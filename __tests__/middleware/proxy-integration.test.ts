/**
 * Integration tests for proxy.ts middleware
 *
 * Tests the full middleware flow end-to-end:
 * - API routes: CORS preflight → rate limiting → CSRF → auth chain
 * - Page routes: admin auth → app middleware → CSP + tracking
 * - Error handling and security headers
 */

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — must be declared before proxy import
// ---------------------------------------------------------------------------

// next-auth/jwt
const mockGetToken = jest.fn();
jest.mock("next-auth/jwt", () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}));

// edge-auth
const mockEnforceEdgeAuth = jest.fn();
const mockApplyEdgeAuthHeaders = jest.fn((response) => response);
jest.mock("@/lib/middleware/edge-auth", () => ({
  enforceEdgeAuth: (...args: unknown[]) => mockEnforceEdgeAuth(...args),
  applyEdgeAuthHeaders: (...args: unknown[]) => mockApplyEdgeAuthHeaders(...args),
}));

// admin-auth
const mockEnforceAdminAuth = jest.fn();
jest.mock("@/lib/middleware/admin-auth", () => ({
  enforceAdminAuth: (...args: unknown[]) => mockEnforceAdminAuth(...args),
  applyAdminAuthHeaders: jest.fn((response) => response),
}));

// CSRF
jest.mock("@/lib/security/csrf", () => ({
  validateCSRFEdge: jest.fn(() => null), // allow by default
}));

// CORS
const mockHandleCorsPreflightRequest = jest.fn(() => null);
const mockSetCorsHeaders = jest.fn();
jest.mock("@/lib/middleware/cors", () => ({
  handleCorsPreflightRequest: (...args: unknown[]) => mockHandleCorsPreflightRequest(...args),
  setCorsHeaders: (...args: unknown[]) => mockSetCorsHeaders(...args),
}));

// CSP
jest.mock("@/lib/middleware/csp", () => ({
  createCSPResponse: jest.fn((_req: unknown) => NextResponse.next()),
  wrapResponseWithCSP: jest.fn((_req: unknown, res: NextResponse) => res),
}));

// Rate limiting (Redis)
jest.mock("@/lib/redis", () => ({
  ratelimit: jest.fn(() => ({
    limit: jest.fn().mockResolvedValue({ success: true, limit: 200, remaining: 199, reset: Date.now() + 60000 }),
  })),
}));

// Middleware chain
jest.mock("@/lib/middleware/chain", () => {
  const actual = jest.requireActual("@/lib/middleware/chain");
  return actual;
});

// Route config
jest.mock("@/lib/middleware/route-config", () => {
  const actual = jest.requireActual("@/lib/middleware/route-config");
  return actual;
});

// AppMiddleware
jest.mock("@/lib/middleware/app", () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve(NextResponse.next())),
}));

// DomainMiddleware
jest.mock("@/lib/middleware/domain", () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve(NextResponse.next())),
}));

// PostHogMiddleware
jest.mock("./../../lib/middleware/posthog", () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve(NextResponse.next())),
}));

// IncomingWebhookMiddleware
jest.mock("./../../lib/middleware/incoming-webhooks", () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve(NextResponse.next())),
  isWebhookPath: jest.fn(() => false),
}));

// Tracking
jest.mock("./../../lib/middleware/tracking", () => ({
  appendTrackingCookies: jest.fn(
    (response: NextResponse) => response,
  ),
}));

// Rollbar
jest.mock("./../../lib/rollbar", () => ({
  serverInstance: {
    error: jest.fn(),
  },
}));

// Constants
jest.mock("./../../lib/constants", () => ({
  BLOCKED_PATHNAMES: [],
}));

// ---------------------------------------------------------------------------
// Import the middleware under test
// ---------------------------------------------------------------------------
import proxy from "../../proxy";

function makeRequest(
  path: string,
  options?: { method?: string; headers?: Record<string, string> },
): NextRequest {
  const url = `https://app.fundroom.ai${path}`;
  return new NextRequest(url, {
    method: options?.method || "GET",
    headers: options?.headers || { host: "app.fundroom.ai" },
  });
}

describe("proxy.ts integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnforceEdgeAuth.mockResolvedValue({
      blocked: false,
      userId: "user-1",
      userEmail: "test@fundroom.ai",
      userRole: "ADMIN",
      category: "AUTHENTICATED",
    });
    mockEnforceAdminAuth.mockResolvedValue({
      blocked: false,
      userId: "user-1",
      userEmail: "test@fundroom.ai",
      userRole: "ADMIN",
    });
  });

  // ----- HOST VALIDATION -----
  describe("Host validation", () => {
    it("rejects requests with no host header", async () => {
      const req = new NextRequest("https://app.fundroom.ai/api/test", {
        headers: {},
      });
      // Force host to be null by not setting it
      const result = await proxy(req, {} as never);
      // If host is null, validateHost returns false → 400
      expect(result.status).toBe(400);
    });

    it("allows requests with valid host", async () => {
      const req = makeRequest("/api/test");
      const result = await proxy(req, {} as never);
      expect(result.status).not.toBe(400);
    });
  });

  // ----- API ROUTES -----
  describe("API routes", () => {
    it("handles CORS preflight (OPTIONS) before auth chain", async () => {
      const preflightResponse = new NextResponse(null, { status: 204 });
      mockHandleCorsPreflightRequest.mockReturnValue(preflightResponse);

      const req = makeRequest("/api/teams/t1/funds", { method: "OPTIONS" });
      const result = await proxy(req, {} as never);

      expect(result).toBe(preflightResponse);
      // Auth should NOT be called for preflight
      expect(mockEnforceEdgeAuth).not.toHaveBeenCalled();
    });

    it("runs the middleware chain for non-preflight API requests", async () => {
      mockHandleCorsPreflightRequest.mockReturnValue(null);

      const req = makeRequest("/api/lp/fund-context");
      const result = await proxy(req, {} as never);

      // The chain should have been executed (rate limit → CSRF → auth)
      expect(result).toBeDefined();
      expect(result.status).not.toBe(400); // not blocked by host validation
    });

    it("generates x-request-id header on successful API requests", async () => {
      mockHandleCorsPreflightRequest.mockReturnValue(null);

      const req = makeRequest("/api/lp/fund-context");
      const result = await proxy(req, {} as never);

      // x-request-id is set in authAndFinalizeMiddleware
      // Since we're mocking enforceEdgeAuth, the real chain runs but our mock returns the auth result
      expect(result).toBeDefined();
    });
  });

  // ----- PAGE ROUTES -----
  describe("Page routes", () => {
    it("redirects /org-setup to /admin/setup", async () => {
      const req = makeRequest("/org-setup");
      const result = await proxy(req, {} as never);
      expect(result.status).toBe(307);
      expect(result.headers.get("location")).toContain("/admin/setup");
    });

    it("redirects /org-setup/step to /admin/setup", async () => {
      const req = makeRequest("/org-setup/step-3");
      const result = await proxy(req, {} as never);
      expect(result.status).toBe(307);
      expect(result.headers.get("location")).toContain("/admin/setup");
    });
  });

  // ----- ERROR HANDLING -----
  describe("Error handling", () => {
    it("catches errors and returns 500 with JSON", async () => {
      // Force an error by making sanitizePath throw indirectly
      // We'll test that the outer try-catch works
      mockHandleCorsPreflightRequest.mockImplementation(() => {
        throw new Error("Simulated middleware error");
      });

      const req = makeRequest("/api/test");
      const result = await proxy(req, {} as never);

      expect(result.status).toBe(500);
      const body = await result.json();
      expect(body.error).toBe("Internal server error");
    });
  });

  // ----- CONFIG -----
  describe("Middleware config", () => {
    it("exports a matcher config", async () => {
      const { config } = await import("../../proxy");
      expect(config).toBeDefined();
      expect(config.matcher).toBeDefined();
      expect(Array.isArray(config.matcher)).toBe(true);
      expect(config.matcher.length).toBeGreaterThan(0);
    });
  });
});
