import { logger as structuredLogger } from "@/lib/logger";

const jobLogger = structuredLogger.child({ module: "jobs" });

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    jobLogger.info(message, meta);
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    jobLogger.error(message, meta);
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    jobLogger.warn(message, meta);
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    jobLogger.debug(message, meta);
  },
};
