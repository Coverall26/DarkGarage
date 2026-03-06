import { Prisma } from "@prisma/client";
import { AsyncLocalStorage } from "async_hooks";
import { logger } from "@/lib/logger";

const AUDITED_MODELS = [
  "Document",
  "Dataroom",
  "Team",
  "Viewer",
  "Link",
  "SignatureDocument",
  "Investor",
  "Transaction",
  "Fund",
] as const;

type AuditedModel = (typeof AUDITED_MODELS)[number];

function isAuditedModel(model: string): model is AuditedModel {
  return AUDITED_MODELS.includes(model as AuditedModel);
}

type AuditContext = {
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  teamId?: string;
};

/** Prisma model result with an id field — all audited models have string id */
type PrismaModelResult = { id: string; [key: string]: unknown };

const auditContextStorage = new AsyncLocalStorage<AuditContext>();

export function runWithAuditContext<T>(context: AuditContext, fn: () => T): T {
  return auditContextStorage.run(context, fn);
}

export function getAuditContext(): AuditContext {
  return auditContextStorage.getStore() || {};
}

async function createAuditLog(
  prismaClient: unknown,
  action: "CREATE" | "UPDATE" | "DELETE",
  model: string,
  resourceId: string,
  oldData: Record<string, unknown> | null,
  newData: unknown
) {
  try {
    const context = getAuditContext();
    
    const auditEntry = {
      userId: context.userId || null,
      teamId: context.teamId || null,
      eventType: `${model.toUpperCase()}_${action}`,
      resourceType: model.toUpperCase(),
      resourceId,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
      metadata: {
        action,
        model,
        timestamp: new Date().toISOString(),
        userEmail: context.userEmail,
        changes: action === "UPDATE" ? computeChanges(oldData, newData as Record<string, unknown>) : null,
        previousData: action === "DELETE" ? sanitizeForAudit(oldData) : null,
      },
    };

    if (context.userId || context.teamId) {
      const { PrismaClient } = require("@prisma/client");
      const rawClient = new PrismaClient();
      try {
        await rawClient.auditLog.create({
          data: auditEntry,
        });
      } finally {
        await rawClient.$disconnect();
      }
    }
  } catch (error) {
    logger.error("[AUDIT] Failed to create audit log", { module: "audit-log", error: String(error) });
  }
}

function sanitizeForAudit(data: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!data) return null;
  
  const SENSITIVE_FIELDS = ["password", "secret", "token", "key", "accessToken"];
  const sanitized = { ...data };
  
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = "[REDACTED]";
    }
  }
  
  return sanitized;
}

function computeChanges(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): Record<string, { from: unknown; to: unknown }> | null {
  if (!oldData || !newData) return null;
  
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  
  const IGNORED_FIELDS = ["updatedAt", "createdAt", "password", "secret", "token", "key"];
  
  for (const key of allKeys) {
    if (IGNORED_FIELDS.includes(key)) continue;
    
    const oldValue = oldData[key];
    const newValue = newData[key];
    
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes[key] = { from: oldValue, to: newValue };
    }
  }
  
  return Object.keys(changes).length > 0 ? changes : null;
}

export const auditLogExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    name: "audit-log",
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const result = await query(args);
          
          const record = result as PrismaModelResult | null;
          if (isAuditedModel(model) && record?.id) {
            setImmediate(() => {
              createAuditLog(client, "CREATE", model, record.id, null, result);
            });
          }
          
          return result;
        },
        async update({ model, args, query }) {
          if (isAuditedModel(model)) {
            const { PrismaClient } = require("@prisma/client");
            const rawClient = new PrismaClient();
            
            let oldData: Record<string, unknown> | null = null;
            try {
              // Prisma extension dynamic model — access model delegate by name at runtime
              const modelClient = (rawClient as any)[model.charAt(0).toLowerCase() + model.slice(1)];
              if (modelClient) {
                oldData = await modelClient.findUnique({ where: args.where });
              }
            } catch {
            } finally {
              await rawClient.$disconnect();
            }
            
            const result = await query(args);
            
            const record = result as PrismaModelResult | null;
            if (record?.id) {
              setImmediate(() => {
                createAuditLog(client, "UPDATE", model, record.id, oldData, result);
              });
            }
            
            return result;
          }
          
          return query(args);
        },
        async delete({ model, args, query }) {
          if (isAuditedModel(model)) {
            const { PrismaClient } = require("@prisma/client");
            const rawClient = new PrismaClient();
            
            let oldData: PrismaModelResult | null = null;
            try {
              // Prisma extension dynamic model — access model delegate by name at runtime
              const modelClient = (rawClient as any)[model.charAt(0).toLowerCase() + model.slice(1)];
              if (modelClient) {
                oldData = await modelClient.findUnique({ where: args.where });
              }
            } catch {
            } finally {
              await rawClient.$disconnect();
            }
            
            const result = await query(args);
            
            if (oldData?.id) {
              setImmediate(() => {
                createAuditLog(client, "DELETE", model, oldData!.id, oldData, null);
              });
            }
            
            return result;
          }
          
          return query(args);
        },
      },
    },
  });
});
