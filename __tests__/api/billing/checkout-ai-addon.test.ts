/**
 * Comprehensive tests for Billing Checkout and AI Add-on API routes.
 *
 * Covers:
 *   - POST /api/billing/checkout — Stripe Checkout Session creation
 *   - POST /api/billing/ai-addon — AI CRM add-on subscribe/cancel
 *
 * Tests: auth, validation, business logic, Stripe interactions, audit logging, error handling.
 */

// ---------------------------------------------------------------------------
// Mock modules — MUST be before any imports that use them
// ---------------------------------------------------------------------------

const mockStripeSubscriptions = {
  create: jest.fn(),
  update: jest.fn(),
  retrieve: jest.fn(),
};

const mockStripeCheckoutSessions = {
  create: jest.fn(),
};

jest.mock("@/ee/stripe", () => ({
  stripeInstance: jest.fn(() => ({
    subscriptions: mockStripeSubscriptions,
    checkout: { sessions: mockStripeCheckoutSessions },
  })),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

const mockRequireAuthAppRouter = jest.fn();

jest.mock("@/lib/auth/rbac", () => ({
  requireAuthAppRouter: (...args: unknown[]) =>
    mockRequireAuthAppRouter(...args),
}));

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterStrictRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/audit/audit-logger", () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

jest.mock("@/lib/tier/crm-tier", () => ({
  invalidateTierCache: jest.fn(),
}));

jest.mock("@/lib/tracking/server-events", () => ({
  publishServerEvent: jest.fn(),
}));

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
// Imports AFTER mocks
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { reportError } from "@/lib/error";
import { invalidateTierCache } from "@/lib/tier/crm-tier";
import { appRouterStrictRateLimit } from "@/lib/security/rate-limiter";

const mockPrisma = prisma as unknown as {
  organization: { findUnique: jest.Mock; update: jest.Mock };
  user: { findUnique: jest.Mock };
};
const mockLogAuditEvent = logAuditEvent as jest.Mock;
const mockReportError = reportError as jest.Mock;
const mockInvalidateTierCache = invalidateTierCache as jest.Mock;
const mockRateLimit = appRouterStrictRateLimit as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setAuthResponse(
  value: { email: string; userId?: string } | null,
) {
  if (value) {
    mockRequireAuthAppRouter.mockResolvedValue({
      userId: value.userId || "user-1",
      email: value.email,
      teamId: "",
      role: "MEMBER",
    });
  } else {
    mockRequireAuthAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }
}

function makeCheckoutRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:5000/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Request;
}

function makeAddonRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:5000/api/billing/ai-addon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Request;
}

/** Standard admin user with configurable org overrides */
function mockAdminUser(orgOverrides: Record<string, unknown> = {}) {
  setAuthResponse({ email: "admin@example.com", userId: "user-admin" });
  mockPrisma.user.findUnique.mockResolvedValue({
    id: "user-admin",
    email: "admin@example.com",
    teams: [
      {
        role: "ADMIN",
        team: {
          id: "team-1",
          organization: {
            id: "org-1",
            stripeCustomerId: "cus_test_123",
            stripeSubscriptionId: "sub_base_123",
            stripeAiSubscriptionId: null,
            subscriptionTier: "CRM_PRO",
            aiCrmEnabled: false,
            name: "Test Org",
            ...orgOverrides,
          },
        },
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockRateLimit.mockResolvedValue(null);
});

// ===========================================================================
// 1. POST /api/billing/checkout
// ===========================================================================

describe("POST /api/billing/checkout", () => {
  let POST: typeof import("@/app/api/billing/checkout/route").POST;

  beforeAll(async () => {
    const mod = await import("@/app/api/billing/checkout/route");
    POST = mod.POST;
  });

  // -----------------------------------------------------------------------
  // Rate Limiting
  // -----------------------------------------------------------------------

  describe("rate limiting", () => {
    it("returns 429 when rate limited", async () => {
      const rateLimitResponse = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
      mockRateLimit.mockResolvedValueOnce(rateLimitResponse);

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);

      expect(res.status).toBe(429);
      // Should not reach auth
      expect(mockRequireAuthAppRouter).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      setAuthResponse(null);

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  // -----------------------------------------------------------------------
  // Input Validation
  // -----------------------------------------------------------------------

  describe("input validation", () => {
    beforeEach(() => {
      setAuthResponse({ email: "admin@example.com" });
    });

    it("returns 400 for invalid plan value", async () => {
      const req = makeCheckoutRequest({ plan: "INVALID_PLAN", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for FREE plan (not a valid checkout plan)", async () => {
      const req = makeCheckoutRequest({ plan: "FREE", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for invalid period value", async () => {
      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "biweekly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for missing plan field", async () => {
      const req = makeCheckoutRequest({ period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for missing period field", async () => {
      const req = makeCheckoutRequest({ plan: "CRM_PRO" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for empty body", async () => {
      const req = makeCheckoutRequest({});
      const res = await POST(req as any);

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // User & Org Resolution
  // -----------------------------------------------------------------------

  describe("user and organization resolution", () => {
    it("returns 404 when user not found in database", async () => {
      setAuthResponse({ email: "ghost@example.com" });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toContain("User not found");
    });

    it("returns 403 when user has no admin role", async () => {
      setAuthResponse({ email: "member@example.com" });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-member",
        email: "member@example.com",
        teams: [
          {
            role: "MEMBER",
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

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain("admin");
    });

    it("returns 403 when user has no team organization", async () => {
      setAuthResponse({ email: "orphan@example.com" });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-orphan",
        email: "orphan@example.com",
        teams: [
          {
            role: "ADMIN",
            team: {
              id: "team-1",
              organization: null,
            },
          },
        ],
      });

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain("admin");
    });

    it("returns 403 when user has no teams at all", async () => {
      setAuthResponse({ email: "noteam@example.com" });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-noteam",
        email: "noteam@example.com",
        teams: [],
      });

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // Downgrade Prevention
  // -----------------------------------------------------------------------

  describe("downgrade prevention", () => {
    it("returns 400 when FUNDROOM user tries to checkout CRM_PRO", async () => {
      mockAdminUser({ subscriptionTier: "FUNDROOM" });

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("billing portal");
    });
  });

  // -----------------------------------------------------------------------
  // Checkout Session Creation (New Customer)
  // -----------------------------------------------------------------------

  describe("new customer checkout", () => {
    it("creates checkout session with customer_email for new customer", async () => {
      mockAdminUser({ stripeCustomerId: null, subscriptionTier: "FREE" });

      mockStripeCheckoutSessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/new_session",
        id: "cs_new_123",
      });

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.url).toBe("https://checkout.stripe.com/new_session");
      expect(data.sessionId).toBe("cs_new_123");

      expect(mockStripeCheckoutSessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_email: "admin@example.com",
          mode: "subscription",
          line_items: [
            expect.objectContaining({
              quantity: 1,
            }),
          ],
          metadata: expect.objectContaining({
            orgId: "org-1",
            teamId: "team-1",
            system: "crm",
            plan: "CRM_PRO",
            period: "monthly",
          }),
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

    it("does not include customer field for new customer", async () => {
      mockAdminUser({ stripeCustomerId: null, subscriptionTier: "FREE" });

      mockStripeCheckoutSessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/x",
        id: "cs_x",
      });

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

      const createCall = mockStripeCheckoutSessions.create.mock.calls[0][0];
      expect(createCall).not.toHaveProperty("customer");
      expect(createCall).toHaveProperty("customer_email");
    });
  });

  // -----------------------------------------------------------------------
  // Checkout Session Creation (Existing Customer)
  // -----------------------------------------------------------------------

  describe("existing customer checkout", () => {
    it("creates checkout session with customer ID for existing customer", async () => {
      mockAdminUser({
        stripeCustomerId: "cus_existing_456",
        subscriptionTier: "CRM_PRO",
      });

      mockStripeCheckoutSessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/upgrade_session",
        id: "cs_upgrade_789",
      });

      const req = makeCheckoutRequest({ plan: "FUNDROOM", period: "yearly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.url).toBe("https://checkout.stripe.com/upgrade_session");
      expect(data.sessionId).toBe("cs_upgrade_789");

      expect(mockStripeCheckoutSessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_existing_456",
          customer_update: { name: "auto" },
          mode: "subscription",
          metadata: expect.objectContaining({
            plan: "FUNDROOM",
            period: "yearly",
          }),
        }),
      );
    });

    it("does not include customer_email for existing customer", async () => {
      mockAdminUser({ stripeCustomerId: "cus_existing_abc" });

      mockStripeCheckoutSessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/x",
        id: "cs_x",
      });

      const req = makeCheckoutRequest({ plan: "FUNDROOM", period: "monthly" });
      await POST(req as any);

      const createCall = mockStripeCheckoutSessions.create.mock.calls[0][0];
      expect(createCall).toHaveProperty("customer", "cus_existing_abc");
      expect(createCall).not.toHaveProperty("customer_email");
    });
  });

  // -----------------------------------------------------------------------
  // Checkout Session Configuration
  // -----------------------------------------------------------------------

  describe("checkout session configuration", () => {
    it("includes billing_address_collection and allow_promotion_codes", async () => {
      mockAdminUser({ stripeCustomerId: null, subscriptionTier: "FREE" });

      mockStripeCheckoutSessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/x",
        id: "cs_config",
      });

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

      expect(mockStripeCheckoutSessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          billing_address_collection: "required",
          allow_promotion_codes: true,
          client_reference_id: "org-1",
        }),
      );
    });

    it("includes success and cancel URLs", async () => {
      mockAdminUser({ stripeCustomerId: null, subscriptionTier: "FREE" });

      mockStripeCheckoutSessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/x",
        id: "cs_urls",
      });

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

      const createCall = mockStripeCheckoutSessions.create.mock.calls[0][0];
      expect(createCall.success_url).toContain("success=true");
      expect(createCall.cancel_url).toContain("cancel=true");
    });
  });

  // -----------------------------------------------------------------------
  // Audit Logging
  // -----------------------------------------------------------------------

  describe("audit logging", () => {
    it("logs BILLING_CHECKOUT_STARTED event on success", async () => {
      mockAdminUser({ stripeCustomerId: null, subscriptionTier: "FREE" });

      mockStripeCheckoutSessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/x",
        id: "cs_audit_test",
      });

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      await POST(req as any);

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

    it("does not fail if audit logging throws", async () => {
      mockAdminUser({ stripeCustomerId: null, subscriptionTier: "FREE" });

      mockStripeCheckoutSessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/x",
        id: "cs_audit_err",
      });

      mockLogAuditEvent.mockRejectedValueOnce(new Error("Audit DB error"));

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);

      // Should still succeed because audit is fire-and-forget
      expect(res.status).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Role Variants
  // -----------------------------------------------------------------------

  describe("admin role variants", () => {
    it("allows OWNER role to create checkout", async () => {
      setAuthResponse({ email: "owner@example.com", userId: "user-owner" });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-owner",
        email: "owner@example.com",
        teams: [
          {
            role: "OWNER",
            team: {
              id: "team-1",
              organization: {
                id: "org-1",
                stripeCustomerId: null,
                subscriptionTier: "FREE",
                name: "Owner Org",
              },
            },
          },
        ],
      });

      mockStripeCheckoutSessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/owner",
        id: "cs_owner",
      });

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);
    });

    it("allows SUPER_ADMIN role to create checkout", async () => {
      setAuthResponse({
        email: "superadmin@example.com",
        userId: "user-sa",
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-sa",
        email: "superadmin@example.com",
        teams: [
          {
            role: "SUPER_ADMIN",
            team: {
              id: "team-1",
              organization: {
                id: "org-1",
                stripeCustomerId: null,
                subscriptionTier: "FREE",
                name: "SA Org",
              },
            },
          },
        ],
      });

      mockStripeCheckoutSessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/sa",
        id: "cs_sa",
      });

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "yearly" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);
    });

    it("rejects MANAGER role (not admin-level for billing)", async () => {
      setAuthResponse({ email: "manager@example.com" });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-mgr",
        email: "manager@example.com",
        teams: [
          {
            role: "MANAGER",
            team: {
              id: "team-1",
              organization: {
                id: "org-1",
                stripeCustomerId: null,
                subscriptionTier: "FREE",
                name: "Mgr Org",
              },
            },
          },
        ],
      });

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // Error Handling
  // -----------------------------------------------------------------------

  describe("error handling", () => {
    it("returns 500 and reports error when Stripe throws", async () => {
      mockAdminUser({ stripeCustomerId: null, subscriptionTier: "FREE" });

      mockStripeCheckoutSessions.create.mockRejectedValue(
        new Error("Stripe API outage"),
      );

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("returns 500 and reports error when Prisma throws", async () => {
      setAuthResponse({ email: "admin@example.com" });
      mockPrisma.user.findUnique.mockRejectedValue(
        new Error("Database connection lost"),
      );

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Plan and Period Combinations
  // -----------------------------------------------------------------------

  describe("plan and period combinations", () => {
    it("handles CRM_PRO monthly", async () => {
      mockAdminUser({ stripeCustomerId: null, subscriptionTier: "FREE" });
      mockStripeCheckoutSessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/x",
        id: "cs_crmpro_m",
      });

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "monthly" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);
    });

    it("handles CRM_PRO yearly", async () => {
      mockAdminUser({ stripeCustomerId: null, subscriptionTier: "FREE" });
      mockStripeCheckoutSessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/x",
        id: "cs_crmpro_y",
      });

      const req = makeCheckoutRequest({ plan: "CRM_PRO", period: "yearly" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);
    });

    it("handles FUNDROOM monthly", async () => {
      mockAdminUser({ stripeCustomerId: null, subscriptionTier: "FREE" });
      mockStripeCheckoutSessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/x",
        id: "cs_fr_m",
      });

      const req = makeCheckoutRequest({ plan: "FUNDROOM", period: "monthly" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);
    });

    it("handles FUNDROOM yearly", async () => {
      mockAdminUser({ stripeCustomerId: null, subscriptionTier: "FREE" });
      mockStripeCheckoutSessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/x",
        id: "cs_fr_y",
      });

      const req = makeCheckoutRequest({ plan: "FUNDROOM", period: "yearly" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);
    });

    it("allows CRM_PRO to upgrade to FUNDROOM via checkout", async () => {
      mockAdminUser({
        stripeCustomerId: "cus_upgrade",
        subscriptionTier: "CRM_PRO",
      });
      mockStripeCheckoutSessions.create.mockResolvedValue({
        url: "https://checkout.stripe.com/upgrade",
        id: "cs_upgrade",
      });

      const req = makeCheckoutRequest({ plan: "FUNDROOM", period: "monthly" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);
    });
  });
});

// ===========================================================================
// 2. POST /api/billing/ai-addon
// ===========================================================================

describe("POST /api/billing/ai-addon", () => {
  let POST: typeof import("@/app/api/billing/ai-addon/route").POST;

  beforeAll(async () => {
    const mod = await import("@/app/api/billing/ai-addon/route");
    POST = mod.POST;
  });

  // -----------------------------------------------------------------------
  // Rate Limiting
  // -----------------------------------------------------------------------

  describe("rate limiting", () => {
    it("returns 429 when rate limited", async () => {
      const rateLimitResponse = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
      mockRateLimit.mockResolvedValueOnce(rateLimitResponse);

      const req = makeAddonRequest({ action: "subscribe", period: "monthly" });
      const res = await POST(req as any);

      expect(res.status).toBe(429);
      expect(mockRequireAuthAppRouter).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      setAuthResponse(null);

      const req = makeAddonRequest({ action: "subscribe", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  // -----------------------------------------------------------------------
  // Input Validation
  // -----------------------------------------------------------------------

  describe("input validation", () => {
    beforeEach(() => {
      setAuthResponse({ email: "admin@example.com" });
    });

    it("returns 400 for invalid action", async () => {
      const req = makeAddonRequest({ action: "pause" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for missing action field", async () => {
      const req = makeAddonRequest({ period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Validation failed");
    });

    it("returns 400 for empty body", async () => {
      const req = makeAddonRequest({});
      const res = await POST(req as any);

      expect(res.status).toBe(400);
    });

    it("accepts subscribe action without period (defaults to monthly)", async () => {
      mockAdminUser();
      const trialEnd = Math.floor(Date.now() / 1000) + 86400 * 14;
      mockStripeSubscriptions.create.mockResolvedValue({
        id: "sub_no_period",
        status: "trialing",
        trial_end: trialEnd,
      });
      mockPrisma.organization.update.mockResolvedValue({});

      const req = makeAddonRequest({ action: "subscribe" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);
    });

    it("accepts cancel action without period", async () => {
      mockAdminUser({
        aiCrmEnabled: true,
        stripeAiSubscriptionId: "sub_ai_cancel_val",
      });
      mockStripeSubscriptions.update.mockResolvedValue({});

      const req = makeAddonRequest({ action: "cancel" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // User & Org Resolution
  // -----------------------------------------------------------------------

  describe("user and organization resolution", () => {
    it("returns 404 when user not found", async () => {
      setAuthResponse({ email: "ghost@example.com" });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const req = makeAddonRequest({ action: "subscribe", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toContain("User not found");
    });

    it("returns 403 when user has no admin role", async () => {
      setAuthResponse({ email: "member@example.com" });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-member",
        email: "member@example.com",
        teams: [
          {
            role: "MEMBER",
            team: {
              id: "team-1",
              organization: {
                id: "org-1",
                stripeCustomerId: "cus_x",
                subscriptionTier: "CRM_PRO",
                aiCrmEnabled: false,
              },
            },
          },
        ],
      });

      const req = makeAddonRequest({ action: "subscribe", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain("admin");
    });

    it("returns 403 when user has no organization", async () => {
      setAuthResponse({ email: "orphan@example.com" });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-orphan",
        email: "orphan@example.com",
        teams: [],
      });

      const req = makeAddonRequest({ action: "subscribe", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe Action
  // -----------------------------------------------------------------------

  describe("subscribe action", () => {
    it("returns 400 when org is on FREE tier", async () => {
      mockAdminUser({ subscriptionTier: "FREE", stripeCustomerId: null });

      const req = makeAddonRequest({ action: "subscribe", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("active CRM Pro or FundRoom");
    });

    it("returns 400 when org has no stripeCustomerId", async () => {
      mockAdminUser({
        subscriptionTier: "CRM_PRO",
        stripeCustomerId: null,
      });

      const req = makeAddonRequest({ action: "subscribe", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("active CRM Pro or FundRoom");
    });

    it("returns 409 when AI CRM is already active", async () => {
      mockAdminUser({
        aiCrmEnabled: true,
        stripeAiSubscriptionId: "sub_ai_existing",
      });

      const req = makeAddonRequest({ action: "subscribe", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.error).toContain("already active");
    });

    it("creates AI add-on subscription with 14-day trial (monthly)", async () => {
      mockAdminUser();

      const trialEnd = Math.floor(Date.now() / 1000) + 86400 * 14;
      mockStripeSubscriptions.create.mockResolvedValue({
        id: "sub_ai_new_monthly",
        status: "trialing",
        trial_end: trialEnd,
      });
      mockPrisma.organization.update.mockResolvedValue({});

      const req = makeAddonRequest({ action: "subscribe", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.subscriptionId).toBe("sub_ai_new_monthly");
      expect(data.status).toBe("trialing");
      expect(data.trialEndsAt).toBeTruthy();

      expect(mockStripeSubscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_test_123",
          trial_period_days: 14,
          items: [
            expect.objectContaining({
              price: expect.any(String),
            }),
          ],
          metadata: expect.objectContaining({
            orgId: "org-1",
            system: "crm",
            addon: "AI_CRM",
          }),
        }),
      );
    });

    it("creates AI add-on subscription with yearly period", async () => {
      mockAdminUser();

      const trialEnd = Math.floor(Date.now() / 1000) + 86400 * 14;
      mockStripeSubscriptions.create.mockResolvedValue({
        id: "sub_ai_new_yearly",
        status: "trialing",
        trial_end: trialEnd,
      });
      mockPrisma.organization.update.mockResolvedValue({});

      const req = makeAddonRequest({ action: "subscribe", period: "yearly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.subscriptionId).toBe("sub_ai_new_yearly");
    });

    it("updates organization with AI CRM fields", async () => {
      mockAdminUser();

      const trialEnd = Math.floor(Date.now() / 1000) + 86400 * 14;
      mockStripeSubscriptions.create.mockResolvedValue({
        id: "sub_ai_update",
        status: "trialing",
        trial_end: trialEnd,
      });
      mockPrisma.organization.update.mockResolvedValue({});

      const req = makeAddonRequest({ action: "subscribe", period: "monthly" });
      await POST(req as any);

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "org-1" },
          data: expect.objectContaining({
            aiCrmEnabled: true,
            stripeAiSubscriptionId: "sub_ai_update",
            aiCrmTrialEndsAt: expect.any(Date),
          }),
        }),
      );
    });

    it("invalidates tier cache after subscription", async () => {
      mockAdminUser();

      mockStripeSubscriptions.create.mockResolvedValue({
        id: "sub_ai_cache",
        status: "trialing",
        trial_end: Math.floor(Date.now() / 1000) + 86400 * 14,
      });
      mockPrisma.organization.update.mockResolvedValue({});

      const req = makeAddonRequest({ action: "subscribe", period: "monthly" });
      await POST(req as any);

      expect(mockInvalidateTierCache).toHaveBeenCalledWith("org-1");
    });

    it("logs AI_CRM_ADDON_SUBSCRIBED audit event", async () => {
      mockAdminUser();

      mockStripeSubscriptions.create.mockResolvedValue({
        id: "sub_ai_audit",
        status: "trialing",
        trial_end: Math.floor(Date.now() / 1000) + 86400 * 14,
      });
      mockPrisma.organization.update.mockResolvedValue({});

      const req = makeAddonRequest({ action: "subscribe", period: "monthly" });
      await POST(req as any);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "AI_CRM_ADDON_SUBSCRIBED",
          resourceType: "Organization",
          resourceId: "org-1",
          userId: "user-admin",
          metadata: expect.objectContaining({
            subscriptionId: "sub_ai_audit",
            period: "monthly",
          }),
        }),
      );
    });

    it("handles null trial_end from Stripe", async () => {
      mockAdminUser();

      mockStripeSubscriptions.create.mockResolvedValue({
        id: "sub_ai_no_trial",
        status: "active",
        trial_end: null,
      });
      mockPrisma.organization.update.mockResolvedValue({});

      const req = makeAddonRequest({ action: "subscribe", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.trialEndsAt).toBeNull();

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            aiCrmTrialEndsAt: null,
          }),
        }),
      );
    });

    it("works for FUNDROOM tier users", async () => {
      mockAdminUser({ subscriptionTier: "FUNDROOM" });

      mockStripeSubscriptions.create.mockResolvedValue({
        id: "sub_ai_fundroom",
        status: "trialing",
        trial_end: Math.floor(Date.now() / 1000) + 86400 * 14,
      });
      mockPrisma.organization.update.mockResolvedValue({});

      const req = makeAddonRequest({ action: "subscribe", period: "monthly" });
      const res = await POST(req as any);

      expect(res.status).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Cancel Action
  // -----------------------------------------------------------------------

  describe("cancel action", () => {
    it("returns 400 when no AI subscription exists", async () => {
      mockAdminUser({ stripeAiSubscriptionId: null });

      const req = makeAddonRequest({ action: "cancel" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("No active AI CRM subscription");
    });

    it("cancels at period end (not immediately)", async () => {
      mockAdminUser({
        aiCrmEnabled: true,
        stripeAiSubscriptionId: "sub_ai_to_cancel",
      });
      mockStripeSubscriptions.update.mockResolvedValue({});

      const req = makeAddonRequest({ action: "cancel" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toContain("cancelled at the end");
      expect(data.subscriptionId).toBe("sub_ai_to_cancel");

      expect(mockStripeSubscriptions.update).toHaveBeenCalledWith(
        "sub_ai_to_cancel",
        expect.objectContaining({
          cancel_at_period_end: true,
          cancellation_details: expect.objectContaining({
            comment: expect.any(String),
          }),
        }),
      );
    });

    it("does not disable aiCrmEnabled immediately (webhook handles it)", async () => {
      mockAdminUser({
        aiCrmEnabled: true,
        stripeAiSubscriptionId: "sub_ai_cancel_wait",
      });
      mockStripeSubscriptions.update.mockResolvedValue({});

      const req = makeAddonRequest({ action: "cancel" });
      await POST(req as any);

      // organization.update should NOT be called for cancel — only webhook does that
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it("logs AI_CRM_ADDON_CANCELLED audit event", async () => {
      mockAdminUser({
        aiCrmEnabled: true,
        stripeAiSubscriptionId: "sub_ai_cancel_audit",
      });
      mockStripeSubscriptions.update.mockResolvedValue({});

      const req = makeAddonRequest({ action: "cancel" });
      await POST(req as any);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "AI_CRM_ADDON_CANCELLED",
          resourceType: "Organization",
          resourceId: "org-1",
          userId: "user-admin",
          metadata: expect.objectContaining({
            subscriptionId: "sub_ai_cancel_audit",
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Invalid Action (catch-all)
  // -----------------------------------------------------------------------

  describe("invalid action after validation", () => {
    // This scenario is unlikely with Zod validation, but tests the catch-all
    it("schema only allows subscribe and cancel actions", async () => {
      setAuthResponse({ email: "admin@example.com" });

      const req = makeAddonRequest({ action: "upgrade" });
      const res = await POST(req as any);

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // Error Handling
  // -----------------------------------------------------------------------

  describe("error handling", () => {
    it("returns 500 when Stripe subscription create fails", async () => {
      mockAdminUser();

      mockStripeSubscriptions.create.mockRejectedValue(
        new Error("Stripe network error"),
      );

      const req = makeAddonRequest({ action: "subscribe", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("returns 500 when Stripe subscription update fails (cancel)", async () => {
      mockAdminUser({
        aiCrmEnabled: true,
        stripeAiSubscriptionId: "sub_ai_fail_cancel",
      });

      mockStripeSubscriptions.update.mockRejectedValue(
        new Error("Stripe rate limited"),
      );

      const req = makeAddonRequest({ action: "cancel" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalled();
    });

    it("returns 500 when Prisma update fails after successful Stripe call", async () => {
      mockAdminUser();

      mockStripeSubscriptions.create.mockResolvedValue({
        id: "sub_ai_prisma_fail",
        status: "trialing",
        trial_end: Math.floor(Date.now() / 1000) + 86400 * 14,
      });
      mockPrisma.organization.update.mockRejectedValue(
        new Error("DB write failure"),
      );

      const req = makeAddonRequest({ action: "subscribe", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });

    it("returns 500 when user query fails", async () => {
      setAuthResponse({ email: "admin@example.com" });
      mockPrisma.user.findUnique.mockRejectedValue(
        new Error("Connection timeout"),
      );

      const req = makeAddonRequest({ action: "subscribe", period: "monthly" });
      const res = await POST(req as any);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
