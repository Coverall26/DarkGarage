import { NextRequest } from "next/server";

// ── Mock declarations ──────────────────────────────────────────────
const mockGetServerSession = jest.fn();
const mockAppRouterRateLimit = jest.fn();
const mockReportError = jest.fn();
const mockLogAuditEvent = jest.fn();
const mockSendInvestorApprovedEmail = jest.fn();
const mockSendInvestorChangesRequestedEmail = jest.fn();
const mockSendInvestorRejectedEmail = jest.fn();
const mockPublishServerEvent = jest.fn();

const mockUserTeamFindFirst = jest.fn();
const mockViewFindFirst = jest.fn();
const mockWaitlistFindFirst = jest.fn();
const mockInvestorFindUnique = jest.fn();
const mockInvestorUpdate = jest.fn();
const mockFundFindFirst = jest.fn();
const mockProfileChangeRequestCreate = jest.fn();

// ── jest.mock calls ────────────────────────────────────────────────
jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
jest.mock("@/lib/auth/auth-options", () => ({ authOptions: {} }));
jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterRateLimit: (...args: unknown[]) => mockAppRouterRateLimit(...args),
}));
jest.mock("@/lib/error", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    userTeam: { findFirst: (...args: unknown[]) => mockUserTeamFindFirst(...args) },
    view: { findFirst: (...args: unknown[]) => mockViewFindFirst(...args) },
    marketplaceWaitlist: { findFirst: (...args: unknown[]) => mockWaitlistFindFirst(...args) },
    investor: {
      findUnique: (...args: unknown[]) => mockInvestorFindUnique(...args),
      update: (...args: unknown[]) => mockInvestorUpdate(...args),
    },
    fund: { findFirst: (...args: unknown[]) => mockFundFindFirst(...args) },
    profileChangeRequest: { create: (...args: unknown[]) => mockProfileChangeRequestCreate(...args) },
  },
}));
jest.mock("@/lib/audit/audit-logger", () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));
jest.mock("@/lib/emails/send-investor-approved", () => ({
  sendInvestorApprovedEmail: (...args: unknown[]) =>
    mockSendInvestorApprovedEmail(...args),
}));
jest.mock("@/lib/emails/send-investor-changes-requested", () => ({
  sendInvestorChangesRequestedEmail: (...args: unknown[]) =>
    mockSendInvestorChangesRequestedEmail(...args),
}));
jest.mock("@/lib/emails/send-investor-rejected", () => ({
  sendInvestorRejectedEmail: (...args: unknown[]) =>
    mockSendInvestorRejectedEmail(...args),
}));
jest.mock("@/lib/tracking/server-events", () => ({
  publishServerEvent: (...args: unknown[]) =>
    mockPublishServerEvent(...args),
}));
jest.mock("@prisma/client", () => ({
  ChangeRequestType: {
    FIELD_CORRECTION: "FIELD_CORRECTION",
    DOCUMENT_REUPLOAD: "DOCUMENT_REUPLOAD",
    ADDITIONAL_INFO: "ADDITIONAL_INFO",
  },
}));

// ── Imports ────────────────────────────────────────────────────────
import { GET as checkLeadGET } from "@/app/api/admin/investors/check-lead/route";
import { POST as reviewPOST } from "@/app/api/admin/investors/[investorId]/review/route";

// ── Helpers ────────────────────────────────────────────────────────
function makeGetRequest(url: string) {
  return new NextRequest(url, { method: "GET" });
}

function makePostRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const flushPromises = () => new Promise((r) => setTimeout(r, 0));

// ── Setup ──────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  mockAppRouterRateLimit.mockResolvedValue(null);
  mockLogAuditEvent.mockResolvedValue(undefined);
  mockSendInvestorApprovedEmail.mockResolvedValue(undefined);
  mockSendInvestorChangesRequestedEmail.mockResolvedValue(undefined);
  mockSendInvestorRejectedEmail.mockResolvedValue(undefined);
  mockPublishServerEvent.mockResolvedValue(undefined);
});

// ════════════════════════════════════════════════════════════════════
// GET /api/admin/investors/check-lead
// ════════════════════════════════════════════════════════════════════
describe("GET /api/admin/investors/check-lead", () => {
  it("returns 401 if not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await checkLeadGET(
      makeGetRequest("http://localhost/api/admin/investors/check-lead?email=test@example.com"),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns rate limit response when blocked", async () => {
    const blockedResponse = new Response("Too Many Requests", { status: 429 });
    mockAppRouterRateLimit.mockResolvedValue(blockedResponse);
    const res = await checkLeadGET(
      makeGetRequest("http://localhost/api/admin/investors/check-lead?email=test@example.com"),
    );
    expect(res.status).toBe(429);
  });

  it("returns 400 if email query param is missing", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    const res = await checkLeadGET(
      makeGetRequest("http://localhost/api/admin/investors/check-lead"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("email");
  });

  it("returns 403 if user has no admin team membership", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockUserTeamFindFirst.mockResolvedValue(null);
    const res = await checkLeadGET(
      makeGetRequest("http://localhost/api/admin/investors/check-lead?email=test@example.com"),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns match from dataroom view when found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockUserTeamFindFirst.mockResolvedValue({
      userId: "user-1",
      teamId: "team-1",
      role: "ADMIN",
    });
    mockViewFindFirst.mockResolvedValue({
      viewedAt: new Date("2026-01-15T10:00:00Z"),
      link: {
        id: "link-1",
        name: "My Link",
        document: { name: "Pitch Deck" },
      },
    });

    const res = await checkLeadGET(
      makeGetRequest("http://localhost/api/admin/investors/check-lead?email=Test@Example.com"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.match).toEqual({
      email: "test@example.com",
      viewedAt: "2026-01-15T10:00:00.000Z",
      linkId: "link-1",
      documentName: "Pitch Deck",
      source: "dataroom_view",
    });
  });

  it("lowercases email for queries", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockUserTeamFindFirst.mockResolvedValue({
      userId: "user-1",
      teamId: "team-1",
      role: "OWNER",
    });
    mockViewFindFirst.mockResolvedValue(null);
    mockWaitlistFindFirst.mockResolvedValue(null);

    await checkLeadGET(
      makeGetRequest("http://localhost/api/admin/investors/check-lead?email=UPPER@CASE.COM"),
    );

    expect(mockViewFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          viewerEmail: "upper@case.com",
        }),
      }),
    );
  });

  it("falls back to marketplace waitlist when no view found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockUserTeamFindFirst.mockResolvedValue({
      userId: "user-1",
      teamId: "team-1",
      role: "ADMIN",
    });
    mockViewFindFirst.mockResolvedValue(null);
    mockWaitlistFindFirst.mockResolvedValue({
      email: "waitlist@example.com",
      createdAt: new Date("2026-02-01T12:00:00Z"),
    });

    const res = await checkLeadGET(
      makeGetRequest("http://localhost/api/admin/investors/check-lead?email=waitlist@example.com"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.match.source).toBe("waitlist");
    expect(body.match.documentName).toBe("Marketplace Waitlist");
    expect(body.match.linkId).toBe("");
  });

  it("returns null match when no view or waitlist entry found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockUserTeamFindFirst.mockResolvedValue({
      userId: "user-1",
      teamId: "team-1",
      role: "ADMIN",
    });
    mockViewFindFirst.mockResolvedValue(null);
    mockWaitlistFindFirst.mockResolvedValue(null);

    const res = await checkLeadGET(
      makeGetRequest("http://localhost/api/admin/investors/check-lead?email=nobody@example.com"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.match).toBeNull();
  });

  it("uses link name as fallback when document name is null", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockUserTeamFindFirst.mockResolvedValue({
      userId: "user-1",
      teamId: "team-1",
      role: "ADMIN",
    });
    mockViewFindFirst.mockResolvedValue({
      viewedAt: new Date("2026-01-15T10:00:00Z"),
      link: {
        id: "link-2",
        name: "Shared Link",
        document: { name: null },
      },
    });

    const res = await checkLeadGET(
      makeGetRequest("http://localhost/api/admin/investors/check-lead?email=test@example.com"),
    );
    const body = await res.json();
    expect(body.match.documentName).toBe("Shared Link");
  });

  it("uses 'Dataroom' as fallback when both document and link name are null", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockUserTeamFindFirst.mockResolvedValue({
      userId: "user-1",
      teamId: "team-1",
      role: "ADMIN",
    });
    mockViewFindFirst.mockResolvedValue({
      viewedAt: new Date("2026-01-15T10:00:00Z"),
      link: {
        id: "link-3",
        name: null,
        document: null,
      },
    });

    const res = await checkLeadGET(
      makeGetRequest("http://localhost/api/admin/investors/check-lead?email=test@example.com"),
    );
    const body = await res.json();
    expect(body.match.documentName).toBe("Dataroom");
  });

  it("returns 500 and reports error on internal failure", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockUserTeamFindFirst.mockRejectedValue(new Error("DB down"));

    const res = await checkLeadGET(
      makeGetRequest("http://localhost/api/admin/investors/check-lead?email=test@example.com"),
    );
    expect(res.status).toBe(500);
    expect(mockReportError).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// POST /api/admin/investors/[investorId]/review
// ════════════════════════════════════════════════════════════════════
describe("POST /api/admin/investors/[investorId]/review", () => {
  const params = Promise.resolve({ investorId: "inv-1" });
  const baseBody = {
    action: "approve",
    fundId: "fund-1",
    teamId: "team-1",
  };

  const mockInvestor = {
    id: "inv-1",
    fundData: { stage: "PENDING" },
    user: { email: "investor@example.com", name: "Test LP" },
    investments: [{ id: "invest-1", fundId: "fund-1" }],
  };

  function setupAuthMocks() {
    mockGetServerSession.mockResolvedValue({ user: { id: "gp-1" } });
    mockUserTeamFindFirst.mockResolvedValue({
      userId: "gp-1",
      teamId: "team-1",
      role: "ADMIN",
    });
    mockFundFindFirst.mockResolvedValue({ id: "fund-1" });
    mockInvestorFindUnique.mockResolvedValue(mockInvestor);
    mockInvestorUpdate.mockResolvedValue({});
  }

  // ── Auth & validation ──────────────────────────────────────────
  it("returns 401 if not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await reviewPOST(
      makePostRequest("http://localhost/api/admin/investors/inv-1/review", baseBody),
      { params },
    );
    expect(res.status).toBe(401);
  });

  it("returns rate limit response when blocked", async () => {
    const blockedResponse = new Response("Too Many Requests", { status: 429 });
    mockAppRouterRateLimit.mockResolvedValue(blockedResponse);
    const res = await reviewPOST(
      makePostRequest("http://localhost/api/admin/investors/inv-1/review", baseBody),
      { params },
    );
    expect(res.status).toBe(429);
  });

  it("returns 400 for invalid JSON body", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "gp-1" } });
    const req = new NextRequest("http://localhost/api/admin/investors/inv-1/review", {
      method: "POST",
      body: "not json",
      headers: { "content-type": "application/json" },
    });
    const res = await reviewPOST(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON body");
  });

  it("returns 400 if required fields are missing", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "gp-1" } });
    const res = await reviewPOST(
      makePostRequest("http://localhost/api/admin/investors/inv-1/review", {
        action: "approve",
        // missing fundId and teamId
      }),
      { params },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Missing required fields");
  });

  it("returns 403 if user has no admin team access", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "gp-1" } });
    mockUserTeamFindFirst.mockResolvedValue(null);
    const res = await reviewPOST(
      makePostRequest("http://localhost/api/admin/investors/inv-1/review", baseBody),
      { params },
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 403 if fund does not belong to team (cross-tenant prevention)", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "gp-1" } });
    mockUserTeamFindFirst.mockResolvedValue({
      userId: "gp-1",
      teamId: "team-1",
      role: "ADMIN",
    });
    mockFundFindFirst.mockResolvedValue(null);
    const res = await reviewPOST(
      makePostRequest("http://localhost/api/admin/investors/inv-1/review", baseBody),
      { params },
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Fund not found");
  });

  it("returns 404 if investor not found", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "gp-1" } });
    mockUserTeamFindFirst.mockResolvedValue({
      userId: "gp-1",
      teamId: "team-1",
      role: "ADMIN",
    });
    mockFundFindFirst.mockResolvedValue({ id: "fund-1" });
    mockInvestorFindUnique.mockResolvedValue(null);
    const res = await reviewPOST(
      makePostRequest("http://localhost/api/admin/investors/inv-1/review", baseBody),
      { params },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Investor not found");
  });

  it("returns 400 for invalid action", async () => {
    setupAuthMocks();
    const res = await reviewPOST(
      makePostRequest("http://localhost/api/admin/investors/inv-1/review", {
        ...baseBody,
        action: "invalid-action",
      }),
      { params },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid action");
  });

  // ── Action: approve ────────────────────────────────────────────
  describe("action: approve", () => {
    it("approves investor and sets APPROVED stage", async () => {
      setupAuthMocks();
      const res = await reviewPOST(
        makePostRequest("http://localhost/api/admin/investors/inv-1/review", {
          ...baseBody,
          action: "approve",
          notes: "Looks good",
        }),
        { params },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Investor approved");
      expect(body.stage).toBe("APPROVED");

      // Verify investor update
      expect(mockInvestorUpdate).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: expect.objectContaining({
          fundData: expect.objectContaining({
            stage: "APPROVED",
            approvedBy: "gp-1",
          }),
        }),
      });
    });

    it("logs audit event on approve", async () => {
      setupAuthMocks();
      await reviewPOST(
        makePostRequest("http://localhost/api/admin/investors/inv-1/review", baseBody),
        { params },
      );
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "INVESTOR_APPROVED",
          userId: "gp-1",
          teamId: "team-1",
          resourceType: "Investor",
          resourceId: "inv-1",
        }),
      );
    });

    it("sends approval email (fire-and-forget)", async () => {
      setupAuthMocks();
      await reviewPOST(
        makePostRequest("http://localhost/api/admin/investors/inv-1/review", baseBody),
        { params },
      );
      await flushPromises();
      expect(mockSendInvestorApprovedEmail).toHaveBeenCalledWith("inv-1", "fund-1");
    });

    it("publishes server event on approve", async () => {
      setupAuthMocks();
      await reviewPOST(
        makePostRequest("http://localhost/api/admin/investors/inv-1/review", baseBody),
        { params },
      );
      await flushPromises();
      expect(mockPublishServerEvent).toHaveBeenCalledWith(
        "funnel_investor_approved",
        expect.objectContaining({
          userId: "gp-1",
          investorId: "inv-1",
          teamId: "team-1",
        }),
      );
    });
  });

  // ── Action: approve-with-changes ───────────────────────────────
  describe("action: approve-with-changes", () => {
    const changesBody = {
      ...baseBody,
      action: "approve-with-changes",
      notes: "Fixed name spelling",
      changes: [
        { field: "firstName", originalValue: "Jhon", newValue: "John" },
        { field: "lastName", originalValue: "Doe", newValue: "Doe" },
      ],
    };

    it("returns 400 if changes array is empty", async () => {
      setupAuthMocks();
      const res = await reviewPOST(
        makePostRequest("http://localhost/api/admin/investors/inv-1/review", {
          ...baseBody,
          action: "approve-with-changes",
          changes: [],
        }),
        { params },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("No changes provided");
    });

    it("returns 400 if changes is omitted (defaults to empty)", async () => {
      setupAuthMocks();
      const res = await reviewPOST(
        makePostRequest("http://localhost/api/admin/investors/inv-1/review", {
          ...baseBody,
          action: "approve-with-changes",
          // no changes field
        }),
        { params },
      );
      expect(res.status).toBe(400);
    });

    it("applies changes and sets APPROVED stage with approvedWithChanges flag", async () => {
      setupAuthMocks();
      const res = await reviewPOST(
        makePostRequest("http://localhost/api/admin/investors/inv-1/review", changesBody),
        { params },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Investor approved with changes");
      expect(body.stage).toBe("APPROVED");
      expect(body.changesApplied).toBe(2);

      expect(mockInvestorUpdate).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: expect.objectContaining({
          firstName: "John",
          lastName: "Doe",
          fundData: expect.objectContaining({
            stage: "APPROVED",
            approvedWithChanges: true,
          }),
        }),
      });
    });

    it("logs audit event with original values", async () => {
      setupAuthMocks();
      await reviewPOST(
        makePostRequest("http://localhost/api/admin/investors/inv-1/review", changesBody),
        { params },
      );
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "INVESTOR_APPROVED_WITH_CHANGES",
          metadata: expect.objectContaining({
            originalValues: expect.arrayContaining([
              expect.objectContaining({
                field: "firstName",
                original: "Jhon",
                new: "John",
              }),
            ]),
          }),
        }),
      );
    });

    it("sends approval email", async () => {
      setupAuthMocks();
      await reviewPOST(
        makePostRequest("http://localhost/api/admin/investors/inv-1/review", changesBody),
        { params },
      );
      await flushPromises();
      expect(mockSendInvestorApprovedEmail).toHaveBeenCalledWith("inv-1", "fund-1");
    });
  });

  // ── Action: request-changes ────────────────────────────────────
  describe("action: request-changes", () => {
    const requestChangesBody = {
      ...baseBody,
      action: "request-changes",
      notes: "Please update your address",
      requestedChanges: [
        {
          changeType: "FIELD_CORRECTION",
          fieldName: "addressLine1",
          reason: "Address incomplete",
          currentValue: "123 Main",
          requestedValue: "123 Main St",
        },
      ],
    };

    it("returns 400 if requestedChanges array is empty", async () => {
      setupAuthMocks();
      const res = await reviewPOST(
        makePostRequest("http://localhost/api/admin/investors/inv-1/review", {
          ...baseBody,
          action: "request-changes",
          requestedChanges: [],
        }),
        { params },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("No change requests provided");
    });

    it("creates ProfileChangeRequest records and sets UNDER_REVIEW stage", async () => {
      setupAuthMocks();
      mockProfileChangeRequestCreate.mockResolvedValue({
        id: "cr-1",
      });

      const res = await reviewPOST(
        makePostRequest(
          "http://localhost/api/admin/investors/inv-1/review",
          requestChangesBody,
        ),
        { params },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Changes requested from investor");
      expect(body.stage).toBe("UNDER_REVIEW");
      expect(body.changeRequestCount).toBe(1);

      // Verify ProfileChangeRequest creation
      expect(mockProfileChangeRequestCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          investorId: "inv-1",
          fundId: "fund-1",
          requestedBy: "gp-1",
          status: "PENDING",
          changeType: "FIELD_CORRECTION",
          fieldName: "addressLine1",
          reason: "Address incomplete",
          currentValue: "123 Main",
          requestedValue: "123 Main St",
          gpNote: "Please update your address",
        }),
      });

      // Verify investor update to UNDER_REVIEW
      expect(mockInvestorUpdate).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: expect.objectContaining({
          fundData: expect.objectContaining({
            stage: "UNDER_REVIEW",
            changesRequested: true,
            changesRequestedBy: "gp-1",
          }),
        }),
      });
    });

    it("handles multiple change requests", async () => {
      setupAuthMocks();
      mockProfileChangeRequestCreate
        .mockResolvedValueOnce({ id: "cr-1" })
        .mockResolvedValueOnce({ id: "cr-2" });

      const res = await reviewPOST(
        makePostRequest("http://localhost/api/admin/investors/inv-1/review", {
          ...baseBody,
          action: "request-changes",
          requestedChanges: [
            {
              changeType: "FIELD_CORRECTION",
              fieldName: "addressLine1",
              reason: "Incomplete",
            },
            {
              changeType: "DOCUMENT_REUPLOAD",
              fieldName: "idDocument",
              reason: "Blurry",
            },
          ],
        }),
        { params },
      );
      const body = await res.json();
      expect(body.changeRequestCount).toBe(2);
      expect(mockProfileChangeRequestCreate).toHaveBeenCalledTimes(2);
    });

    it("logs audit with change request IDs and field names", async () => {
      setupAuthMocks();
      mockProfileChangeRequestCreate.mockResolvedValue({ id: "cr-1" });

      await reviewPOST(
        makePostRequest(
          "http://localhost/api/admin/investors/inv-1/review",
          requestChangesBody,
        ),
        { params },
      );
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "INVESTOR_CHANGES_REQUESTED",
          metadata: expect.objectContaining({
            changeRequestIds: ["cr-1"],
            fieldsRequested: ["addressLine1"],
          }),
        }),
      );
    });

    it("sends changes-requested email with flagged fields", async () => {
      setupAuthMocks();
      mockProfileChangeRequestCreate.mockResolvedValue({ id: "cr-1" });

      await reviewPOST(
        makePostRequest(
          "http://localhost/api/admin/investors/inv-1/review",
          requestChangesBody,
        ),
        { params },
      );
      await flushPromises();
      expect(mockSendInvestorChangesRequestedEmail).toHaveBeenCalledWith({
        investorId: "inv-1",
        fundId: "fund-1",
        flaggedFields: [
          { fieldName: "addressLine1", reason: "Address incomplete" },
        ],
        generalNotes: "Please update your address",
      });
    });
  });

  // ── Action: reject ─────────────────────────────────────────────
  describe("action: reject", () => {
    it("rejects investor with provided reason", async () => {
      setupAuthMocks();
      const res = await reviewPOST(
        makePostRequest("http://localhost/api/admin/investors/inv-1/review", {
          ...baseBody,
          action: "reject",
          rejectionReason: "Unaccredited investor",
        }),
        { params },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Investor rejected");
      expect(body.stage).toBe("REJECTED");

      expect(mockInvestorUpdate).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: expect.objectContaining({
          fundData: expect.objectContaining({
            stage: "REJECTED",
            rejectedBy: "gp-1",
            rejectionReason: "Unaccredited investor",
          }),
        }),
      });
    });

    it("falls back to notes when rejectionReason is not provided", async () => {
      setupAuthMocks();
      const res = await reviewPOST(
        makePostRequest("http://localhost/api/admin/investors/inv-1/review", {
          ...baseBody,
          action: "reject",
          notes: "Notes as reason",
        }),
        { params },
      );
      expect(res.status).toBe(200);
      expect(mockInvestorUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fundData: expect.objectContaining({
              rejectionReason: "Notes as reason",
            }),
          }),
        }),
      );
    });

    it("uses default rejection reason when neither rejectionReason nor notes provided", async () => {
      setupAuthMocks();
      const res = await reviewPOST(
        makePostRequest("http://localhost/api/admin/investors/inv-1/review", {
          ...baseBody,
          action: "reject",
        }),
        { params },
      );
      expect(res.status).toBe(200);
      expect(mockInvestorUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fundData: expect.objectContaining({
              rejectionReason: "Did not meet fund requirements",
            }),
          }),
        }),
      );
    });

    it("logs audit event on reject", async () => {
      setupAuthMocks();
      await reviewPOST(
        makePostRequest("http://localhost/api/admin/investors/inv-1/review", {
          ...baseBody,
          action: "reject",
          rejectionReason: "Unaccredited",
        }),
        { params },
      );
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "INVESTOR_REJECTED",
          metadata: expect.objectContaining({
            rejectionReason: "Unaccredited",
          }),
        }),
      );
    });

    it("sends rejection email (fire-and-forget)", async () => {
      setupAuthMocks();
      await reviewPOST(
        makePostRequest("http://localhost/api/admin/investors/inv-1/review", {
          ...baseBody,
          action: "reject",
          rejectionReason: "Not qualified",
        }),
        { params },
      );
      await flushPromises();
      expect(mockSendInvestorRejectedEmail).toHaveBeenCalledWith(
        "inv-1",
        "fund-1",
        "Not qualified",
      );
    });
  });

  // ── Error handling ─────────────────────────────────────────────
  it("returns 500 and reports error on internal failure", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "gp-1" } });
    mockUserTeamFindFirst.mockRejectedValue(new Error("DB failure"));

    const res = await reviewPOST(
      makePostRequest("http://localhost/api/admin/investors/inv-1/review", baseBody),
      { params },
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(mockReportError).toHaveBeenCalled();
  });

  it("preserves existing fundData fields during approve", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "gp-1" } });
    mockUserTeamFindFirst.mockResolvedValue({
      userId: "gp-1",
      teamId: "team-1",
      role: "ADMIN",
    });
    mockFundFindFirst.mockResolvedValue({ id: "fund-1" });
    mockInvestorFindUnique.mockResolvedValue({
      ...mockInvestor,
      fundData: { existingField: "preserved", stage: "PENDING" },
    });
    mockInvestorUpdate.mockResolvedValue({});

    await reviewPOST(
      makePostRequest("http://localhost/api/admin/investors/inv-1/review", baseBody),
      { params },
    );
    expect(mockInvestorUpdate).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: expect.objectContaining({
        fundData: expect.objectContaining({
          existingField: "preserved",
          stage: "APPROVED",
        }),
      }),
    });
  });

  it("handles null fundData gracefully", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "gp-1" } });
    mockUserTeamFindFirst.mockResolvedValue({
      userId: "gp-1",
      teamId: "team-1",
      role: "ADMIN",
    });
    mockFundFindFirst.mockResolvedValue({ id: "fund-1" });
    mockInvestorFindUnique.mockResolvedValue({
      ...mockInvestor,
      fundData: null,
    });
    mockInvestorUpdate.mockResolvedValue({});

    const res = await reviewPOST(
      makePostRequest("http://localhost/api/admin/investors/inv-1/review", baseBody),
      { params },
    );
    expect(res.status).toBe(200);
    expect(mockInvestorUpdate).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: expect.objectContaining({
        fundData: expect.objectContaining({
          stage: "APPROVED",
        }),
      }),
    });
  });
});
