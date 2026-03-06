import type { Readable } from "stream";
import type {
  StorageProvider,
  StorageConfig,
  StorageUploadOptions,
  StorageDownloadOptions,
  StorageSignedUrlOptions,
  StorageListOptions,
  StorageListResult,
  StorageObjectInfo,
} from "./types";
import { ReplitStorageProvider } from "./replit-provider";
import { VercelBlobProvider } from "./vercel-provider";
import { logger } from "@/lib/logger";

export class DualStorageProvider implements StorageProvider {
  readonly type = "dual" as const;
  private readonly primary: StorageProvider;
  private readonly secondary: StorageProvider;
  private readonly syncEnabled: boolean;

  constructor(config: StorageConfig) {
    if (!config.encryptionKey) {
      throw new Error(
        "[DUAL-STORAGE] Encryption key required for dual storage mode. " +
        "Vercel Blob uses public URLs, so data MUST be encrypted. " +
        "Set STORAGE_ENCRYPTION_KEY environment variable."
      );
    }
    
    this.primary = new ReplitStorageProvider(config);
    this.secondary = new VercelBlobProvider(config);
    this.syncEnabled = process.env.STORAGE_DUAL_SYNC !== "false";
    
    if (process.env.DEBUG === "true") logger.debug("Initialized with Replit (primary) + Vercel (secondary)", { module: "dual-storage", sync: this.syncEnabled });
    if (process.env.DEBUG === "true") logger.debug("All data is encrypted server-side before upload to both providers", { module: "dual-storage" });
  }

  async put(
    key: string,
    data: Buffer | Uint8Array | string,
    options?: StorageUploadOptions
  ): Promise<{ key: string; hash: string }> {
    const primaryResult = await this.primary.put(key, data, options);
    
    if (this.syncEnabled) {
      this.syncToSecondary("put", key, data, options).catch(err => {
        logger.error("Secondary sync failed for put", { module: "dual-storage", key, error: String(err) });
      });
    }
    
    return primaryResult;
  }

  async putStream(
    key: string,
    stream: Readable,
    options?: StorageUploadOptions
  ): Promise<{ key: string; hash: string }> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const data = Buffer.concat(chunks);
    return this.put(key, data, options);
  }

  async get(
    key: string,
    options?: StorageDownloadOptions
  ): Promise<Buffer | null> {
    try {
      const data = await this.primary.get(key, options);
      if (data) return data;
    } catch (error) {
      logger.warn("Primary get failed, trying secondary", { module: "dual-storage", error: String(error) });
    }

    try {
      const data = await this.secondary.get(key, options);
      if (data) {
        if (process.env.DEBUG === "true") logger.debug("Fetched from secondary (Vercel)", { module: "dual-storage", key });
        return data;
      }
    } catch (error) {
      logger.error("Secondary get also failed", { module: "dual-storage", error: String(error) });
    }

    return null;
  }

  async getStream(
    key: string,
    options?: StorageDownloadOptions
  ): Promise<Readable | null> {
    const data = await this.get(key, options);
    if (!data) return null;

    const { Readable: ReadableStream } = await import("stream");
    return ReadableStream.from([data]);
  }

  async delete(key: string): Promise<boolean> {
    const results = await Promise.allSettled([
      this.primary.delete(key),
      this.secondary.delete(key),
    ]);

    const primarySuccess = results[0].status === "fulfilled" && results[0].value;
    const secondarySuccess = results[1].status === "fulfilled" && results[1].value;

    if (results[0].status === "rejected") {
      logger.error("Primary delete failed", { module: "dual-storage", error: String(results[0].reason) });
    }
    if (results[1].status === "rejected") {
      logger.error("Secondary delete failed", { module: "dual-storage", error: String(results[1].reason) });
    }

    return primarySuccess || secondarySuccess;
  }

  async exists(key: string): Promise<boolean> {
    const primaryExists = await this.primary.exists(key);
    if (primaryExists) return true;
    
    return await this.secondary.exists(key);
  }

  async list(options?: StorageListOptions): Promise<StorageListResult> {
    try {
      return await this.primary.list(options);
    } catch (error) {
      logger.warn("Primary list failed, trying secondary", { module: "dual-storage", error: String(error) });
      return await this.secondary.list(options);
    }
  }

  async getInfo(key: string): Promise<StorageObjectInfo | null> {
    const primaryInfo = await this.primary.getInfo(key);
    if (primaryInfo) return primaryInfo;
    
    return await this.secondary.getInfo(key);
  }

  async getSignedUrl(
    key: string,
    options?: StorageSignedUrlOptions
  ): Promise<string> {
    try {
      return await this.primary.getSignedUrl(key, options);
    } catch (error) {
      logger.warn("Primary getSignedUrl failed, trying secondary", { module: "dual-storage", error: String(error) });
      return await this.secondary.getSignedUrl(key, options);
    }
  }

  async copy(sourceKey: string, destKey: string): Promise<boolean> {
    const primaryResult = await this.primary.copy(sourceKey, destKey);
    
    if (this.syncEnabled) {
      this.secondary.copy(sourceKey, destKey).catch(err => {
        logger.error("Secondary copy failed", { module: "dual-storage", error: String(err) });
      });
    }
    
    return primaryResult;
  }

  private async syncToSecondary(
    operation: "put",
    key: string,
    data: Buffer | Uint8Array | string,
    options?: StorageUploadOptions
  ): Promise<void> {
    await this.secondary.put(key, data, options);
    if (process.env.DEBUG === "true") logger.debug("Synced to secondary", { module: "dual-storage", key });
  }

  async syncAllToSecondary(): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;
    let continuationToken: string | undefined;

    do {
      const listResult = await this.primary.list({ 
        maxKeys: 100,
        continuationToken,
      });

      for (const key of listResult.keys) {
        try {
          const exists = await this.secondary.exists(key);
          if (!exists) {
            const data = await this.primary.get(key, { decrypt: false });
            if (data) {
              await this.secondary.put(key, data, { encrypt: false });
              synced++;
              if (process.env.DEBUG === "true") logger.debug("Synced", { module: "dual-storage", key });
            }
          }
        } catch (error) {
          failed++;
          logger.error("Failed to sync", { module: "dual-storage", key, error: String(error) });
        }
      }

      continuationToken = listResult.nextContinuationToken;
    } while (continuationToken);

    return { synced, failed };
  }
}
