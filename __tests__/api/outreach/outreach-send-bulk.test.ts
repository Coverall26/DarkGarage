/**
 * Comprehensive Jest tests for CRM Outreach Send & Bulk API routes:
 *   POST /api/outreach/send  — Send a single outreach email to a contact
 *   POST /api/outreach/bulk  — Send outreach emails to multiple contacts
 *
 * Tests cover: authentication, rate limiting, CRM role enforcement,
 * input validation, contact lookup, tier gating (bulk), merge variable
 * interpolation, email sending, error mapping, partial failures, and
 * boundary conditions.
 */

// ---------------------------------------------------------------------------
// Mock function declarations — MUST be before jest.mock() calls
// ---------------------------------------------------------------------------
const mockGetServerSession = jest.fn();
const mockAppRouterRateLimit = jest.fn();
const mockReportError = jest.fn();
const mockSendOutreachEmail = jest.fn();
const mockSendBulkOutreachEmail = jest.fn();
const mockInterpolateMergeVars = jest.fn((template: string) => template);
const mockResolveCrmRole = jest.fn();
const mockHasCrmPermission = jest.fn();
const mockResolveOrgTier = jest.fn();

// ---------------------------------------------------------------------------
// jest.mock() calls — hoisted by Jest
// ---------------------------------------------------------------------------
jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

jest.mock("next-auth/next", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

jest.mock("@/lib/auth/auth-options", () => ({
  authOptions: {},
}));

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterRateLimit: (...args: unknown[]) => mockAppRouterRateLimit(...args),
}));

jest.mock("@/lib/error", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

jest.mock("@/lib/outreach/send-email", () => ({
  sendOutreachEmail: (...args: unknown[]) => mockSendOutreachEmail(...args),
  sendBulkOutreachEmail: (...args: unknown[]) =>
    mockSendBulkOutreachEmail(...args),
  interpolateMergeVars: (...args: unknown[]) =>
    mockInterpolateMergeVars(...args),
  MergeContext: {},
}));

jest.mock("@/lib/auth/crm-roles", () => ({
  resolveCrmRole: (...args: unknown[]) => mockResolveCrmRole(...args),
  hasCrmPermission: (...args: unknown[]) => mockHasCrmPermission(...args),
}));

jest.mock("@/lib/tier/crm-tier", () => ({
  resolveOrgTier: (...args: unknown[]) => mockResolveOrgTier(...args),
  invalidateTierCache: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    userTeam: { findFirst: jest.fn() },
    contact: { findFirst: jest.fn(), findMany: jest.fn() },
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are set up)
// ---------------------------------------------------------------------------
import { NextRequest, NextResponse } from "next/server";
import { POST as sendPost } from "@/app/api/outreach/send/route";
import { POST as bulkPost } from "@/app/api/outreach/bulk/route";
import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSendRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/outreach/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeBulkRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/outreach/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MOCK_SESSION = {
  user: { id: "user-1", email: "gp@example.com", name: "GP User" },
};

const MOCK_USER_TEAM = {
  role: "ADMIN",
  crmRole: "MANAGER",
  team: { id: "team-1", name: "Acme Capital", organizationId: "org-1" },
  user: { name: "GP User", email: "gp@example.com" },
};

const MOCK_CONTACT = {
  id: "contact-1",
  email: "investor@example.com",
  firstName: "Jane",
  lastName: "Doe",
  company: "Doe Ventures",
  title: "Managing Partner",
};

const MOCK_TIER_WITH_EMAIL = {
  tier: "CRM_PRO",
  hasEmailTracking: true,
  hasKanban: true,
  hasOutreachQueue: true,
  maxContacts: null,
  maxEsigsPerMonth: 25,
  maxSignerStorage: 100,
  emailTemplateLimit: 5,
  hasLpOnboarding: false,
  hasAiFeatures: false,
  pipelineStages: ["LEAD", "CONTACTED", "INTERESTED", "CONVERTED"],
  aiCrmEnabled: false,
};

const MOCK_TIER_FREE = {
  tier: "FREE",
  hasEmailTracking: false,
  hasKanban: false,
  hasOutreachQueue: false,
  maxContacts: 20,
  maxEsigsPerMonth: 10,
  maxSignerStorage: 40,
  emailTemplateLimit: 2,
  hasLpOnboarding: false,
  hasAiFeatures: false,
  pipelineStages: ["LEAD", "CONTACTED", "INTERESTED", "CONVERTED"],
  aiCrmEnabled: false,
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks();
  mockAppRouterRateLimit.mockResolvedValue(null);
  mockGetServerSession.mockResolvedValue(MOCK_SESSION);
  (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(MOCK_USER_TEAM);
  mockResolveCrmRole.mockReturnValue("MANAGER");
  mockHasCrmPermission.mockReturnValue(true);
  (prisma.contact.findFirst as jest.Mock).mockResolvedValue(MOCK_CONTACT);
  mockResolveOrgTier.mockResolvedValue(MOCK_TIER_WITH_EMAIL);
  mockSendOutreachEmail.mockResolvedValue({
    success: true,
    emailId: "email-abc-123",
  });
  mockSendBulkOutreachEmail.mockResolvedValue({
    total: 1,
    sent: 1,
    skipped: 0,
    failed: 0,
    results: [{ contactId: "contact-1", success: true }],
  });
});

// ===========================================================================
// POST /api/outreach/send
// ===========================================================================
describe("POST /api/outreach/send", () => {
  // -----------------------------------------------------------------------
  // Rate Limiting
  // -----------------------------------------------------------------------
  describe("Rate Limiting", () => {
    it("returns rate limit response when blocked", async () => {
      const blockedResponse = NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      );
      mockAppRouterRateLimit.mockResolvedValue(blockedResponse);

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(429);
      expect(mockGetServerSession).not.toHaveBeenCalled();
    });

    it("proceeds when rate limiter returns null", async () => {
      mockAppRouterRateLimit.mockResolvedValue(null);

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------
  describe("Authentication", () => {
    it("returns 401 when no session", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 401 when session has no user id", async () => {
      mockGetServerSession.mockResolvedValue({ user: { email: "a@b.com" } });

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(401);
    });

    it("returns 403 when user has no team", async () => {
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe("No team found");
    });

    it("returns 403 when userTeam has no team object", async () => {
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        role: "ADMIN",
        crmRole: "MANAGER",
        team: null,
        user: { name: "GP", email: "gp@test.com" },
      });

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // CRM Role Enforcement
  // -----------------------------------------------------------------------
  describe("CRM Role Enforcement", () => {
    it("returns 403 when CRM role is VIEWER", async () => {
      mockResolveCrmRole.mockReturnValue("VIEWER");
      mockHasCrmPermission.mockReturnValue(false);

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toMatch(/MANAGER/i);
    });

    it("returns 403 when CRM role is CONTRIBUTOR", async () => {
      mockResolveCrmRole.mockReturnValue("CONTRIBUTOR");
      mockHasCrmPermission.mockReturnValue(false);

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(403);
    });

    it("allows MANAGER role to proceed", async () => {
      mockResolveCrmRole.mockReturnValue("MANAGER");
      mockHasCrmPermission.mockReturnValue(true);

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hello", body: "Body" }),
      );

      expect(res.status).toBe(200);
    });

    it("calls resolveCrmRole with team role and crmRole from userTeam", async () => {
      await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );

      expect(mockResolveCrmRole).toHaveBeenCalledWith("ADMIN", "MANAGER");
    });

    it("calls hasCrmPermission with resolved role and MANAGER minimum", async () => {
      mockResolveCrmRole.mockReturnValue("MANAGER");

      await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );

      expect(mockHasCrmPermission).toHaveBeenCalledWith("MANAGER", "MANAGER");
    });
  });

  // -----------------------------------------------------------------------
  // Input Validation
  // -----------------------------------------------------------------------
  describe("Input Validation", () => {
    it("returns 400 when contactId is missing", async () => {
      const res = await sendPost(
        makeSendRequest({ subject: "Hi", body: "Hello" }),
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/contactId/i);
    });

    it("returns 400 when contactId is not a string", async () => {
      const res = await sendPost(
        makeSendRequest({ contactId: 123, subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when subject is missing", async () => {
      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", body: "Hello" }),
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/subject/i);
    });

    it("returns 400 when subject is empty string", async () => {
      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "", body: "Hello" }),
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when subject is whitespace only", async () => {
      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "   ", body: "Hello" }),
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when body is missing", async () => {
      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi" }),
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/body/i);
    });

    it("returns 400 when body is empty string", async () => {
      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "" }),
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when body is whitespace only", async () => {
      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "   " }),
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when subject is not a string type", async () => {
      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: 42, body: "Hello" }),
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when body is not a string type", async () => {
      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: 42 }),
      );

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // Contact Lookup
  // -----------------------------------------------------------------------
  describe("Contact Lookup", () => {
    it("returns 404 when contact not found", async () => {
      (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await sendPost(
        makeSendRequest({ contactId: "c-999", subject: "Hi", body: "Hello" }),
      );
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toMatch(/not found/i);
    });

    it("scopes contact lookup to the team", async () => {
      await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );

      expect(prisma.contact.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "c-1", teamId: "team-1" },
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Merge Variable Interpolation
  // -----------------------------------------------------------------------
  describe("Merge Variable Interpolation", () => {
    it("calls interpolateMergeVars with subject and context", async () => {
      await sendPost(
        makeSendRequest({
          contactId: "c-1",
          subject: "Hi {{contact.firstName}}",
          body: "Body",
        }),
      );

      expect(mockInterpolateMergeVars).toHaveBeenCalledWith(
        "Hi {{contact.firstName}}",
        expect.objectContaining({
          contact: expect.objectContaining({
            firstName: "Jane",
            lastName: "Doe",
            email: "investor@example.com",
          }),
        }),
      );
    });

    it("calls interpolateMergeVars with body and context", async () => {
      await sendPost(
        makeSendRequest({
          contactId: "c-1",
          subject: "Subject",
          body: "Hello {{contact.firstName}}",
        }),
      );

      // interpolateMergeVars is called twice — once for subject, once for body
      expect(mockInterpolateMergeVars).toHaveBeenCalledTimes(2);
      expect(mockInterpolateMergeVars).toHaveBeenCalledWith(
        "Hello {{contact.firstName}}",
        expect.objectContaining({
          contact: expect.objectContaining({ firstName: "Jane" }),
          sender: expect.objectContaining({
            name: "GP User",
            email: "gp@example.com",
            company: "Acme Capital",
          }),
        }),
      );
    });

    it("trims subject and body before interpolation", async () => {
      await sendPost(
        makeSendRequest({
          contactId: "c-1",
          subject: "  Hello  ",
          body: "  World  ",
        }),
      );

      expect(mockInterpolateMergeVars).toHaveBeenCalledWith(
        "Hello",
        expect.any(Object),
      );
      expect(mockInterpolateMergeVars).toHaveBeenCalledWith(
        "World",
        expect.any(Object),
      );
    });

    it("provides sender context from userTeam data", async () => {
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        ...MOCK_USER_TEAM,
        user: { name: "Joe Smith", email: "joe@acme.com" },
        team: { ...MOCK_USER_TEAM.team, name: "Acme Fund" },
      });

      await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Body" }),
      );

      expect(mockInterpolateMergeVars).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          sender: {
            name: "Joe Smith",
            email: "joe@acme.com",
            company: "Acme Fund",
          },
        }),
      );
    });

    it("handles null user name and email in sender context", async () => {
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        ...MOCK_USER_TEAM,
        user: { name: null, email: null },
      });

      await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Body" }),
      );

      expect(mockInterpolateMergeVars).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          sender: expect.objectContaining({
            name: null,
            email: null,
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Email Sending — Happy Path
  // -----------------------------------------------------------------------
  describe("Email Sending — Happy Path", () => {
    it("returns 200 with success and emailId", async () => {
      mockSendOutreachEmail.mockResolvedValue({
        success: true,
        emailId: "resend-xyz",
      });

      const res = await sendPost(
        makeSendRequest({
          contactId: "c-1",
          subject: "Hello",
          body: "Body content",
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.emailId).toBe("resend-xyz");
    });

    it("passes contactId, teamId, subject, body, actorId to sendOutreachEmail", async () => {
      await sendPost(
        makeSendRequest({
          contactId: "c-1",
          subject: "Test Subject",
          body: "Test Body",
        }),
      );

      expect(mockSendOutreachEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          contactId: "contact-1",
          teamId: "team-1",
          actorId: "user-1",
        }),
      );
    });

    it("passes trackOpens true when set", async () => {
      await sendPost(
        makeSendRequest({
          contactId: "c-1",
          subject: "Hi",
          body: "Hello",
          trackOpens: true,
        }),
      );

      expect(mockSendOutreachEmail).toHaveBeenCalledWith(
        expect.objectContaining({ trackOpens: true }),
      );
    });

    it("defaults trackOpens to false when not provided", async () => {
      await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );

      expect(mockSendOutreachEmail).toHaveBeenCalledWith(
        expect.objectContaining({ trackOpens: false }),
      );
    });

    it("passes templateId when provided", async () => {
      await sendPost(
        makeSendRequest({
          contactId: "c-1",
          subject: "Hi",
          body: "Hello",
          templateId: "tmpl-1",
        }),
      );

      expect(mockSendOutreachEmail).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: "tmpl-1" }),
      );
    });

    it("does not pass templateId when not provided", async () => {
      await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );

      expect(mockSendOutreachEmail).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: undefined }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Email Sending — Error Mapping
  // -----------------------------------------------------------------------
  describe("Email Sending — Error Mapping", () => {
    it("returns 404 for CONTACT_NOT_FOUND error", async () => {
      mockSendOutreachEmail.mockResolvedValue({
        success: false,
        error: "CONTACT_NOT_FOUND",
      });

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe("CONTACT_NOT_FOUND");
    });

    it("returns 403 for TEAM_MISMATCH error", async () => {
      mockSendOutreachEmail.mockResolvedValue({
        success: false,
        error: "TEAM_MISMATCH",
      });

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(403);
    });

    it("returns 422 for UNSUBSCRIBED error", async () => {
      mockSendOutreachEmail.mockResolvedValue({
        success: false,
        error: "UNSUBSCRIBED",
      });

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );
      const data = await res.json();

      expect(res.status).toBe(422);
      expect(data.error).toBe("UNSUBSCRIBED");
    });

    it("returns 422 for BOUNCED error", async () => {
      mockSendOutreachEmail.mockResolvedValue({
        success: false,
        error: "BOUNCED",
      });

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(422);
    });

    it("returns 500 for unknown error from sendOutreachEmail", async () => {
      mockSendOutreachEmail.mockResolvedValue({
        success: false,
        error: "RESEND_API_ERROR",
      });

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(500);
    });

    it("returns 500 for success=false with no error field", async () => {
      mockSendOutreachEmail.mockResolvedValue({ success: false });

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(500);
    });
  });

  // -----------------------------------------------------------------------
  // Error Handling
  // -----------------------------------------------------------------------
  describe("Error Handling", () => {
    it("returns 500 and calls reportError on unexpected exception", async () => {
      (prisma.userTeam.findFirst as jest.Mock).mockRejectedValue(
        new Error("DB connection lost"),
      );

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("returns 500 when contact query throws", async () => {
      (prisma.contact.findFirst as jest.Mock).mockRejectedValue(
        new Error("Contact query failed"),
      );

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(500);
      expect(mockReportError).toHaveBeenCalled();
    });

    it("returns 500 when sendOutreachEmail throws", async () => {
      mockSendOutreachEmail.mockRejectedValue(
        new Error("Resend API down"),
      );

      const res = await sendPost(
        makeSendRequest({ contactId: "c-1", subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(500);
      expect(mockReportError).toHaveBeenCalled();
    });
  });
});

// ===========================================================================
// POST /api/outreach/bulk
// ===========================================================================
describe("POST /api/outreach/bulk", () => {
  // -----------------------------------------------------------------------
  // Rate Limiting
  // -----------------------------------------------------------------------
  describe("Rate Limiting", () => {
    it("returns rate limit response when blocked", async () => {
      const blockedResponse = NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      );
      mockAppRouterRateLimit.mockResolvedValue(blockedResponse);

      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(429);
      expect(mockGetServerSession).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------
  describe("Authentication", () => {
    it("returns 401 when no session", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "Hello" }),
      );
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 401 when session has no user id", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "no-id@test.com" },
      });

      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(401);
    });

    it("returns 403 when user has no team", async () => {
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "Hello" }),
      );
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe("No team found");
    });
  });

  // -----------------------------------------------------------------------
  // CRM Role Enforcement
  // -----------------------------------------------------------------------
  describe("CRM Role Enforcement", () => {
    it("returns 403 when CRM role is VIEWER", async () => {
      mockResolveCrmRole.mockReturnValue("VIEWER");
      mockHasCrmPermission.mockReturnValue(false);

      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "Hello" }),
      );
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toMatch(/MANAGER/i);
    });

    it("returns 403 when CRM role is CONTRIBUTOR", async () => {
      mockResolveCrmRole.mockReturnValue("CONTRIBUTOR");
      mockHasCrmPermission.mockReturnValue(false);

      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(403);
    });

    it("allows MANAGER role to proceed", async () => {
      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "Body" }),
      );

      expect(res.status).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Tier Gating (bulk requires CRM_PRO+)
  // -----------------------------------------------------------------------
  describe("Tier Gating", () => {
    it("returns 403 when tier lacks email tracking (FREE tier)", async () => {
      mockResolveOrgTier.mockResolvedValue(MOCK_TIER_FREE);

      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "Hello" }),
      );
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toMatch(/CRM Pro/i);
      expect(data.upgradeUrl).toBeDefined();
    });

    it("includes upgrade URL in tier rejection response", async () => {
      mockResolveOrgTier.mockResolvedValue(MOCK_TIER_FREE);

      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "Hello" }),
      );
      const data = await res.json();

      expect(data.upgradeUrl).toBe("/admin/settings?tab=billing");
    });

    it("allows CRM_PRO tier to proceed", async () => {
      mockResolveOrgTier.mockResolvedValue(MOCK_TIER_WITH_EMAIL);

      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "Body" }),
      );

      expect(res.status).toBe(200);
    });

    it("resolves tier using orgId from team", async () => {
      await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "Body" }),
      );

      expect(mockResolveOrgTier).toHaveBeenCalledWith("org-1");
    });

    it("skips tier check when orgId is null", async () => {
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        ...MOCK_USER_TEAM,
        team: { id: "team-1", organizationId: null },
      });

      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "Body" }),
      );

      expect(mockResolveOrgTier).not.toHaveBeenCalled();
      expect(res.status).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Input Validation
  // -----------------------------------------------------------------------
  describe("Input Validation", () => {
    it("returns 400 when contactIds is missing", async () => {
      const res = await bulkPost(
        makeBulkRequest({ subject: "Hi", body: "Hello" }),
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/contactIds/i);
    });

    it("returns 400 when contactIds is empty array", async () => {
      const res = await bulkPost(
        makeBulkRequest({ contactIds: [], subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when contactIds is not an array", async () => {
      const res = await bulkPost(
        makeBulkRequest({ contactIds: "c-1", subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when contactIds exceeds 50", async () => {
      const ids = Array.from({ length: 51 }, (_, i) => `c-${i}`);

      const res = await bulkPost(
        makeBulkRequest({ contactIds: ids, subject: "Hi", body: "Hello" }),
      );
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toMatch(/50/);
    });

    it("accepts exactly 50 contactIds", async () => {
      const ids = Array.from({ length: 50 }, (_, i) => `c-${i}`);
      mockSendBulkOutreachEmail.mockResolvedValue({
        total: 50,
        sent: 50,
        skipped: 0,
        failed: 0,
        results: ids.map((id) => ({ contactId: id, success: true })),
      });

      const res = await bulkPost(
        makeBulkRequest({ contactIds: ids, subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(200);
    });

    it("returns 400 when subject is missing", async () => {
      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], body: "Hello" }),
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when subject is empty", async () => {
      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "", body: "Hello" }),
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when subject is whitespace only", async () => {
      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "   ", body: "Hello" }),
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when body is missing", async () => {
      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi" }),
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when body is empty", async () => {
      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "" }),
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when body is whitespace only", async () => {
      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "   " }),
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when subject is a non-string type", async () => {
      const res = await bulkPost(
        makeBulkRequest({
          contactIds: ["c-1"],
          subject: 42,
          body: "Hello",
        }),
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 when body is a non-string type", async () => {
      const res = await bulkPost(
        makeBulkRequest({
          contactIds: ["c-1"],
          subject: "Hi",
          body: true,
        }),
      );

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // Bulk Email Sending — Happy Path
  // -----------------------------------------------------------------------
  describe("Bulk Email Sending — Happy Path", () => {
    it("returns 200 with result on success", async () => {
      mockSendBulkOutreachEmail.mockResolvedValue({
        total: 3,
        sent: 3,
        skipped: 0,
        failed: 0,
        results: [
          { contactId: "c-1", success: true },
          { contactId: "c-2", success: true },
          { contactId: "c-3", success: true },
        ],
      });

      const res = await bulkPost(
        makeBulkRequest({
          contactIds: ["c-1", "c-2", "c-3"],
          subject: "Update",
          body: "Hello team",
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.total).toBe(3);
      expect(data.sent).toBe(3);
      expect(data.failed).toBe(0);
    });

    it("passes correct payload to sendBulkOutreachEmail", async () => {
      await bulkPost(
        makeBulkRequest({
          contactIds: ["c-1", "c-2"],
          subject: " Subject ",
          body: " Body ",
          trackOpens: true,
          templateId: "tmpl-99",
        }),
      );

      expect(mockSendBulkOutreachEmail).toHaveBeenCalledWith({
        contactIds: ["c-1", "c-2"],
        teamId: "team-1",
        subject: "Subject",
        bodyTemplate: "Body",
        actorId: "user-1",
        trackOpens: true,
        templateId: "tmpl-99",
      });
    });

    it("defaults trackOpens to false when not provided", async () => {
      await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "Body" }),
      );

      expect(mockSendBulkOutreachEmail).toHaveBeenCalledWith(
        expect.objectContaining({ trackOpens: false }),
      );
    });

    it("trims subject and body before sending", async () => {
      await bulkPost(
        makeBulkRequest({
          contactIds: ["c-1"],
          subject: "  Spaced Subject  ",
          body: "  Spaced Body  ",
        }),
      );

      expect(mockSendBulkOutreachEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Spaced Subject",
          bodyTemplate: "Spaced Body",
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Partial Failures
  // -----------------------------------------------------------------------
  describe("Partial Failures", () => {
    it("returns 200 with partial results when some contacts fail", async () => {
      mockSendBulkOutreachEmail.mockResolvedValue({
        total: 3,
        sent: 2,
        skipped: 0,
        failed: 1,
        results: [
          { contactId: "c-1", success: true },
          { contactId: "c-2", success: false, error: "BOUNCED" },
          { contactId: "c-3", success: true },
        ],
      });

      const res = await bulkPost(
        makeBulkRequest({
          contactIds: ["c-1", "c-2", "c-3"],
          subject: "Update",
          body: "Content",
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.sent).toBe(2);
      expect(data.failed).toBe(1);
      expect(data.results[1].error).toBe("BOUNCED");
    });

    it("returns 200 with all failures when every contact bounces", async () => {
      mockSendBulkOutreachEmail.mockResolvedValue({
        total: 2,
        sent: 0,
        skipped: 0,
        failed: 2,
        results: [
          { contactId: "c-1", success: false, error: "BOUNCED" },
          { contactId: "c-2", success: false, error: "UNSUBSCRIBED" },
        ],
      });

      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1", "c-2"], subject: "Hi", body: "Body" }),
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.sent).toBe(0);
      expect(data.failed).toBe(2);
    });

    it("returns 200 with mixed skipped and failed results", async () => {
      mockSendBulkOutreachEmail.mockResolvedValue({
        total: 3,
        sent: 1,
        skipped: 1,
        failed: 1,
        results: [
          { contactId: "c-1", success: true },
          { contactId: "c-2", success: false, error: "UNSUBSCRIBED" },
          { contactId: "c-3", success: false, error: "SEND_FAILED" },
        ],
      });

      const res = await bulkPost(
        makeBulkRequest({
          contactIds: ["c-1", "c-2", "c-3"],
          subject: "Hi",
          body: "Body",
        }),
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.total).toBe(3);
      expect(data.sent).toBe(1);
      expect(data.skipped).toBe(1);
      expect(data.failed).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Error Handling
  // -----------------------------------------------------------------------
  describe("Error Handling", () => {
    it("returns 500 and calls reportError on unexpected exception", async () => {
      (prisma.userTeam.findFirst as jest.Mock).mockRejectedValue(
        new Error("DB connection lost"),
      );

      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "Hello" }),
      );
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("returns 500 when resolveOrgTier throws", async () => {
      mockResolveOrgTier.mockRejectedValue(new Error("Tier service down"));

      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "Hello" }),
      );

      expect(res.status).toBe(500);
      expect(mockReportError).toHaveBeenCalled();
    });

    it("returns 500 when sendBulkOutreachEmail throws", async () => {
      mockSendBulkOutreachEmail.mockRejectedValue(
        new Error("Resend API down"),
      );

      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "Body" }),
      );

      expect(res.status).toBe(500);
      expect(mockReportError).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Single Contact in Bulk Mode (edge case)
  // -----------------------------------------------------------------------
  describe("Single Contact in Bulk Mode", () => {
    it("sends to single contact successfully", async () => {
      mockSendBulkOutreachEmail.mockResolvedValue({
        total: 1,
        sent: 1,
        skipped: 0,
        failed: 0,
        results: [{ contactId: "c-1", success: true }],
      });

      const res = await bulkPost(
        makeBulkRequest({ contactIds: ["c-1"], subject: "Hi", body: "Body" }),
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.total).toBe(1);
      expect(data.sent).toBe(1);
    });
  });
});
