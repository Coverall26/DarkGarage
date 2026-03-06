import { getBackupPrismaClient } from "./backup-client";
import { logger } from "@/lib/logger";

type BackupOperation = {
  model: string;
  operation: "upsert" | "delete" | "deleteMany" | "createMany" | "updateMany";
  args: any;
  retries: number;
  timestamp: number;
};

const MAX_QUEUE_SIZE = 1000;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [100, 500, 2000];

const modelQueues = new Map<string, BackupOperation[]>();
const processingModels = new Set<string>();

export function enqueueBackup(
  model: string,
  operation: BackupOperation["operation"],
  args: any,
  entityId?: string,
): void {
  const queueKey = entityId ? `${model}:${entityId}` : model;

  if (!modelQueues.has(queueKey)) {
    modelQueues.set(queueKey, []);
  }

  const queue = modelQueues.get(queueKey)!;

  if (queue.length >= MAX_QUEUE_SIZE) {
    const dropped = queue.shift();
    logger.warn("Backup queue full, dropping oldest operation", { module: "backup-queue", queueKey, droppedOperation: dropped?.operation });
  }

  queue.push({
    model,
    operation,
    args,
    retries: 0,
    timestamp: Date.now(),
  });

  if (!processingModels.has(queueKey)) {
    processQueue(queueKey);
  }
}

async function processQueue(queueKey: string): Promise<void> {
  processingModels.add(queueKey);

  try {
    const queue = modelQueues.get(queueKey);
    if (!queue) return;

    while (queue.length > 0) {
      const op = queue[0];
      const success = await executeBackupOp(op);

      if (success) {
        queue.shift();
      } else if (op.retries < MAX_RETRIES) {
        op.retries++;
        const delay = RETRY_DELAYS[op.retries - 1] || 2000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logger.error(`Backup operation failed after ${MAX_RETRIES} retries`, { module: "backup-queue", model: op.model, operation: op.operation, args: JSON.stringify(op.args).substring(0, 200) });
        queue.shift();
      }
    }

    modelQueues.delete(queueKey);
  } finally {
    processingModels.delete(queueKey);
  }
}

async function executeBackupOp(op: BackupOperation): Promise<boolean> {
  try {
    const backup = getBackupPrismaClient();
    if (!backup) return true;

    const modelName =
      op.model.charAt(0).toLowerCase() + op.model.slice(1);
    // Prisma extension dynamic model — access model delegate by name at runtime
    const modelClient = (backup as any)[modelName];
    if (!modelClient) {
      logger.warn("Model not found on backup client", { module: "backup-queue", model: op.model });
      return true;
    }

    await modelClient[op.operation](op.args);
    return true;
  } catch (error) {
    if (op.retries >= MAX_RETRIES - 1) {
      logger.error("Backup operation error", { module: "backup-queue", model: op.model, operation: op.operation, error: error instanceof Error ? error.message : String(error) });
    }
    return false;
  }
}
