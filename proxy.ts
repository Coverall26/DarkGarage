/**
 * proxy.ts — FundRoom Edge Middleware (Single Entry Point)
 *
 * IMPORTANT: This file MUST be named `proxy.ts`, NOT `middleware.ts`.
 * Next.js 16.1.6+ auto-detects `proxy.ts` as the middleware entry point.
 * Creating a `middleware.ts` alongside it causes a fatal startup error:
 *   "Both middleware file and proxy file detected."
 * See SESSION_SUMMARY_FEB14_2026.md for the full incident report.
 *
 * This middleware handles ALL incoming requests:
 *   1. API routes (/api/*): Rate limiting → CSRF → Edge Auth → Route handler
 *   2. Admin pages (/admin/*): JWT + role enforcement → AppMiddleware
 *   3. Custom domains: DomainMiddleware routing
 *   4. Public pages: CSP + tracking cookies
 *
 * Pages Router is deprecated — App Router only for all new development.
 */

import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

import { enforceAdminAuth } from "@/lib/middleware/admin-auth";
import { chain, MiddlewareFn } from "@/lib/middleware/chain";
import { enforceEdgeAuth, applyEdgeAuthHeaders } from "@/lib/middleware/edge-auth";
import { RouteCategory } from "@/lib/middleware/route-config";
import { validateCSRFEdge } from "@/lib/security/csrf";
import AppMiddleware from "@/lib/middleware/app";
import { handleCorsPreflightRequest, setCorsHeaders } from "@/lib/middleware/cors";
import { createCSPResponse, wrapResponseWithCSP } from "@/lib/middleware/csp";
import DomainMiddleware from "@/lib/middleware/domain";
import { ratelimit } from "@/lib/redis";

import { BLOCKED_PATHNAMES } from "./lib/constants";
import IncomingWebhookMiddleware, {
  isWebhookPath,
} from "./lib/middleware/incoming-webhooks";
import PostHogMiddleware from "./lib/middleware/posthog";
import { appendTrackingCookies } from "./lib/middleware/tracking";
import { serverInstance } from "./lib/rollbar";

function isAnalyticsPath(path: string): boolean {
  const pattern = /^\/ingest\/.*/;
  return pattern.test(path);
}

function validateHost(host: string | null): boolean {
  if (!host) return false;

  const hostPattern = /^[a-zA-Z0-9][a-zA-Z0-9\-\.]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
  const cleanHost = host.split(':')[0];

  if (cleanHost.length > 253) return false;
  if (!hostPattern.test(cleanHost)) return false;

  return true;
}

function validateClientIP(req: NextRequest): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIP = req.headers.get("x-real-ip");

  const ip = forwardedFor?.split(',')[0]?.trim() || realIP || null;

  if (ip) {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Pattern = /^([a-fA-F0-9:]+)$/;

    if (!ipv4Pattern.test(ip) && !ipv6Pattern.test(ip)) {
      return null;
    }
  }

  return ip;
}

function escapePath(path: string): string {
  return path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizePath(path: string): string {
  let sanitized = path.replace(/\.{2,}/g, '');
  sanitized = sanitized.replace(/\/+/g, '/');
  try {
    sanitized = decodeURIComponent(sanitized).replace(/[<>'"]/g, '');
  } catch {
    sanitized = sanitized.replace(/[<>'"]/g, '');
  }
  return sanitized;
}

function isCustomDomain(host: string): boolean {
  // In development, only .local domains are custom
  if (process.env.NODE_ENV === "development") {
    return host?.includes(".local") || false;
  }

  // Known infrastructure/platform domains are NOT custom domains.
  // Custom domains are tenant-owned (e.g., dataroom.acme.com).
  // Platform subdomains (app.fundroom.ai, app.login.fundroom.ai) ARE treated
  // as custom domains here so DomainMiddleware can handle their routing.
  const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "fundroom.ai";
  const knownNonCustomPatterns = [
    "localhost",
    ".vercel.app",
    ".replit.app",
    ".replit.dev",
    ".repl.co",
  ];

  const cleanHost = host?.split(":")[0] || "";

  // If it's a known infra host (Vercel, Replit, localhost), not custom
  if (knownNonCustomPatterns.some((p) => cleanHost === p || cleanHost.endsWith(p))) {
    return false;
  }

  // The root platform domain itself (fundroom.ai, www.fundroom.ai) is not custom
  if (cleanHost === platformDomain || cleanHost === `www.${platformDomain}`) {
    return false;
  }

  // Platform subdomains (app.fundroom.ai, app.login.fundroom.ai, app.admin.fundroom.ai)
  // are routed through DomainMiddleware for SaaS-specific handling, so treat as
  // "custom" to let DomainMiddleware intercept them.
  if (cleanHost.endsWith(`.${platformDomain}`)) {
    return true;
  }

  // The NEXTAUTH_URL host (current main app host) is NOT a custom domain
  const nextauthHost = process.env.NEXTAUTH_URL
    ? new URL(process.env.NEXTAUTH_URL).hostname
    : "";
  if (nextauthHost && cleanHost === nextauthHost) {
    return false;
  }

  // Everything else is a tenant custom domain
  return true;
}

function createErrorResponse(message: string, status: number): NextResponse {
  return new NextResponse(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// ---------------------------------------------------------------------------
// Blanket API rate limiting — safety net for all /api/ routes
// Per-route limiters (in individual handlers) are tighter and take precedence.
// This catches any route that lacks its own limiter.
// ---------------------------------------------------------------------------
const RATE_LIMIT_EXEMPT_PATHS = [
  "/api/health",
  "/api/webhooks/",
  "/api/stripe/webhook",
  "/api/cron/",
  "/api/jobs/",
];

const blanketLimiter = ratelimit(200, "60 s");

/**
 * API middleware step 1: Blanket rate limiting (200 req/min/IP).
 * Fails open if Redis is unavailable.
 */
const rateLimitMiddleware: MiddlewareFn = async (req) => {
  const path = req.nextUrl.pathname;

  // Skip exempt paths (health checks, webhooks, cron jobs)
  if (RATE_LIMIT_EXEMPT_PATHS.some((exempt) => path === exempt || path.startsWith(exempt))) {
    return null;
  }

  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const key = `rl:blanket:${ip}`;

  try {
    const result = await blanketLimiter.limit(key);

    if (!result.success) {
      const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
      const response = NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(result.limit),
            "X-RateLimit-Remaining": String(result.remaining),
          },
        },
      );
      setCorsHeaders(req, response);
      return response;
    }

    return null; // Allowed
  } catch {
    // Fail open — if Redis is unavailable, allow the request
    return null;
  }
};

/**
 * API middleware step 2: CSRF protection.
 * Validates Origin/Referer on state-changing requests (POST, PUT, PATCH, DELETE).
 * Safe methods (GET, HEAD, OPTIONS) and exempt paths pass through.
 */
const csrfMiddleware: MiddlewareFn = (req) => {
  const csrfResponse = validateCSRFEdge(req);
  if (csrfResponse) {
    const csrfNextResponse = new NextResponse(csrfResponse.body, {
      status: csrfResponse.status,
      headers: csrfResponse.headers,
    });
    setCorsHeaders(req, csrfNextResponse);
    return csrfNextResponse;
  }
  return null;
};

/**
 * API middleware step 3: Edge auth + header injection.
 * Classifies each route (PUBLIC/CRON/AUTHENTICATED/TEAM_SCOPED/ADMIN)
 * and enforces appropriate auth at the edge. On success, injects user
 * context headers and returns the final response with CORS.
 *
 * This is a terminal middleware — it always returns a response (either
 * a 401/403 block or NextResponse.next() with headers).
 */
const authAndFinalizeMiddleware: MiddlewareFn = async (req) => {
  const authResult = await enforceEdgeAuth(req);
  if (authResult.blocked && authResult.response) {
    setCorsHeaders(req, authResult.response);
    return authResult.response;
  }

  // Build the final pass-through response with user context + CORS headers
  const response = NextResponse.next();

  // Generate request ID for tracing
  response.headers.set("x-request-id", crypto.randomUUID());

  // Inject user context headers for authenticated routes
  if (authResult.category !== RouteCategory.PUBLIC && authResult.category !== RouteCategory.CRON) {
    applyEdgeAuthHeaders(response, authResult);
  }
  setCorsHeaders(req, response);
  return response;
};

// ---------------------------------------------------------------------------
// API middleware chain — executed in order for all /api/* routes
// ---------------------------------------------------------------------------
const apiMiddlewares: MiddlewareFn[] = [
  rateLimitMiddleware,
  csrfMiddleware,
  authAndFinalizeMiddleware,
];

export const config = {
  matcher: [
    "/((?!_next/|_static|vendor|_icons|icons/|_vercel|favicon.ico|favicon.png|sitemap.xml|sw.js|sw-version.json|manifest.json|offline).*)",
  ],
};

export default async function proxy(req: NextRequest, ev: NextFetchEvent) {
  try {
    const path = sanitizePath(req.nextUrl.pathname);
    const host = req.headers.get("host");

    if (!validateHost(host)) {
      return createErrorResponse("Invalid host header", 400);
    }

    // ---------------------------------------------------------------
    // API routes — handled by middleware chain
    // ---------------------------------------------------------------
    if (path.startsWith("/api/")) {
      // Handle CORS preflight separately (must return before chain)
      const preflightResponse = handleCorsPreflightRequest(req);
      if (preflightResponse) return preflightResponse;

      return chain(req, apiMiddlewares);
    }

    // ---------------------------------------------------------------
    // Page routes — handled by existing middleware stack
    // ---------------------------------------------------------------

    // Redirect legacy /org-setup to canonical /admin/setup
    if (path === "/org-setup" || path.startsWith("/org-setup/")) {
      return NextResponse.redirect(new URL("/admin/setup", req.url));
    }

    const clientIP = validateClientIP(req);
    if (clientIP) {
      req.headers.set("x-client-ip", clientIP);
    }

    // Helper: wrap response with CSP + tracking cookies
    const cookieHeader = req.headers.get("cookie");
    const referrer = req.headers.get("referer");
    const withTracking = (response: NextResponse): NextResponse =>
      appendTrackingCookies(response, cookieHeader, req.nextUrl, referrer);

    if (isAnalyticsPath(path)) {
      const response = await PostHogMiddleware(req);
      return wrapResponseWithCSP(req, response);
    }

    if (isWebhookPath(host)) {
      const response = await IncomingWebhookMiddleware(req);
      return wrapResponseWithCSP(req, response);
    }

    if (isCustomDomain(host || "")) {
      const response = await DomainMiddleware(req);
      return withTracking(wrapResponseWithCSP(req, response));
    }

    // Inject pathname header for server layouts (used by LP layout auth)
    if (path.startsWith("/lp/")) {
      req.headers.set("x-lp-pathname", path);
    }

    // Admin page auth enforcement — defense-in-depth layer
    if (path.startsWith("/admin/") || path === "/admin") {
      const adminAuth = await enforceAdminAuth(req);
      if (adminAuth.blocked && adminAuth.response) {
        return withTracking(wrapResponseWithCSP(req, adminAuth.response));
      }
      // Admin auth passed — continue to AppMiddleware for standard routing
    }

    if (
      !path.startsWith("/view/") &&
      !path.startsWith("/verify") &&
      !path.startsWith("/unsubscribe")
    ) {
      const response = await AppMiddleware(req);
      if (response) {
        return withTracking(wrapResponseWithCSP(req, response));
      }
      return withTracking(createCSPResponse(req));
    }

    if (path.startsWith("/view/")) {
      const isBlocked = BLOCKED_PATHNAMES.some((blockedPath) => {
        const escapedBlockedPath = escapePath(blockedPath);
        const blockPattern = new RegExp(escapedBlockedPath);
        return blockPattern.test(path);
      });

      if (isBlocked || path.includes(".")) {
        const url = req.nextUrl.clone();
        const rewriteResponse = NextResponse.rewrite(url, { status: 404 });
        return withTracking(wrapResponseWithCSP(req, rewriteResponse));
      }
    }

    return withTracking(createCSPResponse(req));
  } catch (error) {
    serverInstance.error(error as Error, {
      path: req.nextUrl.pathname,
      method: req.method,
      host: req.headers.get("host"),
    });
    console.error("[Proxy Error]", error instanceof Error ? error.message : "Unknown error");

    return createErrorResponse("Internal server error", 500);
  }
}
