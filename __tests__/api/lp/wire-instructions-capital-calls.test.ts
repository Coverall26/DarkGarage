/**
 * Tests for:
 *   GET /api/lp/wire-instructions  (app/api/lp/wire-instructions/route.ts)
 *   GET /api/lp/capital-calls      (app/api/lp/capital-calls/route.ts)
 *
 * Covers: auth, investor lookup, manualInvestment vs regular investment paths,
 * wire instruction formatting, proof status derivation from Transaction,
 * capital call filtering (no DRAFTs), LP response serialization, summary stats.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockRequireLPAuthAppRouter = jest.fn();
const mockGetWireInstructionsPublic = jest.fn();

jest.mock("@/lib/auth/rbac", () => ({
  requireLPAuthAppRouter: (...args: unknown[]) =>
    mockRequireLPAuthAppRouter(...args),
  enforceRBAC: jest.fn(),
  requireAdmin: jest.fn(),
  enforceRBACAppRouter: jest.fn(),
  requireAdminAppRouter: jest.fn(),
}));

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

jest.mock("@/lib/wire-transfer", () => ({
  getWireInstructionsPublic: (...args: unknown[]) =>
    mockGetWireInstructionsPublic(...args),
}));

// ── Import handlers after mocks ────────────────────────────────────────────

import { GET as getWireInstructions } from "@/app/api/lp/wire-instructions/route";
import { GET as getCapitalCalls } from "@/app/api/lp/capital-calls/route";

// ── Shared Helpers ─────────────────────────────────────────────────────────

const AUTH_RESULT = {
  userId: "user-1",
  email: "lp@example.com",
  investorId: "inv-1",
  session: { user: { id: "user-1", email: "lp@example.com" } },
};

function makeWireRequest() {
  return new NextRequest("http://localhost/api/lp/wire-instructions", {
    method: "GET",
  });
}

function makeCapitalCallsRequest(params?: Record<string, string>) {
  const url = new URL("http://localhost/api/lp/capital-calls");
  if (params) {
    for (const [key, val] of Object.entries(params)) {
      url.searchParams.set(key, val);
    }
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

// ── Wire Instructions Tests ────────────────────────────────────────────────

describe("GET /api/lp/wire-instructions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireLPAuthAppRouter.mockResolvedValue(AUTH_RESULT);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireLPAuthAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await getWireInstructions(makeWireRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 404 when investor profile not found", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      name: "Test User",
      investorProfile: null,
    });

    const res = await getWireInstructions(makeWireRequest());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Investor profile not found");
  });

  it("returns 404 when user not found at all", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await getWireInstructions(makeWireRequest());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Investor profile not found");
  });

  it("returns wire instructions via manualInvestment path (happy path)", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      name: "Jane Doe",
      investorProfile: { id: "inv-1" },
    });

    (prisma.manualInvestment.findFirst as jest.Mock).mockResolvedValue({
      id: "mi-1",
      fundId: "fund-1",
      teamId: "team-1",
      commitmentAmount: new Decimal("250000"),
      fundedAmount: new Decimal("100000"),
      proofStatus: "VERIFIED",
      proofFileName: "receipt.pdf",
      proofUploadedAt: new Date("2026-02-20T10:00:00Z"),
      transferMethod: "WIRE",
      transferStatus: "COMPLETED",
      fund: { id: "fund-1", name: "Bermuda Club Fund I" },
    });

    mockGetWireInstructionsPublic.mockResolvedValue({
      bankName: "First National Bank",
      accountNumberLast4: "7890",
      routingNumber: "***5678",
      swiftCode: "FNBKUS33",
      beneficiaryName: "Bermuda GP LLC",
      beneficiaryAddress: null,
      reference: "LP-DOE-BCF1",
      notes: "Include investor name in memo",
      intermediaryBank: null,
    });

    const res = await getWireInstructions(makeWireRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.fundId).toBe("fund-1");
    expect(body.fundName).toBe("Bermuda Club Fund I");
    expect(body.investmentId).toBe("mi-1");
    expect(body.teamId).toBe("team-1");
    expect(body.commitmentAmount).toBe(250000);
    expect(body.investorName).toBe("Jane Doe");
    expect(body.proofStatus).toBe("VERIFIED");
    expect(body.proofFileName).toBe("receipt.pdf");

    // Wire instructions formatted correctly
    expect(body.wireInstructions).toEqual({
      bankName: "First National Bank",
      accountName: "Bermuda GP LLC",
      routingNumber: "***5678",
      accountNumber: "****7890",
      reference: "LP-DOE-BCF1",
      notes: "Include investor name in memo",
      swiftCode: "FNBKUS33",
    });

    // Should NOT have queried regular investment
    expect(prisma.investment.findFirst).not.toHaveBeenCalled();
  });

  it("returns wire instructions via regular investment fallback", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      name: "John Smith",
      investorProfile: { id: "inv-1" },
    });

    // No manual investment
    (prisma.manualInvestment.findFirst as jest.Mock).mockResolvedValue(null);

    // Regular investment found
    (prisma.investment.findFirst as jest.Mock).mockResolvedValue({
      id: "invest-1",
      fundId: "fund-2",
      commitmentAmount: new Decimal("500000"),
      fund: { id: "fund-2", name: "Growth Fund II", teamId: "team-2" },
    });

    mockGetWireInstructionsPublic.mockResolvedValue({
      bankName: "Chase",
      accountNumberLast4: "1234",
      routingNumber: "***9999",
      swiftCode: "",
      beneficiaryName: "Growth GP LLC",
      reference: "REF-123",
      notes: "",
      intermediaryBank: null,
    });

    // No wire transaction
    (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await getWireInstructions(makeWireRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.fundId).toBe("fund-2");
    expect(body.fundName).toBe("Growth Fund II");
    expect(body.investmentId).toBe("invest-1");
    expect(body.teamId).toBe("team-2");
    expect(body.commitmentAmount).toBe(500000);
    expect(body.investorName).toBe("John Smith");

    // No transaction means PENDING
    expect(body.proofStatus).toBe("PENDING");
    expect(body.proofFileName).toBeUndefined();
    expect(body.proofUploadedAt).toBeUndefined();

    expect(body.wireInstructions.bankName).toBe("Chase");
    expect(body.wireInstructions.accountNumber).toBe("****1234");
    expect(body.wireInstructions.swiftCode).toBe("");
  });

  it("returns 404 when no investment found (neither manual nor regular)", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      name: "New User",
      investorProfile: { id: "inv-1" },
    });

    (prisma.manualInvestment.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.investment.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await getWireInstructions(makeWireRequest());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("No active fund investment found");
  });

  it("returns VERIFIED proof status when Transaction status is COMPLETED", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      name: "LP User",
      investorProfile: { id: "inv-1" },
    });
    (prisma.manualInvestment.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.investment.findFirst as jest.Mock).mockResolvedValue({
      id: "invest-1",
      fundId: "fund-1",
      commitmentAmount: new Decimal("100000"),
      fund: { id: "fund-1", name: "Fund A", teamId: "team-1" },
    });
    mockGetWireInstructionsPublic.mockResolvedValue(null);

    (prisma.transaction.findFirst as jest.Mock).mockResolvedValue({
      status: "COMPLETED",
      metadata: { proofFileName: "wire-proof.pdf", proofUploadedAt: "2026-02-20T12:00:00Z" },
      initiatedAt: new Date("2026-02-19T10:00:00Z"),
    });

    const res = await getWireInstructions(makeWireRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.proofStatus).toBe("VERIFIED");
    expect(body.proofFileName).toBe("wire-proof.pdf");
    expect(body.proofUploadedAt).toBe("2026-02-20T12:00:00Z");
  });

  it("returns REJECTED proof status when Transaction status is FAILED", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      name: "LP User",
      investorProfile: { id: "inv-1" },
    });
    (prisma.manualInvestment.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.investment.findFirst as jest.Mock).mockResolvedValue({
      id: "invest-1",
      fundId: "fund-1",
      commitmentAmount: new Decimal("100000"),
      fund: { id: "fund-1", name: "Fund A", teamId: "team-1" },
    });
    mockGetWireInstructionsPublic.mockResolvedValue(null);

    (prisma.transaction.findFirst as jest.Mock).mockResolvedValue({
      status: "FAILED",
      metadata: null,
      initiatedAt: new Date("2026-02-18T10:00:00Z"),
    });

    const res = await getWireInstructions(makeWireRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.proofStatus).toBe("REJECTED");
  });

  it("returns REJECTED proof status when Transaction status is CANCELLED", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      name: "LP User",
      investorProfile: { id: "inv-1" },
    });
    (prisma.manualInvestment.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.investment.findFirst as jest.Mock).mockResolvedValue({
      id: "invest-1",
      fundId: "fund-1",
      commitmentAmount: new Decimal("100000"),
      fund: { id: "fund-1", name: "Fund A", teamId: "team-1" },
    });
    mockGetWireInstructionsPublic.mockResolvedValue(null);

    (prisma.transaction.findFirst as jest.Mock).mockResolvedValue({
      status: "CANCELLED",
      metadata: null,
      initiatedAt: new Date("2026-02-18T10:00:00Z"),
    });

    const res = await getWireInstructions(makeWireRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.proofStatus).toBe("REJECTED");
  });

  it("returns RECEIVED proof status when Transaction status is PENDING", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      name: "LP User",
      investorProfile: { id: "inv-1" },
    });
    (prisma.manualInvestment.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.investment.findFirst as jest.Mock).mockResolvedValue({
      id: "invest-1",
      fundId: "fund-1",
      commitmentAmount: new Decimal("100000"),
      fund: { id: "fund-1", name: "Fund A", teamId: "team-1" },
    });
    mockGetWireInstructionsPublic.mockResolvedValue(null);

    (prisma.transaction.findFirst as jest.Mock).mockResolvedValue({
      status: "PENDING",
      metadata: { proofFileName: "upload.pdf" },
      initiatedAt: new Date("2026-02-20T08:00:00Z"),
    });

    const res = await getWireInstructions(makeWireRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.proofStatus).toBe("RECEIVED");
    expect(body.proofFileName).toBe("upload.pdf");
    // Falls back to initiatedAt.toISOString() when metadata.proofUploadedAt is absent
    expect(body.proofUploadedAt).toBe("2026-02-20T08:00:00.000Z");
  });

  it("returns null wireInstructions when none configured for the fund", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      name: "LP User",
      investorProfile: { id: "inv-1" },
    });
    (prisma.manualInvestment.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.investment.findFirst as jest.Mock).mockResolvedValue({
      id: "invest-1",
      fundId: "fund-1",
      commitmentAmount: new Decimal("50000"),
      fund: { id: "fund-1", name: "Fund X", teamId: "team-1" },
    });

    // No wire instructions configured
    mockGetWireInstructionsPublic.mockResolvedValue(null);
    (prisma.transaction.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await getWireInstructions(makeWireRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.wireInstructions).toBeNull();
    expect(body.fundId).toBe("fund-1");
    expect(body.commitmentAmount).toBe(50000);
  });

  it("returns investorName as empty string when user.name is null", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      name: null,
      investorProfile: { id: "inv-1" },
    });
    (prisma.manualInvestment.findFirst as jest.Mock).mockResolvedValue({
      id: "mi-1",
      fundId: "fund-1",
      teamId: "team-1",
      commitmentAmount: new Decimal("10000"),
      fundedAmount: new Decimal("0"),
      proofStatus: null,
      proofFileName: null,
      proofUploadedAt: null,
      transferMethod: null,
      transferStatus: null,
      fund: { id: "fund-1", name: "Fund" },
    });
    mockGetWireInstructionsPublic.mockResolvedValue(null);

    const res = await getWireInstructions(makeWireRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.investorName).toBe("");
  });

  it("returns 500 on unexpected error and reports to Rollbar", async () => {
    const { reportError } = require("@/lib/error");
    (prisma.user.findUnique as jest.Mock).mockRejectedValue(
      new Error("DB connection lost"),
    );

    const res = await getWireInstructions(makeWireRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(reportError).toHaveBeenCalled();
  });
});

// ── Capital Calls Tests ────────────────────────────────────────────────────

describe("GET /api/lp/capital-calls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireLPAuthAppRouter.mockResolvedValue(AUTH_RESULT);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireLPAuthAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await getCapitalCalls(makeCapitalCallsRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 404 when investor not found", async () => {
    (prisma.investor.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await getCapitalCalls(makeCapitalCallsRequest());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Investor not found");
  });

  it("returns 400 when no fund associated", async () => {
    (prisma.investor.findFirst as jest.Mock).mockResolvedValue({
      id: "inv-1",
      fundId: null,
    });

    // No fundId query param and investor has no fundId
    const res = await getCapitalCalls(makeCapitalCallsRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No fund associated");
  });

  it("returns capital calls with LP response (happy path)", async () => {
    (prisma.investor.findFirst as jest.Mock).mockResolvedValue({
      id: "inv-1",
      fundId: "fund-1",
    });

    const mockDueDate = new Date("2026-03-15T00:00:00Z");
    const mockNoticeDate = new Date("2026-02-15T00:00:00Z");
    const mockSentAt = new Date("2026-02-15T09:00:00Z");
    const mockCreatedAt = new Date("2026-02-14T10:00:00Z");
    const mockProofUploadedAt = new Date("2026-03-10T12:00:00Z");

    (prisma.capitalCall.findMany as jest.Mock).mockResolvedValue([
      {
        id: "cc-1",
        callNumber: 1,
        amount: new Decimal("500000"),
        purpose: "Initial capital deployment",
        dueDate: mockDueDate,
        status: "SENT",
        noticeDate: mockNoticeDate,
        sentAt: mockSentAt,
        fundedAt: null,
        noticePdfUrl: "https://storage.example.com/notice-1.pdf",
        proRataPercentage: new Decimal("0.1500"),
        createdAt: mockCreatedAt,
        responses: [
          {
            id: "ccr-1",
            amountDue: new Decimal("75000"),
            amountPaid: new Decimal("0"),
            status: "PENDING",
            proofDocumentId: null,
            proofUploadedAt: null,
            confirmedAt: null,
            fundReceivedDate: null,
            notes: null,
          },
        ],
      },
      {
        id: "cc-2",
        callNumber: 2,
        amount: new Decimal("200000"),
        purpose: "Follow-on investment",
        dueDate: new Date("2026-04-15T00:00:00Z"),
        status: "SENT",
        noticeDate: null,
        sentAt: null,
        fundedAt: null,
        noticePdfUrl: null,
        proRataPercentage: null,
        createdAt: new Date("2026-03-01T10:00:00Z"),
        responses: [
          {
            id: "ccr-2",
            amountDue: new Decimal("30000"),
            amountPaid: new Decimal("30000"),
            status: "FUNDED",
            proofDocumentId: "doc-proof-1",
            proofUploadedAt: mockProofUploadedAt,
            confirmedAt: new Date("2026-03-12T10:00:00Z"),
            fundReceivedDate: new Date("2026-03-11T00:00:00Z"),
            notes: "Verified",
          },
        ],
      },
    ]);

    const res = await getCapitalCalls(makeCapitalCallsRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    // Calls array
    expect(body.calls).toHaveLength(2);

    // First call
    const call1 = body.calls[0];
    expect(call1.id).toBe("cc-1");
    expect(call1.callNumber).toBe(1);
    expect(call1.amount).toBe(500000);
    expect(call1.purpose).toBe("Initial capital deployment");
    expect(call1.status).toBe("SENT");
    expect(call1.proRataPercentage).toBe(0.15);
    expect(call1.noticePdfUrl).toBe("https://storage.example.com/notice-1.pdf");

    // LP's response on first call
    expect(call1.myResponse).not.toBeNull();
    expect(call1.myResponse.amountDue).toBe(75000);
    expect(call1.myResponse.amountPaid).toBe(0);
    expect(call1.myResponse.status).toBe("PENDING");

    // Second call with FUNDED response
    const call2 = body.calls[1];
    expect(call2.myResponse.status).toBe("FUNDED");
    expect(call2.myResponse.amountPaid).toBe(30000);
    expect(call2.myResponse.proofDocumentId).toBe("doc-proof-1");
    expect(call2.myResponse.notes).toBe("Verified");
  });

  it("returns summary with pending counts and totalOwed", async () => {
    (prisma.investor.findFirst as jest.Mock).mockResolvedValue({
      id: "inv-1",
      fundId: "fund-1",
    });

    (prisma.capitalCall.findMany as jest.Mock).mockResolvedValue([
      {
        id: "cc-1",
        callNumber: 1,
        amount: new Decimal("100000"),
        purpose: null,
        dueDate: new Date("2026-03-15"),
        status: "SENT",
        noticeDate: null,
        sentAt: null,
        fundedAt: null,
        noticePdfUrl: null,
        proRataPercentage: null,
        createdAt: new Date(),
        responses: [
          {
            id: "ccr-1",
            amountDue: new Decimal("25000"),
            amountPaid: new Decimal("0"),
            status: "PENDING",
            proofDocumentId: null,
            proofUploadedAt: null,
            confirmedAt: null,
            fundReceivedDate: null,
            notes: null,
          },
        ],
      },
      {
        id: "cc-2",
        callNumber: 2,
        amount: new Decimal("200000"),
        purpose: null,
        dueDate: new Date("2026-04-01"),
        status: "SENT",
        noticeDate: null,
        sentAt: null,
        fundedAt: null,
        noticePdfUrl: null,
        proRataPercentage: null,
        createdAt: new Date(),
        responses: [
          {
            id: "ccr-2",
            amountDue: new Decimal("50000"),
            amountPaid: new Decimal("0"),
            status: "PENDING",
            proofDocumentId: null,
            proofUploadedAt: null,
            confirmedAt: null,
            fundReceivedDate: null,
            notes: null,
          },
        ],
      },
      {
        id: "cc-3",
        callNumber: 3,
        amount: new Decimal("150000"),
        purpose: null,
        dueDate: new Date("2026-05-01"),
        status: "FUNDED",
        noticeDate: null,
        sentAt: null,
        fundedAt: new Date("2026-04-20"),
        noticePdfUrl: null,
        proRataPercentage: null,
        createdAt: new Date(),
        responses: [
          {
            id: "ccr-3",
            amountDue: new Decimal("37500"),
            amountPaid: new Decimal("37500"),
            status: "FUNDED",
            proofDocumentId: "doc-1",
            proofUploadedAt: new Date(),
            confirmedAt: new Date(),
            fundReceivedDate: new Date(),
            notes: null,
          },
        ],
      },
    ]);

    const res = await getCapitalCalls(makeCapitalCallsRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.summary.totalCalls).toBe(3);
    expect(body.summary.pendingCount).toBe(2);
    expect(body.summary.totalOwed).toBe(75000); // 25000 + 50000
    expect(body.summary.fundedCount).toBe(1);
  });

  it("filters by status query param", async () => {
    (prisma.investor.findFirst as jest.Mock).mockResolvedValue({
      id: "inv-1",
      fundId: "fund-1",
    });

    (prisma.capitalCall.findMany as jest.Mock).mockResolvedValue([]);

    const res = await getCapitalCalls(makeCapitalCallsRequest({ status: "SENT" }));
    expect(res.status).toBe(200);

    // Verify Prisma was called with the status filter, not the default `{ not: "DRAFT" }`
    expect(prisma.capitalCall.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fundId: "fund-1",
          status: "SENT",
        }),
      }),
    );
  });

  it("never returns DRAFT calls when no status filter provided", async () => {
    (prisma.investor.findFirst as jest.Mock).mockResolvedValue({
      id: "inv-1",
      fundId: "fund-1",
    });

    (prisma.capitalCall.findMany as jest.Mock).mockResolvedValue([]);

    await getCapitalCalls(makeCapitalCallsRequest());

    // Default filter should exclude DRAFT
    expect(prisma.capitalCall.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: "DRAFT" },
        }),
      }),
    );
  });

  it("uses fundId query param over investor.fundId when provided", async () => {
    (prisma.investor.findFirst as jest.Mock).mockResolvedValue({
      id: "inv-1",
      fundId: "fund-1",
    });

    (prisma.capitalCall.findMany as jest.Mock).mockResolvedValue([]);

    await getCapitalCalls(makeCapitalCallsRequest({ fundId: "fund-override" }));

    expect(prisma.capitalCall.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fundId: "fund-override",
        }),
      }),
    );
  });

  it("returns calls with null myResponse when no LP response exists", async () => {
    (prisma.investor.findFirst as jest.Mock).mockResolvedValue({
      id: "inv-1",
      fundId: "fund-1",
    });

    (prisma.capitalCall.findMany as jest.Mock).mockResolvedValue([
      {
        id: "cc-1",
        callNumber: 1,
        amount: new Decimal("100000"),
        purpose: "Deployment",
        dueDate: new Date("2026-06-01"),
        status: "SENT",
        noticeDate: null,
        sentAt: null,
        fundedAt: null,
        noticePdfUrl: null,
        proRataPercentage: null,
        createdAt: new Date(),
        responses: [], // Empty — no response for this investor
      },
    ]);

    const res = await getCapitalCalls(makeCapitalCallsRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.calls).toHaveLength(1);
    expect(body.calls[0].myResponse).toBeNull();
  });

  it("returns null proRataPercentage when not set", async () => {
    (prisma.investor.findFirst as jest.Mock).mockResolvedValue({
      id: "inv-1",
      fundId: "fund-1",
    });

    (prisma.capitalCall.findMany as jest.Mock).mockResolvedValue([
      {
        id: "cc-1",
        callNumber: 1,
        amount: new Decimal("100000"),
        purpose: null,
        dueDate: new Date("2026-06-01"),
        status: "SENT",
        noticeDate: null,
        sentAt: null,
        fundedAt: null,
        noticePdfUrl: null,
        proRataPercentage: null,
        createdAt: new Date(),
        responses: [],
      },
    ]);

    const res = await getCapitalCalls(makeCapitalCallsRequest());
    const body = await res.json();

    expect(body.calls[0].proRataPercentage).toBeNull();
  });

  it("returns empty calls array and zero summary when no calls exist", async () => {
    (prisma.investor.findFirst as jest.Mock).mockResolvedValue({
      id: "inv-1",
      fundId: "fund-1",
    });

    (prisma.capitalCall.findMany as jest.Mock).mockResolvedValue([]);

    const res = await getCapitalCalls(makeCapitalCallsRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.calls).toEqual([]);
    expect(body.summary).toEqual({
      totalCalls: 0,
      pendingCount: 0,
      totalOwed: 0,
      fundedCount: 0,
    });
  });

  it("returns 500 on unexpected error and reports to Rollbar", async () => {
    const { reportError } = require("@/lib/error");
    (prisma.investor.findFirst as jest.Mock).mockRejectedValue(
      new Error("DB timeout"),
    );

    const res = await getCapitalCalls(makeCapitalCallsRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(reportError).toHaveBeenCalled();
  });
});
