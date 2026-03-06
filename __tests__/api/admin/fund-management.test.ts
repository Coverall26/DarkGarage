/**
 * Fund Management & Transactions API Tests
 *
 * Tests for 6 App Router routes:
 *   1. GET  /api/admin/fund/[fundId]/pending-actions — Pending action counts
 *   2. GET  /api/admin/fund/[fundId]/pending-details — Top N pending items
 *   3. GET  /api/teams/[teamId]/funds/[fundId]/transactions — Fund transactions
 *   4. GET/POST/DELETE /api/teams/[teamId]/funds/[fundId]/wire-instructions — Wire mgmt
 *   5. GET  /api/admin/team-context — Team context for admin pages
 *   6. GET  /api/admin/transactions — Admin transaction listing
 *
 * Covers: auth (401), authorization (403), happy path (200),
 * not found (404), error handling (500), count calculations,
 * top-N detail items, status filtering, wire encryption.
 */

import { NextRequest, NextResponse } from "next/server";

// --- Declare mocks BEFORE jest.mock() calls ---

const mockGetServerSession = jest.fn();
const mockAppRouterRateLimit = jest.fn().mockResolvedValue(null);
const mockReportError = jest.fn();
const mockDetermineCurrentStage = jest.fn();
const mockAuthenticateGP = jest.fn();
const mockEnforceRBACAppRouter = jest.fn();
const mockSetWireInstructions = jest.fn();
const mockGetWireInstructions = jest.fn();
const mockDeleteWireInstructions = jest.fn();

// --- jest.mock() calls with wrapper functions ---

jest.mock("next-auth", () => ({
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

jest.mock("@/lib/investor/approval-pipeline", () => ({
  determineCurrentStage: (...args: unknown[]) => mockDetermineCurrentStage(...args),
}));

jest.mock("@/lib/marketplace/auth", () => ({
  authenticateGP: (...args: unknown[]) => mockAuthenticateGP(...args),
}));

jest.mock("@/lib/auth/rbac", () => ({
  enforceRBACAppRouter: (...args: unknown[]) => mockEnforceRBACAppRouter(...args),
}));

jest.mock("@/lib/wire-transfer", () => ({
  setWireInstructions: (...args: unknown[]) => mockSetWireInstructions(...args),
  getWireInstructions: (...args: unknown[]) => mockGetWireInstructions(...args),
  deleteWireInstructions: (...args: unknown[]) => mockDeleteWireInstructions(...args),
}));

// --- Imports (AFTER jest.mock) ---

import { GET as getPendingActions } from "@/app/api/admin/fund/[fundId]/pending-actions/route";
import { GET as getPendingDetails } from "@/app/api/admin/fund/[fundId]/pending-details/route";
import { GET as getTransactions } from "@/app/api/teams/[teamId]/funds/[fundId]/transactions/route";
import {
  GET as getWireInstructions,
  POST as postWireInstructions,
  DELETE as deleteWireInstructionsRoute,
} from "@/app/api/teams/[teamId]/funds/[fundId]/wire-instructions/route";
import { GET as getTeamContext } from "@/app/api/admin/team-context/route";
import { GET as getAdminTransactions } from "@/app/api/admin/transactions/route";

const prisma = require("@/lib/prisma").default;

// --- Constants ---

const USER_ID = "user-gp-001";
const TEAM_ID = "team-001";
const FUND_ID = "fund-001";
const ORG_ID = "org-001";

// --- Helpers ---

function makeAdminFundReq(
  fundId: string,
  path: string,
  query?: Record<string, string>,
): [NextRequest, { params: Promise<{ fundId: string }> }] {
  const url = new URL(`http://localhost/api/admin/fund/${fundId}/${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  const req = new NextRequest(url, { method: "GET" });
  const ctx = { params: Promise.resolve({ fundId }) };
  return [req, ctx];
}

function makeTeamFundReq(
  teamId: string,
  fundId: string,
  path: string,
  opts?: { method?: string; body?: Record<string, unknown>; query?: Record<string, string> },
): [NextRequest, { params: Promise<{ teamId: string; fundId: string }> }] {
  const url = new URL(`http://localhost/api/teams/${teamId}/funds/${fundId}/${path}`);
  if (opts?.query) {
    for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, v);
  }
  const reqInit: RequestInit = { method: opts?.method || "GET" };
  if (opts?.body) {
    reqInit.headers = { "content-type": "application/json" };
    reqInit.body = JSON.stringify(opts.body);
  }
  const req = new NextRequest(url, reqInit);
  const ctx = { params: Promise.resolve({ teamId, fundId }) };
  return [req, ctx];
}

function makeAdminReq(
  path: string,
  query?: Record<string, string>,
): NextRequest {
  const url = new URL(`http://localhost/api/admin/${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  return new NextRequest(url, { method: "GET" });
}

function mockSession(userId = USER_ID) {
  mockGetServerSession.mockResolvedValue({
    user: { id: userId, email: "gp@test.com" },
  });
}

function mockNoSession() {
  mockGetServerSession.mockResolvedValue(null);
}

/** Mock user with admin teams for pending-actions/pending-details routes */
function mockAdminUser(teamIds: string[] = [TEAM_ID]) {
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({
    id: USER_ID,
    teams: teamIds.map((id) => ({ teamId: id })),
  });
}

function mockNoTeamUser() {
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({
    id: USER_ID,
    teams: [],
  });
}

function mockFundFound(fundId = FUND_ID, teamId = TEAM_ID) {
  (prisma.fund.findFirst as jest.Mock).mockResolvedValue({
    id: fundId,
    teamId,
    name: "Test Fund I",
  });
}

function mockFundNotFound() {
  (prisma.fund.findFirst as jest.Mock).mockResolvedValue(null);
}

// --- beforeEach ---

beforeEach(() => {
  jest.clearAllMocks();
  mockAppRouterRateLimit.mockResolvedValue(null);
});

// ====================================================================
// 1. GET /api/admin/fund/[fundId]/pending-actions
// ====================================================================

describe("GET /api/admin/fund/[fundId]/pending-actions", () => {
  const call = (fundId = FUND_ID) => {
    const [req, ctx] = makeAdminFundReq(fundId, "pending-actions");
    return getPendingActions(req, ctx);
  };

  it("returns 401 if not authenticated", async () => {
    mockNoSession();
    const res = await call();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 if user has no admin teams", async () => {
    mockSession();
    mockNoTeamUser();
    const res = await call();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("GP access required");
  });

  it("returns 404 if fund not found for user's teams", async () => {
    mockSession();
    mockAdminUser();
    mockFundNotFound();
    const res = await call();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Fund not found");
  });

  it("returns correct pending action counts", async () => {
    mockSession();
    mockAdminUser();
    mockFundFound();

    // Mock parallel Promise.all queries
    (prisma.transaction.count as jest.Mock).mockResolvedValue(3);
    (prisma.lPDocument.count as jest.Mock).mockResolvedValue(2);
    (prisma.investor.findMany as jest.Mock).mockResolvedValue([
      { fundData: { approvalStage: "APPLIED" }, accreditationStatus: "PENDING", onboardingStep: 1 },
      { fundData: { approvalStage: "UNDER_REVIEW" }, accreditationStatus: "PENDING", onboardingStep: 2 },
      { fundData: { approvalStage: "APPROVED" }, accreditationStatus: "KYC_VERIFIED", onboardingStep: 3 },
      { fundData: { approvalStage: "FUNDED" }, accreditationStatus: "KYC_VERIFIED", onboardingStep: 5 },
    ]);
    (prisma.investment.count as jest.Mock).mockResolvedValue(1);

    // determineCurrentStage returns the approvalStage from fundData
    mockDetermineCurrentStage
      .mockReturnValueOnce("APPLIED")
      .mockReturnValueOnce("UNDER_REVIEW")
      .mockReturnValueOnce("APPROVED")
      .mockReturnValueOnce("FUNDED");

    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.pendingWires).toBe(3);
    expect(body.pendingDocs).toBe(2);
    expect(body.needsReview).toBe(2); // APPLIED + UNDER_REVIEW
    expect(body.awaitingWire).toBe(1);
    expect(body.totalActions).toBe(3 + 2 + 2 + 1); // 8
  });

  it("returns zero counts when no pending actions", async () => {
    mockSession();
    mockAdminUser();
    mockFundFound();

    (prisma.transaction.count as jest.Mock).mockResolvedValue(0);
    (prisma.lPDocument.count as jest.Mock).mockResolvedValue(0);
    (prisma.investor.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.investment.count as jest.Mock).mockResolvedValue(0);

    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.pendingWires).toBe(0);
    expect(body.pendingDocs).toBe(0);
    expect(body.needsReview).toBe(0);
    expect(body.awaitingWire).toBe(0);
    expect(body.totalActions).toBe(0);
  });

  it("returns 500 and reports error on internal failure", async () => {
    mockSession();
    mockAdminUser();
    mockFundFound();
    (prisma.transaction.count as jest.Mock).mockRejectedValue(new Error("DB fail"));

    const res = await call();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(mockReportError).toHaveBeenCalled();
  });

  it("returns 400 if fund ID is missing", async () => {
    mockSession();
    const [req, ctx] = makeAdminFundReq("", "pending-actions");
    // Override params with empty id
    const ctxEmpty = { params: Promise.resolve({ id: "" }) };
    const res = await getPendingActions(req, ctxEmpty);
    expect(res.status).toBe(400);
  });
});

// ====================================================================
// 2. GET /api/admin/fund/[fundId]/pending-details
// ====================================================================

describe("GET /api/admin/fund/[fundId]/pending-details", () => {
  const call = (fundId = FUND_ID, query?: Record<string, string>) => {
    const [req, ctx] = makeAdminFundReq(fundId, "pending-details", query);
    return getPendingDetails(req, ctx);
  };

  it("returns 401 if not authenticated", async () => {
    mockNoSession();
    const res = await call();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 if user has no admin teams", async () => {
    mockSession();
    mockNoTeamUser();
    const res = await call();
    expect(res.status).toBe(403);
  });

  it("returns 404 if fund not found", async () => {
    mockSession();
    mockAdminUser();
    mockFundNotFound();
    const res = await call();
    expect(res.status).toBe(404);
  });

  it("returns top N items per category with correct shape", async () => {
    mockSession();
    mockAdminUser();
    mockFundFound();

    const now = new Date();

    // Wire transactions
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
      {
        id: "tx-1",
        amount: 50000,
        status: "PENDING",
        createdAt: now,
        description: "Wire from LP",
        metadata: { proofFileName: "proof.pdf" },
        investor: { id: "inv-1", entityName: "Acme LLC", user: { name: "Jane Doe", email: "jane@test.com" } },
      },
    ]);

    // Pending docs
    (prisma.lPDocument.findMany as jest.Mock).mockResolvedValue([
      {
        id: "doc-1",
        title: "Sub Agreement",
        documentType: "SUBSCRIPTION",
        createdAt: now,
        originalFilename: "sub_agreement.pdf",
        investor: { id: "inv-2", entityName: null, user: { name: "John Smith", email: "john@test.com" } },
      },
    ]);

    // Investors for review
    (prisma.investor.findMany as jest.Mock).mockResolvedValue([
      {
        id: "inv-3",
        entityName: "Smith Trust",
        fundData: { approvalStage: "APPLIED" },
        accreditationStatus: "PENDING",
        onboardingStep: 1,
        onboardingCompletedAt: null,
        createdAt: now,
        user: { name: "Bob Smith", email: "bob@test.com" },
      },
      {
        id: "inv-4",
        entityName: null,
        fundData: { approvalStage: "APPROVED" },
        accreditationStatus: "KYC_VERIFIED",
        onboardingStep: 4,
        onboardingCompletedAt: null,
        createdAt: now,
        user: { name: "Alice Jones", email: "alice@test.com" },
      },
    ]);
    mockDetermineCurrentStage
      .mockReturnValueOnce("APPLIED")
      .mockReturnValueOnce("APPROVED");

    // Docs approved investments
    (prisma.investment.findMany as jest.Mock).mockResolvedValue([
      {
        id: "invest-1",
        commitmentAmount: 100000,
        fundedAmount: 0,
        status: "DOCS_APPROVED",
        createdAt: now,
        investor: { id: "inv-5", entityName: "Jones LLC", user: { name: "Carol Jones", email: "carol@test.com" } },
      },
    ]);

    // Total counts for "and X more"
    (prisma.transaction.count as jest.Mock).mockResolvedValue(5);
    (prisma.lPDocument.count as jest.Mock).mockResolvedValue(3);
    (prisma.investment.count as jest.Mock).mockResolvedValue(2);

    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();

    // Verify response shape
    expect(body.pendingWires.items).toHaveLength(1);
    expect(body.pendingWires.items[0]).toMatchObject({
      transactionId: "tx-1",
      investorId: "inv-1",
      name: "Jane Doe",
      email: "jane@test.com",
      amount: 50000,
      status: "PENDING",
      proofFileName: "proof.pdf",
    });
    expect(body.pendingWires.total).toBe(5);

    expect(body.pendingDocs.items).toHaveLength(1);
    expect(body.pendingDocs.items[0]).toMatchObject({
      documentId: "doc-1",
      investorId: "inv-2",
      name: "John Smith",
      documentType: "SUBSCRIPTION",
    });
    expect(body.pendingDocs.total).toBe(3);

    expect(body.needsReview.items).toHaveLength(1); // Only APPLIED counted
    expect(body.needsReview.items[0]).toMatchObject({
      investorId: "inv-3",
      name: "Bob Smith",
      stage: "APPLIED",
    });
    expect(body.needsReview.total).toBe(1);

    expect(body.awaitingWire.items).toHaveLength(1);
    expect(body.awaitingWire.items[0]).toMatchObject({
      investmentId: "invest-1",
      investorId: "inv-5",
      name: "Carol Jones",
      commitmentAmount: 100000,
      fundedAmount: 0,
    });
    expect(body.awaitingWire.total).toBe(2);

    expect(body.totalActions).toBe(5 + 3 + 1 + 2); // 11
  });

  it("respects limit query parameter", async () => {
    mockSession();
    mockAdminUser();
    mockFundFound();

    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.lPDocument.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.investor.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.investment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.transaction.count as jest.Mock).mockResolvedValue(0);
    (prisma.lPDocument.count as jest.Mock).mockResolvedValue(0);
    (prisma.investment.count as jest.Mock).mockResolvedValue(0);

    await call(FUND_ID, { limit: "3" });

    // Verify the limit=3 was passed to take in findMany calls
    const txCall = (prisma.transaction.findMany as jest.Mock).mock.calls[0][0];
    expect(txCall.take).toBe(3);

    const docCall = (prisma.lPDocument.findMany as jest.Mock).mock.calls[0][0];
    expect(docCall.take).toBe(3);

    const investCall = (prisma.investment.findMany as jest.Mock).mock.calls[0][0];
    expect(investCall.take).toBe(3);
  });

  it("clamps limit to max 10", async () => {
    mockSession();
    mockAdminUser();
    mockFundFound();

    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.lPDocument.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.investor.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.investment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.transaction.count as jest.Mock).mockResolvedValue(0);
    (prisma.lPDocument.count as jest.Mock).mockResolvedValue(0);
    (prisma.investment.count as jest.Mock).mockResolvedValue(0);

    await call(FUND_ID, { limit: "50" });

    const txCall = (prisma.transaction.findMany as jest.Mock).mock.calls[0][0];
    expect(txCall.take).toBe(10);
  });

  it("returns 500 and reports error on internal failure", async () => {
    mockSession();
    mockAdminUser();
    mockFundFound();
    (prisma.transaction.findMany as jest.Mock).mockRejectedValue(new Error("DB fail"));

    const res = await call();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(mockReportError).toHaveBeenCalled();
  });

  it("handles investors with missing user/entityName gracefully", async () => {
    mockSession();
    mockAdminUser();
    mockFundFound();

    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
      {
        id: "tx-1",
        amount: 1000,
        status: "PENDING",
        createdAt: new Date(),
        description: null,
        metadata: null,
        investor: null,
      },
    ]);
    (prisma.lPDocument.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.investor.findMany as jest.Mock).mockResolvedValue([
      {
        id: "inv-lonely",
        entityName: null,
        fundData: null,
        accreditationStatus: "PENDING",
        onboardingStep: 0,
        onboardingCompletedAt: null,
        createdAt: new Date(),
        user: null,
      },
    ]);
    mockDetermineCurrentStage.mockReturnValueOnce("APPLIED");
    (prisma.investment.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.transaction.count as jest.Mock).mockResolvedValue(1);
    (prisma.lPDocument.count as jest.Mock).mockResolvedValue(0);
    (prisma.investment.count as jest.Mock).mockResolvedValue(0);

    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();

    // Wire with null investor should fall back to "Unknown"
    expect(body.pendingWires.items[0].name).toBe("Unknown");
    expect(body.pendingWires.items[0].investorId).toBeNull();
    expect(body.pendingWires.items[0].proofFileName).toBeNull();

    // Investor with null user/entityName should fall back to "Unknown"
    expect(body.needsReview.items[0].name).toBe("Unknown");
  });
});

// ====================================================================
// 3. GET /api/teams/[teamId]/funds/[fundId]/transactions
// ====================================================================

describe("GET /api/teams/[teamId]/funds/[fundId]/transactions", () => {
  const call = (
    teamId = TEAM_ID,
    fundId = FUND_ID,
    query?: Record<string, string>,
  ) => {
    const [req, ctx] = makeTeamFundReq(teamId, fundId, "transactions", { query });
    return getTransactions(req, ctx);
  };

  const callWithStatuses = (statuses: string[]) => {
    const url = new URL(`http://localhost/api/teams/${TEAM_ID}/funds/${FUND_ID}/transactions`);
    for (const s of statuses) url.searchParams.append("status", s);
    const req = new NextRequest(url, { method: "GET" });
    const ctx = { params: Promise.resolve({ teamId: TEAM_ID, fundId: FUND_ID }) };
    return getTransactions(req, ctx);
  };

  it("returns 401 if not authenticated", async () => {
    mockAuthenticateGP.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const res = await call();
    expect(res.status).toBe(401);
  });

  it("returns 403 if not GP admin", async () => {
    mockAuthenticateGP.mockResolvedValue({
      error: NextResponse.json({ error: "Forbidden: Admin or Owner role required" }, { status: 403 }),
    });

    const res = await call();
    expect(res.status).toBe(403);
  });

  it("returns 404 if fund not in team", async () => {
    mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });
    mockFundNotFound();

    const res = await call();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Fund not found");
  });

  it("returns paginated transactions with correct shape", async () => {
    mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });
    mockFundFound();

    const now = new Date();
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
      {
        id: "tx-1",
        amount: 50000,
        currency: "USD",
        type: "CAPITAL_CALL",
        status: "COMPLETED",
        initiatedAt: now,
        description: "Capital call",
        confirmedAt: now,
        confirmedBy: "gp-1",
        bankReference: "REF-001",
        fundsReceivedDate: now,
        investor: {
          id: "inv-1",
          entityName: "Acme LLC",
          user: { name: "Jane Doe", email: "jane@test.com" },
        },
      },
    ]);
    (prisma.transaction.count as jest.Mock).mockResolvedValue(1);

    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0]).toMatchObject({
      id: "tx-1",
      investorName: "Jane Doe",
      investorEmail: "jane@test.com",
      amount: 50000,
      currency: "USD",
      type: "CAPITAL_CALL",
      status: "COMPLETED",
      fundName: "Test Fund I",
      bankReference: "REF-001",
    });
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(50);
    expect(body.totalPages).toBe(1);
  });

  it("filters by single status", async () => {
    mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });
    mockFundFound();
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

    await call(TEAM_ID, FUND_ID, { status: "PENDING" });

    const txCall = (prisma.transaction.findMany as jest.Mock).mock.calls[0][0];
    expect(txCall.where.status).toBe("PENDING");
  });

  it("filters by multiple statuses", async () => {
    mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });
    mockFundFound();
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

    await callWithStatuses(["PENDING", "PROOF_UPLOADED"]);

    const txCall = (prisma.transaction.findMany as jest.Mock).mock.calls[0][0];
    expect(txCall.where.status).toEqual({ in: ["PENDING", "PROOF_UPLOADED"] });
  });

  it("paginates with page and pageSize params", async () => {
    mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });
    mockFundFound();
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.transaction.count as jest.Mock).mockResolvedValue(100);

    const res = await call(TEAM_ID, FUND_ID, { page: "2", pageSize: "10" });
    const body = await res.json();

    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(10);
    expect(body.totalPages).toBe(10);

    const txCall = (prisma.transaction.findMany as jest.Mock).mock.calls[0][0];
    expect(txCall.skip).toBe(10); // (page-1) * pageSize
    expect(txCall.take).toBe(10);
  });

  it("clamps pageSize to max 100", async () => {
    mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });
    mockFundFound();
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

    await call(TEAM_ID, FUND_ID, { pageSize: "500" });

    const txCall = (prisma.transaction.findMany as jest.Mock).mock.calls[0][0];
    expect(txCall.take).toBe(100);
  });

  it("returns 500 and reports error on internal failure", async () => {
    mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });
    mockFundFound();
    (prisma.transaction.findMany as jest.Mock).mockRejectedValue(new Error("DB down"));

    const res = await call();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(mockReportError).toHaveBeenCalled();
  });
});

// ====================================================================
// 4. GET/POST/DELETE /api/teams/[teamId]/funds/[fundId]/wire-instructions
// ====================================================================

describe("GET/POST/DELETE /api/teams/[teamId]/funds/[fundId]/wire-instructions", () => {
  // --- GET ---

  describe("GET", () => {
    const callGet = (teamId = TEAM_ID, fundId = FUND_ID) => {
      const [req, ctx] = makeTeamFundReq(teamId, fundId, "wire-instructions");
      return getWireInstructions(req, ctx);
    };

    it("returns 401 if not authenticated", async () => {
      mockAuthenticateGP.mockResolvedValue({
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      });

      const res = await callGet();
      expect(res.status).toBe(401);
    });

    it("returns 403 if not GP admin", async () => {
      mockAuthenticateGP.mockResolvedValue({
        error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      });

      const res = await callGet();
      expect(res.status).toBe(403);
    });

    it("returns null instructions when not configured", async () => {
      mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });
      mockGetWireInstructions.mockResolvedValue(null);

      const res = await callGet();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.instructions).toBeNull();
      expect(body.configured).toBe(false);
    });

    it("returns wire instructions when configured", async () => {
      mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });
      const instructions = {
        bankName: "Wells Fargo",
        accountNumber: "123456789",
        routingNumber: "987654321",
        swiftCode: "WFBIUS6S",
        beneficiaryName: "Acme Fund I LLC",
      };
      mockGetWireInstructions.mockResolvedValue(instructions);

      const res = await callGet();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.instructions).toEqual(instructions);
      expect(body.configured).toBe(true);
    });

    it("returns 500 on internal error", async () => {
      mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });
      mockGetWireInstructions.mockRejectedValue(new Error("Decrypt fail"));

      const res = await callGet();
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalled();
    });
  });

  // --- POST ---

  describe("POST", () => {
    const callPost = (body: Record<string, unknown>) => {
      const [req, ctx] = makeTeamFundReq(TEAM_ID, FUND_ID, "wire-instructions", {
        method: "POST",
        body,
      });
      return postWireInstructions(req, ctx);
    };

    const validBody = {
      bankName: "Wells Fargo",
      accountNumber: "123456789",
      routingNumber: "987654321",
      beneficiaryName: "Acme Fund I LLC",
    };

    it("returns 401 if not authenticated", async () => {
      mockAuthenticateGP.mockResolvedValue({
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      });

      const res = await callPost(validBody);
      expect(res.status).toBe(401);
    });

    it("returns 400 if required fields missing", async () => {
      mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });

      const res = await callPost({ bankName: "Test Bank" }); // missing accountNumber, routingNumber, beneficiaryName
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("required");
    });

    it("returns 400 if routing number is not 9 digits", async () => {
      mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });

      const res = await callPost({
        ...validBody,
        routingNumber: "12345", // Only 5 digits
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("9 digits");
    });

    it("returns 400 if bank name exceeds 200 characters", async () => {
      mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });

      const res = await callPost({
        ...validBody,
        bankName: "A".repeat(201),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("200 characters");
    });

    it("returns 400 if beneficiary name exceeds 200 characters", async () => {
      mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });

      const res = await callPost({
        ...validBody,
        beneficiaryName: "B".repeat(201),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("200 characters");
    });

    it("creates wire instructions successfully", async () => {
      mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });
      mockSetWireInstructions.mockResolvedValue({ id: FUND_ID, name: "Test Fund I" });

      const res = await callPost(validBody);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.fund).toEqual({ id: FUND_ID, name: "Test Fund I" });

      // Verify setWireInstructions was called with correct args
      expect(mockSetWireInstructions).toHaveBeenCalledWith(FUND_ID, validBody, USER_ID);
    });

    it("returns 500 on internal error", async () => {
      mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });
      mockSetWireInstructions.mockRejectedValue(new Error("Encrypt fail"));

      const res = await callPost(validBody);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalled();
    });
  });

  // --- DELETE ---

  describe("DELETE", () => {
    const callDelete = (teamId = TEAM_ID, fundId = FUND_ID) => {
      const [req, ctx] = makeTeamFundReq(teamId, fundId, "wire-instructions", { method: "DELETE" });
      return deleteWireInstructionsRoute(req, ctx);
    };

    it("returns 401 if not authenticated", async () => {
      mockAuthenticateGP.mockResolvedValue({
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      });

      const res = await callDelete();
      expect(res.status).toBe(401);
    });

    it("deletes wire instructions successfully", async () => {
      mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });
      mockDeleteWireInstructions.mockResolvedValue({ id: FUND_ID, name: "Test Fund I" });

      const res = await callDelete();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.fund).toEqual({ id: FUND_ID, name: "Test Fund I" });

      expect(mockDeleteWireInstructions).toHaveBeenCalledWith(FUND_ID, USER_ID);
    });

    it("returns 500 on internal error", async () => {
      mockAuthenticateGP.mockResolvedValue({ userId: USER_ID, teamId: TEAM_ID, role: "ADMIN" });
      mockDeleteWireInstructions.mockRejectedValue(new Error("Fund not found"));

      const res = await callDelete();
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalled();
    });
  });
});

// ====================================================================
// 5. GET /api/admin/team-context
// ====================================================================

describe("GET /api/admin/team-context", () => {
  const call = () => {
    const req = makeAdminReq("team-context");
    return getTeamContext(req);
  };

  it("returns 401 if not authenticated (via enforceRBACAppRouter)", async () => {
    mockEnforceRBACAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await call();
    expect(res.status).toBe(401);
  });

  it("returns 403 if not admin role", async () => {
    mockEnforceRBACAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 }),
    );

    const res = await call();
    expect(res.status).toBe(403);
  });

  it("returns 403 if no admin team found", async () => {
    mockEnforceRBACAppRouter.mockResolvedValue({
      userId: USER_ID,
      email: "gp@test.com",
      teamId: "",
      role: "ADMIN",
    });
    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await call();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("No admin team found");
  });

  it("returns team context with GP_FUND mode", async () => {
    mockEnforceRBACAppRouter.mockResolvedValue({
      userId: USER_ID,
      email: "gp@test.com",
      teamId: "",
      role: "ADMIN",
    });

    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
      userId: USER_ID,
      teamId: TEAM_ID,
      role: "ADMIN",
      team: {
        id: TEAM_ID,
        name: "Acme Capital",
        organization: {
          id: ORG_ID,
          name: "Acme Corp",
          featureFlags: { mode: "GP_FUND" },
          logo: "https://example.com/logo.png",
          brandColor: "#FF0000",
        },
        funds: [
          {
            id: FUND_ID,
            name: "Acme Fund I",
            entityMode: "FUND",
            fundSubType: null,
            featureFlags: {},
          },
        ],
      },
    });

    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toMatchObject({
      teamId: TEAM_ID,
      teamName: "Acme Capital",
      orgId: ORG_ID,
      orgName: "Acme Corp",
      mode: "GP_FUND",
      instrumentType: null,
      logoUrl: "https://example.com/logo.png",
      brandColor: "#FF0000",
    });
    expect(body.funds).toHaveLength(1);
    expect(body.funds[0]).toMatchObject({
      id: FUND_ID,
      name: "Acme Fund I",
      entityMode: "FUND",
    });
  });

  it("returns STARTUP mode with instrument type from first fund", async () => {
    mockEnforceRBACAppRouter.mockResolvedValue({
      userId: USER_ID,
      email: "gp@test.com",
      teamId: "",
      role: "ADMIN",
    });

    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
      userId: USER_ID,
      teamId: TEAM_ID,
      role: "ADMIN",
      team: {
        id: TEAM_ID,
        name: "Startup Capital",
        organization: {
          id: ORG_ID,
          name: "Startup Corp",
          featureFlags: { mode: "STARTUP" },
          logo: null,
          brandColor: null,
        },
        funds: [
          {
            id: "fund-startup",
            name: "Seed Round",
            entityMode: "STARTUP",
            fundSubType: "SAFE",
            featureFlags: {},
          },
        ],
      },
    });

    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.mode).toBe("STARTUP");
    expect(body.instrumentType).toBe("SAFE");
    expect(body.brandColor).toBe("#0066FF"); // Default fallback
    expect(body.logoUrl).toBeNull();
  });

  it("infers STARTUP mode from first fund when org mode not set", async () => {
    mockEnforceRBACAppRouter.mockResolvedValue({
      userId: USER_ID,
      email: "gp@test.com",
      teamId: "",
      role: "ADMIN",
    });

    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
      userId: USER_ID,
      teamId: TEAM_ID,
      role: "ADMIN",
      team: {
        id: TEAM_ID,
        name: "Inferred Startup",
        organization: {
          id: ORG_ID,
          name: "Inferred Corp",
          featureFlags: {}, // No mode set
          logo: null,
          brandColor: null,
        },
        funds: [
          {
            id: "fund-inferred",
            name: "Pre-Seed",
            entityMode: "STARTUP",
            fundSubType: "CONVERTIBLE_NOTE",
            featureFlags: {},
          },
        ],
      },
    });

    const res = await call();
    const body = await res.json();

    expect(body.mode).toBe("STARTUP");
    expect(body.instrumentType).toBe("CONVERTIBLE_NOTE");
  });

  it("defaults to GP_FUND mode when no org mode and no funds", async () => {
    mockEnforceRBACAppRouter.mockResolvedValue({
      userId: USER_ID,
      email: "gp@test.com",
      teamId: "",
      role: "ADMIN",
    });

    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
      userId: USER_ID,
      teamId: TEAM_ID,
      role: "ADMIN",
      team: {
        id: TEAM_ID,
        name: "Empty Team",
        organization: {
          id: ORG_ID,
          name: "Empty Corp",
          featureFlags: {},
          logo: null,
          brandColor: null,
        },
        funds: [],
      },
    });

    const res = await call();
    const body = await res.json();

    expect(body.mode).toBe("GP_FUND");
    expect(body.instrumentType).toBeNull();
    expect(body.funds).toHaveLength(0);
  });

  it("returns 500 and reports error on internal failure", async () => {
    mockEnforceRBACAppRouter.mockResolvedValue({
      userId: USER_ID,
      email: "gp@test.com",
      teamId: "",
      role: "ADMIN",
    });
    (prisma.userTeam.findFirst as jest.Mock).mockRejectedValue(new Error("DB fail"));

    const res = await call();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(mockReportError).toHaveBeenCalled();
  });
});

// ====================================================================
// 6. GET /api/admin/transactions
// ====================================================================

describe("GET /api/admin/transactions", () => {
  const call = (query?: Record<string, string>) => {
    const req = makeAdminReq("transactions", query);
    return getAdminTransactions(req);
  };

  it("returns 401 if not authenticated (via enforceRBACAppRouter)", async () => {
    mockEnforceRBACAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await call();
    expect(res.status).toBe(401);
  });

  it("returns 403 if not admin role", async () => {
    mockEnforceRBACAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 }),
    );

    const res = await call();
    expect(res.status).toBe(403);
  });

  it("returns 403 if no admin team found (auto-resolve)", async () => {
    mockEnforceRBACAppRouter.mockResolvedValue({
      userId: USER_ID,
      email: "gp@test.com",
      teamId: TEAM_ID,
      role: "ADMIN",
    });
    // No teamId in query, so the route auto-resolves from membership
    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await call();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("No admin team found");
  });

  it("returns empty list when team has no funds", async () => {
    mockEnforceRBACAppRouter.mockResolvedValue({
      userId: USER_ID,
      email: "gp@test.com",
      teamId: TEAM_ID,
      role: "ADMIN",
    });
    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({ teamId: TEAM_ID });
    (prisma.fund.findMany as jest.Mock).mockResolvedValue([]);

    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transactions).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("returns transactions with correct shape", async () => {
    mockEnforceRBACAppRouter.mockResolvedValue({
      userId: USER_ID,
      email: "gp@test.com",
      teamId: TEAM_ID,
      role: "ADMIN",
    });
    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({ teamId: TEAM_ID });
    (prisma.fund.findMany as jest.Mock).mockResolvedValue([
      { id: FUND_ID, name: "Acme Fund I" },
    ]);

    const now = new Date();
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([
      {
        id: "tx-1",
        type: "CAPITAL_CALL",
        status: "COMPLETED",
        amount: 75000,
        fundId: FUND_ID,
        bankReference: "REF-123",
        createdAt: now,
        confirmedAt: now,
        investor: { id: "inv-1", user: { name: "Jane Doe", email: "jane@test.com" } },
      },
      {
        id: "tx-2",
        type: null,
        status: "PENDING",
        amount: 25000,
        fundId: FUND_ID,
        bankReference: null,
        createdAt: now,
        confirmedAt: null,
        investor: null,
      },
    ]);
    (prisma.transaction.count as jest.Mock).mockResolvedValue(2);

    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.transactions).toHaveLength(2);

    // Transaction with investor
    expect(body.transactions[0]).toMatchObject({
      id: "tx-1",
      type: "CAPITAL_CALL",
      status: "COMPLETED",
      amount: 75000,
      investorName: "Jane Doe",
      investorEmail: "jane@test.com",
      fundName: "Acme Fund I",
      fundId: FUND_ID,
      bankReference: "REF-123",
    });

    // Transaction with null investor
    expect(body.transactions[1]).toMatchObject({
      id: "tx-2",
      type: "WIRE", // Defaults to "WIRE" when type is null
      status: "PENDING",
      amount: 25000,
      investorName: "Unknown",
      investorEmail: "",
      fundName: "Acme Fund I",
    });

    expect(body.total).toBe(2);
  });

  it("filters by status query param", async () => {
    mockEnforceRBACAppRouter.mockResolvedValue({
      userId: USER_ID,
      email: "gp@test.com",
      teamId: TEAM_ID,
      role: "ADMIN",
    });
    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({ teamId: TEAM_ID });
    (prisma.fund.findMany as jest.Mock).mockResolvedValue([
      { id: FUND_ID, name: "Acme Fund I" },
    ]);
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

    await call({ status: "PENDING" });

    const txCall = (prisma.transaction.findMany as jest.Mock).mock.calls[0][0];
    expect(txCall.where.status).toBe("PENDING");
  });

  it("uses provided teamId from query params", async () => {
    const providedTeamId = "team-explicit";
    mockEnforceRBACAppRouter.mockResolvedValue({
      userId: USER_ID,
      email: "gp@test.com",
      teamId: TEAM_ID,
      role: "ADMIN",
    });
    // Note: when teamId is provided in query, no userTeam.findFirst call should happen
    (prisma.fund.findMany as jest.Mock).mockResolvedValue([]);

    const res = await call({ teamId: providedTeamId });
    expect(res.status).toBe(200);

    // Verify fund lookup uses the provided teamId
    const fundCall = (prisma.fund.findMany as jest.Mock).mock.calls[0][0];
    expect(fundCall.where.teamId).toBe(providedTeamId);

    // No membership lookup since teamId was provided
    expect(prisma.userTeam.findFirst).not.toHaveBeenCalled();
  });

  it("respects limit and offset params", async () => {
    mockEnforceRBACAppRouter.mockResolvedValue({
      userId: USER_ID,
      email: "gp@test.com",
      teamId: TEAM_ID,
      role: "ADMIN",
    });
    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({ teamId: TEAM_ID });
    (prisma.fund.findMany as jest.Mock).mockResolvedValue([
      { id: FUND_ID, name: "Fund" },
    ]);
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

    await call({ limit: "25", offset: "50" });

    const txCall = (prisma.transaction.findMany as jest.Mock).mock.calls[0][0];
    expect(txCall.take).toBe(25);
    expect(txCall.skip).toBe(50);
  });

  it("clamps limit to max 200", async () => {
    mockEnforceRBACAppRouter.mockResolvedValue({
      userId: USER_ID,
      email: "gp@test.com",
      teamId: TEAM_ID,
      role: "ADMIN",
    });
    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({ teamId: TEAM_ID });
    (prisma.fund.findMany as jest.Mock).mockResolvedValue([
      { id: FUND_ID, name: "Fund" },
    ]);
    (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

    await call({ limit: "999" });

    const txCall = (prisma.transaction.findMany as jest.Mock).mock.calls[0][0];
    expect(txCall.take).toBe(200);
  });

  it("returns 500 and reports error on internal failure", async () => {
    mockEnforceRBACAppRouter.mockResolvedValue({
      userId: USER_ID,
      email: "gp@test.com",
      teamId: TEAM_ID,
      role: "ADMIN",
    });
    (prisma.userTeam.findFirst as jest.Mock).mockRejectedValue(new Error("DB fail"));

    const res = await call();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(mockReportError).toHaveBeenCalled();
  });
});
