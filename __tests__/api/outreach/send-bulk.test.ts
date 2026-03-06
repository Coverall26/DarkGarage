/**
 * Comprehensive tests for CRM Outreach Send & Bulk API routes:
 *   POST /api/outreach/send  — Send a single outreach email to a contact
 *   POST /api/outreach/bulk  — Send outreach emails to multiple contacts
 *
 * Tests cover: authentication, CRM role enforcement, input validation,
 * contact lookup, tier gating (bulk only), email sending, error handling,
 * and partial failure scenarios.
 */

// ---------------------------------------------------------------------------
// jest.mock declarations — hoisted before imports
// ---------------------------------------------------------------------------

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth/auth-options", () => ({
  authOptions: {},
}));

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterRateLimit: jest.fn(() => Promise.resolve(null)),
}));

jest.mock("@/lib/audit/audit-logger", () => ({
  logAuditEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/outreach/send-email", () => ({
  sendOutreachEmail: jest.fn(),
  sendBulkOutreachEmail: jest.fn(),
  interpolateMergeVars: jest.fn((template: string) => template),
  MergeContext: {},
}));

jest.mock("@/lib/tier/crm-tier", () => ({
  resolveOrgTier: jest.fn(),
  invalidateTierCache: jest.fn(),
}));

jest.mock("@/lib/auth/crm-roles", () => ({
  resolveCrmRole: jest.fn(),
  hasCrmPermission: jest.fn(),
  enforceCrmRoleAppRouter: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    contact: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    contactActivity: {
      create: jest.fn(() => Promise.resolve({ id: "activity-1" })),
    },
    userTeam: {
      findFirst: jest.fn(),
    },
    team: {
      findUnique: jest.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Imports — AFTER all jest.mock calls
// ---------------------------------------------------------------------------

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { sendOutreachEmail, sendBulkOutreachEmail } from "@/lib/outreach/send-email";
import { resolveOrgTier } from "@/lib/tier/crm-tier";
import { resolveCrmRole, hasCrmPermission } from "@/lib/auth/crm-roles";

// ---------------------------------------------------------------------------
// Type-safe mock references
// ---------------------------------------------------------------------------

const mockGetServerSession = getServerSession as jest.Mock;
const mockAppRouterRateLimit = appRouterRateLimit as jest.Mock;
const mockReportError = reportError as jest.Mock;
const mockSendOutreachEmail = sendOutreachEmail as jest.Mock;
const mockSendBulkOutreachEmail = sendBulkOutreachEmail as jest.Mock;
const mockResolveOrgTier = resolveOrgTier as jest.Mock;
const mockResolveCrmRole = resolveCrmRole as jest.Mock;
const mockHasCrmPermission = hasCrmPermission as jest.Mock;

const mockPrisma = prisma as unknown as {
  contact: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  contactActivity: { create: jest.Mock };
  userTeam: { findFirst: jest.Mock };
  team: { findUnique: jest.Mock };
};

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const VALID_SESSION = {
  user: { id: "user-1", email: "gp@test.com", name: "GP User" },
  expires: "2099-01-01",
};

const VALID_USER_TEAM = {
  role: "ADMIN",
  crmRole: "MANAGER",
  team: { id: "team-1", name: "Acme Capital", organizationId: "org-1" },
  user: { name: "GP User", email: "gp@test.com" },
};

const VALID_CONTACT = {
  id: "contact-1",
  email: "jane@acme.com",
  firstName: "Jane",
  lastName: "Smith",
  company: "Acme Inc",
  title: "Partner",
  teamId: "team-1",
  unsubscribedAt: null,
  emailBounced: false,
};

const CRM_PRO_TIER = {
  tier: "CRM_PRO",
  aiCrmEnabled: false,
  maxContacts: null,
  maxEsigsPerMonth: 25,
  maxSignerStorage: 100,
  emailTemplateLimit: 5,
  hasKanban: true,
  hasOutreachQueue: true,
  hasEmailTracking: true,
  hasLpOnboarding: false,
  hasAiFeatures: false,
  pipelineStages: ["LEAD", "CONTACTED", "INTERESTED", "CONVERTED"],
};

const FREE_TIER = {
  ...CRM_PRO_TIER,
  tier: "FREE",
  maxContacts: 20,
  maxEsigsPerMonth: 10,
  emailTemplateLimit: 2,
  hasKanban: false,
  hasOutreachQueue: false,
  hasEmailTracking: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string, body: Record<string, unknown>): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Set up the default "happy path" mocks for the send route.
 */
function setupSendDefaults() {
  mockGetServerSession.mockResolvedValue(VALID_SESSION);
  mockAppRouterRateLimit.mockResolvedValue(null);
  mockPrisma.userTeam.findFirst.mockResolvedValue(VALID_USER_TEAM);
  mockResolveCrmRole.mockReturnValue("MANAGER");
  mockHasCrmPermission.mockReturnValue(true);
  mockPrisma.contact.findFirst.mockResolvedValue(VALID_CONTACT);
  mockSendOutreachEmail.mockResolvedValue({
    success: true,
    emailId: "resend-email-123",
  });
}

/**
 * Set up the default "happy path" mocks for the bulk route.
 */
function setupBulkDefaults() {
  mockGetServerSession.mockResolvedValue(VALID_SESSION);
  mockAppRouterRateLimit.mockResolvedValue(null);
  mockPrisma.userTeam.findFirst.mockResolvedValue(VALID_USER_TEAM);
  mockResolveCrmRole.mockReturnValue("MANAGER");
  mockHasCrmPermission.mockReturnValue(true);
  mockResolveOrgTier.mockResolvedValue(CRM_PRO_TIER);
  mockSendBulkOutreachEmail.mockResolvedValue({
    total: 2,
    sent: 2,
    skipped: 0,
    failed: 0,
    results: [
      { contactId: "c1", success: true },
      { contactId: "c2", success: true },
    ],
  });
}

// =========================================================================
// POST /api/outreach/send
// =========================================================================

describe("POST /api/outreach/send", () => {
  let handler: (req: Request) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/outreach/send/route");
    handler = mod.POST as unknown as (req: Request) => Promise<Response>;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setupSendDefaults();
  });

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------

  describe("Authentication", () => {
    test("returns 401 when session is null", async () => {
      mockGetServerSession.mockResolvedValueOnce(null);

      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized");
    });

    test("returns 401 when session has no user id", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { email: "gp@test.com" },
        expires: "2099-01-01",
      });

      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(401);
    });

    test("returns 403 when user has no team", async () => {
      mockPrisma.userTeam.findFirst.mockResolvedValueOnce(null);

      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("No team found");
    });

    test("returns 403 when userTeam has no team object", async () => {
      mockPrisma.userTeam.findFirst.mockResolvedValueOnce({
        role: "ADMIN",
        crmRole: "MANAGER",
        team: null,
        user: { name: "GP", email: "gp@test.com" },
      });

      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // CRM Role Enforcement
  // -----------------------------------------------------------------------

  describe("CRM Role Enforcement", () => {
    test("returns 403 when CRM role is insufficient (VIEWER)", async () => {
      mockResolveCrmRole.mockReturnValueOnce("VIEWER");
      mockHasCrmPermission.mockReturnValueOnce(false);

      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("MANAGER");
    });

    test("returns 403 when CRM role is CONTRIBUTOR (needs MANAGER)", async () => {
      mockResolveCrmRole.mockReturnValueOnce("CONTRIBUTOR");
      mockHasCrmPermission.mockReturnValueOnce(false);

      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("CRM MANAGER role required");
    });

    test("calls resolveCrmRole with team role and crmRole from userTeam", async () => {
      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        subject: "Hi",
        body: "Hello",
      });

      await handler(req);

      expect(mockResolveCrmRole).toHaveBeenCalledWith("ADMIN", "MANAGER");
    });

    test("calls hasCrmPermission with resolved role and MANAGER minimum", async () => {
      mockResolveCrmRole.mockReturnValueOnce("MANAGER");

      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        subject: "Hi",
        body: "Hello",
      });

      await handler(req);

      expect(mockHasCrmPermission).toHaveBeenCalledWith("MANAGER", "MANAGER");
    });
  });

  // -----------------------------------------------------------------------
  // Input Validation
  // -----------------------------------------------------------------------

  describe("Input Validation", () => {
    test("returns 400 when contactId is missing", async () => {
      const req = makeRequest("http://localhost/api/outreach/send", {
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("contactId");
    });

    test("returns 400 when contactId is not a string", async () => {
      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: 123,
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("contactId");
    });

    test("returns 400 when subject is missing", async () => {
      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("subject");
    });

    test("returns 400 when subject is empty string", async () => {
      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        subject: "   ",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("subject");
    });

    test("returns 400 when subject is a non-string type", async () => {
      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        subject: 42,
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
    });

    test("returns 400 when body is missing", async () => {
      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        subject: "Hi",
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("body");
    });

    test("returns 400 when body is empty/whitespace", async () => {
      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        subject: "Hi",
        body: "  ",
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("body");
    });

    test("returns 400 when body is a non-string type", async () => {
      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        subject: "Hello",
        body: { html: "<p>test</p>" },
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // Contact Lookup
  // -----------------------------------------------------------------------

  describe("Contact Lookup", () => {
    test("returns 404 when contact is not found", async () => {
      mockPrisma.contact.findFirst.mockResolvedValueOnce(null);

      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "nonexistent",
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe("Contact not found");
    });

    test("scopes contact lookup to user's team", async () => {
      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        subject: "Hi",
        body: "Hello",
      });

      await handler(req);

      expect(mockPrisma.contact.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "c1", teamId: "team-1" },
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Successful Email Sending
  // -----------------------------------------------------------------------

  describe("Successful Send", () => {
    test("sends email and returns 200 with emailId", async () => {
      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "contact-1",
        subject: "Hello {{contact.firstName}}",
        body: "<p>Hi there</p>",
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.emailId).toBe("resend-email-123");
    });

    test("calls sendOutreachEmail with correct payload", async () => {
      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "contact-1",
        subject: "Test Subject",
        body: "<p>Test body</p>",
        trackOpens: true,
        templateId: "tmpl-1",
      });

      await handler(req);

      expect(mockSendOutreachEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          contactId: "contact-1",
          teamId: "team-1",
          actorId: "user-1",
          trackOpens: true,
          templateId: "tmpl-1",
        }),
      );
    });

    test("passes trimmed subject and body to sendOutreachEmail", async () => {
      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "contact-1",
        subject: "  Hello  ",
        body: "  <p>world</p>  ",
      });

      await handler(req);

      // The route calls interpolateMergeVars on trimmed inputs; our mock returns them as-is
      const call = mockSendOutreachEmail.mock.calls[0][0];
      // The subject and body are interpolated versions of trimmed inputs
      expect(call.subject).not.toMatch(/^\s/);
      expect(call.body).not.toMatch(/^\s/);
    });

    test("defaults trackOpens to false when not provided", async () => {
      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "contact-1",
        subject: "Hi",
        body: "Body",
      });

      await handler(req);

      const call = mockSendOutreachEmail.mock.calls[0][0];
      expect(call.trackOpens).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Send Failures (sendOutreachEmail returns error)
  // -----------------------------------------------------------------------

  describe("Send Failures", () => {
    test("returns 422 when contact is unsubscribed", async () => {
      mockSendOutreachEmail.mockResolvedValueOnce({
        success: false,
        error: "UNSUBSCRIBED",
      });

      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "contact-1",
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error).toBe("UNSUBSCRIBED");
    });

    test("returns 422 when contact email has bounced", async () => {
      mockSendOutreachEmail.mockResolvedValueOnce({
        success: false,
        error: "BOUNCED",
      });

      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "contact-1",
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error).toBe("BOUNCED");
    });

    test("returns 404 when sendOutreachEmail reports CONTACT_NOT_FOUND", async () => {
      mockSendOutreachEmail.mockResolvedValueOnce({
        success: false,
        error: "CONTACT_NOT_FOUND",
      });

      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "contact-1",
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(404);
    });

    test("returns 403 when sendOutreachEmail reports TEAM_MISMATCH", async () => {
      mockSendOutreachEmail.mockResolvedValueOnce({
        success: false,
        error: "TEAM_MISMATCH",
      });

      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "contact-1",
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(403);
    });

    test("returns 500 for unknown send errors", async () => {
      mockSendOutreachEmail.mockResolvedValueOnce({
        success: false,
        error: "SEND_FAILED",
      });

      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "contact-1",
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe("SEND_FAILED");
    });

    test("returns 500 for null error code in failed result", async () => {
      mockSendOutreachEmail.mockResolvedValueOnce({
        success: false,
        error: undefined,
      });

      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "contact-1",
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(500);
    });
  });

  // -----------------------------------------------------------------------
  // Error Handling (exceptions)
  // -----------------------------------------------------------------------

  describe("Error Handling", () => {
    test("returns 500 and calls reportError on unexpected exception", async () => {
      mockPrisma.userTeam.findFirst.mockRejectedValueOnce(
        new Error("Database connection lost"),
      );

      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalledTimes(1);
    });

    test("returns 500 when contact.findFirst throws", async () => {
      mockPrisma.contact.findFirst.mockRejectedValueOnce(
        new Error("Prisma query failed"),
      );

      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(500);
      expect(mockReportError).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Rate Limiting
  // -----------------------------------------------------------------------

  describe("Rate Limiting", () => {
    test("returns rate limit response when blocked", async () => {
      const rateLimitResponse = new Response(
        JSON.stringify({ error: "Too many requests" }),
        { status: 429 },
      );
      mockAppRouterRateLimit.mockResolvedValueOnce(rateLimitResponse);

      const req = makeRequest("http://localhost/api/outreach/send", {
        contactId: "c1",
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(429);
      // Should not reach session check
      expect(mockGetServerSession).not.toHaveBeenCalled();
    });
  });
});

// =========================================================================
// POST /api/outreach/bulk
// =========================================================================

describe("POST /api/outreach/bulk", () => {
  let handler: (req: Request) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/outreach/bulk/route");
    handler = mod.POST as unknown as (req: Request) => Promise<Response>;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setupBulkDefaults();
  });

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------

  describe("Authentication", () => {
    test("returns 401 when session is null", async () => {
      mockGetServerSession.mockResolvedValueOnce(null);

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Unauthorized");
    });

    test("returns 401 when session user has no id", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { email: "gp@test.com" },
        expires: "2099-01-01",
      });

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(401);
    });

    test("returns 403 when user has no team", async () => {
      mockPrisma.userTeam.findFirst.mockResolvedValueOnce(null);

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe("No team found");
    });

    test("returns 403 when userTeam has no team object", async () => {
      mockPrisma.userTeam.findFirst.mockResolvedValueOnce({
        role: "ADMIN",
        crmRole: "MANAGER",
        team: null,
      });

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // CRM Role Enforcement
  // -----------------------------------------------------------------------

  describe("CRM Role Enforcement", () => {
    test("returns 403 when CRM role is VIEWER", async () => {
      mockResolveCrmRole.mockReturnValueOnce("VIEWER");
      mockHasCrmPermission.mockReturnValueOnce(false);

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("MANAGER");
    });

    test("returns 403 when CRM role is CONTRIBUTOR", async () => {
      mockResolveCrmRole.mockReturnValueOnce("CONTRIBUTOR");
      mockHasCrmPermission.mockReturnValueOnce(false);

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("CRM MANAGER role required");
    });

    test("passes with MANAGER role", async () => {
      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1", "c2"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Tier Gating
  // -----------------------------------------------------------------------

  describe("Tier Gating", () => {
    test("returns 403 when tier does not have email tracking (FREE tier)", async () => {
      mockResolveOrgTier.mockResolvedValueOnce(FREE_TIER);

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("CRM Pro");
      expect(data.upgradeUrl).toBe("/admin/settings?tab=billing");
    });

    test("allows CRM_PRO tier with email tracking", async () => {
      mockResolveOrgTier.mockResolvedValueOnce(CRM_PRO_TIER);

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
    });

    test("allows FUNDROOM tier", async () => {
      mockResolveOrgTier.mockResolvedValueOnce({
        ...CRM_PRO_TIER,
        tier: "FUNDROOM",
        hasEmailTracking: true,
      });

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
    });

    test("calls resolveOrgTier with the organization ID from userTeam", async () => {
      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "Hello",
      });

      await handler(req);

      expect(mockResolveOrgTier).toHaveBeenCalledWith("org-1");
    });

    test("skips tier check when orgId is null", async () => {
      mockPrisma.userTeam.findFirst.mockResolvedValueOnce({
        role: "ADMIN",
        crmRole: "MANAGER",
        team: { id: "team-1", organizationId: null },
      });

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      // Should proceed past tier check — reaches validation and sendBulkOutreachEmail
      expect(mockResolveOrgTier).not.toHaveBeenCalled();
      expect(res.status).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Input Validation
  // -----------------------------------------------------------------------

  describe("Input Validation", () => {
    test("returns 400 when contactIds is not provided", async () => {
      const req = makeRequest("http://localhost/api/outreach/bulk", {
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("contactIds");
    });

    test("returns 400 when contactIds is not an array", async () => {
      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: "c1",
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("contactIds");
    });

    test("returns 400 when contactIds is an empty array", async () => {
      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: [],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("contactIds");
    });

    test("returns 400 when contactIds exceeds 50", async () => {
      const ids = Array.from({ length: 51 }, (_, i) => `c${i}`);

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ids,
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("50");
    });

    test("returns 400 when subject is missing", async () => {
      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("subject");
    });

    test("returns 400 when subject is empty/whitespace", async () => {
      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "   ",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
    });

    test("returns 400 when body is missing", async () => {
      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("body");
    });

    test("returns 400 when body is empty/whitespace", async () => {
      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "  ",
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
    });

    test("returns 400 when subject is a non-string type", async () => {
      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: 42,
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
    });

    test("returns 400 when body is a non-string type", async () => {
      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: false,
      });

      const res = await handler(req);
      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // Successful Bulk Send
  // -----------------------------------------------------------------------

  describe("Successful Bulk Send", () => {
    test("sends to multiple contacts and returns 200 with results", async () => {
      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1", "c2"],
        subject: "Hi {{contact.firstName}}",
        body: "<p>Hello</p>",
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(2);
      expect(data.sent).toBe(2);
      expect(data.skipped).toBe(0);
      expect(data.failed).toBe(0);
      expect(data.results).toHaveLength(2);
    });

    test("calls sendBulkOutreachEmail with correct payload", async () => {
      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1", "c2", "c3"],
        subject: "Test Subject",
        body: "<p>Test body</p>",
        trackOpens: true,
        templateId: "tmpl-1",
      });

      await handler(req);

      expect(mockSendBulkOutreachEmail).toHaveBeenCalledWith({
        contactIds: ["c1", "c2", "c3"],
        teamId: "team-1",
        subject: "Test Subject",
        bodyTemplate: "<p>Test body</p>",
        actorId: "user-1",
        trackOpens: true,
        templateId: "tmpl-1",
      });
    });

    test("trims subject and body before passing to sendBulkOutreachEmail", async () => {
      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "  Hello World  ",
        body: "  <p>Content</p>  ",
      });

      await handler(req);

      const call = mockSendBulkOutreachEmail.mock.calls[0][0];
      expect(call.subject).toBe("Hello World");
      expect(call.bodyTemplate).toBe("<p>Content</p>");
    });

    test("defaults trackOpens to false when not provided", async () => {
      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "Hello",
      });

      await handler(req);

      const call = mockSendBulkOutreachEmail.mock.calls[0][0];
      expect(call.trackOpens).toBe(false);
    });

    test("sends to single contact in bulk mode", async () => {
      mockSendBulkOutreachEmail.mockResolvedValueOnce({
        total: 1,
        sent: 1,
        skipped: 0,
        failed: 0,
        results: [{ contactId: "c1", success: true }],
      });

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(1);
      expect(data.sent).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Partial Failures
  // -----------------------------------------------------------------------

  describe("Partial Failures", () => {
    test("returns 200 with partial results when some contacts fail", async () => {
      mockSendBulkOutreachEmail.mockResolvedValueOnce({
        total: 3,
        sent: 1,
        skipped: 1,
        failed: 1,
        results: [
          { contactId: "c1", success: true },
          { contactId: "c2", success: false, error: "UNSUBSCRIBED" },
          { contactId: "c3", success: false, error: "SEND_FAILED" },
        ],
      });

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1", "c2", "c3"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(3);
      expect(data.sent).toBe(1);
      expect(data.skipped).toBe(1);
      expect(data.failed).toBe(1);

      // Verify individual results
      const successResult = data.results.find(
        (r: { contactId: string }) => r.contactId === "c1",
      );
      expect(successResult.success).toBe(true);

      const unsubResult = data.results.find(
        (r: { contactId: string }) => r.contactId === "c2",
      );
      expect(unsubResult.success).toBe(false);
      expect(unsubResult.error).toBe("UNSUBSCRIBED");

      const failedResult = data.results.find(
        (r: { contactId: string }) => r.contactId === "c3",
      );
      expect(failedResult.success).toBe(false);
      expect(failedResult.error).toBe("SEND_FAILED");
    });

    test("returns 200 with all failures when all contacts bounce", async () => {
      mockSendBulkOutreachEmail.mockResolvedValueOnce({
        total: 2,
        sent: 0,
        skipped: 2,
        failed: 0,
        results: [
          { contactId: "c1", success: false, error: "BOUNCED" },
          { contactId: "c2", success: false, error: "BOUNCED" },
        ],
      });

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1", "c2"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sent).toBe(0);
      expect(data.skipped).toBe(2);
    });

    test("returns 200 with mixed unsubscribed and send failures", async () => {
      mockSendBulkOutreachEmail.mockResolvedValueOnce({
        total: 4,
        sent: 2,
        skipped: 1,
        failed: 1,
        results: [
          { contactId: "c1", success: true },
          { contactId: "c2", success: true },
          { contactId: "c3", success: false, error: "UNSUBSCRIBED" },
          { contactId: "c4", success: false, error: "SEND_FAILED" },
        ],
      });

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1", "c2", "c3", "c4"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      const data = await res.json();
      expect(data.total).toBe(4);
      expect(data.sent).toBe(2);
      expect(data.skipped).toBe(1);
      expect(data.failed).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Error Handling
  // -----------------------------------------------------------------------

  describe("Error Handling", () => {
    test("returns 500 and calls reportError on unexpected exception", async () => {
      mockSendBulkOutreachEmail.mockRejectedValueOnce(
        new Error("Network failure"),
      );

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalledTimes(1);
    });

    test("returns 500 when userTeam query throws", async () => {
      mockPrisma.userTeam.findFirst.mockRejectedValueOnce(
        new Error("DB timeout"),
      );

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(500);
      expect(mockReportError).toHaveBeenCalled();
    });

    test("returns 500 when resolveOrgTier throws", async () => {
      mockResolveOrgTier.mockRejectedValueOnce(
        new Error("Tier resolution failed"),
      );

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(500);
      expect(mockReportError).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Rate Limiting
  // -----------------------------------------------------------------------

  describe("Rate Limiting", () => {
    test("returns rate limit response when blocked", async () => {
      const rateLimitResponse = new Response(
        JSON.stringify({ error: "Too many requests" }),
        { status: 429 },
      );
      mockAppRouterRateLimit.mockResolvedValueOnce(rateLimitResponse);

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ["c1"],
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(429);
      expect(mockGetServerSession).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Exactly 50 contacts (boundary)
  // -----------------------------------------------------------------------

  describe("Boundary: 50 contacts", () => {
    test("accepts exactly 50 contactIds", async () => {
      const ids = Array.from({ length: 50 }, (_, i) => `c${i}`);
      mockSendBulkOutreachEmail.mockResolvedValueOnce({
        total: 50,
        sent: 50,
        skipped: 0,
        failed: 0,
        results: ids.map((id) => ({ contactId: id, success: true })),
      });

      const req = makeRequest("http://localhost/api/outreach/bulk", {
        contactIds: ids,
        subject: "Hi",
        body: "Hello",
      });

      const res = await handler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.total).toBe(50);
    });
  });
});
