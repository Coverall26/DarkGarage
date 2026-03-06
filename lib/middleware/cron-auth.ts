/**
 * Cron Authentication Module
 *
 * Standalone cron secret verification usable from both edge middleware
 * and individual route handlers (defense in depth).
 *
 * Edge-compatible: No Prisma, no Node.js-only imports.
 */

import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Timing-safe comparison
// ---------------------------------------------------------------------------

/**
 * Constant-time string comparison to prevent timing attacks.
 * Falls back to simple comparison if crypto.subtle is unavailable.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  // Use bitwise XOR for constant-time comparison (no short-circuit)
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Verify that the request contains a valid CRON_SECRET bearer token.
 *
 * Checks the Authorization header for "Bearer <CRON_SECRET>".
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @returns true if the secret is valid, false otherwise
 */
export function verifyCronSecret(request: Request | { headers: Headers }): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // If CRON_SECRET is not configured, deny all cron requests
    return false;
  }

  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix
  return timingSafeEqual(token, cronSecret);
}

/**
 * Require valid cron authentication on a request.
 *
 * Returns null if authorized (pass through), or a 401 NextResponse if not.
 *
 * Usage in edge middleware (edge-auth.ts):
 *   const response = requireCronAuth(req);
 *   if (response) return response; // 401
 *
 * Usage in route handlers (defense in depth):
 *   const response = requireCronAuth(req);
 *   if (response) return response; // 401
 */
export function requireCronAuth(request: Request | { headers: Headers }): NextResponse | null {
  if (verifyCronSecret(request)) {
    return null; // Authorized — pass through
  }

  return NextResponse.json(
    { error: "Unauthorized: Invalid CRON_SECRET" },
    { status: 401 }
  );
}
