/**
 * Tests for GET /api/esign/filings
 *
 * Lists document filings with optional stats summary.
 * Supports filtering by sourceType, destinationType, envelopeId, contactVaultId.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRequireAuthAppRouter = jest.fn();
jest.mock("@/lib/auth/rbac", () => ({
  requireAuthAppRouter: (...args: unknown[]) =>
    mockRequireAuthAppRouter(...args),
}));

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterRateLimit: jest.fn().mockResolvedValue(null),
}));

const mockGetFilingHistory = jest.fn();
const mockGetFilingStats = jest.fn();
jest.mock("@/lib/esign/document-filing-service", () => ({
  getFilingHistory: (...args: unknown[]) => mockGetFilingHistory(...args),
  getFilingStats: (...args: unknown[]) => mockGetFilingStats(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let GET: typeof import("@/app/api/esign/filings/route").GET;

const mockSession = {
  userId: "user-1",
  email: "gp@fundroom.ai",
  teamId: "",
  role: "MEMBER",
  session: { user: { id: "user-1", email: "gp@fundroom.ai" } },
};

const mockTeam = { teamId: "team-1" };

function makeRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:5000/api/esign/filings");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  jest.clearAllMocks();
  mockRequireAuthAppRouter.mockResolvedValue(mockSession);
  (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(mockTeam);

  const mod = await import("@/app/api/esign/filings/route");
  GET = mod.GET;
});

// ============================================================================
// Tests
// ============================================================================

describe("GET /api/esign/filings", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuthAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no active team", async () => {
    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("No active team");
  });

  it("returns filing list on success", async () => {
    mockGetFilingHistory.mockResolvedValue({
      filings: [
        {
          id: "f-1",
          envelopeId: "env-1",
          sourceType: "ENVELOPE",
          destinationType: "ORG_VAULT",
          filedFileSize: BigInt(1024),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.filings).toHaveLength(1);
    expect(data.filings[0].filedFileSize).toBe(1024);
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(20);
  });

  it("passes filter params to getFilingHistory", async () => {
    mockGetFilingHistory.mockResolvedValue({
      filings: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    await GET(
      makeRequest({
        sourceType: "ENVELOPE",
        destinationType: "ORG_VAULT",
        envelopeId: "env-1",
        contactVaultId: "cv-1",
        page: "2",
        pageSize: "10",
      })
    );

    expect(mockGetFilingHistory).toHaveBeenCalledWith({
      teamId: "team-1",
      sourceType: "ENVELOPE",
      destinationType: "ORG_VAULT",
      envelopeId: "env-1",
      contactVaultId: "cv-1",
      page: 2,
      pageSize: 10,
    });
  });

  it("includes stats when stats=true", async () => {
    mockGetFilingHistory.mockResolvedValue({
      filings: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    mockGetFilingStats.mockResolvedValue({
      totalFilings: 42,
      byDestination: { ORG_VAULT: 20, CONTACT_VAULT: 15, EMAIL: 7 },
      bySource: { ENVELOPE: 42 },
      totalSizeBytes: BigInt(1048576),
    });

    const res = await GET(makeRequest({ stats: "true" }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.stats).toBeDefined();
    expect(data.stats.totalFilings).toBe(42);
    expect(data.stats.totalSizeBytes).toBe(1048576);
    expect(data.stats.byDestination.ORG_VAULT).toBe(20);
  });

  it("does not include stats when stats param is not 'true'", async () => {
    mockGetFilingHistory.mockResolvedValue({
      filings: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    const res = await GET(makeRequest({ stats: "false" }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.stats).toBeUndefined();
    expect(mockGetFilingStats).not.toHaveBeenCalled();
  });

  it("serializes BigInt filedFileSize to Number", async () => {
    mockGetFilingHistory.mockResolvedValue({
      filings: [
        { id: "f-1", filedFileSize: BigInt(9876543210) },
        { id: "f-2", filedFileSize: null },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.filings[0].filedFileSize).toBe(9876543210);
    expect(data.filings[1].filedFileSize).toBe(null);
  });

  it("returns 500 on internal error", async () => {
    mockGetFilingHistory.mockRejectedValue(new Error("Database failure"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});
