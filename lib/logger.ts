/**
 * Structured Logger for FundRoom AI
 *
 * Production-grade JSON structured logging with context-aware
 * log levels, module/function tagging, and child logger support.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("message", { module: "auth", metadata: { userId } });
 *
 *   // Create child logger with pre-set context
 *   const log = logger.child({ module: "wire-transfer" });
 *   log.info("Wire confirmed", { amount: 50000 });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  module?: string;
  function?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  module?: string;
  function?: string;
  metadata?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env && env in LOG_LEVELS) return env as LogLevel;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getMinLevel()];
}

function formatEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error,
): string {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  if (context?.module) entry.module = context.module;
  if (context?.function) entry.function = context.function;

  // Collect metadata from context (excluding reserved keys)
  const reserved = new Set(["module", "function", "metadata"]);
  const extra: Record<string, unknown> = {};
  if (context) {
    for (const [key, val] of Object.entries(context)) {
      if (!reserved.has(key) && val !== undefined) {
        extra[key] = val;
      }
    }
  }

  const merged = { ...extra, ...context?.metadata };
  if (Object.keys(merged).length > 0) {
    entry.metadata = merged;
  }

  if (error) {
    entry.error = {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  // Production: JSON, Development: human-readable
  if (process.env.NODE_ENV === "production") {
    return JSON.stringify(entry);
  }

  const prefix = `[${level.toUpperCase()}]`;
  const mod = entry.module ? ` [${entry.module}]` : "";
  const fn = entry.function ? `.${entry.function}` : "";
  const meta =
    entry.metadata && Object.keys(entry.metadata).length > 0
      ? ` ${JSON.stringify(entry.metadata)}`
      : "";
  const errStr = entry.error ? ` Error: ${entry.error.message}` : "";
  return `${prefix}${mod}${fn} ${message}${meta}${errStr}`;
}

function createLogger(baseContext?: LogContext) {
  const log = (level: LogLevel, message: string, context?: LogContext, error?: Error) => {
    if (!shouldLog(level)) return;

    const mergedContext = { ...baseContext, ...context };
    const formatted = formatEntry(level, message, mergedContext, error);

    switch (level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.info(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
    }
  };

  return {
    debug: (message: string, context?: LogContext) => log("debug", message, context),
    info: (message: string, context?: LogContext) => log("info", message, context),
    warn: (message: string, context?: LogContext) => log("warn", message, context),
    error: (message: string, contextOrError?: LogContext | Error, error?: Error) => {
      if (contextOrError instanceof Error) {
        log("error", message, undefined, contextOrError);
      } else {
        log("error", message, contextOrError, error);
      }
    },
    child: (childContext: LogContext) =>
      createLogger({ ...baseContext, ...childContext }),
  };
}

export const logger = createLogger();
export type Logger = ReturnType<typeof createLogger>;
