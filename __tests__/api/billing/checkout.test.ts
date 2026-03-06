/**
 * Comprehensive tests for POST /api/billing/checkout
 *
 * Tests: rate limiting, authentication, input validation, user/org resolution,
 * role-based access, downgrade prevention, Stripe checkout session creation
 * (new + existing customer), session configuration, audit logging, error handling.
 */

// ---------------------------------------------------------------------------
// Mock function declarations — MUST be before jest.mock() calls
// ---------------------------------------------------------------------------

const mockRequireAuthAppRouter = jest.fn();
const mockAppRouterStrictRateLimit = jest.fn();
const mockGetCrmPriceId = jest.fn();
const mockLogAuditEvent = jest.fn();
const mockReportError = jest.fn();

const mockStripeCheckoutSessionsCreate = jest.fn();
const mockStripeInstance = jest.fn(() => ({
  checkout: { sessions: { create: mockStripeCheckoutSessionsCreate } },
}));

const mockPrismaUserFindUnique = jest.fn();

// ---------------------------------------------------------------------------
// jest.mock() calls — hoisted above all imports
// ---------------------------------------------------------------------------

jest.mock("@/lib/auth/rbac", () => ({
  requireAuthAppRouter: (...args: unknown[]) =>
    mockRequireAuthAppRouter(...args),
}));

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterStrictRateLimit: (...args: unknown[]) =>
    mockAppRouterStrictRateLimit(...args),
}));

jest.mock("@/lib/stripe/crm-products", () => ({
  getCrmPriceId: (...args: unknown[]) => mockGetCrmPriceId(...args),
}));

jest.mock("@/ee/stripe", () => ({
  stripeInstance: (...args: unknown[]) => mockStripeInstance(...args),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockPrismaUserFindUnique(...args),
    },
  },
}));

jest.mock("@/lib/audit/audit-logger", () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

jest.mock("@/lib/error", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

// validateBody is NOT mocked — we use the real implementation + real Zod schema
// to verify actual validation behavior end-to-end.

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth/auth-options", () => ({
  authOptions: { providers: [], session: { strategy: "jwt" } },
}));

// ---------------------------------------------------------------------------
// Imports — AFTER all jest.mock() calls
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { POST } from "@/app/api/billing/checkout/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Request;
}

function makeInvalidJsonRequest(): Request {
  return new Request("http://localhost/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not valid json{{{",
  }) as unknown as Request;
}

/** Set auth to return a successful authenticated user */
function setAuth(email: string, userId = "user-1") {
  mockRequireAuthAppRouter.mockResolvedValue({
    userId,
    email,
    teamId: "",
    role: "MEMBER",
  });
}

/** Set auth to return 401 Unauthorized */
function setAuthUnauthorized() {
  mockRequireAuthAppRouter.mockResolvedValue(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  );
}

/** Build a user DB record for prisma.user.findUnique */
function makeUserRecord(overrides: {
  id?: string;
  email?: string;
  role?: string;
  orgOverrides?: Record<string, unknown>;
  teamId?: string;
  hasOrg?: boolean;
  hasTeams?: boolean;
} = {}) {
  const {
    id = "user-1",
    email = "admin@example.com",
    role = "ADMIN",
    orgOverrides = {},
    teamId = "team-1",
    hasOrg = true,
    hasTeams = true,
  } = overrides;

  if (!hasTeams) {
    return { id, email, teams: [] };
  }

  return {
    id,
    email,
    teams: [
      {
        role,
        team: {
          id: teamId,
          organization: hasOrg
            ? {
                id: "org-1",
                stripeCustomerId: null,
                subscriptionTier: "FREE",
                name: "Test Org",
                ...orgOverrides,
              }
            : null,
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  // Default: rate limit allows requests
  mockAppRouterStrictRateLimit.mockResolvedValue(null);

  // Default: getCrmPriceId returns a valid price
  mockGetCrmPriceId.mockReturnValue("price_test_123");

  // Default: audit logging succeeds (fire-and-forget)
  mockLogAuditEvent.mockResolvedValue(undefined);
});

// ===========================================================================
// Test Suites
// ===========================================================================

describe("POST /api/billing/checkout", () => {
  // -----------------------------------------------------------------------
  // 1. Rate Limiting
  // -----------------------------------------------------------------------

  describe("rate limiting", () => {
    it("returns 429 when rate limited", async () => {
      const rateLimitResponse = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
      mockAppRouterStrictRateLimit.mockResolvedValueOnce(rateLimitResponse);

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);

      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toBe("Too many requests");
    });

    it("does not call auth or prisma when rate limited", async () => {
      const rateLimitResponse = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
      mockAppRouterStrictRateLimit.mockResolvedValueOnce(rateLimitResponse);

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

      expect(mockRequireAuthAppRouter).not.toHaveBeenCalled();
      expect(mockPrismaUserFindUnique).not.toHaveBeenCalled();
      expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
    });

    it("proceeds when rate limiter returns null", async () => {
      mockAppRouterStrictRateLimit.mockResolvedValue(null);
      setAuthUnauthorized();

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);

      // Should have proceeded past rate limit to auth (which returns 401)
      expect(res.status).toBe(401);
      expect(mockRequireAuthAppRouter).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 2. Authentication
  // -----------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      setAuthUnauthorized();

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("does not call prisma when unauthenticated", async () => {
      setAuthUnauthorized();

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

      expect(mockPrismaUserFindUnique).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 3. Input Validation (real Zod schema via real validateBody)
  // -----------------------------------------------------------------------

  describe("input validation", () => {
    beforeEach(() => {
      setAuth("admin@example.com");
    });

    it("returns 400 for invalid plan value", async () => {
      const req = makeRequest({ plan: "INVALID_PLAN", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for FREE plan (not a valid checkout plan)", async () => {
      const req = makeRequest({ plan: "FREE", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for AI_CRM plan (addon, not base plan)", async () => {
      const req = makeRequest({ plan: "AI_CRM", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for invalid period value", async () => {
      const req = makeRequest({ plan: "CRM_PRO", period: "biweekly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for missing plan field", async () => {
      const req = makeRequest({ period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for missing period field", async () => {
      const req = makeRequest({ plan: "CRM_PRO" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for empty body", async () => {
      const req = makeRequest({});
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for invalid JSON body", async () => {
      const req = makeInvalidJsonRequest();
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Invalid JSON body");
    });

    it("does not call prisma for invalid input", async () => {
      const req = makeRequest({ plan: "BAD", period: "monthly" });
      await POST(req as any);

      expect(mockPrismaUserFindUnique).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 4. Price ID Resolution
  // -----------------------------------------------------------------------

  describe("price configuration", () => {
    it("returns 400 when getCrmPriceId returns null", async () => {
      setAuth("admin@example.com");
      mockGetCrmPriceId.mockReturnValue(null);

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Price not configured for this plan.");
    });

    it("calls getCrmPriceId with correct plan and period", async () => {
      setAuth("admin@example.com");
      mockGetCrmPriceId.mockReturnValue("price_yearly_fundroom");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({ orgOverrides: { subscriptionTier: "FREE" } }),
      );
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/x",
        id: "cs_x",
      });

      const req = makeRequest({ plan: "FUNDROOM", period: "yearly" });
      await POST(req as any);

      expect(mockGetCrmPriceId).toHaveBeenCalledWith("FUNDROOM", "yearly");
    });
  });

  // -----------------------------------------------------------------------
  // 5. User & Organization Resolution
  // -----------------------------------------------------------------------

  describe("user and organization resolution", () => {
    it("returns 404 when user not found in database", async () => {
      setAuth("ghost@example.com");
      mockPrismaUserFindUnique.mockResolvedValue(null);

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe("User not found");
    });

    it("queries prisma with the authenticated email", async () => {
      setAuth("lookup@example.com");
      mockPrismaUserFindUnique.mockResolvedValue(null);

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

      expect(mockPrismaUserFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: "lookup@example.com" },
        }),
      );
    });

    it("returns 403 when user has no admin role", async () => {
      setAuth("member@example.com");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({ email: "member@example.com", role: "MEMBER" }),
      );

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain("admin");
    });

    it("returns 403 when user has MANAGER role (not billing-admin)", async () => {
      setAuth("manager@example.com");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({ email: "manager@example.com", role: "MANAGER" }),
      );

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(403);
    });

    it("returns 403 when user has no teams", async () => {
      setAuth("noteam@example.com");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({ email: "noteam@example.com", hasTeams: false }),
      );

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(403);
    });

    it("returns 403 when admin team has no organization", async () => {
      setAuth("orphan@example.com");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({
          email: "orphan@example.com",
          role: "ADMIN",
          hasOrg: false,
        }),
      );

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain("admin");
    });
  });

  // -----------------------------------------------------------------------
  // 6. Admin Role Variants (OWNER, ADMIN, SUPER_ADMIN allowed)
  // -----------------------------------------------------------------------

  describe("admin role variants", () => {
    const setupStripeSuccess = () => {
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/ok",
        id: "cs_ok",
      });
    };

    it("allows OWNER role", async () => {
      setAuth("owner@example.com", "user-owner");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({ id: "user-owner", email: "owner@example.com", role: "OWNER" }),
      );
      setupStripeSuccess();

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);
    });

    it("allows ADMIN role", async () => {
      setAuth("admin@example.com", "user-admin");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({ id: "user-admin", email: "admin@example.com", role: "ADMIN" }),
      );
      setupStripeSuccess();

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);
    });

    it("allows SUPER_ADMIN role", async () => {
      setAuth("sa@example.com", "user-sa");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({ id: "user-sa", email: "sa@example.com", role: "SUPER_ADMIN" }),
      );
      setupStripeSuccess();

      const req = makeRequest({ plan: "FUNDROOM", period: "yearly" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // 7. Downgrade Prevention
  // -----------------------------------------------------------------------

  describe("downgrade prevention", () => {
    it("returns 400 when FUNDROOM user tries to checkout CRM_PRO", async () => {
      setAuth("admin@example.com");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({
          role: "ADMIN",
          orgOverrides: { subscriptionTier: "FUNDROOM" },
        }),
      );

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("billing portal");
    });

    it("does not call Stripe for downgrade attempt", async () => {
      setAuth("admin@example.com");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({
          role: "ADMIN",
          orgOverrides: { subscriptionTier: "FUNDROOM" },
        }),
      );

      const req = makeRequest({ plan: "CRM_PRO", period: "yearly" });
      await POST(req as any);

      expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled();
    });

    it("allows FUNDROOM to FUNDROOM checkout (same-tier, different period)", async () => {
      setAuth("admin@example.com");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({
          role: "ADMIN",
          orgOverrides: {
            subscriptionTier: "FUNDROOM",
            stripeCustomerId: "cus_fr",
          },
        }),
      );
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/same_tier",
        id: "cs_same",
      });

      const req = makeRequest({ plan: "FUNDROOM", period: "yearly" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);
    });

    it("allows CRM_PRO to FUNDROOM upgrade", async () => {
      setAuth("admin@example.com");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({
          role: "ADMIN",
          orgOverrides: {
            subscriptionTier: "CRM_PRO",
            stripeCustomerId: "cus_cp",
          },
        }),
      );
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/upgrade",
        id: "cs_upgrade",
      });

      const req = makeRequest({ plan: "FUNDROOM", period: "monthly" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);
    });

    it("allows FREE to CRM_PRO upgrade", async () => {
      setAuth("admin@example.com");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({
          role: "ADMIN",
          orgOverrides: { subscriptionTier: "FREE" },
        }),
      );
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/new",
        id: "cs_new",
      });

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // 8. New Customer Checkout
  // -----------------------------------------------------------------------

  describe("new customer checkout", () => {
    beforeEach(() => {
      setAuth("admin@example.com", "user-admin");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({
          id: "user-admin",
          email: "admin@example.com",
          role: "ADMIN",
          orgOverrides: {
            stripeCustomerId: null,
            subscriptionTier: "FREE",
          },
        }),
      );
    });

    it("creates checkout session with customer_email", async () => {
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/new_session",
        id: "cs_new_123",
      });

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.url).toBe("https://checkout.stripe.com/new_session");
      expect(data.sessionId).toBe("cs_new_123");

      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_email: "admin@example.com",
          mode: "subscription",
        }),
      );
    });

    it("does not include customer field for new customer", async () => {
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/x",
        id: "cs_x",
      });

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

      const createCall = mockStripeCheckoutSessionsCreate.mock.calls[0][0];
      expect(createCall).not.toHaveProperty("customer");
      expect(createCall).toHaveProperty("customer_email", "admin@example.com");
    });

    it("passes correct line items with price ID", async () => {
      mockGetCrmPriceId.mockReturnValue("price_crm_pro_monthly_test");
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        url: "https://x",
        id: "cs_li",
      });

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            {
              price: "price_crm_pro_monthly_test",
              quantity: 1,
            },
          ],
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // 9. Existing Customer Checkout
  // -----------------------------------------------------------------------

  describe("existing customer checkout", () => {
    beforeEach(() => {
      setAuth("admin@example.com", "user-admin");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({
          id: "user-admin",
          email: "admin@example.com",
          role: "OWNER",
          orgOverrides: {
            stripeCustomerId: "cus_existing_456",
            subscriptionTier: "CRM_PRO",
          },
        }),
      );
    });

    it("creates checkout session with customer ID", async () => {
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/upgrade_session",
        id: "cs_upgrade_789",
      });

      const req = makeRequest({ plan: "FUNDROOM", period: "yearly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.url).toBe("https://checkout.stripe.com/upgrade_session");
      expect(data.sessionId).toBe("cs_upgrade_789");

      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_existing_456",
          customer_update: { name: "auto" },
        }),
      );
    });

    it("does not include customer_email for existing customer", async () => {
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        url: "https://x",
        id: "cs_x",
      });

      const req = makeRequest({ plan: "FUNDROOM", period: "monthly" });
      await POST(req as any);

      const createCall = mockStripeCheckoutSessionsCreate.mock.calls[0][0];
      expect(createCall).toHaveProperty("customer", "cus_existing_456");
      expect(createCall).not.toHaveProperty("customer_email");
    });
  });

  // -----------------------------------------------------------------------
  // 10. Checkout Session Configuration
  // -----------------------------------------------------------------------

  describe("checkout session configuration", () => {
    beforeEach(() => {
      setAuth("admin@example.com", "user-admin");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({
          id: "user-admin",
          role: "ADMIN",
          orgOverrides: { stripeCustomerId: null, subscriptionTier: "FREE" },
        }),
      );
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/x",
        id: "cs_config",
      });
    });

    it("includes billing_address_collection and allow_promotion_codes", async () => {
      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          billing_address_collection: "required",
          allow_promotion_codes: true,
        }),
      );
    });

    it("sets client_reference_id to org ID", async () => {
      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          client_reference_id: "org-1",
        }),
      );
    });

    it("includes correct metadata with system=crm", async () => {
      const req = makeRequest({ plan: "FUNDROOM", period: "yearly" });
      await POST(req as any);

      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            orgId: "org-1",
            teamId: "team-1",
            system: "crm",
            plan: "FUNDROOM",
            period: "yearly",
          }),
        }),
      );
    });

    it("includes subscription_data metadata", async () => {
      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_data: expect.objectContaining({
            metadata: expect.objectContaining({
              orgId: "org-1",
              system: "crm",
              plan: "CRM_PRO",
            }),
          }),
        }),
      );
    });

    it("includes success and cancel URLs with correct query params", async () => {
      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

      const createCall = mockStripeCheckoutSessionsCreate.mock.calls[0][0];
      expect(createCall.success_url).toContain("tab=billing");
      expect(createCall.success_url).toContain("success=true");
      expect(createCall.cancel_url).toContain("tab=billing");
      expect(createCall.cancel_url).toContain("cancel=true");
    });

    it("sets mode to subscription", async () => {
      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

      expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // 11. Audit Logging
  // -----------------------------------------------------------------------

  describe("audit logging", () => {
    beforeEach(() => {
      setAuth("admin@example.com", "user-admin");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({
          id: "user-admin",
          role: "ADMIN",
          orgOverrides: { stripeCustomerId: null, subscriptionTier: "FREE" },
        }),
      );
    });

    it("logs BILLING_CHECKOUT_STARTED event on success", async () => {
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/x",
        id: "cs_audit_test",
      });

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

      // Need to flush microtasks for fire-and-forget .catch()
      await new Promise((r) => setTimeout(r, 0));

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "BILLING_CHECKOUT_STARTED",
          resourceType: "Organization",
          resourceId: "org-1",
          userId: "user-admin",
          metadata: expect.objectContaining({
            plan: "CRM_PRO",
            period: "monthly",
            checkoutSessionId: "cs_audit_test",
          }),
        }),
      );
    });

    it("does not fail request if audit logging throws", async () => {
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/x",
        id: "cs_audit_err",
      });
      mockLogAuditEvent.mockRejectedValueOnce(new Error("Audit DB error"));

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);

      // Should still succeed because audit is fire-and-forget (.catch)
      expect(res.status).toBe(200);
    });

    it("reports audit error via reportError when audit fails", async () => {
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/x",
        id: "cs_audit_err2",
      });
      const auditError = new Error("Audit connection error");
      mockLogAuditEvent.mockRejectedValueOnce(auditError);

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

      // Allow the .catch handler to run
      await new Promise((r) => setTimeout(r, 10));

      expect(mockReportError).toHaveBeenCalledWith(auditError);
    });

    it("does not log audit event when checkout fails", async () => {
      mockStripeCheckoutSessionsCreate.mockRejectedValue(
        new Error("Stripe outage"),
      );

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

      expect(mockLogAuditEvent).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 12. Error Handling
  // -----------------------------------------------------------------------

  describe("error handling", () => {
    it("returns 500 and generic message when Stripe throws", async () => {
      setAuth("admin@example.com", "user-admin");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({
          id: "user-admin",
          role: "ADMIN",
          orgOverrides: { stripeCustomerId: null, subscriptionTier: "FREE" },
        }),
      );
      mockStripeCheckoutSessionsCreate.mockRejectedValue(
        new Error("Stripe API outage"),
      );

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("calls reportError when Stripe throws", async () => {
      setAuth("admin@example.com", "user-admin");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({
          id: "user-admin",
          role: "ADMIN",
          orgOverrides: { stripeCustomerId: null, subscriptionTier: "FREE" },
        }),
      );
      const stripeError = new Error("Stripe API outage");
      mockStripeCheckoutSessionsCreate.mockRejectedValue(stripeError);

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

      expect(mockReportError).toHaveBeenCalledWith(stripeError);
    });

    it("returns 500 when prisma throws", async () => {
      setAuth("admin@example.com");
      mockPrismaUserFindUnique.mockRejectedValue(
        new Error("Database connection failed"),
      );

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalled();
    });

    it("does not leak error details in 500 response", async () => {
      setAuth("admin@example.com");
      mockPrismaUserFindUnique.mockRejectedValue(
        new Error("Connection to database failed: password authentication failed for user 'admin'"),
      );

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(JSON.stringify(data)).not.toContain("password");
      expect(JSON.stringify(data)).not.toContain("database");
    });
  });

  // -----------------------------------------------------------------------
  // 13. Response Shape
  // -----------------------------------------------------------------------

  describe("response shape", () => {
    it("returns url and sessionId on success", async () => {
      setAuth("admin@example.com", "user-admin");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({
          id: "user-admin",
          role: "ADMIN",
          orgOverrides: { stripeCustomerId: null, subscriptionTier: "FREE" },
        }),
      );
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/session_abc",
        id: "cs_abc_123",
      });

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        url: "https://checkout.stripe.com/session_abc",
        sessionId: "cs_abc_123",
      });
    });

    it("all error responses use { error } format (H-06)", async () => {
      // 401
      setAuthUnauthorized();
      let res = await POST(makeRequest({ plan: "CRM_PRO", period: "monthly" }) as any);
      let data = await res.json();
      expect(data).toHaveProperty("error");
      expect(data).not.toHaveProperty("message");

      // 400 validation
      setAuth("admin@example.com");
      res = await POST(makeRequest({ plan: "BAD" }) as any);
      data = await res.json();
      expect(data).toHaveProperty("error");
      expect(data).not.toHaveProperty("message");

      // 404
      jest.clearAllMocks();
      mockAppRouterStrictRateLimit.mockResolvedValue(null);
      mockGetCrmPriceId.mockReturnValue("price_test");
      mockLogAuditEvent.mockResolvedValue(undefined);
      setAuth("ghost@example.com");
      mockPrismaUserFindUnique.mockResolvedValue(null);
      res = await POST(makeRequest({ plan: "CRM_PRO", period: "monthly" }) as any);
      data = await res.json();
      expect(data).toHaveProperty("error");
      expect(data).not.toHaveProperty("message");
    });
  });

  // -----------------------------------------------------------------------
  // 14. Plan + Period Combinations
  // -----------------------------------------------------------------------

  describe("plan and period combinations", () => {
    beforeEach(() => {
      setAuth("admin@example.com", "user-admin");
      mockPrismaUserFindUnique.mockResolvedValue(
        makeUserRecord({
          id: "user-admin",
          role: "ADMIN",
          orgOverrides: { stripeCustomerId: null, subscriptionTier: "FREE" },
        }),
      );
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        url: "https://checkout.stripe.com/ok",
        id: "cs_ok",
      });
    });

    it("accepts CRM_PRO monthly", async () => {
      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      expect(res.status).toBe(200);
      expect(mockGetCrmPriceId).toHaveBeenCalledWith("CRM_PRO", "monthly");
    });

    it("accepts CRM_PRO yearly", async () => {
      const req = makeRequest({ plan: "CRM_PRO", period: "yearly" });
      const res = await POST(req as any);
      expect(res.status).toBe(200);
      expect(mockGetCrmPriceId).toHaveBeenCalledWith("CRM_PRO", "yearly");
    });

    it("accepts FUNDROOM monthly", async () => {
      const req = makeRequest({ plan: "FUNDROOM", period: "monthly" });
      const res = await POST(req as any);
      expect(res.status).toBe(200);
      expect(mockGetCrmPriceId).toHaveBeenCalledWith("FUNDROOM", "monthly");
    });

    it("accepts FUNDROOM yearly", async () => {
      const req = makeRequest({ plan: "FUNDROOM", period: "yearly" });
      const res = await POST(req as any);
      expect(res.status).toBe(200);
      expect(mockGetCrmPriceId).toHaveBeenCalledWith("FUNDROOM", "yearly");
    });
  });

  // -----------------------------------------------------------------------
  // 15. User email null handling
  // -----------------------------------------------------------------------

  describe("user email edge cases", () => {
    it("passes undefined for customer_email when user.email is null", async () => {
      setAuth("admin@example.com", "user-admin");
      mockPrismaUserFindUnique.mockResolvedValue({
        id: "user-admin",
        email: null,
        teams: [
          {
            role: "ADMIN",
            team: {
              id: "team-1",
              organization: {
                id: "org-1",
                stripeCustomerId: null,
                subscriptionTier: "FREE",
                name: "Test Org",
              },
            },
          },
        ],
      });
      mockStripeCheckoutSessionsCreate.mockResolvedValue({
        url: "https://x",
        id: "cs_null_email",
      });

      const req = makeRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);

      const createCall = mockStripeCheckoutSessionsCreate.mock.calls[0][0];
      expect(createCall.customer_email).toBeUndefined();
    });
  });
});
