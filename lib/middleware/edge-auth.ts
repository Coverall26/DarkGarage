/**
 * Edge Auth Middleware — General-Purpose Session Enforcement
 *
 * Validates JWT sessions at the edge for ALL /api/* routes based on
 * route classification from route-config.ts. Replaces the admin-only
 * scope of admin-auth.ts with comprehensive coverage.
 *
 * What this middleware does:
 *   1. Classifies the route (PUBLIC / CRON / AUTHENTICATED / TEAM_SCOPED / ADMIN)
 *   2. PUBLIC → pass through (no auth check)
 *   3. CRON → verify CRON_SECRET bearer token
 *   4. AUTHENTICATED / TEAM_SCOPED → verify JWT session exists
 *   5. ADMIN → verify JWT session + non-LP role (delegates to admin-auth.ts)
 *   6. Injects user context headers (x-middleware-user-*) for authenticated routes
 *
 * What this middleware does NOT do:
 *   - Team membership checks (requires Prisma, done in route handlers)
 *   - org_id scoping (requires Prisma, done in route handlers via RBAC)
 *   - Per-route rate limiting (handled by individual route handlers)
 *
 * Edge Compatibility:
 *   Uses next-auth/jwt `getToken()` which works in Edge Runtime.
 *   Does NOT import Prisma or any Node.js-only modules.
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken, JWT } from "next-auth/jwt";

import { SESSION_COOKIE_NAME } from "@/lib/constants/auth-cookies";
import { classifyRoute, RouteCategory } from "./route-config";
import { requireCronAuth } from "./cron-auth";
import { enforceAdminAuth, applyAdminAuthHeaders } from "./admin-auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EdgeAuthResult {
  /** Whether the request should be blocked */
  blocked: boolean;
  /** The blocking response (only set if blocked=true) */
  response?: NextResponse;
  /** User ID from JWT (only set if authenticated) */
  userId?: string;
  /** User email from JWT (only set if authenticated) */
  userEmail?: string;
  /** User role from JWT (only set if authenticated) */
  userRole?: string;
  /** The route category determined by classification */
  category: RouteCategory;
}

// ---------------------------------------------------------------------------
// JWT Token Retrieval (cached per request)
// ---------------------------------------------------------------------------

async function getJWTToken(req: NextRequest): Promise<JWT | null> {
  try {
    return await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: SESSION_COOKIE_NAME,
    });
  } catch {
    // Token decode failure — treat as unauthenticated
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main middleware function
// ---------------------------------------------------------------------------

/**
 * Enforce edge-level authentication for all /api/* routes.
 *
 * Returns an EdgeAuthResult:
 *   - blocked=true + response: Return the response immediately (401/403)
 *   - blocked=false: Request is authorized, proceed to route handler
 *
 * Usage in proxy.ts:
 *   const authResult = await enforceEdgeAuth(req);
 *   if (authResult.blocked && authResult.response) return authResult.response;
 *   // Apply auth headers and continue
 */
export async function enforceEdgeAuth(
  req: NextRequest
): Promise<EdgeAuthResult> {
  const pathname = req.nextUrl.pathname;
  const category = classifyRoute(pathname);

  // ----- PUBLIC: No auth needed -----
  if (category === RouteCategory.PUBLIC) {
    return { blocked: false, category };
  }

  // ----- CRON: Verify CRON_SECRET bearer token -----
  if (category === RouteCategory.CRON) {
    const cronResponse = requireCronAuth(req);
    if (cronResponse) {
      return { blocked: true, response: cronResponse, category };
    }
    return { blocked: false, category };
  }

  // ----- ADMIN: Delegate to existing admin-auth.ts (JWT + role check) -----
  if (category === RouteCategory.ADMIN) {
    const adminResult = await enforceAdminAuth(req);
    return {
      blocked: adminResult.blocked,
      response: adminResult.response,
      userId: adminResult.userId,
      userEmail: adminResult.userEmail,
      userRole: adminResult.userRole,
      category,
    };
  }

  // ----- AUTHENTICATED & TEAM_SCOPED: Verify JWT session exists -----
  const token = await getJWTToken(req);

  if (!token?.email) {
    return {
      blocked: true,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
      category,
    };
  }

  // Extract user context from JWT
  const userId = (token.sub as string) || (token.id as string) || "";
  const userEmail = token.email as string;
  const userRole = (token.role as string) || "MEMBER";

  return {
    blocked: false,
    userId,
    userEmail,
    userRole,
    category,
  };
}

// ---------------------------------------------------------------------------
// Auth header injection
// ---------------------------------------------------------------------------

/**
 * Apply user context headers to a NextResponse for downstream route handlers.
 *
 * These headers are consumed by route handlers for defense-in-depth
 * identity verification. They supplement (not replace) the route-level
 * getServerSession() calls.
 *
 * For ADMIN routes, delegates to applyAdminAuthHeaders for consistency.
 */
export function applyEdgeAuthHeaders(
  response: NextResponse,
  authResult: EdgeAuthResult
): NextResponse {
  // For ADMIN routes, use the existing admin-auth header function
  if (authResult.category === RouteCategory.ADMIN) {
    return applyAdminAuthHeaders(response, {
      blocked: authResult.blocked,
      userId: authResult.userId,
      userEmail: authResult.userEmail,
      userRole: authResult.userRole,
    });
  }

  // For all other authenticated routes, set the same headers
  if (authResult.userId) {
    response.headers.set("x-middleware-user-id", authResult.userId);
  }
  if (authResult.userEmail) {
    response.headers.set("x-middleware-user-email", authResult.userEmail);
  }
  if (authResult.userRole) {
    response.headers.set("x-middleware-user-role", authResult.userRole);
  }

  return response;
}
