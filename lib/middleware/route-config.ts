/**
 * Route Classification — Single Source of Truth
 *
 * Centralizes route-level auth requirements for the edge middleware layer.
 * Used by edge-auth.ts to decide what protection each /api/* route needs.
 *
 * Edge-compatible: No Prisma, no Node.js-only imports.
 *
 * Classification hierarchy (evaluated in order):
 *   PUBLIC    → No auth needed (auth endpoints, webhooks, health)
 *   CRON      → Requires CRON_SECRET bearer token
 *   ADMIN     → Requires valid session + non-LP role
 *   TEAM_SCOPED → Requires valid session (team checks done in handlers)
 *   AUTHENTICATED → Requires valid session (user-level)
 *   (default) → Falls back to AUTHENTICATED for any unmatched /api/* route
 */

// ---------------------------------------------------------------------------
// Route categories
// ---------------------------------------------------------------------------

export enum RouteCategory {
  /** No authentication required */
  PUBLIC = "PUBLIC",
  /** Requires CRON_SECRET in Authorization header */
  CRON = "CRON",
  /** Requires valid session (user-level, no specific team) */
  AUTHENTICATED = "AUTHENTICATED",
  /** Requires valid session + team membership (verified in handler) */
  TEAM_SCOPED = "TEAM_SCOPED",
  /** Requires valid session + admin/owner/super_admin role */
  ADMIN = "ADMIN",
}

// ---------------------------------------------------------------------------
// Path arrays — exported for testing and documentation
// ---------------------------------------------------------------------------

/**
 * PUBLIC: Auth endpoints, webhooks (signature-verified), health checks,
 * public marketplace, tracking pixels, open graph, public views.
 */
export const PUBLIC_PATHS = [
  // Auth — must be accessible without session
  "/api/auth/",

  // Webhooks — use their own signature verification (HMAC, Stripe sig, etc.)
  "/api/webhooks/",

  // Health checks
  "/api/health",

  // Public marketplace
  "/api/marketplace/public/",

  // Tracking / analytics — fire-and-forget, no PII
  "/api/record_click",
  "/api/record_view",
  "/api/record_video_view",
  "/api/tracking/",

  // Open Graph image generation
  "/api/og/",

  // CSP violation reports (browser-sent, no auth possible)
  "/api/csp-report",

  // Stripe webhook (separate from /api/webhooks/ — signature-verified)
  "/api/stripe/webhook",

  // Public view / link access (token-based, not session-based)
  "/api/views",
  "/api/views-dataroom",
  "/api/view/",

  // Feature flags (public read)
  "/api/feature-flags",

  // Branding (public for LP portal theming)
  "/api/branding/",

  // Help endpoint
  "/api/help/",

  // Marketplace waitlist (public signup)
  "/api/marketplace/waitlist",

  // Unsubscribe (token-based)
  "/api/unsubscribe",

  // Outreach public sub-routes (loaded by email clients / linked from emails)
  // Must be listed BEFORE /api/outreach/ in TEAM_SCOPED to match first.
  "/api/outreach/unsubscribe",
  "/api/outreach/track/",

  // Internal job endpoints — use INTERNAL_API_KEY bearer token auth in handlers.
  // NOT in CRON_PATHS because they use a different secret than CRON_SECRET.
  "/api/jobs/",

  // Internal billing auto-unpause (EE feature, uses INTERNAL_API_KEY)
  "/api/internal/",
];

/**
 * CRON: Scheduled jobs — require CRON_SECRET bearer token.
 * Note: /api/jobs/ uses INTERNAL_API_KEY (not CRON_SECRET) in route handlers,
 * so it is NOT included here. Job routes are in PUBLIC_PATHS because their
 * own INTERNAL_API_KEY auth provides the security layer.
 */
export const CRON_PATHS = [
  "/api/cron/",
];

/**
 * ADMIN: Admin dashboard, settings, investor management, reports.
 * Requires session + non-LP role (ADMIN/OWNER/SUPER_ADMIN/MANAGER).
 *
 * Note: Some admin API paths have their own exempt list in admin-auth.ts
 * (health checks, rollbar webhook). Those are handled there, not here.
 */
export const ADMIN_PATHS = [
  "/api/admin/",
];

/**
 * TEAM_SCOPED: Routes that require session + team membership.
 * Team membership verification is done in handlers via RBAC middleware,
 * but edge layer ensures a valid session exists.
 */
export const TEAM_SCOPED_PATHS = [
  "/api/teams/",
  "/api/billing/",
  "/api/funds/",
  "/api/setup/",
  "/api/outreach/",
  "/api/contacts/",
  "/api/ai/",
  "/api/tier",
];

/**
 * AUTHENTICATED: Requires a valid session but no specific team.
 * LP endpoints, user settings, e-signature, notifications, etc.
 */
export const AUTHENTICATED_PATHS = [
  "/api/esign/",
  "/api/lp/",
  "/api/user/",
  "/api/notifications/",
  "/api/investor-profile/",
  "/api/account/",
  "/api/sse/",
  "/api/sign/",
  "/api/signatures/",
  "/api/documents/",
  "/api/subscriptions/",
  "/api/transactions/",
  "/api/approvals/",
  "/api/offering/",
  "/api/links/",
  "/api/passkeys/",
  "/api/conversations/",
  "/api/feedback/",
  "/api/analytics/",
  "/api/file/",
  "/api/storage/",
  "/api/org/",
  "/api/mupdf/",
  "/api/signature/",
];

// ---------------------------------------------------------------------------
// Classification function
// ---------------------------------------------------------------------------

/**
 * Classify an API route pathname into an auth category.
 *
 * Uses simple startsWith matching for edge-runtime performance.
 * Evaluation order: PUBLIC → CRON → ADMIN → TEAM_SCOPED → AUTHENTICATED → default.
 *
 * @param pathname - The request pathname (e.g. "/api/teams/123/funds")
 * @returns The RouteCategory determining what auth is required
 */
export function classifyRoute(pathname: string): RouteCategory {
  // PUBLIC — no auth needed
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p))) {
    return RouteCategory.PUBLIC;
  }

  // CRON — requires CRON_SECRET
  if (CRON_PATHS.some((p) => pathname === p || pathname.startsWith(p))) {
    return RouteCategory.CRON;
  }

  // ADMIN — requires session + admin role
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    return RouteCategory.ADMIN;
  }

  // TEAM_SCOPED — requires session (team checks done in handlers)
  if (TEAM_SCOPED_PATHS.some((p) => pathname.startsWith(p))) {
    return RouteCategory.TEAM_SCOPED;
  }

  // AUTHENTICATED — requires session
  if (AUTHENTICATED_PATHS.some((p) => pathname.startsWith(p))) {
    return RouteCategory.AUTHENTICATED;
  }

  // Fail-safe: any /api/* path not matching a category → AUTHENTICATED
  if (pathname.startsWith("/api/")) {
    return RouteCategory.AUTHENTICATED;
  }

  // Non-API paths should not reach this function, but treat as PUBLIC
  return RouteCategory.PUBLIC;
}
