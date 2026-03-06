/**
 * Capital Calls API Tests
 *
 * Tests for 5 App Router route files:
 *
 *   1. GET  /api/teams/[teamId]/funds/[fundId]/capital-calls           — List calls
 *      POST /api/teams/[teamId]/funds/[fundId]/capital-calls           — Create call
 *
 *   2. GET    /api/teams/[teamId]/funds/[fundId]/capital-calls/[callId]  — Detail
 *      PATCH  /api/teams/[teamId]/funds/[fundId]/capital-calls/[callId]  — Update
 *      DELETE /api/teams/[teamId]/funds/[fundId]/capital-calls/[callId]  — Delete
 *
 *   3. POST /api/teams/[teamId]/funds/[fundId]/capital-calls/[callId]/send — Send to investors
 *
 *   4. GET /api/teams/[teamId]/funds/[fundId]/capital-calls/[callId]/responses — List responses
 *
 *   5. POST /api/teams/[teamId]/funds/[fundId]/capital-calls/[callId]/responses/[responseId]/confirm
 *      — GP confirms payment
 *
 * Validates: auth (401), authorization (403), input validation (400),
 * not-found (404), happy paths (200/201), error handling (500),
 * Prisma data correctness, and audit logging.
 */

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mock function declarations — BEFORE jest.mock() calls
// ---------------------------------------------------------------------------

const mockGetServerSession = jest.fn();
const mockAppRouterRateLimit = jest.fn().mockResolvedValue(null);
const mockReportError = jest.fn();
const mockLogAuditEvent = jest.fn().mockResolvedValue(undefined);
const mockValidateBody = jest.fn();
const mockSendOrgEmail = jest.fn().mockResolvedValue(undefined);

// ---------------------------------------------------------------------------
// jest.mock() calls — wrapper pattern
// ---------------------------------------------------------------------------

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

jest.mock("@/lib/audit/audit-logger", () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

jest.mock("@/lib/middleware/validate", () => ({
  validateBody: (...args: unknown[]) => mockValidateBody(...args),
}));

jest.mock("@/lib/resend", () => ({
  sendOrgEmail: (...args: unknown[]) => mockSendOrgEmail(...args),
}));

jest.mock("@/lib/validations/admin", () => ({
  CapitalCallCreateSchema: {},
  CapitalCallUpdateSchema: {},
}));

// ---------------------------------------------------------------------------
// Route imports — AFTER jest.mock()
// ---------------------------------------------------------------------------

import {
  GET as listCalls,
  POST as createCall,
} from "@/app/api/teams/[teamId]/funds/[fundId]/capital-calls/route";

import {
  GET as getCallDetail,
  PATCH as updateCall,
  DELETE as deleteCall,
} from "@/app/api/teams/[teamId]/funds/[fundId]/capital-calls/[callId]/route";

import { POST as sendCall } from "@/app/api/teams/[teamId]/funds/[fundId]/capital-calls/[callId]/send/route";

import { GET as listResponses } from "@/app/api/teams/[teamId]/funds/[fundId]/capital-calls/[callId]/responses/route";

import { POST as confirmResponse } from "@/app/api/teams/[teamId]/funds/[fundId]/capital-calls/[callId]/responses/[responseId]/confirm/route";

import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEAM_ID = "team-t1";
const FUND_ID = "fund-f1";
const CALL_ID = "call-c1";
const RESPONSE_ID = "resp-r1";
const USER_ID = "user-u1";
const INVESTOR_ID = "investor-i1";

// ---------------------------------------------------------------------------
// Decimal helper — mimics Prisma Decimal objects
// ---------------------------------------------------------------------------

function decimal(val: number) {
  return {
    toNumber: () => val,
    toString: () => String(val),
  };
}

// ---------------------------------------------------------------------------
// Request builders
// ---------------------------------------------------------------------------

function makeReq(
  url: string,
  method: string,
  body?: Record<string, unknown>,
): NextRequest {
  const init: RequestInit = { method };
  if (body) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

function listCtx() {
  return { params: Promise.resolve({ teamId: TEAM_ID, fundId: FUND_ID }) };
}

function callCtx() {
  return {
    params: Promise.resolve({
      teamId: TEAM_ID,
      fundId: FUND_ID,
      callId: CALL_ID,
    }),
  };
}

function responseCtx() {
  return {
    params: Promise.resolve({
      teamId: TEAM_ID,
      fundId: FUND_ID,
      callId: CALL_ID,
      responseId: RESPONSE_ID,
    }),
  };
}

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

const MOCK_SESSION = { user: { id: USER_ID, email: "gp@test.com" } };

function mockAuthedSession() {
  mockGetServerSession.mockResolvedValue(MOCK_SESSION);
}

function mockNoSession() {
  mockGetServerSession.mockResolvedValue(null);
}

function mockGPAccess(role = "ADMIN") {
  (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
    userId: USER_ID,
    teamId: TEAM_ID,
    role,
    status: "ACTIVE",
  });
  (prisma.fund.findFirst as jest.Mock).mockResolvedValue({
    id: FUND_ID,
    teamId: TEAM_ID,
    name: "Test Fund I",
  });
}

function mockNoTeamAccess() {
  (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);
}

function mockFundWithOrg() {
  (prisma.fund.findFirst as jest.Mock).mockResolvedValue({
    id: FUND_ID,
    teamId: TEAM_ID,
    name: "Test Fund I",
    team: { organization: { name: "Acme Capital" } },
  });
}

function makeMockCall(overrides = {}) {
  return {
    id: CALL_ID,
    fundId: FUND_ID,
    callNumber: 1,
    amount: decimal(500000),
    purpose: "Working capital",
    dueDate: new Date("2026-06-01"),
    proRataPercentage: decimal(0.25),
    status: "DRAFT",
    createdBy: USER_ID,
    sentAt: null,
    noticeDate: null,
    fundedAt: null,
    notes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    responses: [],
    ...overrides,
  };
}

function makeMockResponse(overrides = {}) {
  return {
    id: RESPONSE_ID,
    capitalCallId: CALL_ID,
    investorId: INVESTOR_ID,
    amountDue: decimal(50000),
    amountPaid: decimal(0),
    status: "PENDING",
    confirmedBy: null,
    confirmedAt: null,
    fundReceivedDate: null,
    notes: null,
    createdAt: new Date("2026-01-02"),
    investor: {
      id: INVESTOR_ID,
      entityName: "Acme Holdings LLC",
      entityType: "LLC",
      user: { email: "lp@test.com", name: "LP User" },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("Capital Calls API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppRouterRateLimit.mockResolvedValue(null);
  });

  // =========================================================================
  // 1. LIST CAPITAL CALLS — GET /capital-calls
  // =========================================================================

  describe("GET /api/teams/[teamId]/funds/[fundId]/capital-calls", () => {
    const url = `http://localhost:3000/api/teams/${TEAM_ID}/funds/${FUND_ID}/capital-calls`;

    it("returns 401 when no session", async () => {
      mockNoSession();
      const res = await listCalls(makeReq(url, "GET"), listCtx());
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 403 when user is not a GP team member", async () => {
      mockAuthedSession();
      mockNoTeamAccess();
      const res = await listCalls(makeReq(url, "GET"), listCtx());
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("Forbidden");
    });

    it("returns 403 when fund does not belong to team", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "ADMIN",
      });
      // fund.findFirst returns null — fund not in team
      (prisma.fund.findFirst as jest.Mock).mockResolvedValue(null);
      const res = await listCalls(makeReq(url, "GET"), listCtx());
      expect(res.status).toBe(403);
    });

    it("returns 200 with empty array when no capital calls exist", async () => {
      mockAuthedSession();
      mockGPAccess();
      (prisma.capitalCall.findMany as jest.Mock).mockResolvedValue([]);
      const res = await listCalls(makeReq(url, "GET"), listCtx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.calls).toEqual([]);
    });

    it("returns serialized capital calls with responses", async () => {
      mockAuthedSession();
      mockGPAccess();
      const mockCalls = [
        makeMockCall({
          responses: [
            makeMockResponse({ amountDue: decimal(25000), amountPaid: decimal(10000) }),
          ],
        }),
      ];
      (prisma.capitalCall.findMany as jest.Mock).mockResolvedValue(mockCalls);

      const res = await listCalls(makeReq(url, "GET"), listCtx());
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.calls).toHaveLength(1);
      expect(body.calls[0].amount).toBe(500000);
      expect(body.calls[0].proRataPercentage).toBe(0.25);
      expect(body.calls[0].responses[0].amountDue).toBe(25000);
      expect(body.calls[0].responses[0].amountPaid).toBe(10000);
    });

    it("passes status filter to Prisma query", async () => {
      mockAuthedSession();
      mockGPAccess();
      (prisma.capitalCall.findMany as jest.Mock).mockResolvedValue([]);

      const urlWithFilter = `${url}?status=SENT`;
      const res = await listCalls(makeReq(urlWithFilter, "GET"), listCtx());
      expect(res.status).toBe(200);

      expect(prisma.capitalCall.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fundId: FUND_ID, status: "SENT" },
        }),
      );
    });

    it("returns 500 on internal error", async () => {
      mockAuthedSession();
      mockGPAccess();
      (prisma.capitalCall.findMany as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      const res = await listCalls(makeReq(url, "GET"), listCtx());
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. CREATE CAPITAL CALL — POST /capital-calls
  // =========================================================================

  describe("POST /api/teams/[teamId]/funds/[fundId]/capital-calls", () => {
    const url = `http://localhost:3000/api/teams/${TEAM_ID}/funds/${FUND_ID}/capital-calls`;

    const validBody = {
      amount: 500000,
      dueDate: "2026-06-01",
      purpose: "Working capital",
      proRataPercentage: 25,
    };

    function mockValidation(data = validBody) {
      mockValidateBody.mockResolvedValue({ data, error: null });
    }

    function mockValidationError() {
      mockValidateBody.mockResolvedValue({
        data: null,
        error: NextResponse.json(
          { error: "Validation failed", issues: [{ path: "amount", message: "Required" }] },
          { status: 400 },
        ),
      });
    }

    it("returns 401 when no session", async () => {
      mockNoSession();
      const res = await createCall(makeReq(url, "POST", validBody), listCtx());
      expect(res.status).toBe(401);
    });

    it("returns 403 when user lacks GP role", async () => {
      mockAuthedSession();
      mockNoTeamAccess();
      const res = await createCall(makeReq(url, "POST", validBody), listCtx());
      expect(res.status).toBe(403);
    });

    it("returns 400 when body validation fails", async () => {
      mockAuthedSession();
      mockGPAccess();
      mockValidationError();

      const res = await createCall(makeReq(url, "POST", {}), listCtx());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Validation failed");
    });

    it("creates capital call with auto-generated call number when not provided", async () => {
      mockAuthedSession();
      mockGPAccess();
      mockValidation({ ...validBody, callNumber: undefined });

      // Auto-suggest: findFirst to get max callNumber
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue({ callNumber: 3 });

      const mockResult = makeMockCall({
        callNumber: 4,
        responses: [makeMockResponse()],
      });

      // $transaction mock: callback pattern
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        return mockResult;
      });

      const res = await createCall(makeReq(url, "POST", validBody), listCtx());
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.amount).toBe(500000);
      expect(body.responses).toHaveLength(1);
    });

    it("creates capital call with explicit call number", async () => {
      mockAuthedSession();
      mockGPAccess();
      mockValidation({ ...validBody, callNumber: 7 });

      const mockResult = makeMockCall({
        callNumber: 7,
        responses: [],
      });
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => mockResult);

      const res = await createCall(makeReq(url, "POST", validBody), listCtx());
      expect(res.status).toBe(201);
    });

    it("defaults call number to 1 when no existing calls", async () => {
      mockAuthedSession();
      mockGPAccess();
      mockValidation({ ...validBody, callNumber: undefined });

      // No existing calls
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(null);

      const mockResult = makeMockCall({ callNumber: 1, responses: [] });
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => mockResult);

      const res = await createCall(makeReq(url, "POST", validBody), listCtx());
      expect(res.status).toBe(201);
    });

    it("fires audit log event on successful creation", async () => {
      mockAuthedSession();
      mockGPAccess();
      mockValidation(validBody);
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(null);

      const mockResult = makeMockCall({ responses: [makeMockResponse()] });
      (prisma.$transaction as jest.Mock).mockImplementation(async () => mockResult);

      await createCall(makeReq(url, "POST", validBody), listCtx());

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "CAPITAL_CALL_CREATED",
          userId: USER_ID,
          teamId: TEAM_ID,
          resourceType: "CapitalCall",
          resourceId: CALL_ID,
        }),
      );
    });

    it("returns 500 on transaction failure", async () => {
      mockAuthedSession();
      mockGPAccess();
      mockValidation(validBody);
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error("TX fail"));

      const res = await createCall(makeReq(url, "POST", validBody), listCtx());
      expect(res.status).toBe(500);
      expect(mockReportError).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. GET CAPITAL CALL DETAIL — GET /capital-calls/[callId]
  // =========================================================================

  describe("GET /api/teams/[teamId]/funds/[fundId]/capital-calls/[callId]", () => {
    const url = `http://localhost:3000/api/teams/${TEAM_ID}/funds/${FUND_ID}/capital-calls/${CALL_ID}`;

    it("returns 401 when no session", async () => {
      mockNoSession();
      const res = await getCallDetail(makeReq(url, "GET"), callCtx());
      expect(res.status).toBe(401);
    });

    it("returns 403 when user lacks GP access", async () => {
      mockAuthedSession();
      mockNoTeamAccess();
      const res = await getCallDetail(makeReq(url, "GET"), callCtx());
      expect(res.status).toBe(403);
    });

    it("returns 404 when capital call not found", async () => {
      mockAuthedSession();
      mockGPAccess();
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await getCallDetail(makeReq(url, "GET"), callCtx());
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Capital call not found");
    });

    it("returns call detail with summary calculations", async () => {
      mockAuthedSession();
      mockGPAccess();

      const mockCall = makeMockCall({
        responses: [
          makeMockResponse({
            id: "resp-1",
            amountDue: decimal(50000),
            amountPaid: decimal(50000),
            status: "FUNDED",
          }),
          makeMockResponse({
            id: "resp-2",
            amountDue: decimal(30000),
            amountPaid: decimal(10000),
            status: "PENDING",
          }),
        ],
      });
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(mockCall);

      const res = await getCallDetail(makeReq(url, "GET"), callCtx());
      expect(res.status).toBe(200);
      const body = await res.json();

      // Verify summary calculations
      expect(body.summary.totalDue).toBe(80000);
      expect(body.summary.totalPaid).toBe(60000);
      expect(body.summary.outstanding).toBe(20000);
      expect(body.summary.percentFunded).toBe(75);
      expect(body.summary.responseCount).toBe(2);
      expect(body.summary.fundedCount).toBe(1);
      expect(body.summary.pendingCount).toBe(1);
    });

    it("returns 500 on internal error", async () => {
      mockAuthedSession();
      mockGPAccess();
      (prisma.capitalCall.findFirst as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );
      const res = await getCallDetail(makeReq(url, "GET"), callCtx());
      expect(res.status).toBe(500);
      expect(mockReportError).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. UPDATE CAPITAL CALL — PATCH /capital-calls/[callId]
  // =========================================================================

  describe("PATCH /api/teams/[teamId]/funds/[fundId]/capital-calls/[callId]", () => {
    const url = `http://localhost:3000/api/teams/${TEAM_ID}/funds/${FUND_ID}/capital-calls/${CALL_ID}`;

    function mockPatchValidation(data: Record<string, unknown>) {
      mockValidateBody.mockResolvedValue({ data, error: null });
    }

    it("returns 401 when no session", async () => {
      mockNoSession();
      const res = await updateCall(
        makeReq(url, "PATCH", { amount: 100000 }),
        callCtx(),
      );
      expect(res.status).toBe(401);
    });

    it("returns 403 when user lacks GP access", async () => {
      mockAuthedSession();
      mockNoTeamAccess();
      const res = await updateCall(
        makeReq(url, "PATCH", { amount: 100000 }),
        callCtx(),
      );
      expect(res.status).toBe(403);
    });

    it("returns 404 when capital call not found", async () => {
      mockAuthedSession();
      mockGPAccess();
      // fund.findFirst returns the fund (from mockGPAccess)
      // but capitalCall.findFirst returns null
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(null);

      mockPatchValidation({ amount: 100000 });
      const res = await updateCall(
        makeReq(url, "PATCH", { amount: 100000 }),
        callCtx(),
      );
      expect(res.status).toBe(404);
    });

    it("returns 400 when capital call is not DRAFT", async () => {
      mockAuthedSession();
      mockGPAccess();
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(
        makeMockCall({ status: "SENT" }),
      );

      const res = await updateCall(
        makeReq(url, "PATCH", { amount: 100000 }),
        callCtx(),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Only DRAFT");
    });

    it("returns 400 when body validation fails", async () => {
      mockAuthedSession();
      mockGPAccess();
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(
        makeMockCall({ status: "DRAFT" }),
      );
      mockValidateBody.mockResolvedValue({
        data: null,
        error: NextResponse.json(
          { error: "Validation failed" },
          { status: 400 },
        ),
      });

      const res = await updateCall(
        makeReq(url, "PATCH", { amount: -1 }),
        callCtx(),
      );
      expect(res.status).toBe(400);
    });

    it("updates capital call with partial fields", async () => {
      mockAuthedSession();
      mockGPAccess();
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(
        makeMockCall({ status: "DRAFT" }),
      );
      mockPatchValidation({ amount: 750000, purpose: "Expansion" });

      const updatedCall = makeMockCall({
        amount: decimal(750000),
        purpose: "Expansion",
        responses: [],
      });
      (prisma.capitalCall.update as jest.Mock).mockResolvedValue(updatedCall);

      const res = await updateCall(
        makeReq(url, "PATCH", { amount: 750000, purpose: "Expansion" }),
        callCtx(),
      );
      expect(res.status).toBe(200);

      // Verify Prisma update received correct data
      expect(prisma.capitalCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CALL_ID },
          data: expect.objectContaining({
            amount: 750000,
            purpose: "Expansion",
          }),
        }),
      );
    });

    it("fires audit log event on update", async () => {
      mockAuthedSession();
      mockGPAccess();
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(
        makeMockCall({ status: "DRAFT" }),
      );
      mockPatchValidation({ notes: "Updated notes" });

      const updatedCall = makeMockCall({ notes: "Updated notes", responses: [] });
      (prisma.capitalCall.update as jest.Mock).mockResolvedValue(updatedCall);

      await updateCall(
        makeReq(url, "PATCH", { notes: "Updated notes" }),
        callCtx(),
      );

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "CAPITAL_CALL_UPDATED",
          userId: USER_ID,
          teamId: TEAM_ID,
          resourceType: "CapitalCall",
          resourceId: CALL_ID,
          metadata: expect.objectContaining({
            updatedFields: expect.arrayContaining(["notes"]),
          }),
        }),
      );
    });

    it("returns 500 on internal error", async () => {
      mockAuthedSession();
      mockGPAccess();
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(
        makeMockCall({ status: "DRAFT" }),
      );
      mockPatchValidation({ amount: 100000 });
      (prisma.capitalCall.update as jest.Mock).mockRejectedValue(
        new Error("Update failed"),
      );

      const res = await updateCall(
        makeReq(url, "PATCH", { amount: 100000 }),
        callCtx(),
      );
      expect(res.status).toBe(500);
      expect(mockReportError).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. DELETE CAPITAL CALL — DELETE /capital-calls/[callId]
  // =========================================================================

  describe("DELETE /api/teams/[teamId]/funds/[fundId]/capital-calls/[callId]", () => {
    const url = `http://localhost:3000/api/teams/${TEAM_ID}/funds/${FUND_ID}/capital-calls/${CALL_ID}`;

    it("returns 401 when no session", async () => {
      mockNoSession();
      const res = await deleteCall(makeReq(url, "DELETE"), callCtx());
      expect(res.status).toBe(401);
    });

    it("returns 403 when user lacks GP access", async () => {
      mockAuthedSession();
      mockNoTeamAccess();
      const res = await deleteCall(makeReq(url, "DELETE"), callCtx());
      expect(res.status).toBe(403);
    });

    it("returns 404 when capital call not found", async () => {
      mockAuthedSession();
      mockGPAccess();
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await deleteCall(makeReq(url, "DELETE"), callCtx());
      expect(res.status).toBe(404);
    });

    it("returns 400 when capital call is not DRAFT", async () => {
      mockAuthedSession();
      mockGPAccess();
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(
        makeMockCall({ status: "SENT" }),
      );

      const res = await deleteCall(makeReq(url, "DELETE"), callCtx());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Only DRAFT");
    });

    it("deletes DRAFT capital call and its responses via transaction", async () => {
      mockAuthedSession();
      mockGPAccess();
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(
        makeMockCall({ status: "DRAFT" }),
      );

      // $transaction with array pattern — returns array of results
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        { count: 3 }, // deleteMany responses
        { id: CALL_ID }, // delete call
      ]);

      const res = await deleteCall(makeReq(url, "DELETE"), callCtx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      // Verify $transaction was called with array
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("fires audit log event on deletion", async () => {
      mockAuthedSession();
      mockGPAccess();
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(
        makeMockCall({ status: "DRAFT" }),
      );
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      await deleteCall(makeReq(url, "DELETE"), callCtx());

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "CAPITAL_CALL_CANCELLED",
          userId: USER_ID,
          teamId: TEAM_ID,
          resourceType: "CapitalCall",
          resourceId: CALL_ID,
          metadata: { action: "deleted_draft" },
        }),
      );
    });

    it("returns 500 on transaction failure", async () => {
      mockAuthedSession();
      mockGPAccess();
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(
        makeMockCall({ status: "DRAFT" }),
      );
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error("TX error"),
      );

      const res = await deleteCall(makeReq(url, "DELETE"), callCtx());
      expect(res.status).toBe(500);
      expect(mockReportError).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 6. SEND CAPITAL CALL — POST /capital-calls/[callId]/send
  // =========================================================================

  describe("POST /api/teams/[teamId]/funds/[fundId]/capital-calls/[callId]/send", () => {
    const url = `http://localhost:3000/api/teams/${TEAM_ID}/funds/${FUND_ID}/capital-calls/${CALL_ID}/send`;

    it("returns 401 when no session", async () => {
      mockNoSession();
      const res = await sendCall(makeReq(url, "POST"), callCtx());
      expect(res.status).toBe(401);
    });

    it("returns 403 when user lacks GP role", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);
      const res = await sendCall(makeReq(url, "POST"), callCtx());
      expect(res.status).toBe(403);
    });

    it("returns 404 when fund not found", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "ADMIN",
      });
      (prisma.fund.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await sendCall(makeReq(url, "POST"), callCtx());
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Fund not found");
    });

    it("returns 404 when capital call not found", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "ADMIN",
      });
      mockFundWithOrg();
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await sendCall(makeReq(url, "POST"), callCtx());
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Capital call not found");
    });

    it("returns 400 when capital call is not DRAFT", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "ADMIN",
      });
      mockFundWithOrg();
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(
        makeMockCall({ status: "SENT", responses: [] }),
      );

      const res = await sendCall(makeReq(url, "POST"), callCtx());
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Only DRAFT");
    });

    it("sends capital call — transitions DRAFT to SENT and sends emails", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "OWNER",
      });
      mockFundWithOrg();

      const mockCallWithResponses = makeMockCall({
        status: "DRAFT",
        responses: [
          makeMockResponse({
            amountDue: decimal(50000),
            investor: {
              id: INVESTOR_ID,
              entityName: "Acme Holdings",
              user: { email: "lp@test.com", name: "LP" },
            },
          }),
        ],
      });
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(
        mockCallWithResponses,
      );

      const updatedCall = makeMockCall({
        status: "SENT",
        sentAt: new Date(),
        amount: decimal(500000),
        proRataPercentage: decimal(0.25),
      });
      (prisma.capitalCall.update as jest.Mock).mockResolvedValue(updatedCall);

      const res = await sendCall(makeReq(url, "POST"), callCtx());
      expect(res.status).toBe(200);
      const body = await res.json();

      // Verify status transition
      expect(prisma.capitalCall.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CALL_ID },
          data: expect.objectContaining({
            status: "SENT",
          }),
        }),
      );

      // Verify email was attempted
      expect(mockSendOrgEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: TEAM_ID,
          to: "lp@test.com",
          subject: expect.stringContaining("Capital Call Notice"),
        }),
      );

      expect(body.noticesSent).toBe(1);
    });

    it("skips investors without email addresses", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "ADMIN",
      });
      mockFundWithOrg();

      const callWithNoEmailInvestor = makeMockCall({
        status: "DRAFT",
        responses: [
          makeMockResponse({
            amountDue: decimal(50000),
            investor: {
              id: INVESTOR_ID,
              entityName: "NoEmail LLC",
              user: { email: null, name: null },
            },
          }),
        ],
      });
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(
        callWithNoEmailInvestor,
      );

      const updatedCall = makeMockCall({
        status: "SENT",
        amount: decimal(500000),
        proRataPercentage: null,
      });
      (prisma.capitalCall.update as jest.Mock).mockResolvedValue(updatedCall);

      const res = await sendCall(makeReq(url, "POST"), callCtx());
      expect(res.status).toBe(200);

      // No email should be sent
      expect(mockSendOrgEmail).not.toHaveBeenCalled();
    });

    it("fires audit log event on send", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "ADMIN",
      });
      mockFundWithOrg();

      const call = makeMockCall({
        status: "DRAFT",
        callNumber: 3,
        amount: decimal(100000),
        responses: [],
      });
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(call);

      const updatedCall = makeMockCall({
        status: "SENT",
        amount: decimal(100000),
        proRataPercentage: null,
      });
      (prisma.capitalCall.update as jest.Mock).mockResolvedValue(updatedCall);

      await sendCall(makeReq(url, "POST"), callCtx());

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "CAPITAL_CALL_SENT",
          userId: USER_ID,
          teamId: TEAM_ID,
          resourceType: "CapitalCall",
          resourceId: CALL_ID,
          metadata: expect.objectContaining({
            callNumber: 3,
            recipientCount: 0,
            totalAmount: 100000,
          }),
        }),
      );
    });

    it("returns 500 on internal error", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "ADMIN",
      });
      (prisma.fund.findFirst as jest.Mock).mockRejectedValue(
        new Error("DB fail"),
      );

      const res = await sendCall(makeReq(url, "POST"), callCtx());
      expect(res.status).toBe(500);
      expect(mockReportError).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 7. LIST RESPONSES — GET /capital-calls/[callId]/responses
  // =========================================================================

  describe("GET /api/teams/[teamId]/funds/[fundId]/capital-calls/[callId]/responses", () => {
    const url = `http://localhost:3000/api/teams/${TEAM_ID}/funds/${FUND_ID}/capital-calls/${CALL_ID}/responses`;

    it("returns 401 when no session", async () => {
      mockNoSession();
      const res = await listResponses(makeReq(url, "GET"), callCtx());
      expect(res.status).toBe(401);
    });

    it("returns 403 when user lacks GP role", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);
      const res = await listResponses(makeReq(url, "GET"), callCtx());
      expect(res.status).toBe(403);
    });

    it("returns 404 when fund not found", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "ADMIN",
      });
      (prisma.fund.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await listResponses(makeReq(url, "GET"), callCtx());
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Fund not found");
    });

    it("returns 404 when capital call not found", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "ADMIN",
      });
      (prisma.fund.findFirst as jest.Mock).mockResolvedValue({
        id: FUND_ID,
        teamId: TEAM_ID,
      });
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await listResponses(makeReq(url, "GET"), callCtx());
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Capital call not found");
    });

    it("returns responses with summary stats", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "ADMIN",
      });
      (prisma.fund.findFirst as jest.Mock).mockResolvedValue({
        id: FUND_ID,
        teamId: TEAM_ID,
      });
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue({
        id: CALL_ID,
        status: "SENT",
        amount: decimal(500000),
      });

      const mockResponses = [
        makeMockResponse({
          id: "resp-1",
          amountDue: decimal(50000),
          amountPaid: decimal(50000),
          status: "FUNDED",
        }),
        makeMockResponse({
          id: "resp-2",
          amountDue: decimal(30000),
          amountPaid: decimal(15000),
          status: "PARTIAL",
        }),
        makeMockResponse({
          id: "resp-3",
          amountDue: decimal(20000),
          amountPaid: decimal(0),
          status: "PENDING",
        }),
      ];
      (prisma.capitalCallResponse.findMany as jest.Mock).mockResolvedValue(
        mockResponses,
      );

      const res = await listResponses(makeReq(url, "GET"), callCtx());
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.responses).toHaveLength(3);
      expect(body.summary.totalResponses).toBe(3);
      expect(body.summary.totalDue).toBe(100000);
      expect(body.summary.totalPaid).toBe(65000);
      expect(body.summary.outstanding).toBe(35000);
      expect(body.summary.funded).toBe(1);
      expect(body.summary.pending).toBe(1);
      expect(body.summary.partiallyFunded).toBe(1);
    });

    it("passes status filter to query", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "ADMIN",
      });
      (prisma.fund.findFirst as jest.Mock).mockResolvedValue({
        id: FUND_ID,
        teamId: TEAM_ID,
      });
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue({
        id: CALL_ID,
        status: "SENT",
        amount: decimal(500000),
      });
      (prisma.capitalCallResponse.findMany as jest.Mock).mockResolvedValue([]);

      const urlWithFilter = `${url}?status=FUNDED`;
      const res = await listResponses(makeReq(urlWithFilter, "GET"), callCtx());
      expect(res.status).toBe(200);

      expect(prisma.capitalCallResponse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            capitalCallId: CALL_ID,
            status: "FUNDED",
          },
        }),
      );
    });

    it("returns empty array and zero summary when no responses", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "ADMIN",
      });
      (prisma.fund.findFirst as jest.Mock).mockResolvedValue({
        id: FUND_ID,
        teamId: TEAM_ID,
      });
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue({
        id: CALL_ID,
        status: "SENT",
        amount: decimal(500000),
      });
      (prisma.capitalCallResponse.findMany as jest.Mock).mockResolvedValue([]);

      const res = await listResponses(makeReq(url, "GET"), callCtx());
      const body = await res.json();

      expect(body.responses).toEqual([]);
      expect(body.summary.totalDue).toBe(0);
      expect(body.summary.totalPaid).toBe(0);
      expect(body.summary.outstanding).toBe(0);
    });

    it("returns 500 on internal error", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockRejectedValue(
        new Error("DB fail"),
      );
      const res = await listResponses(makeReq(url, "GET"), callCtx());
      expect(res.status).toBe(500);
      expect(mockReportError).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 8. CONFIRM RESPONSE — POST /capital-calls/[callId]/responses/[responseId]/confirm
  // =========================================================================

  describe("POST /api/teams/.../capital-calls/[callId]/responses/[responseId]/confirm", () => {
    const url = `http://localhost:3000/api/teams/${TEAM_ID}/funds/${FUND_ID}/capital-calls/${CALL_ID}/responses/${RESPONSE_ID}/confirm`;

    function mockConfirmSetup(
      callStatus = "SENT",
      responseStatus = "PENDING",
      amountDue = 50000,
      amountPaid = 0,
    ) {
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "ADMIN",
      });
      (prisma.fund.findFirst as jest.Mock).mockResolvedValue({
        id: FUND_ID,
        teamId: TEAM_ID,
      });
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(
        makeMockCall({ status: callStatus }),
      );
      (prisma.capitalCallResponse.findFirst as jest.Mock).mockResolvedValue(
        makeMockResponse({
          status: responseStatus,
          amountDue: decimal(amountDue),
          amountPaid: decimal(amountPaid),
          investor: {
            id: INVESTOR_ID,
            entityName: "Acme Holdings",
          },
        }),
      );
    }

    it("returns 401 when no session", async () => {
      mockNoSession();
      const res = await confirmResponse(
        makeReq(url, "POST", { amountPaid: 50000 }),
        responseCtx(),
      );
      expect(res.status).toBe(401);
    });

    it("returns 403 when user lacks GP role", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);
      const res = await confirmResponse(
        makeReq(url, "POST", { amountPaid: 50000 }),
        responseCtx(),
      );
      expect(res.status).toBe(403);
    });

    it("returns 404 when fund not found", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "ADMIN",
      });
      (prisma.fund.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await confirmResponse(
        makeReq(url, "POST", { amountPaid: 50000 }),
        responseCtx(),
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Fund not found");
    });

    it("returns 404 when capital call not found", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "ADMIN",
      });
      (prisma.fund.findFirst as jest.Mock).mockResolvedValue({
        id: FUND_ID,
        teamId: TEAM_ID,
      });
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await confirmResponse(
        makeReq(url, "POST", { amountPaid: 50000 }),
        responseCtx(),
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Capital call not found");
    });

    it("returns 400 when call is not in SENT or PARTIALLY_FUNDED status", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "ADMIN",
      });
      (prisma.fund.findFirst as jest.Mock).mockResolvedValue({
        id: FUND_ID,
        teamId: TEAM_ID,
      });
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(
        makeMockCall({ status: "DRAFT" }),
      );

      const res = await confirmResponse(
        makeReq(url, "POST", { amountPaid: 50000 }),
        responseCtx(),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("SENT or PARTIALLY_FUNDED");
    });

    it("returns 404 when response not found", async () => {
      mockAuthedSession();
      (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
        userId: USER_ID,
        teamId: TEAM_ID,
        role: "ADMIN",
      });
      (prisma.fund.findFirst as jest.Mock).mockResolvedValue({
        id: FUND_ID,
        teamId: TEAM_ID,
      });
      (prisma.capitalCall.findFirst as jest.Mock).mockResolvedValue(
        makeMockCall({ status: "SENT" }),
      );
      (prisma.capitalCallResponse.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await confirmResponse(
        makeReq(url, "POST", { amountPaid: 50000 }),
        responseCtx(),
      );
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Response not found");
    });

    it("returns 400 when response is already FUNDED", async () => {
      mockAuthedSession();
      mockConfirmSetup("SENT", "FUNDED");

      const res = await confirmResponse(
        makeReq(url, "POST", { amountPaid: 1000 }),
        responseCtx(),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("already fully funded");
    });

    it("returns 400 when amountPaid is missing or zero", async () => {
      mockAuthedSession();
      mockConfirmSetup("SENT", "PENDING");

      const res = await confirmResponse(
        makeReq(url, "POST", { amountPaid: 0 }),
        responseCtx(),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("positive");
    });

    it("returns 400 when amountPaid is negative", async () => {
      mockAuthedSession();
      mockConfirmSetup("SENT", "PENDING");

      const res = await confirmResponse(
        makeReq(url, "POST", { amountPaid: -500 }),
        responseCtx(),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when payment exceeds amount due (beyond 1% tolerance)", async () => {
      mockAuthedSession();
      mockConfirmSetup("SENT", "PENDING", 50000, 0);

      const res = await confirmResponse(
        makeReq(url, "POST", { amountPaid: 51000 }),
        responseCtx(),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("exceed amount due");
    });

    it("returns 400 when fund received date is invalid", async () => {
      mockAuthedSession();
      mockConfirmSetup("SENT", "PENDING", 50000, 0);

      const res = await confirmResponse(
        makeReq(url, "POST", {
          amountPaid: 25000,
          fundReceivedDate: "not-a-date",
        }),
        responseCtx(),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Invalid fund received date");
    });

    it("confirms full payment — sets response to FUNDED", async () => {
      mockAuthedSession();
      mockConfirmSetup("SENT", "PENDING", 50000, 0);

      const txResult = {
        updatedResponse: {
          ...makeMockResponse({
            amountPaid: decimal(50000),
            amountDue: decimal(50000),
            status: "FUNDED",
          }),
        },
        updatedCall: { id: CALL_ID, status: "PARTIALLY_FUNDED" },
        newCallStatus: "PARTIALLY_FUNDED",
      };
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => txResult);

      const res = await confirmResponse(
        makeReq(url, "POST", {
          amountPaid: 50000,
          fundReceivedDate: "2026-03-15",
          notes: "Wire received",
        }),
        responseCtx(),
      );
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.response.amountPaid).toBe(50000);
      expect(body.callStatus).toBe("PARTIALLY_FUNDED");
      expect(body.callFullyFunded).toBe(false);
    });

    it("confirms partial payment — sets response to PARTIAL", async () => {
      mockAuthedSession();
      mockConfirmSetup("SENT", "PENDING", 50000, 0);

      const txResult = {
        updatedResponse: {
          ...makeMockResponse({
            amountPaid: decimal(25000),
            amountDue: decimal(50000),
            status: "PARTIAL",
          }),
        },
        updatedCall: null,
        newCallStatus: "PARTIALLY_FUNDED",
      };
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => txResult);

      const res = await confirmResponse(
        makeReq(url, "POST", { amountPaid: 25000 }),
        responseCtx(),
      );
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.response.amountPaid).toBe(25000);
      expect(body.callStatus).toBe("PARTIALLY_FUNDED");
    });

    it("detects when all responses are funded — marks call as FUNDED", async () => {
      mockAuthedSession();
      mockConfirmSetup("PARTIALLY_FUNDED", "PENDING", 50000, 0);

      const txResult = {
        updatedResponse: {
          ...makeMockResponse({
            amountPaid: decimal(50000),
            amountDue: decimal(50000),
            status: "FUNDED",
          }),
        },
        updatedCall: { id: CALL_ID, status: "FUNDED" },
        newCallStatus: "FUNDED",
      };
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => txResult);

      const res = await confirmResponse(
        makeReq(url, "POST", { amountPaid: 50000 }),
        responseCtx(),
      );
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.callStatus).toBe("FUNDED");
      expect(body.callFullyFunded).toBe(true);
    });

    it("allows payment within 1% tolerance of amount due", async () => {
      mockAuthedSession();
      // amountDue = 50000, amountPaid = 0
      // Payment of 50400 is within 1% tolerance (50000 * 1.01 = 50500)
      mockConfirmSetup("SENT", "PENDING", 50000, 0);

      const txResult = {
        updatedResponse: {
          ...makeMockResponse({
            amountPaid: decimal(50400),
            amountDue: decimal(50000),
            status: "FUNDED",
          }),
        },
        updatedCall: null,
        newCallStatus: "SENT",
      };
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => txResult);

      const res = await confirmResponse(
        makeReq(url, "POST", { amountPaid: 50400 }),
        responseCtx(),
      );
      expect(res.status).toBe(200);
    });

    it("fires audit log event on confirmation", async () => {
      mockAuthedSession();
      mockConfirmSetup("SENT", "PENDING", 50000, 0);

      const txResult = {
        updatedResponse: makeMockResponse({
          amountPaid: decimal(50000),
          amountDue: decimal(50000),
          status: "FUNDED",
        }),
        updatedCall: null,
        newCallStatus: "SENT",
      };
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => txResult);

      await confirmResponse(
        makeReq(url, "POST", { amountPaid: 50000 }),
        responseCtx(),
      );

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "CAPITAL_CALL_UPDATED",
          userId: USER_ID,
          teamId: TEAM_ID,
          resourceType: "CapitalCallResponse",
          resourceId: RESPONSE_ID,
          metadata: expect.objectContaining({
            action: "payment_confirmed",
            amountPaid: 50000,
            investorId: INVESTOR_ID,
          }),
        }),
      );
    });

    it("returns 500 on transaction failure", async () => {
      mockAuthedSession();
      mockConfirmSetup("SENT", "PENDING", 50000, 0);
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error("TX error"),
      );

      const res = await confirmResponse(
        makeReq(url, "POST", { amountPaid: 50000 }),
        responseCtx(),
      );
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalled();
    });
  });
});
