import { Prisma } from "@prisma/client";

import { isBackupEnabled } from "../backup-client";
import { enqueueBackup } from "../backup-queue";

/** Prisma model result with an id field — all audited/replicated models have string id */
type PrismaModelResult = { id: string; [key: string]: unknown };

/**
 * Strips Prisma relation fields from a result object, leaving only scalar fields
 * suitable for create/update data. Relations (objects with .id, arrays) would
 * cause errors if passed as data to Prisma.
 */
function stripRelations(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== "object") return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = value;
      continue;
    }
    if (value instanceof Date) {
      result[key] = value;
      continue;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      // Skip relation objects (they have an "id" property)
      if ("id" in (value as object)) continue;
      // Keep JSON/jsonb fields (plain objects without "id")
      result[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      // Arrays are always relation fields in Prisma results — skip
      continue;
    }
    result[key] = value;
  }
  return result;
}

/**
 * Enqueue an upsert for a single record using its result data from the primary DB.
 * Uses stripRelations to ensure only scalar fields are included.
 */
function replicateResult(model: string, result: unknown): void {
  if (!result || typeof result !== "object") return;
  const record = result as PrismaModelResult;
  if (!record.id) return;
  const data = stripRelations(record);
  enqueueBackup(
    model,
    "upsert",
    {
      where: { id: record.id },
      create: data,
      update: data,
    },
    record.id,
  );
}

export const backupWriteExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    name: "backup-write",
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const result = await query(args);
          if (isBackupEnabled()) {
            replicateResult(model, result);
          }
          return result;
        },

        async update({ model, args, query }) {
          const result = await query(args);
          if (isBackupEnabled()) {
            replicateResult(model, result);
          }
          return result;
        },

        async upsert({ model, args, query }) {
          const result = await query(args);
          if (isBackupEnabled()) {
            replicateResult(model, result);
          }
          return result;
        },

        async delete({ model, args, query }) {
          const result = await query(args);
          const record = result as PrismaModelResult | null;
          if (isBackupEnabled() && record?.id) {
            enqueueBackup(
              model,
              "delete",
              { where: { id: record.id } },
              record.id,
            );
          }
          return result;
        },

        async createMany({ model, args, query }) {
          const result = await query(args);
          if (!isBackupEnabled() || !args?.data) return result;

          // createMany doesn't return records. Replicate using input data.
          // Items with explicit IDs are upserted individually.
          // Items without IDs can't be replicated (IDs are generated server-side).
          const items = Array.isArray(args.data) ? args.data : [args.data];
          for (const item of items) {
            const record = item as Record<string, unknown>;
            if ("id" in record && record.id) {
              const id = record.id as string;
              enqueueBackup(
                model,
                "upsert",
                {
                  where: { id },
                  create: item,
                  update: item,
                },
                id,
              );
            }
          }
          return result;
        },

        async updateMany({ model, args, query }) {
          const result = await query(args);
          if (!isBackupEnabled() || !args?.where || !args?.data) return result;

          // updateMany doesn't return records. Replay the same updateMany
          // on backup with the same where clause and data.
          enqueueBackup(model, "updateMany", {
            where: args.where,
            data: args.data,
          });
          return result;
        },

        async deleteMany({ model, args, query }) {
          const result = await query(args);
          if (isBackupEnabled() && args?.where) {
            enqueueBackup(model, "deleteMany", { where: args.where });
          }
          return result;
        },
      },
    },
  });
});
