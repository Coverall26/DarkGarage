import { z } from "zod";
import { reportError } from "./error";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Critical environment variable validation
// Validates at first import (server startup). Missing critical vars will
// log errors and set a global flag — the health endpoint returns 503 when
// validation fails, and the deployment-readiness endpoint already checks
// individual vars in detail.
// ---------------------------------------------------------------------------

const criticalEnvSchema = z.object({
  // Auth (required — app won't work without these)
  NEXTAUTH_SECRET: z
    .string()
    .min(32, "NEXTAUTH_SECRET must be at least 32 characters"),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL"),

  // Database (at least one required)
  DATABASE_URL: z.string().optional(),
  SUPABASE_DATABASE_URL: z.string().optional(),
});

const importantEnvSchema = z.object({
  // Email (important but app can start without)
  RESEND_API_KEY: z.string().optional(),

  // Storage
  STORAGE_PROVIDER: z.string().optional(),
  STORAGE_ENCRYPTION_KEY: z.string().optional(),

  // Google OAuth (optional, dual credential system)
  FUNDROOM_GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),

  // Monitoring (optional)
  ROLLBAR_SERVER_TOKEN: z.string().optional(),

  // Redis / Rate limiting
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

let _cached: EnvValidationResult | null = null;

/**
 * Validate critical and important environment variables.
 * Results are cached after first call.
 */
export function validateEnv(): EnvValidationResult {
  if (_cached) return _cached;

  const errors: string[] = [];
  const warnings: string[] = [];

  // Critical validation
  const criticalResult = criticalEnvSchema.safeParse(process.env);
  if (!criticalResult.success) {
    for (const issue of criticalResult.error.issues) {
      errors.push(`${issue.path.join(".")}: ${issue.message}`);
    }
  }

  // Database: at least one must be set
  if (!process.env.SUPABASE_DATABASE_URL && !process.env.DATABASE_URL) {
    errors.push(
      "DATABASE_URL or SUPABASE_DATABASE_URL: At least one database URL is required",
    );
  }

  // Important validation (warnings only)
  const importantResult = importantEnvSchema.safeParse(process.env);
  if (!importantResult.success) {
    for (const issue of importantResult.error.issues) {
      warnings.push(`${issue.path.join(".")}: ${issue.message}`);
    }
  }

  // Warn about missing important vars
  if (!process.env.RESEND_API_KEY) {
    warnings.push(
      "RESEND_API_KEY: Not set — email notifications will be disabled",
    );
  }
  if (!process.env.STORAGE_ENCRYPTION_KEY) {
    warnings.push(
      "STORAGE_ENCRYPTION_KEY: Not set — document encryption will fail",
    );
  }
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    warnings.push(
      "UPSTASH_REDIS_REST_URL: Not set — rate limiting will use in-memory fallback",
    );
  }
  if (
    !process.env.FUNDROOM_GOOGLE_CLIENT_ID &&
    !process.env.GOOGLE_CLIENT_ID
  ) {
    warnings.push(
      "GOOGLE_CLIENT_ID: Not set — Google OAuth login will be unavailable",
    );
  }

  _cached = {
    valid: errors.length === 0,
    errors,
    warnings,
  };

  // Log results on first validation
  if (errors.length > 0) {
    const msg = `Critical env var errors:\n${errors.map((e) => `  - ${e}`).join("\n")}`;
    logger.error(msg, { module: "env", errors });
    try {
      reportError(new Error(msg));
    } catch {
      // reportError itself may fail if Rollbar isn't configured
    }
  }
  if (warnings.length > 0) {
    logger.warn(`Env var warnings:\n${warnings.map((w) => `  - ${w}`).join("\n")}`, { module: "env", warnings });
  }

  return _cached;
}

/**
 * Returns true if all critical env vars are properly set.
 */
export function isEnvValid(): boolean {
  return validateEnv().valid;
}

/**
 * Reset cached validation (for testing).
 */
export function resetEnvValidation(): void {
  _cached = null;
}
