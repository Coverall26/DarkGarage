/**
 * Tests for edge auth middleware — lib/middleware/edge-auth.ts
 *
 * Validates that the edge auth module correctly:
 * 1. Passes through PUBLIC routes without auth
 * 2. Verifies CRON_SECRET for CRON routes
 * 3. Requires JWT session for AUTHENTICATED routes
 * 4. Requires JWT session for TEAM_SCOPED routes
 * 5. Delegates to admin-auth for ADMIN routes
 * 6. Injects user context headers for authenticated routes
 * 7. Handles edge cases (expired JWT, missing fields, getToken failures)
 */

import { NextRequest, NextResponse } from "next/server";
import { RouteCategory } from "@/lib/middleware/route-config";

// Mock next-auth/jwt
const mockGetToken = jest.fn();
jest.mock("next-auth/jwt", () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}));

// Mock admin-auth
const mockEnforceAdminAuth = jest.fn();
const mockApplyAdminAuthHeaders = jest.fn((response) => response);
jest.mock("@/lib/middleware/admin-auth", () => ({
  enforceAdminAuth: (...args: unknown[]) => mockEnforceAdminAuth(...args),
  applyAdminAuthHeaders: (...args: unknown[]) => mockApplyAdminAuthHeaders(...args),
}));

// Mock cron-auth
const mockRequireCronAuth = jest.fn();
jest.mock("@/lib/middleware/cron-auth", () => ({
  requireCronAuth: (...args: unknown[]) => mockRequireCronAuth(...args),
  verifyCronSecret: jest.fn(),
}));

import { enforceEdgeAuth, applyEdgeAuthHeaders } from "@/lib/middleware/edge-auth";

function makeRequest(path: string, headers?: Record<string, string>): NextRequest {
  const url = `https://app.fundroom.ai${path}`;
  return new NextRequest(url, { headers });
}

describe("edge-auth: enforceEdgeAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.CRON_SECRET = "test-cron-secret";
    mockRequireCronAuth.mockReturnValue(null);
  });

  // ----- PUBLIC ROUTES -----
  describe("PUBLIC routes", () => {
    it("passes through /api/auth/* without auth check", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/auth/register"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
      expect(mockGetToken).not.toHaveBeenCalled();
    });

    it("passes through /api/webhooks/* without auth check", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/webhooks/persona"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
    });

    it("passes through /api/health without auth check", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/health"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
    });

    it("passes through /api/record_click without auth check", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/record_click"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
    });

    it("passes through /api/record_view without auth check", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/record_view"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
    });

    it("passes through /api/record_video_view without auth check", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/record_video_view"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
    });

    it("passes through /api/og/* without auth check", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/og/image"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
    });

    it("passes through /api/csp-report without auth check", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/csp-report"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
    });

    it("passes through /api/views without auth check", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/views"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
    });

    it("passes through /api/views-dataroom without auth check", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/views-dataroom"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
    });

    it("passes through /api/branding/* without auth check", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/branding/tenant"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
    });

    it("passes through /api/feature-flags without auth check", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/feature-flags"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
    });

    it("passes through /api/marketplace/waitlist without auth check", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/marketplace/waitlist"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
    });

    it("passes through /api/marketplace/public/* without auth check", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/marketplace/public/listings"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
    });

    it("passes through /api/stripe/webhook without auth check", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/stripe/webhook"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
    });

    it("passes through /api/help/* without auth check", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/help/faq"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
    });

    it("passes through /api/unsubscribe without auth check", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/unsubscribe"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
    });

    it("does not call getToken for PUBLIC routes", async () => {
      await enforceEdgeAuth(makeRequest("/api/auth/register"));
      await enforceEdgeAuth(makeRequest("/api/webhooks/stripe-crm"));
      await enforceEdgeAuth(makeRequest("/api/health"));
      await enforceEdgeAuth(makeRequest("/api/marketplace/public/listings"));
      expect(mockGetToken).not.toHaveBeenCalled();
    });
  });

  // ----- CRON ROUTES -----
  describe("CRON routes", () => {
    it("passes through /api/cron/* with valid CRON_SECRET", async () => {
      mockRequireCronAuth.mockReturnValue(null);
      const result = await enforceEdgeAuth(makeRequest("/api/cron/domains"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.CRON);
      expect(mockRequireCronAuth).toHaveBeenCalled();
    });

    it("blocks /api/cron/* with invalid CRON_SECRET", async () => {
      const mockResponse = NextResponse.json(
        { error: "Unauthorized: Invalid CRON_SECRET" },
        { status: 401 },
      );
      mockRequireCronAuth.mockReturnValue(mockResponse);
      const result = await enforceEdgeAuth(makeRequest("/api/cron/domains"));
      expect(result.blocked).toBe(true);
      expect(result.response).toBe(mockResponse);
      expect(result.category).toBe(RouteCategory.CRON);
    });

    it("blocks /api/cron/* with missing Authorization header", async () => {
      const mockResponse = NextResponse.json(
        { error: "Unauthorized: Invalid CRON_SECRET" },
        { status: 401 },
      );
      mockRequireCronAuth.mockReturnValue(mockResponse);
      const result = await enforceEdgeAuth(makeRequest("/api/cron/audit-retention"));
      expect(result.blocked).toBe(true);
      expect(result.category).toBe(RouteCategory.CRON);
    });

    // /api/jobs/* uses INTERNAL_API_KEY (not CRON_SECRET) — classified as PUBLIC
    it("does NOT classify /api/jobs/* as CRON (uses INTERNAL_API_KEY)", async () => {
      const result = await enforceEdgeAuth(makeRequest("/api/jobs/cleanup"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.PUBLIC);
      expect(mockGetToken).not.toHaveBeenCalled();
    });

    it("does not call getToken for CRON routes", async () => {
      mockRequireCronAuth.mockReturnValue(null);
      await enforceEdgeAuth(makeRequest("/api/cron/domains"));
      expect(mockGetToken).not.toHaveBeenCalled();
    });
  });

  // ----- ADMIN ROUTES -----
  describe("ADMIN routes", () => {
    it("delegates to enforceAdminAuth for /api/admin/*", async () => {
      mockEnforceAdminAuth.mockResolvedValue({
        blocked: false,
        userId: "user-123",
        userEmail: "admin@fundroom.ai",
        userRole: "ADMIN",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/admin/settings"));
      expect(result.blocked).toBe(false);
      expect(result.userId).toBe("user-123");
      expect(result.userEmail).toBe("admin@fundroom.ai");
      expect(result.userRole).toBe("ADMIN");
      expect(result.category).toBe(RouteCategory.ADMIN);
      expect(mockEnforceAdminAuth).toHaveBeenCalled();
    });

    it("blocks when enforceAdminAuth blocks", async () => {
      const mockResponse = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      mockEnforceAdminAuth.mockResolvedValue({
        blocked: true,
        response: mockResponse,
      });

      const result = await enforceEdgeAuth(makeRequest("/api/admin/settings"));
      expect(result.blocked).toBe(true);
      expect(result.response).toBe(mockResponse);
      expect(result.category).toBe(RouteCategory.ADMIN);
    });

    it("passes through admin result fields (userId, userEmail, userRole)", async () => {
      mockEnforceAdminAuth.mockResolvedValue({
        blocked: false,
        userId: "owner-1",
        userEmail: "owner@fundroom.ai",
        userRole: "OWNER",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/admin/platform/settings"));
      expect(result.userId).toBe("owner-1");
      expect(result.userEmail).toBe("owner@fundroom.ai");
      expect(result.userRole).toBe("OWNER");
    });

    it("does not call getToken for ADMIN routes (admin-auth handles it)", async () => {
      mockEnforceAdminAuth.mockResolvedValue({ blocked: false });
      await enforceEdgeAuth(makeRequest("/api/admin/dashboard-stats"));
      expect(mockGetToken).not.toHaveBeenCalled();
    });
  });

  // ----- AUTHENTICATED ROUTES -----
  describe("AUTHENTICATED routes", () => {
    it("passes through /api/lp/* with valid JWT", async () => {
      mockGetToken.mockResolvedValue({
        sub: "user-456",
        email: "investor@example.com",
        role: "LP",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/lp/fund-context"));
      expect(result.blocked).toBe(false);
      expect(result.userId).toBe("user-456");
      expect(result.userEmail).toBe("investor@example.com");
      expect(result.userRole).toBe("LP");
      expect(result.category).toBe(RouteCategory.AUTHENTICATED);
    });

    it("blocks /api/lp/* without JWT", async () => {
      mockGetToken.mockResolvedValue(null);

      const result = await enforceEdgeAuth(makeRequest("/api/lp/fund-context"));
      expect(result.blocked).toBe(true);
      expect(result.response?.status).toBe(401);
      expect(result.category).toBe(RouteCategory.AUTHENTICATED);
    });

    it("blocks /api/esign/* without JWT email", async () => {
      mockGetToken.mockResolvedValue({ sub: "user-789" }); // no email

      const result = await enforceEdgeAuth(makeRequest("/api/esign/envelopes"));
      expect(result.blocked).toBe(true);
      expect(result.response?.status).toBe(401);
    });

    it("passes through /api/user/* with valid JWT", async () => {
      mockGetToken.mockResolvedValue({
        sub: "user-101",
        email: "user@example.com",
        role: "MEMBER",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/user/notification-preferences"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.AUTHENTICATED);
    });

    it("defaults role to MEMBER when not in JWT", async () => {
      mockGetToken.mockResolvedValue({
        sub: "user-101",
        email: "user@example.com",
        // no role
      });

      const result = await enforceEdgeAuth(makeRequest("/api/lp/register"));
      expect(result.blocked).toBe(false);
      expect(result.userRole).toBe("MEMBER");
    });

    it("passes through /api/sign/* with valid JWT", async () => {
      mockGetToken.mockResolvedValue({
        sub: "user-500",
        email: "signer@example.com",
        role: "MEMBER",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/sign/abc123"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.AUTHENTICATED);
    });

    it("passes through /api/notifications/* with valid JWT", async () => {
      mockGetToken.mockResolvedValue({
        sub: "user-600",
        email: "notify@example.com",
        role: "MEMBER",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/notifications/preferences"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.AUTHENTICATED);
    });

    it("passes through /api/investor-profile/* with valid JWT", async () => {
      mockGetToken.mockResolvedValue({
        sub: "user-700",
        email: "investor@example.com",
        role: "LP",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/investor-profile/prof-123"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.AUTHENTICATED);
    });

    it("passes through /api/documents/* with valid JWT", async () => {
      mockGetToken.mockResolvedValue({
        sub: "user-800",
        email: "doc@example.com",
        role: "MEMBER",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/documents/upload"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.AUTHENTICATED);
    });

    it("extracts userId from token.id when token.sub is missing", async () => {
      mockGetToken.mockResolvedValue({
        id: "alt-user-id",
        email: "alt@example.com",
        role: "MEMBER",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/lp/fund-context"));
      expect(result.blocked).toBe(false);
      expect(result.userId).toBe("alt-user-id");
    });

    it("prefers token.sub over token.id for userId", async () => {
      mockGetToken.mockResolvedValue({
        sub: "sub-id",
        id: "id-field",
        email: "user@example.com",
        role: "MEMBER",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/lp/register"));
      expect(result.blocked).toBe(false);
      expect(result.userId).toBe("sub-id");
    });
  });

  // ----- TEAM_SCOPED ROUTES -----
  describe("TEAM_SCOPED routes", () => {
    it("passes through /api/teams/* with valid JWT", async () => {
      mockGetToken.mockResolvedValue({
        sub: "user-222",
        email: "gp@fundroom.ai",
        role: "ADMIN",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/teams/t1/funds"));
      expect(result.blocked).toBe(false);
      expect(result.userId).toBe("user-222");
      expect(result.category).toBe(RouteCategory.TEAM_SCOPED);
    });

    it("blocks /api/teams/* without JWT", async () => {
      mockGetToken.mockResolvedValue(null);

      const result = await enforceEdgeAuth(makeRequest("/api/teams/t1/wire-transfers"));
      expect(result.blocked).toBe(true);
      expect(result.response?.status).toBe(401);
      expect(result.category).toBe(RouteCategory.TEAM_SCOPED);
    });

    it("passes through /api/billing/* with valid JWT", async () => {
      mockGetToken.mockResolvedValue({
        sub: "user-333",
        email: "billing@fundroom.ai",
        role: "OWNER",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/billing/checkout"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.TEAM_SCOPED);
    });

    it("passes through /api/funds/* with valid JWT", async () => {
      mockGetToken.mockResolvedValue({
        sub: "user-444",
        email: "fund@fundroom.ai",
        role: "ADMIN",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/funds/create"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.TEAM_SCOPED);
    });

    it("passes through /api/outreach/* with valid JWT", async () => {
      mockGetToken.mockResolvedValue({
        sub: "user-555",
        email: "crm@fundroom.ai",
        role: "ADMIN",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/outreach/sequences"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.TEAM_SCOPED);
    });

    it("passes through /api/contacts/* with valid JWT", async () => {
      mockGetToken.mockResolvedValue({
        sub: "user-666",
        email: "crm@fundroom.ai",
        role: "MANAGER",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/contacts/c1"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.TEAM_SCOPED);
    });

    it("passes through /api/ai/* with valid JWT", async () => {
      mockGetToken.mockResolvedValue({
        sub: "user-777",
        email: "ai@fundroom.ai",
        role: "ADMIN",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/ai/draft-email"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.TEAM_SCOPED);
    });

    it("blocks TEAM_SCOPED routes without JWT email", async () => {
      mockGetToken.mockResolvedValue({ sub: "user-999" }); // no email

      const result = await enforceEdgeAuth(makeRequest("/api/teams/t1/funds"));
      expect(result.blocked).toBe(true);
      expect(result.response?.status).toBe(401);
      expect(result.category).toBe(RouteCategory.TEAM_SCOPED);
    });
  });

  // ----- JWT EDGE CASES -----
  describe("JWT edge cases", () => {
    it("handles getToken throwing an error gracefully", async () => {
      mockGetToken.mockRejectedValue(new Error("JWT decode failure"));

      const result = await enforceEdgeAuth(makeRequest("/api/lp/fund-context"));
      expect(result.blocked).toBe(true);
      expect(result.response?.status).toBe(401);
    });

    it("treats empty email string as unauthenticated", async () => {
      mockGetToken.mockResolvedValue({
        sub: "user-123",
        email: "",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/lp/register"));
      // Empty string is falsy, so token?.email check fails
      expect(result.blocked).toBe(true);
      expect(result.response?.status).toBe(401);
    });

    it("returns userId as empty string when neither sub nor id exists", async () => {
      mockGetToken.mockResolvedValue({
        email: "user@example.com",
        role: "MEMBER",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/lp/fund-context"));
      expect(result.blocked).toBe(false);
      expect(result.userId).toBe("");
    });
  });

  // ----- FAIL-SAFE -----
  describe("Fail-safe default", () => {
    it("requires auth for unknown /api/* paths", async () => {
      mockGetToken.mockResolvedValue(null);

      const result = await enforceEdgeAuth(makeRequest("/api/unknown-endpoint"));
      expect(result.blocked).toBe(true);
      expect(result.response?.status).toBe(401);
      expect(result.category).toBe(RouteCategory.AUTHENTICATED);
    });

    it("allows unknown /api/* paths with valid JWT", async () => {
      mockGetToken.mockResolvedValue({
        sub: "user-444",
        email: "test@example.com",
        role: "MEMBER",
      });

      const result = await enforceEdgeAuth(makeRequest("/api/unknown-endpoint"));
      expect(result.blocked).toBe(false);
      expect(result.category).toBe(RouteCategory.AUTHENTICATED);
    });
  });
});

describe("edge-auth: applyEdgeAuthHeaders", () => {
  it("sets user context headers for AUTHENTICATED routes", () => {
    const response = NextResponse.next();

    applyEdgeAuthHeaders(response, {
      blocked: false,
      userId: "user-123",
      userEmail: "test@example.com",
      userRole: "ADMIN",
      category: RouteCategory.AUTHENTICATED,
    });

    expect(response.headers.get("x-middleware-user-id")).toBe("user-123");
    expect(response.headers.get("x-middleware-user-email")).toBe("test@example.com");
    expect(response.headers.get("x-middleware-user-role")).toBe("ADMIN");
  });

  it("sets user context headers for TEAM_SCOPED routes", () => {
    const response = NextResponse.next();

    applyEdgeAuthHeaders(response, {
      blocked: false,
      userId: "user-456",
      userEmail: "gp@fundroom.ai",
      userRole: "OWNER",
      category: RouteCategory.TEAM_SCOPED,
    });

    expect(response.headers.get("x-middleware-user-id")).toBe("user-456");
    expect(response.headers.get("x-middleware-user-email")).toBe("gp@fundroom.ai");
    expect(response.headers.get("x-middleware-user-role")).toBe("OWNER");
  });

  it("delegates to applyAdminAuthHeaders for ADMIN routes", () => {
    const response = NextResponse.next();

    applyEdgeAuthHeaders(response, {
      blocked: false,
      userId: "admin-1",
      userEmail: "admin@fundroom.ai",
      userRole: "ADMIN",
      category: RouteCategory.ADMIN,
    });

    expect(mockApplyAdminAuthHeaders).toHaveBeenCalledWith(
      response,
      expect.objectContaining({
        blocked: false,
        userId: "admin-1",
        userEmail: "admin@fundroom.ai",
        userRole: "ADMIN",
      }),
    );
  });

  it("handles missing user fields gracefully", () => {
    const response = NextResponse.next();

    applyEdgeAuthHeaders(response, {
      blocked: false,
      category: RouteCategory.AUTHENTICATED,
    });

    expect(response.headers.get("x-middleware-user-id")).toBeNull();
    expect(response.headers.get("x-middleware-user-email")).toBeNull();
    expect(response.headers.get("x-middleware-user-role")).toBeNull();
  });

  it("does not set headers for PUBLIC routes", () => {
    const response = NextResponse.next();

    applyEdgeAuthHeaders(response, {
      blocked: false,
      category: RouteCategory.PUBLIC,
    });

    // PUBLIC routes shouldn't go through applyEdgeAuthHeaders in practice,
    // but if they do, no user headers should be set
    expect(response.headers.get("x-middleware-user-id")).toBeNull();
  });

  it("does not set headers for CRON routes", () => {
    const response = NextResponse.next();

    applyEdgeAuthHeaders(response, {
      blocked: false,
      category: RouteCategory.CRON,
    });

    expect(response.headers.get("x-middleware-user-id")).toBeNull();
  });

  it("sets all three headers when all fields present", () => {
    const response = NextResponse.next();

    applyEdgeAuthHeaders(response, {
      blocked: false,
      userId: "uid-abc",
      userEmail: "abc@test.com",
      userRole: "SUPER_ADMIN",
      category: RouteCategory.TEAM_SCOPED,
    });

    expect(response.headers.get("x-middleware-user-id")).toBe("uid-abc");
    expect(response.headers.get("x-middleware-user-email")).toBe("abc@test.com");
    expect(response.headers.get("x-middleware-user-role")).toBe("SUPER_ADMIN");
  });
});
