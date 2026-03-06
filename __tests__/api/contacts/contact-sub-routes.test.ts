/**
 * Tests for Contact Sub-Routes:
 *   GET/POST /api/contacts/[id]/engagement
 *   PUT /api/contacts/[id]/follow-up
 *   GET/POST /api/contacts/[id]/notes
 *   PUT /api/contacts/[id]/status
 */

const mockGetServerSession = jest.fn();
const mockReportError = jest.fn();
const mockLogAuditEvent = jest.fn().mockResolvedValue(undefined);
const mockAppRouterRateLimit = jest.fn().mockResolvedValue(null);
const mockResolveCrmRole = jest.fn().mockReturnValue("MANAGER");
const mockHasCrmPermission = jest.fn().mockReturnValue(true);
const mockRecalculateContactEngagement = jest.fn();
const mockValidateBody = jest.fn();

jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));
jest.mock("@/lib/auth/auth-options", () => ({ authOptions: {} }));
jest.mock("@/lib/error", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));
jest.mock("@/lib/audit/audit-logger", () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));
jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterRateLimit: (...args: unknown[]) => mockAppRouterRateLimit(...args),
}));
jest.mock("@/lib/auth/crm-roles", () => ({
  resolveCrmRole: (...args: unknown[]) => mockResolveCrmRole(...args),
  hasCrmPermission: (...args: unknown[]) => mockHasCrmPermission(...args),
}));
jest.mock("@/lib/crm/contact-service", () => ({
  recalculateContactEngagement: (...args: unknown[]) =>
    mockRecalculateContactEngagement(...args),
}));
jest.mock("@/lib/middleware/validate", () => ({
  validateBody: (...args: unknown[]) => mockValidateBody(...args),
}));
jest.mock("@/lib/validations/teams", () => ({
  ContactFollowUpSchema: {},
}));

const { NextRequest } = require("next/server");
const prisma = require("@/lib/prisma").default;

function makeReq(url: string, opts?: RequestInit) {
  return new NextRequest(`http://localhost${url}`, opts);
}

const SESSION = { user: { id: "user1", email: "gp@test.com" } };
const TEAM = { role: "ADMIN", crmRole: "MANAGER", team: { id: "team1", organizationId: "org1" } };

// ─── ENGAGEMENT ROUTE ────────────────────────────────────────────────────────

describe("GET /api/contacts/[id]/engagement", () => {
  let GET: Function;
  const params = Promise.resolve({ id: "c1" });

  beforeAll(() => {
    GET = require("@/app/api/contacts/[id]/engagement/route").GET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    prisma.userTeam.findFirst.mockResolvedValue(TEAM);
    mockResolveCrmRole.mockReturnValue("MANAGER");
    mockHasCrmPermission.mockReturnValue(true);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(makeReq("/api/contacts/c1/engagement"), { params });
    expect(res.status).toBe(401);
  });

  it("returns 403 when no team found", async () => {
    prisma.userTeam.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq("/api/contacts/c1/engagement"), { params });
    expect(res.status).toBe(403);
  });

  it("returns 403 when CRM permission insufficient", async () => {
    mockHasCrmPermission.mockReturnValue(false);
    const res = await GET(makeReq("/api/contacts/c1/engagement"), { params });
    expect(res.status).toBe(403);
  });

  it("returns 404 when contact not found", async () => {
    prisma.contact.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq("/api/contacts/c1/engagement"), { params });
    expect(res.status).toBe(404);
  });

  it("returns engagement breakdown on success", async () => {
    prisma.contact.findFirst.mockResolvedValue({
      id: "c1",
      engagementScore: 42,
      lastEngagedAt: "2026-01-15T00:00:00Z",
      lastContactedAt: "2026-01-10T00:00:00Z",
    });
    prisma.contactActivity.findMany.mockResolvedValue([
      { type: "EMAIL_SENT", createdAt: new Date() },
      { type: "EMAIL_OPENED", createdAt: new Date() },
      { type: "LINK_CLICKED", createdAt: new Date() },
      { type: "EMAIL_SENT", createdAt: new Date() },
    ]);

    const res = await GET(makeReq("/api/contacts/c1/engagement"), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.contactId).toBe("c1");
    expect(body.engagementScore).toBe(42);
    expect(body.activityCount).toBe(4);
    expect(body.emailMetrics.sent).toBe(2);
    expect(body.emailMetrics.opened).toBe(1);
    expect(body.emailMetrics.clicked).toBe(1);
    expect(body.emailMetrics.openRate).toBe(50);
    expect(body.emailMetrics.clickRate).toBe(50);
  });

  it("handles zero emails correctly (no division by zero)", async () => {
    prisma.contact.findFirst.mockResolvedValue({
      id: "c1",
      engagementScore: 0,
      lastEngagedAt: null,
      lastContactedAt: null,
    });
    prisma.contactActivity.findMany.mockResolvedValue([]);

    const res = await GET(makeReq("/api/contacts/c1/engagement"), { params });
    const body = await res.json();
    expect(body.emailMetrics.openRate).toBe(0);
    expect(body.emailMetrics.clickRate).toBe(0);
  });

  it("returns 500 on unexpected error", async () => {
    prisma.userTeam.findFirst.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeReq("/api/contacts/c1/engagement"), { params });
    expect(res.status).toBe(500);
    expect(mockReportError).toHaveBeenCalled();
  });
});

describe("POST /api/contacts/[id]/engagement", () => {
  let POST: Function;
  const params = Promise.resolve({ id: "c1" });

  beforeAll(() => {
    POST = require("@/app/api/contacts/[id]/engagement/route").POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    prisma.userTeam.findFirst.mockResolvedValue(TEAM);
    mockResolveCrmRole.mockReturnValue("MANAGER");
    mockHasCrmPermission.mockReturnValue(true);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makeReq("/api/contacts/c1/engagement", { method: "POST" }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 403 when VIEWER role (needs CONTRIBUTOR)", async () => {
    mockHasCrmPermission.mockReturnValue(false);
    const res = await POST(makeReq("/api/contacts/c1/engagement", { method: "POST" }), { params });
    expect(res.status).toBe(403);
  });

  it("returns 404 when contact not found", async () => {
    prisma.contact.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq("/api/contacts/c1/engagement", { method: "POST" }), { params });
    expect(res.status).toBe(404);
  });

  it("recalculates engagement on success", async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: "c1" });
    mockRecalculateContactEngagement.mockResolvedValue({
      total: 35,
      tier: "WARM",
      byType: { EMAIL_SENT: 5 },
      emailMetrics: { sent: 5, opened: 3, clicked: 1, replied: 0, openRate: 60, clickRate: 20 },
      activityCount: 8,
      lastActivityAt: "2026-02-01T00:00:00Z",
    });

    const res = await POST(makeReq("/api/contacts/c1/engagement", { method: "POST" }), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.engagementScore).toBe(35);
    expect(body.tier).toBe("WARM");
    expect(mockRecalculateContactEngagement).toHaveBeenCalledWith("c1", "team1");
  });
});

// ─── FOLLOW-UP ROUTE ─────────────────────────────────────────────────────────

describe("PUT /api/contacts/[id]/follow-up", () => {
  let PUT: Function;
  const params = Promise.resolve({ id: "c1" });

  beforeAll(() => {
    PUT = require("@/app/api/contacts/[id]/follow-up/route").PUT;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    prisma.userTeam.findFirst.mockResolvedValue(TEAM);
    mockResolveCrmRole.mockReturnValue("CONTRIBUTOR");
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PUT(makeReq("/api/contacts/c1/follow-up", { method: "PUT" }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 403 when no team found", async () => {
    prisma.userTeam.findFirst.mockResolvedValue(null);
    const res = await PUT(makeReq("/api/contacts/c1/follow-up", { method: "PUT" }), { params });
    expect(res.status).toBe(403);
  });

  it("returns 403 for VIEWER role", async () => {
    mockResolveCrmRole.mockReturnValue("VIEWER");
    const res = await PUT(makeReq("/api/contacts/c1/follow-up", { method: "PUT" }), { params });
    expect(res.status).toBe(403);
  });

  it("returns 404 when contact not found", async () => {
    prisma.contact.findFirst.mockResolvedValue(null);
    mockValidateBody.mockResolvedValue({ data: { nextFollowUpDate: "2026-03-01" } });
    const res = await PUT(makeReq("/api/contacts/c1/follow-up", { method: "PUT" }), { params });
    expect(res.status).toBe(404);
  });

  it("sets follow-up date successfully", async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: "c1", teamId: "team1" });
    mockValidateBody.mockResolvedValue({ data: { nextFollowUpDate: "2026-03-01T00:00:00Z" } });
    prisma.contact.update.mockResolvedValue({
      id: "c1",
      nextFollowUpAt: new Date("2026-03-01"),
    });

    const res = await PUT(makeReq("/api/contacts/c1/follow-up", { method: "PUT" }), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.id).toBe("c1");
    expect(prisma.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
        data: { nextFollowUpAt: expect.any(Date) },
      }),
    );
  });

  it("clears follow-up date when null", async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: "c1", teamId: "team1" });
    mockValidateBody.mockResolvedValue({ data: { nextFollowUpDate: null } });
    prisma.contact.update.mockResolvedValue({
      id: "c1",
      nextFollowUpAt: null,
    });

    const res = await PUT(makeReq("/api/contacts/c1/follow-up", { method: "PUT" }), { params });
    expect(res.status).toBe(200);
    expect(prisma.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { nextFollowUpAt: null },
      }),
    );
  });

  it("returns validation error from validateBody", async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: "c1", teamId: "team1" });
    const mockErrorResponse = { status: 400, json: async () => ({ error: "Invalid input" }) };
    mockValidateBody.mockResolvedValue({ error: mockErrorResponse });
    const res = await PUT(makeReq("/api/contacts/c1/follow-up", { method: "PUT" }), { params });
    expect(res.status).toBe(400);
  });
});

// ─── NOTES ROUTE ─────────────────────────────────────────────────────────────

describe("GET /api/contacts/[id]/notes", () => {
  let GET: Function;
  const params = Promise.resolve({ id: "c1" });

  beforeAll(() => {
    GET = require("@/app/api/contacts/[id]/notes/route").GET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    prisma.userTeam.findFirst.mockResolvedValue(TEAM);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(makeReq("/api/contacts/c1/notes"), { params });
    expect(res.status).toBe(401);
  });

  it("returns 403 when no team found", async () => {
    prisma.userTeam.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq("/api/contacts/c1/notes"), { params });
    expect(res.status).toBe(403);
  });

  it("returns 404 when contact not found", async () => {
    prisma.contact.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq("/api/contacts/c1/notes"), { params });
    expect(res.status).toBe(404);
  });

  it("returns notes on success", async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: "c1" });
    prisma.contactNote.findMany.mockResolvedValue([
      { id: "n1", content: "Follow up on proposal", author: { id: "user1", name: "GP", email: "gp@test.com", image: null } },
      { id: "n2", content: "Interested in Series A", author: { id: "user1", name: "GP", email: "gp@test.com", image: null } },
    ]);

    const res = await GET(makeReq("/api/contacts/c1/notes"), { params });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.notes).toHaveLength(2);
    expect(body.notes[0].content).toBe("Follow up on proposal");
  });

  it("returns 500 on error", async () => {
    prisma.userTeam.findFirst.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeReq("/api/contacts/c1/notes"), { params });
    expect(res.status).toBe(500);
    expect(mockReportError).toHaveBeenCalled();
  });
});

describe("POST /api/contacts/[id]/notes", () => {
  let POST: Function;
  const params = Promise.resolve({ id: "c1" });

  beforeAll(() => {
    POST = require("@/app/api/contacts/[id]/notes/route").POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    prisma.userTeam.findFirst.mockResolvedValue(TEAM);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(
      makeReq("/api/contacts/c1/notes", {
        method: "POST",
        body: JSON.stringify({ content: "test" }),
      }),
      { params },
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when content is missing", async () => {
    const res = await POST(
      makeReq("/api/contacts/c1/notes", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when content is empty string", async () => {
    const res = await POST(
      makeReq("/api/contacts/c1/notes", {
        method: "POST",
        body: JSON.stringify({ content: "   " }),
      }),
      { params },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when content exceeds 10,000 chars", async () => {
    const res = await POST(
      makeReq("/api/contacts/c1/notes", {
        method: "POST",
        body: JSON.stringify({ content: "a".repeat(10001) }),
      }),
      { params },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when contact not found", async () => {
    prisma.contact.findFirst.mockResolvedValue(null);
    const res = await POST(
      makeReq("/api/contacts/c1/notes", {
        method: "POST",
        body: JSON.stringify({ content: "test note" }),
      }),
      { params },
    );
    expect(res.status).toBe(404);
  });

  it("creates note with activity in $transaction", async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: "c1" });
    const createdNote = {
      id: "n1",
      contactId: "c1",
      authorId: "user1",
      content: "Follow up needed",
      isPinned: false,
      isPrivate: false,
      author: { id: "user1", name: "GP", email: "gp@test.com", image: null },
    };
    prisma.$transaction.mockResolvedValue([createdNote, {}]);

    const res = await POST(
      makeReq("/api/contacts/c1/notes", {
        method: "POST",
        body: JSON.stringify({ content: "Follow up needed" }),
      }),
      { params },
    );
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.content).toBe("Follow up needed");
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("creates pinned note", async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: "c1" });
    prisma.$transaction.mockResolvedValue([
      { id: "n1", isPinned: true, content: "Important", author: {} },
      {},
    ]);

    const res = await POST(
      makeReq("/api/contacts/c1/notes", {
        method: "POST",
        body: JSON.stringify({ content: "Important", isPinned: true }),
      }),
      { params },
    );
    expect(res.status).toBe(201);
  });
});

// ─── STATUS ROUTE ────────────────────────────────────────────────────────────

describe("PUT /api/contacts/[id]/status", () => {
  let PUT: Function;
  const params = Promise.resolve({ id: "c1" });

  beforeAll(() => {
    PUT = require("@/app/api/contacts/[id]/status/route").PUT;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    prisma.userTeam.findFirst.mockResolvedValue(TEAM);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await PUT(
      makeReq("/api/contacts/c1/status", {
        method: "PUT",
        body: JSON.stringify({ status: "LEAD" }),
      }),
      { params },
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when no team found", async () => {
    prisma.userTeam.findFirst.mockResolvedValue(null);
    const res = await PUT(
      makeReq("/api/contacts/c1/status", {
        method: "PUT",
        body: JSON.stringify({ status: "LEAD" }),
      }),
      { params },
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when contact not found", async () => {
    prisma.contact.findFirst.mockResolvedValue(null);
    const res = await PUT(
      makeReq("/api/contacts/c1/status", {
        method: "PUT",
        body: JSON.stringify({ status: "LEAD" }),
      }),
      { params },
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid status", async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: "c1", status: "LEAD" });
    const res = await PUT(
      makeReq("/api/contacts/c1/status", {
        method: "PUT",
        body: JSON.stringify({ status: "INVALID_STATUS" }),
      }),
      { params },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid status");
  });

  it("returns 400 when status is missing", async () => {
    prisma.contact.findFirst.mockResolvedValue({ id: "c1", status: "LEAD" });
    const res = await PUT(
      makeReq("/api/contacts/c1/status", {
        method: "PUT",
        body: JSON.stringify({}),
      }),
      { params },
    );
    expect(res.status).toBe(400);
  });

  it("returns current contact when status unchanged (no-op)", async () => {
    const contact = { id: "c1", status: "LEAD", convertedAt: null, closedAt: null };
    prisma.contact.findFirst.mockResolvedValue(contact);
    const res = await PUT(
      makeReq("/api/contacts/c1/status", {
        method: "PUT",
        body: JSON.stringify({ status: "LEAD" }),
      }),
      { params },
    );
    expect(res.status).toBe(200);
    expect(prisma.contact.update).not.toHaveBeenCalled();
  });

  it("updates status and creates activity", async () => {
    prisma.contact.findFirst.mockResolvedValue({
      id: "c1",
      status: "LEAD",
      convertedAt: null,
      closedAt: null,
    });
    prisma.contact.update.mockResolvedValue({ id: "c1", status: "OPPORTUNITY" });
    prisma.contactActivity.create.mockResolvedValue({});

    const res = await PUT(
      makeReq("/api/contacts/c1/status", {
        method: "PUT",
        body: JSON.stringify({ status: "OPPORTUNITY" }),
      }),
      { params },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("OPPORTUNITY");
    expect(prisma.contactActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "STATUS_CHANGE",
          metadata: { previousStatus: "LEAD", newStatus: "OPPORTUNITY" },
        }),
      }),
    );
  });

  it("sets convertedAt when moving from early to converted stage", async () => {
    prisma.contact.findFirst.mockResolvedValue({
      id: "c1",
      status: "PROSPECT",
      convertedAt: null,
      closedAt: null,
    });
    prisma.contact.update.mockResolvedValue({ id: "c1", status: "OPPORTUNITY" });
    prisma.contactActivity.create.mockResolvedValue({});

    await PUT(
      makeReq("/api/contacts/c1/status", {
        method: "PUT",
        body: JSON.stringify({ status: "OPPORTUNITY" }),
      }),
      { params },
    );

    expect(prisma.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "OPPORTUNITY",
          convertedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("sets closedAt when moving to WON", async () => {
    prisma.contact.findFirst.mockResolvedValue({
      id: "c1",
      status: "OPPORTUNITY",
      convertedAt: new Date(),
      closedAt: null,
    });
    prisma.contact.update.mockResolvedValue({ id: "c1", status: "WON" });
    prisma.contactActivity.create.mockResolvedValue({});

    await PUT(
      makeReq("/api/contacts/c1/status", {
        method: "PUT",
        body: JSON.stringify({ status: "WON" }),
      }),
      { params },
    );

    expect(prisma.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "WON",
          closedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("sets closedAt when moving to LOST", async () => {
    prisma.contact.findFirst.mockResolvedValue({
      id: "c1",
      status: "LEAD",
      convertedAt: null,
      closedAt: null,
    });
    prisma.contact.update.mockResolvedValue({ id: "c1", status: "LOST" });
    prisma.contactActivity.create.mockResolvedValue({});

    await PUT(
      makeReq("/api/contacts/c1/status", {
        method: "PUT",
        body: JSON.stringify({ status: "LOST" }),
      }),
      { params },
    );

    expect(prisma.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "LOST",
          closedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("does NOT overwrite existing convertedAt", async () => {
    const existingDate = new Date("2026-01-01");
    prisma.contact.findFirst.mockResolvedValue({
      id: "c1",
      status: "LEAD",
      convertedAt: existingDate,
      closedAt: null,
    });
    prisma.contact.update.mockResolvedValue({ id: "c1", status: "CUSTOMER" });
    prisma.contactActivity.create.mockResolvedValue({});

    await PUT(
      makeReq("/api/contacts/c1/status", {
        method: "PUT",
        body: JSON.stringify({ status: "CUSTOMER" }),
      }),
      { params },
    );

    // Should NOT set convertedAt because it already exists
    const updateCall = prisma.contact.update.mock.calls[0][0];
    expect(updateCall.data.convertedAt).toBeUndefined();
  });

  it("logs audit event", async () => {
    prisma.contact.findFirst.mockResolvedValue({
      id: "c1",
      status: "LEAD",
      convertedAt: null,
      closedAt: null,
    });
    prisma.contact.update.mockResolvedValue({ id: "c1", status: "OPPORTUNITY" });
    prisma.contactActivity.create.mockResolvedValue({});

    await PUT(
      makeReq("/api/contacts/c1/status", {
        method: "PUT",
        body: JSON.stringify({ status: "OPPORTUNITY" }),
      }),
      { params },
    );

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "CONTACT_STATUS_CHANGED",
        resourceType: "Contact",
        resourceId: "c1",
        metadata: { previousStatus: "LEAD", newStatus: "OPPORTUNITY" },
      }),
    );
  });

  it("returns 500 on unexpected error", async () => {
    prisma.userTeam.findFirst.mockRejectedValue(new Error("DB error"));
    const res = await PUT(
      makeReq("/api/contacts/c1/status", {
        method: "PUT",
        body: JSON.stringify({ status: "LEAD" }),
      }),
      { params },
    );
    expect(res.status).toBe(500);
    expect(mockReportError).toHaveBeenCalled();
  });
});
