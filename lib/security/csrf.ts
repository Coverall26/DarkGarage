import { NextApiRequest, NextApiResponse } from "next";
import { NextRequest, NextResponse } from "next/server";

/**
 * CSRF protection for API routes.
 *
 * Validates the Origin (or Referer) header against known platform domains.
 * Should be called at the top of mutation handlers (POST, PUT, PATCH, DELETE).
 *
 * Exempt: GET/HEAD/OPTIONS requests, webhook endpoints, and requests
 * identified by a custom header (X-Requested-With: FundRoom).
 *
 * When both Origin and Referer are missing, the request is only allowed if it
 * includes the X-Requested-With: FundRoom header. Cross-origin attackers cannot
 * set this header without a CORS preflight, which our CORS middleware blocks.
 *
 * Pages Router: validateCSRF(req, res) — returns boolean, sends 403 if rejected.
 * App Router:   validateCSRFAppRouter(req) — returns null if allowed, NextResponse(403) if rejected.
 * Middleware:    validateCSRFEdge(req) — edge-compatible, returns null or NextResponse(403).
 */

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "fundroom.ai";

function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  // Platform domains
  origins.add(`https://${PLATFORM_DOMAIN}`);
  origins.add(`https://www.${PLATFORM_DOMAIN}`);
  origins.add(`https://app.${PLATFORM_DOMAIN}`);
  origins.add(`https://app.login.${PLATFORM_DOMAIN}`);
  origins.add(`https://app.admin.${PLATFORM_DOMAIN}`);

  // NEXTAUTH_URL
  if (process.env.NEXTAUTH_URL) {
    try {
      const url = new URL(process.env.NEXTAUTH_URL);
      origins.add(url.origin);
    } catch {
      // Invalid URL, skip
    }
  }

  // Development
  if (process.env.NODE_ENV === "development") {
    origins.add("http://localhost:3000");
    origins.add("http://localhost:5000");
    origins.add("http://127.0.0.1:3000");
    origins.add("http://127.0.0.1:5000");
  }

  return origins;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Custom header required when both Origin and Referer are missing.
 * Cross-origin attackers cannot set custom headers without a CORS preflight,
 * which our CORS middleware will block for unknown origins.
 */
export const CSRF_HEADER_NAME = "x-requested-with";
export const CSRF_HEADER_VALUE = "FundRoom";

export function validateCSRF(
  req: NextApiRequest,
  res: NextApiResponse,
): boolean {
  // Safe methods don't need CSRF protection
  if (SAFE_METHODS.has(req.method || "GET")) {
    return true;
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // If no Origin and no Referer, require X-Requested-With: FundRoom header.
  // This custom header cannot be set cross-origin without a CORS preflight.
  if (!origin && !referer) {
    const xrw = req.headers[CSRF_HEADER_NAME];
    if (xrw === CSRF_HEADER_VALUE) {
      return true;
    }
    res.status(403).json({ error: "Forbidden: missing origin verification" });
    return false;
  }

  const allowed = getAllowedOrigins();

  // Check Origin header first (most reliable)
  if (origin) {
    if (allowed.has(origin)) {
      return true;
    }
    // Allow Replit dev origins
    if (
      process.env.NODE_ENV === "development" &&
      (origin.endsWith(".replit.dev") || origin.endsWith(".replit.app"))
    ) {
      return true;
    }
    res.status(403).json({ error: "Forbidden: invalid origin" });
    return false;
  }

  // Fall back to Referer header
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (allowed.has(refererOrigin)) {
        return true;
      }
      if (
        process.env.NODE_ENV === "development" &&
        (refererOrigin.endsWith(".replit.dev") ||
          refererOrigin.endsWith(".replit.app"))
      ) {
        return true;
      }
    } catch {
      // Invalid referer URL
    }
    res.status(403).json({ error: "Forbidden: invalid referer" });
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// App Router variant
// ---------------------------------------------------------------------------

/**
 * CSRF validation for App Router (route.ts handlers).
 * Returns null if the request is allowed, or a NextResponse(403) if rejected.
 */
export function validateCSRFAppRouter(req: NextRequest): NextResponse | null {
  const method = req.method;
  if (SAFE_METHODS.has(method)) return null;

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // If no Origin and no Referer, require X-Requested-With: FundRoom header.
  if (!origin && !referer) {
    const xrw = req.headers.get(CSRF_HEADER_NAME);
    if (xrw === CSRF_HEADER_VALUE) return null;
    return NextResponse.json(
      { error: "Forbidden: missing origin verification" },
      { status: 403 },
    );
  }

  const allowed = getAllowedOrigins();

  if (origin) {
    if (allowed.has(origin)) return null;
    if (
      process.env.NODE_ENV === "development" &&
      (origin.endsWith(".replit.dev") || origin.endsWith(".replit.app"))
    ) {
      return null;
    }
    return NextResponse.json(
      { error: "Forbidden: invalid origin" },
      { status: 403 },
    );
  }

  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (allowed.has(refererOrigin)) return null;
      if (
        process.env.NODE_ENV === "development" &&
        (refererOrigin.endsWith(".replit.dev") ||
          refererOrigin.endsWith(".replit.app"))
      ) {
        return null;
      }
    } catch {
      // Invalid referer URL
    }
    return NextResponse.json(
      { error: "Forbidden: invalid referer" },
      { status: 403 },
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Edge-compatible variant for middleware (proxy.ts)
// ---------------------------------------------------------------------------

/** Paths exempt from CSRF validation (webhooks, health, public endpoints). */
const CSRF_EXEMPT_PREFIXES = [
  "/api/webhooks/",
  "/api/stripe/webhook",
  "/api/health",
  "/api/csp-report",
  "/api/auth/",
  // Public tracking endpoints (GET-like behavior with POST for beacon API)
  "/api/record_click",
  "/api/record_view",
  "/api/record_video_view",
  "/api/record_reaction",
];

/**
 * Edge-compatible CSRF validation for proxy.ts middleware.
 * Returns null if the request is allowed, or a Response(403) if rejected.
 * Uses the standard Request API (no Next.js-specific imports needed at edge).
 */
export function validateCSRFEdge(req: Request): Response | null {
  const method = req.method;
  if (SAFE_METHODS.has(method)) return null;

  const url = new URL(req.url);
  const pathname = url.pathname;

  // Exempt paths
  for (const prefix of CSRF_EXEMPT_PREFIXES) {
    if (pathname.startsWith(prefix)) return null;
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // If no Origin and no Referer, require X-Requested-With: FundRoom header.
  if (!origin && !referer) {
    const xrw = req.headers.get(CSRF_HEADER_NAME);
    if (xrw === CSRF_HEADER_VALUE) return null;
    return new Response(
      JSON.stringify({ error: "Forbidden: missing origin verification" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const allowed = getAllowedOrigins();

  if (origin) {
    if (allowed.has(origin)) return null;
    if (
      process.env.NODE_ENV === "development" &&
      (origin.endsWith(".replit.dev") || origin.endsWith(".replit.app"))
    ) {
      return null;
    }
    return new Response(
      JSON.stringify({ error: "Forbidden: invalid origin" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (allowed.has(refererOrigin)) return null;
      if (
        process.env.NODE_ENV === "development" &&
        (refererOrigin.endsWith(".replit.dev") ||
          refererOrigin.endsWith(".replit.app"))
      ) {
        return null;
      }
    } catch {
      // Invalid referer URL
    }
    return new Response(
      JSON.stringify({ error: "Forbidden: invalid referer" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return null;
}
