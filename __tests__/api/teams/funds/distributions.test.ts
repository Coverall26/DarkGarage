/**
 * Distributions API Tests
 *
 * Tests for 3 App Router route files:
 *
 *   1. GET  /api/teams/[teamId]/funds/[fundId]/distributions           — List distributions
 *      POST /api/teams/[teamId]/funds/[fundId]/distributions           — Create distribution
 *
 *   2. GET    /api/teams/[teamId]/funds/[fundId]/distributions/[distributionId]  — Detail
 *      PATCH  /api/teams/[teamId]/funds/[fundId]/distributions/[distributionId]  — Update
 *      DELETE /api/teams/[teamId]/funds/[fundId]/distributions/[distributionId]  — Delete
 *
 *   3. POST /api/teams/[teamId]/funds/[fundId]/distributions/[distributionId]/execute — Execute
 *
 * Validates: auth (401), authorization (403), input validation (400),
 * not-found (404), happy paths (200/201), status transitions, and audit logging.
 */

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mock function declarations — BEFORE jest.mock() calls
// ---------------------------------------------------------------------------

const mockRequireAdminAppRouter = jest.fn();
const mockAppRouterRateLimit = jest.fn().mockResolvedValue(null);
const mockReportError = jest.fn();
const mockLogAuditEvent = jest.fn().mockResolvedValue(undefined);

// ---------------------------------------------------------------------------
// jest.mock() calls — wrapper pattern
// ---------------------------------------------------------------------------

jest.mock("@/lib/auth/rbac", () => ({
  requireAdminAppRouter: (...args: unknown[]) =>
    mockRequireAdminAppRouter(...args),
}));

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterRateLimit: (...args: unknown[]) =>
    mockAppRouterRateLimit(...args),
}));

jest.mock("@/lib/error", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

jest.mock("@/lib/audit/audit-logger", () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Route imports — AFTER jest.mock()
// ---------------------------------------------------------------------------

import {
  GET as listDistributions,
  POST as createDistribution,
} from "@/app/api/teams/[teamId]/funds/[fundId]/distributions/route";

import {
  GET as getDistribution,
  PATCH as updateDistribution,
  DELETE as deleteDistribution,
} from "@/app/api/teams/[teamId]/funds/[fundId]/distributions/[distributionId]/route";

import { POST as executeDistribution } from "@/app/api/teams/[teamId]/funds/[fundId]/distributions/[distributionId]/execute/route";

import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEAM_ID = "team-d1";
const FUND_ID = "fund-d1";
const DIST_ID = "dist-d1";
const USER_ID = "user-d1";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decimal(val: number) {
  return {
    toNumber: () => val,
    toString: () => String(val),
  };
}

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

function detailCtx() {
  return {
    params: Promise.resolve({
      teamId: TEAM_ID,
      fundId: FUND_ID,
      distributionId: DIST_ID,
    }),
  };
}

function mockAuth(teamId = TEAM_ID) {
  mockRequireAdminAppRouter.mockResolvedValue({
    userId: USER_ID,
    teamId,
  });
}

function mockNoAuth() {
  mockRequireAdminAppRouter.mockResolvedValue(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  );
}

function mockFundExists() {
  (prisma.fund.findFirst as jest.Mock).mockResolvedValue({
    id: FUND_ID,
    teamId: TEAM_ID,
    name: "Test Fund I",
  });
}

function makeMockDistribution(overrides = {}) {
  return {
    id: DIST_ID,
    fundId: FUND_ID,
    teamId: TEAM_ID,
    distributionNumber: 1,
    totalAmount: decimal(500000),
    distributionType: "DIVIDEND",
    distributionDate: new Date("2026-06-01"),
    status: "DRAFT",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Distributions API", () => {
  const BASE_URL = `http://localhost:3000/api/teams/${TEAM_ID}/funds/${FUND_ID}/distributions`;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppRouterRateLimit.mockResolvedValue(null);
  });

  // =========================================================================
  // GET /api/teams/[teamId]/funds/[fundId]/distributions
  // =========================================================================

  describe("GET /distributions (list)", () => {
    it("returns 401 when not authenticated", async () => {
      mockNoAuth();
      const res = await listDistributions(makeReq(BASE_URL, "GET"), listCtx());
      expect(res.status).toBe(401);
    });

    it("returns 403 when teamId mismatch", async () => {
      mockAuth("other-team");
      const res = await listDistributions(makeReq(BASE_URL, "GET"), listCtx());
      expect(res.status).toBe(403);
    });

    it("returns 404 when fund not found", async () => {
      mockAuth();
      (prisma.fund.findFirst as jest.Mock).mockResolvedValue(null);
      const res = await listDistributions(makeReq(BASE_URL, "GET"), listCtx());
      expect(res.status).toBe(404);
    });

    it("returns empty list when no distributions", async () => {
      mockAuth();
      mockFundExists();
      (prisma.distribution.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.distribution.count as jest.Mock).mockResolvedValue(0);

      const res = await listDistributions(makeReq(BASE_URL, "GET"), listCtx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.distributions).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });

    it("returns distributions with Decimal serialized to string", async () => {
      mockAuth();
      mockFundExists();
      const mockDist = makeMockDistribution();
      (prisma.distribution.findMany as jest.Mock).mockResolvedValue([mockDist]);
      (prisma.distribution.count as jest.Mock).mockResolvedValue(1);

      const res = await listDistributions(makeReq(BASE_URL, "GET"), listCtx());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.distributions).toHaveLength(1);
      expect(body.distributions[0].totalAmount).toBe("500000");
    });

    it("passes status filter to query", async () => {
      mockAuth();
      mockFundExists();
      (prisma.distribution.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.distribution.count as jest.Mock).mockResolvedValue(0);

      const url = `${BASE_URL}?status=DRAFT`;
      const res = await listDistributions(makeReq(url, "GET"), listCtx());
      expect(res.status).toBe(200);
      expect(prisma.distribution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "DRAFT" }),
        }),
      );
    });
  });

  // =========================================================================
  // POST /api/teams/[teamId]/funds/[fundId]/distributions
  // =========================================================================

  describe("POST /distributions (create)", () => {
    const validBody = {
      totalAmount: 500000,
      distributionType: "DIVIDEND",
      distributionDate: "2026-06-01",
    };

    it("returns 401 when not authenticated", async () => {
      mockNoAuth();
      const res = await createDistribution(
        makeReq(BASE_URL, "POST", validBody),
        listCtx(),
      );
      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid amount", async () => {
      mockAuth();
      mockFundExists();
      const res = await createDistribution(
        makeReq(BASE_URL, "POST", { ...validBody, totalAmount: 0 }),
        listCtx(),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Amount");
    });

    it("returns 400 for invalid distribution type", async () => {
      mockAuth();
      mockFundExists();
      const res = await createDistribution(
        makeReq(BASE_URL, "POST", {
          ...validBody,
          distributionType: "INVALID",
        }),
        listCtx(),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 for missing distribution date", async () => {
      mockAuth();
      mockFundExists();
      const res = await createDistribution(
        makeReq(BASE_URL, "POST", {
          totalAmount: 500000,
          distributionType: "DIVIDEND",
        }),
        listCtx(),
      );
      expect(res.status).toBe(400);
    });

    it("creates distribution in DRAFT status with auto-incremented number", async () => {
      mockAuth();
      mockFundExists();
      (prisma.distribution.findFirst as jest.Mock).mockResolvedValue({
        distributionNumber: 3,
      });
      const created = makeMockDistribution({ distributionNumber: 4 });
      (prisma.distribution.create as jest.Mock).mockResolvedValue(created);

      const res = await createDistribution(
        makeReq(BASE_URL, "POST", validBody),
        listCtx(),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.totalAmount).toBe("500000");

      expect(prisma.distribution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "DRAFT",
            distributionNumber: 4,
            fundId: FUND_ID,
            teamId: TEAM_ID,
          }),
        }),
      );
    });

    it("logs audit event on creation", async () => {
      mockAuth();
      mockFundExists();
      (prisma.distribution.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.distribution.create as jest.Mock).mockResolvedValue(
        makeMockDistribution(),
      );

      await createDistribution(
        makeReq(BASE_URL, "POST", validBody),
        listCtx(),
      );

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "DISTRIBUTION_CREATED",
          resourceType: "Distribution",
        }),
      );
    });
  });

  // =========================================================================
  // GET /api/teams/[teamId]/funds/[fundId]/distributions/[distributionId]
  // =========================================================================

  describe("GET /distributions/[id] (detail)", () => {
    it("returns 404 when distribution not found", async () => {
      mockAuth();
      (prisma.distribution.findFirst as jest.Mock).mockResolvedValue(null);

      const res = await getDistribution(
        makeReq(`${BASE_URL}/${DIST_ID}`, "GET"),
        detailCtx(),
      );
      expect(res.status).toBe(404);
    });

    it("returns distribution with serialized amount", async () => {
      mockAuth();
      (prisma.distribution.findFirst as jest.Mock).mockResolvedValue(
        makeMockDistribution(),
      );

      const res = await getDistribution(
        makeReq(`${BASE_URL}/${DIST_ID}`, "GET"),
        detailCtx(),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.totalAmount).toBe("500000");
    });
  });

  // =========================================================================
  // PATCH /api/teams/[teamId]/funds/[fundId]/distributions/[distributionId]
  // =========================================================================

  describe("PATCH /distributions/[id] (update)", () => {
    it("returns 400 when distribution is not DRAFT", async () => {
      mockAuth();
      (prisma.distribution.findFirst as jest.Mock).mockResolvedValue(
        makeMockDistribution({ status: "PENDING" }),
      );

      const res = await updateDistribution(
        makeReq(`${BASE_URL}/${DIST_ID}`, "PATCH", { totalAmount: 600000 }),
        detailCtx(),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("DRAFT");
    });

    it("validates status transitions", async () => {
      mockAuth();
      (prisma.distribution.findFirst as jest.Mock).mockResolvedValue(
        makeMockDistribution({ status: "DRAFT" }),
      );

      // DRAFT → DISTRIBUTED is not allowed
      const res = await updateDistribution(
        makeReq(`${BASE_URL}/${DIST_ID}`, "PATCH", { status: "DISTRIBUTED" }),
        detailCtx(),
      );
      expect(res.status).toBe(400);
    });

    it("allows valid status transition DRAFT → PENDING", async () => {
      mockAuth();
      const draft = makeMockDistribution({ status: "DRAFT" });
      (prisma.distribution.findFirst as jest.Mock).mockResolvedValue(draft);
      (prisma.distribution.update as jest.Mock).mockResolvedValue({
        ...draft,
        status: "PENDING",
      });

      const res = await updateDistribution(
        makeReq(`${BASE_URL}/${DIST_ID}`, "PATCH", { status: "PENDING" }),
        detailCtx(),
      );
      expect(res.status).toBe(200);
    });

    it("updates amount and type on DRAFT distribution", async () => {
      mockAuth();
      const draft = makeMockDistribution();
      (prisma.distribution.findFirst as jest.Mock).mockResolvedValue(draft);
      (prisma.distribution.update as jest.Mock).mockResolvedValue({
        ...draft,
        totalAmount: decimal(750000),
        distributionType: "INTEREST",
      });

      const res = await updateDistribution(
        makeReq(`${BASE_URL}/${DIST_ID}`, "PATCH", {
          totalAmount: 750000,
          distributionType: "INTEREST",
        }),
        detailCtx(),
      );
      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // DELETE /api/teams/[teamId]/funds/[fundId]/distributions/[distributionId]
  // =========================================================================

  describe("DELETE /distributions/[id]", () => {
    it("returns 400 when distribution is not DRAFT", async () => {
      mockAuth();
      (prisma.distribution.findFirst as jest.Mock).mockResolvedValue(
        makeMockDistribution({ status: "APPROVED" }),
      );

      const res = await deleteDistribution(
        makeReq(`${BASE_URL}/${DIST_ID}`, "DELETE"),
        detailCtx(),
      );
      expect(res.status).toBe(400);
    });

    it("deletes DRAFT distribution", async () => {
      mockAuth();
      (prisma.distribution.findFirst as jest.Mock).mockResolvedValue(
        makeMockDistribution({ status: "DRAFT" }),
      );
      (prisma.distribution.delete as jest.Mock).mockResolvedValue({});

      const res = await deleteDistribution(
        makeReq(`${BASE_URL}/${DIST_ID}`, "DELETE"),
        detailCtx(),
      );
      expect(res.status).toBe(200);
      expect(prisma.distribution.delete).toHaveBeenCalledWith({
        where: { id: DIST_ID },
      });
    });

    it("logs audit event on deletion", async () => {
      mockAuth();
      (prisma.distribution.findFirst as jest.Mock).mockResolvedValue(
        makeMockDistribution({ status: "DRAFT" }),
      );
      (prisma.distribution.delete as jest.Mock).mockResolvedValue({});

      await deleteDistribution(
        makeReq(`${BASE_URL}/${DIST_ID}`, "DELETE"),
        detailCtx(),
      );

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "DISTRIBUTION_DELETED",
          resourceType: "Distribution",
        }),
      );
    });
  });

  // =========================================================================
  // POST /api/teams/[teamId]/funds/[fundId]/distributions/[distributionId]/execute
  // =========================================================================

  describe("POST /distributions/[id]/execute", () => {
    it("returns 400 when distribution is not APPROVED", async () => {
      mockAuth();
      (prisma.distribution.findFirst as jest.Mock).mockResolvedValue(
        makeMockDistribution({ status: "DRAFT" }),
      );

      const res = await executeDistribution(
        makeReq(`${BASE_URL}/${DIST_ID}/execute`, "POST"),
        detailCtx(),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("APPROVED");
    });

    it("executes APPROVED distribution atomically", async () => {
      mockAuth();
      const approved = makeMockDistribution({ status: "APPROVED" });
      (prisma.distribution.findFirst as jest.Mock).mockResolvedValue(approved);

      const executed = { ...approved, status: "DISTRIBUTED" };
      (prisma.$transaction as jest.Mock).mockResolvedValue([executed, {}]);

      const res = await executeDistribution(
        makeReq(`${BASE_URL}/${DIST_ID}/execute`, "POST"),
        detailCtx(),
      );
      expect(res.status).toBe(200);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("logs audit event on execution", async () => {
      mockAuth();
      const approved = makeMockDistribution({ status: "APPROVED" });
      (prisma.distribution.findFirst as jest.Mock).mockResolvedValue(approved);
      (prisma.$transaction as jest.Mock).mockResolvedValue([
        { ...approved, status: "DISTRIBUTED", totalAmount: decimal(500000) },
        {},
      ]);

      await executeDistribution(
        makeReq(`${BASE_URL}/${DIST_ID}/execute`, "POST"),
        detailCtx(),
      );

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "DISTRIBUTION_COMPLETED",
          resourceType: "Distribution",
        }),
      );
    });
  });
});
