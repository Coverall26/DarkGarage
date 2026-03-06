/**
 * Tests for GET /api/contacts and POST /api/contacts
 *
 * Route: app/api/contacts/route.ts
 */

import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — jest.mock() is hoisted, so use inline jest.fn() in factories
// ---------------------------------------------------------------------------

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    contact: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    contactActivity: {
      create: jest.fn(),
    },
    pendingContact: {
      deleteMany: jest.fn(),
    },
    userTeam: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth/auth-options", () => ({
  authOptions: {},
}));

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/tier/crm-tier", () => ({
  resolveOrgTier: jest.fn(),
}));

jest.mock("@/lib/tier/gates", () => ({
  checkContactLimit: jest.fn(),
}));

jest.mock("@/lib/audit/audit-logger", () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/auth/crm-roles", () => ({
  resolveCrmRole: jest.fn(),
}));

jest.mock("@/lib/middleware/validate", () => ({
  validateBody: jest.fn(),
}));

jest.mock("@/lib/middleware/module-access", () => ({
  checkModuleAccess: jest.fn().mockResolvedValue(null),
  checkModuleLimit: jest.fn().mockResolvedValue(null),
  resolveOrgIdFromTeam: jest.fn().mockResolvedValue("org-1"),
}));

// Import handlers + mocked modules after jest.mock declarations
import { GET, POST } from "@/app/api/contacts/route";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { reportError } from "@/lib/error";
import { resolveOrgTier } from "@/lib/tier/crm-tier";
import { checkContactLimit } from "@/lib/tier/gates";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { resolveCrmRole } from "@/lib/auth/crm-roles";
import { validateBody } from "@/lib/middleware/validate";

// Cast to jest.Mock for type safety
const mockPrisma = prisma as unknown as {
  contact: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; create: jest.Mock };
  contactActivity: { create: jest.Mock };
  pendingContact: { deleteMany: jest.Mock };
  userTeam: { findFirst: jest.Mock };
};
const mockGetServerSession = getServerSession as jest.Mock;
const mockReportError = reportError as jest.Mock;
const mockResolveOrgTier = resolveOrgTier as jest.Mock;
const mockCheckContactLimit = checkContactLimit as jest.Mock;
const mockLogAuditEvent = logAuditEvent as jest.Mock;
const mockResolveCrmRole = resolveCrmRole as jest.Mock;
const mockValidateBody = validateBody as jest.Mock;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER_ID = "user-123";
const MOCK_TEAM_ID = "team-456";
const MOCK_ORG_ID = "org-789";

function authenticatedSession(userId = MOCK_USER_ID) {
  return { user: { id: userId, email: "gp@example.com" } };
}

function mockUserTeamContext(overrides?: Partial<{
  role: string;
  crmRole: string | null;
  teamId: string;
  organizationId: string | null;
}>) {
  return {
    userId: MOCK_USER_ID,
    role: overrides?.role ?? "ADMIN",
    crmRole: overrides?.crmRole ?? null,
    team: {
      id: overrides?.teamId ?? MOCK_TEAM_ID,
      organizationId: overrides?.organizationId ?? MOCK_ORG_ID,
    },
  };
}

function defaultTier(overrides?: Record<string, unknown>) {
  return {
    tier: "FREE",
    aiCrmEnabled: false,
    maxContacts: 20,
    maxEsigsPerMonth: 10,
    maxSignerStorage: 40,
    emailTemplateLimit: 2,
    hasKanban: false,
    hasOutreachQueue: false,
    hasEmailTracking: false,
    hasLpOnboarding: false,
    hasAiFeatures: false,
    pipelineStages: ["LEAD", "CONTACTED", "INTERESTED", "CONVERTED"],
    ...overrides,
  };
}

function makeGetRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/contacts");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url);
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ===========================================================================
// GET /api/contacts
// ===========================================================================

describe("GET /api/contacts", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 403 when no organization found", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(null);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("No organization found");
  });

  it("returns 403 when organization ID is null", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue({
      userId: "user-123",
      role: "ADMIN",
      crmRole: null,
      team: { id: "team-456", organizationId: null },
    });

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("No organization found");
  });

  it("returns contacts with pagination (happy path)", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveOrgTier.mockResolvedValue(defaultTier());
    mockResolveCrmRole.mockReturnValue("MANAGER");

    const mockContacts = [
      { id: "c1", email: "a@example.com", firstName: "Alice", contactActivities: [] },
      { id: "c2", email: "b@example.com", firstName: "Bob", contactActivities: [] },
    ];

    // findMany + count (Promise.all)
    mockPrisma.contact.findMany.mockResolvedValue(mockContacts);
    // count is called twice: once for total, once for contactCount
    mockPrisma.contact.count
      .mockResolvedValueOnce(2)   // total (in Promise.all)
      .mockResolvedValueOnce(15); // contactCount for usage

    const res = await GET(makeGetRequest({ page: "1", limit: "10" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.contacts).toHaveLength(2);
    expect(json.total).toBe(2);
    expect(json.page).toBe(1);
    expect(json.limit).toBe(10);
    expect(json.contacts[0].email).toBe("a@example.com");
  });

  it("applies search filter", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveOrgTier.mockResolvedValue(defaultTier());
    mockResolveCrmRole.mockReturnValue("CONTRIBUTOR");
    mockPrisma.contact.findMany.mockResolvedValue([]);
    mockPrisma.contact.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(5);

    await GET(makeGetRequest({ search: "alice" }));

    const whereArg = mockPrisma.contact.findMany.mock.calls[0][0].where;
    expect(whereArg.teamId).toBe(MOCK_TEAM_ID);
    expect(whereArg.OR).toBeDefined();
    expect(whereArg.OR).toHaveLength(4);
    expect(whereArg.OR[0]).toEqual({
      firstName: { contains: "alice", mode: "insensitive" },
    });
    expect(whereArg.OR[2]).toEqual({
      email: { contains: "alice", mode: "insensitive" },
    });
  });

  it("applies status filter", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveOrgTier.mockResolvedValue(defaultTier());
    mockResolveCrmRole.mockReturnValue("MANAGER");
    mockPrisma.contact.findMany.mockResolvedValue([]);
    mockPrisma.contact.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(5);

    await GET(makeGetRequest({ status: "LEAD" }));

    const whereArg = mockPrisma.contact.findMany.mock.calls[0][0].where;
    expect(whereArg.status).toBe("LEAD");
  });

  it("applies engagement filter for hot leads", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveOrgTier.mockResolvedValue(defaultTier());
    mockResolveCrmRole.mockReturnValue("MANAGER");
    mockPrisma.contact.findMany.mockResolvedValue([]);
    mockPrisma.contact.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(5);

    await GET(makeGetRequest({ engagement: "hot" }));

    const whereArg = mockPrisma.contact.findMany.mock.calls[0][0].where;
    expect(whereArg.engagementScore).toEqual({ gte: 15 });
  });

  it("returns tier and usage info", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveOrgTier.mockResolvedValue(defaultTier({ maxContacts: 20 }));
    mockResolveCrmRole.mockReturnValue("MANAGER");
    mockPrisma.contact.findMany.mockResolvedValue([]);
    mockPrisma.contact.count
      .mockResolvedValueOnce(0)   // total
      .mockResolvedValueOnce(18); // contactCount

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.tier).toBe("FREE");
    expect(json.aiCrmEnabled).toBe(false);
    expect(json.pipelineStages).toEqual([
      "LEAD", "CONTACTED", "INTERESTED", "CONVERTED",
    ]);
    expect(json.usage).toEqual({
      contactCount: 18,
      contactLimit: 20,
    });
  });

  it("returns CRM role in response", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(
      mockUserTeamContext({ role: "MEMBER", crmRole: "CONTRIBUTOR" }),
    );
    mockResolveOrgTier.mockResolvedValue(defaultTier());
    mockResolveCrmRole.mockReturnValue("CONTRIBUTOR");
    mockPrisma.contact.findMany.mockResolvedValue([]);
    mockPrisma.contact.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(5);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.crmRole).toBe("CONTRIBUTOR");
    expect(mockResolveCrmRole).toHaveBeenCalledWith("MEMBER", "CONTRIBUTOR");
  });

  it("includes investor profile when tier has LP onboarding", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveOrgTier.mockResolvedValue(defaultTier({ hasLpOnboarding: true }));
    mockResolveCrmRole.mockReturnValue("MANAGER");
    mockPrisma.contact.findMany.mockResolvedValue([]);
    mockPrisma.contact.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    await GET(makeGetRequest());

    const includeArg = mockPrisma.contact.findMany.mock.calls[0][0].include;
    expect(includeArg.investor).toBeDefined();
    expect(includeArg.investor.select.accreditationStatus).toBe(true);
  });

  it("excludes investor profile when tier does not have LP onboarding", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveOrgTier.mockResolvedValue(defaultTier({ hasLpOnboarding: false }));
    mockResolveCrmRole.mockReturnValue("MANAGER");
    mockPrisma.contact.findMany.mockResolvedValue([]);
    mockPrisma.contact.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    await GET(makeGetRequest());

    const includeArg = mockPrisma.contact.findMany.mock.calls[0][0].include;
    expect(includeArg.investor).toBeUndefined();
  });

  it("respects pagination bounds (page and limit)", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveOrgTier.mockResolvedValue(defaultTier());
    mockResolveCrmRole.mockReturnValue("MANAGER");
    mockPrisma.contact.findMany.mockResolvedValue([]);
    mockPrisma.contact.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(100);

    const res = await GET(makeGetRequest({ page: "3", limit: "25" }));
    const json = await res.json();

    expect(json.page).toBe(3);
    expect(json.limit).toBe(25);
    // skip = (3-1) * 25 = 50
    expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        take: 25,
      }),
    );
  });

  it("clamps limit to 100 max", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveOrgTier.mockResolvedValue(defaultTier());
    mockResolveCrmRole.mockReturnValue("MANAGER");
    mockPrisma.contact.findMany.mockResolvedValue([]);
    mockPrisma.contact.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const res = await GET(makeGetRequest({ limit: "500" }));
    const json = await res.json();

    expect(json.limit).toBe(100);
    expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("returns 500 and reports error on unexpected failure", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockRejectedValue(new Error("DB down"));

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Internal server error");
    expect(mockReportError).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ===========================================================================
// POST /api/contacts
// ===========================================================================

describe("POST /api/contacts", () => {
  const validBody = {
    email: "new@example.com",
    firstName: "Jane",
    lastName: "Doe",
    source: "MANUAL_ENTRY",
  };

  const createdContact = {
    id: "contact-new",
    teamId: MOCK_TEAM_ID,
    email: "new@example.com",
    firstName: "Jane",
    lastName: "Doe",
    source: "MANUAL_ENTRY",
    status: "PROSPECT",
  };

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await POST(makePostRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 403 when no organization found", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(null);

    const res = await POST(makePostRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("No organization found");
  });

  it("returns 403 when CRM role is VIEWER", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(
      mockUserTeamContext({ role: "MEMBER" }),
    );
    mockResolveCrmRole.mockReturnValue("VIEWER");

    const res = await POST(makePostRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain("CONTRIBUTOR role required");
  });

  it("returns 403 when contact limit is reached", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveCrmRole.mockReturnValue("CONTRIBUTOR");
    mockCheckContactLimit.mockResolvedValue({
      allowed: false,
      meta: { currentCount: 20, maxContacts: 20 },
    });

    const res = await POST(makePostRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("CONTACT_LIMIT_REACHED");
    expect(json.currentCount).toBe(20);
    expect(json.maxContacts).toBe(20);
  });

  it("returns 409 for duplicate email", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveCrmRole.mockReturnValue("CONTRIBUTOR");
    mockCheckContactLimit.mockResolvedValue({ allowed: true });
    mockValidateBody.mockResolvedValue({ data: validBody, error: null });
    mockPrisma.contact.findUnique.mockResolvedValue({
      id: "existing-contact",
      email: "new@example.com",
    });

    const res = await POST(makePostRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("Contact with this email already exists");
    expect(json.contactId).toBe("existing-contact");
  });

  it("creates contact successfully (happy path)", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveCrmRole.mockReturnValue("MANAGER");
    mockCheckContactLimit.mockResolvedValue({ allowed: true });
    mockValidateBody.mockResolvedValue({ data: validBody, error: null });
    mockPrisma.contact.findUnique.mockResolvedValue(null);
    mockPrisma.contact.create.mockResolvedValue(createdContact);
    mockPrisma.contactActivity.create.mockResolvedValue({});

    const res = await POST(makePostRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.id).toBe("contact-new");
    expect(json.email).toBe("new@example.com");
    expect(json.firstName).toBe("Jane");

    // Verify contact.create was called with correct data
    expect(mockPrisma.contact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        teamId: MOCK_TEAM_ID,
        email: "new@example.com",
        firstName: "Jane",
        lastName: "Doe",
        source: "MANUAL_ENTRY",
        status: "PROSPECT",
      }),
    });
  });

  it("normalizes email to lowercase and trims", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveCrmRole.mockReturnValue("CONTRIBUTOR");
    mockCheckContactLimit.mockResolvedValue({ allowed: true });
    mockValidateBody.mockResolvedValue({
      data: { ...validBody, email: "  Upper@Example.COM  " },
      error: null,
    });
    mockPrisma.contact.findUnique.mockResolvedValue(null);
    mockPrisma.contact.create.mockResolvedValue({
      ...createdContact,
      email: "upper@example.com",
    });
    mockPrisma.contactActivity.create.mockResolvedValue({});

    await POST(makePostRequest({ ...validBody, email: "  Upper@Example.COM  " }));

    expect(mockPrisma.contact.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "upper@example.com",
      }),
    });

    // Duplicate check should also use normalized email
    expect(mockPrisma.contact.findUnique).toHaveBeenCalledWith({
      where: {
        teamId_email: {
          teamId: MOCK_TEAM_ID,
          email: "upper@example.com",
        },
      },
    });
  });

  it("creates contact activity record", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveCrmRole.mockReturnValue("CONTRIBUTOR");
    mockCheckContactLimit.mockResolvedValue({ allowed: true });
    mockValidateBody.mockResolvedValue({ data: validBody, error: null });
    mockPrisma.contact.findUnique.mockResolvedValue(null);
    mockPrisma.contact.create.mockResolvedValue(createdContact);
    mockPrisma.contactActivity.create.mockResolvedValue({});

    await POST(makePostRequest(validBody));

    expect(mockPrisma.contactActivity.create).toHaveBeenCalledWith({
      data: {
        contactId: "contact-new",
        type: "CREATED",
        description: "Contact created via MANUAL_ENTRY",
        actorId: MOCK_USER_ID,
      },
    });
  });

  it("deletes PendingContact for DATAROOM_VIEWER source", async () => {
    const dataroomBody = { ...validBody, source: "DATAROOM_VIEWER" };
    const dataroomContact = { ...createdContact, source: "DATAROOM_VIEWER" };

    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveCrmRole.mockReturnValue("MANAGER");
    mockCheckContactLimit.mockResolvedValue({ allowed: true });
    mockValidateBody.mockResolvedValue({ data: dataroomBody, error: null });
    mockPrisma.contact.findUnique.mockResolvedValue(null);
    mockPrisma.contact.create.mockResolvedValue(dataroomContact);
    mockPrisma.contactActivity.create.mockResolvedValue({});
    mockPrisma.pendingContact.deleteMany.mockResolvedValue({ count: 1 });

    await POST(makePostRequest(dataroomBody));

    expect(mockPrisma.pendingContact.deleteMany).toHaveBeenCalledWith({
      where: {
        orgId: MOCK_ORG_ID,
        email: "new@example.com",
      },
    });
  });

  it("deletes PendingContact for DATAROOM_VIEW source", async () => {
    const dataroomBody = { ...validBody, source: "DATAROOM_VIEW" };
    const dataroomContact = { ...createdContact, source: "DATAROOM_VIEW" };

    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveCrmRole.mockReturnValue("MANAGER");
    mockCheckContactLimit.mockResolvedValue({ allowed: true });
    mockValidateBody.mockResolvedValue({ data: dataroomBody, error: null });
    mockPrisma.contact.findUnique.mockResolvedValue(null);
    mockPrisma.contact.create.mockResolvedValue(dataroomContact);
    mockPrisma.contactActivity.create.mockResolvedValue({});
    mockPrisma.pendingContact.deleteMany.mockResolvedValue({ count: 1 });

    await POST(makePostRequest(dataroomBody));

    expect(mockPrisma.pendingContact.deleteMany).toHaveBeenCalledWith({
      where: {
        orgId: MOCK_ORG_ID,
        email: "new@example.com",
      },
    });
  });

  it("does NOT delete PendingContact for non-dataroom sources", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveCrmRole.mockReturnValue("CONTRIBUTOR");
    mockCheckContactLimit.mockResolvedValue({ allowed: true });
    mockValidateBody.mockResolvedValue({ data: validBody, error: null });
    mockPrisma.contact.findUnique.mockResolvedValue(null);
    mockPrisma.contact.create.mockResolvedValue(createdContact);
    mockPrisma.contactActivity.create.mockResolvedValue({});

    await POST(makePostRequest(validBody));

    expect(mockPrisma.pendingContact.deleteMany).not.toHaveBeenCalled();
  });

  it("fires audit log event on successful creation", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveCrmRole.mockReturnValue("CONTRIBUTOR");
    mockCheckContactLimit.mockResolvedValue({ allowed: true });
    mockValidateBody.mockResolvedValue({ data: validBody, error: null });
    mockPrisma.contact.findUnique.mockResolvedValue(null);
    mockPrisma.contact.create.mockResolvedValue(createdContact);
    mockPrisma.contactActivity.create.mockResolvedValue({});

    await POST(makePostRequest(validBody));

    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      eventType: "CONTACT_CREATED",
      userId: MOCK_USER_ID,
      teamId: MOCK_TEAM_ID,
      resourceType: "Contact",
      resourceId: "contact-new",
      metadata: { email: "new@example.com", source: "MANUAL_ENTRY" },
    });
  });

  it("returns validation error from validateBody", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveCrmRole.mockReturnValue("CONTRIBUTOR");
    mockCheckContactLimit.mockResolvedValue({ allowed: true });

    const validationErrorResponse = new Response(
      JSON.stringify({ error: "Validation failed" }),
      { status: 400 },
    );
    // NextResponse.json is returned for validation errors
    const { NextResponse: RealNextResponse } = jest.requireActual("next/server");
    const errorResp = RealNextResponse.json(
      { error: "Validation failed", issues: [{ path: "email", message: "Required" }] },
      { status: 400 },
    );
    mockValidateBody.mockResolvedValue({ data: null, error: errorResp });

    const res = await POST(makePostRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Validation failed");
    expect(mockPrisma.contact.create).not.toHaveBeenCalled();
  });

  it("returns 500 and reports error on unexpected failure", async () => {
    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveCrmRole.mockReturnValue("MANAGER");
    mockCheckContactLimit.mockResolvedValue({ allowed: true });
    mockValidateBody.mockResolvedValue({ data: validBody, error: null });
    mockPrisma.contact.findUnique.mockResolvedValue(null);
    mockPrisma.contact.create.mockRejectedValue(new Error("DB write failed"));

    const res = await POST(makePostRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Internal server error");
    expect(mockReportError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("handles PendingContact delete failure gracefully (non-blocking)", async () => {
    const dataroomBody = { ...validBody, source: "DATAROOM_VIEWER" };
    const dataroomContact = { ...createdContact, source: "DATAROOM_VIEWER" };

    mockGetServerSession.mockResolvedValue(authenticatedSession());
    mockPrisma.userTeam.findFirst.mockResolvedValue(mockUserTeamContext());
    mockResolveCrmRole.mockReturnValue("MANAGER");
    mockCheckContactLimit.mockResolvedValue({ allowed: true });
    mockValidateBody.mockResolvedValue({ data: dataroomBody, error: null });
    mockPrisma.contact.findUnique.mockResolvedValue(null);
    mockPrisma.contact.create.mockResolvedValue(dataroomContact);
    mockPrisma.contactActivity.create.mockResolvedValue({});
    mockPrisma.pendingContact.deleteMany.mockRejectedValue(
      new Error("PendingContact delete failed"),
    );

    const res = await POST(makePostRequest(dataroomBody));

    // Should still return 201 despite PendingContact delete failure
    expect(res.status).toBe(201);
    // reportError should be called for the failed PendingContact delete
    expect(mockReportError).toHaveBeenCalledWith(expect.any(Error));
  });
});
