/**
 * Centralized feature flag resolution.
 *
 * All environment-driven feature toggles live here.  Importing a flag
 * from this module (instead of reading `process.env.*` inline) gives
 * us a single place to audit, rename, or migrate flags to a runtime
 * provider (LaunchDarkly, Vercel Edge Config, PlatformSettings DB row,
 * etc.) without touching call-sites.
 *
 * Flags are functions (not constants) so that `process.env` is read at
 * call time — this keeps tests that mutate `process.env` working.
 *
 * Usage:
 *   import { isPaywallBypassed } from "@/lib/feature-flags";
 *   if (isPaywallBypassed()) { ... }
 */

// ─── Feature flag functions ─────────────────────────────────────────

/**
 * Skip all paywall / FundroomActivation checks.
 * Intended for MVP launch before Stripe billing is live.
 * Set `PAYWALL_BYPASS=true` in the environment to enable.
 *
 * ⚠️  Must be removed or set to "false" once CRM billing is
 *     handling subscription lifecycle in production.
 */
export function isPaywallBypassed(): boolean {
  return process.env.PAYWALL_BYPASS === "true";
}

/**
 * Enable verbose authentication debug logging.
 * Only enable in development — never in production.
 */
export function isAuthDebugEnabled(): boolean {
  return process.env.AUTH_DEBUG === "true";
}

/**
 * Enable the optional backup database (dual-write).
 * Requires `BACKUP_DATABASE_URL` to be set.
 */
export function isBackupDbEnabled(): boolean {
  return process.env.BACKUP_DB_ENABLED === "true";
}

/**
 * Enable Plaid bank integrations (Phase 2).
 * Requires `PLAID_CLIENT_ID` and `PLAID_SECRET`.
 */
export function isPlaidFlagEnabled(): boolean {
  return (
    process.env.PLAID_ENABLED === "true" &&
    !!process.env.PLAID_CLIENT_ID &&
    !!process.env.PLAID_SECRET
  );
}
