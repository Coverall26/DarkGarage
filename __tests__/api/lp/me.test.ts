/**
 * Tests for GET /api/lp/me
 *
 * Returns the current LP investor profile with investments,
 * capital calls, documents, fund aggregates, and accreditation status.
 * Tests: auth, profile lookup, data aggregation, KYC raw query, error handling.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockRequireLPAuthAppRouter = jest.fn();

jest.mock("@/lib/auth/rbac", () => ({
  requireLPAuthAppRouter: (...args: any[]) =>
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

// ── Import handler after mocks ─────────────────────────────────────────────

import { GET } from "@/app/api/lp/me/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest() {
  return new NextRequest("http://localhost/api/lp/me", { method: "GET" });
}

const AUTH_RESULT = {
  userId: "user-1",
  email: "lp@example.com",
  investorId: "inv-1",
  session: { user: { id: "user-1", email: "lp@example.com" } },
};

function buildMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    investorProfile: {
      id: "inv-1",
      entityName: "Acme LLC",
      ndaSigned: true,
      ndaSignedAt: new Date("2026-01-15"),
      accreditationStatus: "SELF_CERTIFIED",
      accreditationType: "INCOME_200K",
      fundData: { representations: {} },
      signedDocs: ["doc-1"],
      investments: [
        {
          id: "investment-1",
          fundId: "fund-1",
          commitmentAmount: { toString: () => "100000" },
          fundedAmount: { toString: () => "50000" },
          fund: { name: "Fund I", ndaGateEnabled: true },
        },
      ],
      capitalCalls: [
        {
          id: "ccr-1",
          amountDue: { toString: () => "25000" },
          status: "PENDING",
          capitalCall: {
            callNumber: 1,
            dueDate: new Date("2026-06-01"),
            fund: { name: "Fund I" },
          },
        },
      ],
      documents: [
        { id: "doc-1", title: "NDA", documentType: "NDA" },
      ],
      accreditationAcks: [
        {
          acknowledged: true,
          completedAt: new Date("2026-01-20"),
          accreditationType: "INCOME_200K",
          method: "SELF_ACK",
        },
      ],
      ...overrides,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/lp/me", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireLPAuthAppRouter.mockResolvedValue(AUTH_RESULT);
    // Default: KYC raw query returns NOT_STARTED
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { personaStatus: "NOT_STARTED", personaVerifiedAt: null },
    ]);
    // Default: empty funds for aggregates
    (prisma.fund.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireLPAuthAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 404 when user not found", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Investor profile not found");
  });

  it("returns 404 when investor profile not found", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: null,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  it("returns full investor profile on success", async () => {
    const mockUser = buildMockUser();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.fund.findMany as jest.Mock).mockResolvedValue([
      {
        id: "fund-1",
        name: "Fund I",
        targetRaise: { toString: () => "1000000" },
        currentRaise: { toString: () => "500000" },
        status: "OPEN",
        _count: { investments: 5 },
      },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    // Investor fields
    expect(json.investor.id).toBe("inv-1");
    expect(json.investor.entityName).toBe("Acme LLC");
    expect(json.investor.ndaSigned).toBe(true);
    expect(json.investor.accreditationStatus).toBe("SELF_CERTIFIED");
    expect(json.investor.totalCommitment).toBe(100000);
    expect(json.investor.totalFunded).toBe(50000);
  });

  it("returns capital call data", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(buildMockUser());

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.capitalCalls).toHaveLength(1);
    expect(json.capitalCalls[0].callNumber).toBe(1);
    expect(json.capitalCalls[0].amount).toBe("25000");
    expect(json.capitalCalls[0].status).toBe("PENDING");
    expect(json.capitalCalls[0].fundName).toBe("Fund I");
  });

  it("returns gate progress", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(buildMockUser());

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.gateProgress.ndaCompleted).toBe(true);
    expect(json.gateProgress.accreditationCompleted).toBe(true);
    expect(json.gateProgress.completionPercentage).toBe(100);
  });

  it("returns 50% gate progress when only NDA signed", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(
      buildMockUser({
        ndaSigned: true,
        accreditationAcks: [],
      }),
    );

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.gateProgress.ndaCompleted).toBe(true);
    expect(json.gateProgress.accreditationCompleted).toBe(false);
    expect(json.gateProgress.completionPercentage).toBe(50);
  });

  it("returns KYC status from raw query", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(buildMockUser());
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      {
        personaStatus: "COMPLETED",
        personaVerifiedAt: new Date("2026-02-01"),
      },
    ]);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.investor.kycStatus).toBe("COMPLETED");
    expect(json.investor.kycVerifiedAt).toBeDefined();
  });

  it("returns fund aggregates for invested funds", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(buildMockUser());
    (prisma.fund.findMany as jest.Mock).mockResolvedValue([
      {
        id: "fund-1",
        name: "Fund I",
        targetRaise: { toString: () => "1000000" },
        currentRaise: { toString: () => "500000" },
        status: "OPEN",
        _count: { investments: 5 },
      },
    ]);

    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.fundAggregates).toHaveLength(1);
    expect(json.fundAggregates[0].name).toBe("Fund I");
    expect(json.fundAggregates[0].targetRaise).toBe("1000000");
    expect(json.fundAggregates[0].investorCount).toBe(5);
  });

  it("handles investor with no investments", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(
      buildMockUser({
        investments: [],
        capitalCalls: [],
        accreditationAcks: [],
      }),
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.investor.totalCommitment).toBe(0);
    expect(json.investor.totalFunded).toBe(0);
    expect(json.capitalCalls).toEqual([]);
    expect(json.ndaGateEnabled).toBe(true); // default when no investments
  });

  it("returns ndaGateEnabled = false when fund disables it", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(
      buildMockUser({
        investments: [
          {
            id: "inv-1",
            fundId: "fund-1",
            commitmentAmount: { toString: () => "50000" },
            fundedAmount: { toString: () => "0" },
            fund: { name: "Fund I", ndaGateEnabled: false },
          },
        ],
      }),
    );

    const res = await GET(makeRequest());
    const json = await res.json();
    expect(json.ndaGateEnabled).toBe(false);
  });

  it("returns 500 on unexpected error", async () => {
    (prisma.user.findUnique as jest.Mock).mockRejectedValue(
      new Error("DB error"),
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
  });
});
