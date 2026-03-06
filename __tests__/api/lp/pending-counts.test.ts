/**
 * Tests for GET /api/lp/pending-counts
 *
 * Returns pending document and signature counts for the authenticated LP.
 * Used by LP Bottom Tab Bar for badge indicators.
 * Tests: auth, parallel queries, count responses, error handling.
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

import { GET } from "@/app/api/lp/pending-counts/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest() {
  return new NextRequest("http://localhost/api/lp/pending-counts", {
    method: "GET",
  });
}

const AUTH_RESULT = {
  userId: "user-1",
  email: "lp@example.com",
  investorId: "inv-1",
  session: { user: { id: "user-1", email: "lp@example.com" } },
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/lp/pending-counts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireLPAuthAppRouter.mockResolvedValue(AUTH_RESULT);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireLPAuthAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns pending counts for authenticated LP", async () => {
    (prisma.signatureRecipient.count as jest.Mock).mockResolvedValue(3);
    (prisma.lPDocument.count as jest.Mock).mockResolvedValue(1);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.pendingSignatures).toBe(3);
    expect(json.pendingDocs).toBe(1);
  });

  it("returns zero counts when no pending items", async () => {
    (prisma.signatureRecipient.count as jest.Mock).mockResolvedValue(0);
    (prisma.lPDocument.count as jest.Mock).mockResolvedValue(0);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.pendingSignatures).toBe(0);
    expect(json.pendingDocs).toBe(0);
  });

  it("queries signature recipients by LP email", async () => {
    (prisma.signatureRecipient.count as jest.Mock).mockResolvedValue(0);
    (prisma.lPDocument.count as jest.Mock).mockResolvedValue(0);

    await GET(makeRequest());

    expect(prisma.signatureRecipient.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: "lp@example.com",
          status: { in: ["PENDING", "SENT", "VIEWED"] },
          role: "SIGNER",
        }),
      }),
    );
  });

  it("queries LP documents with REVISION_REQUESTED status", async () => {
    (prisma.signatureRecipient.count as jest.Mock).mockResolvedValue(0);
    (prisma.lPDocument.count as jest.Mock).mockResolvedValue(0);

    await GET(makeRequest());

    expect(prisma.lPDocument.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          investor: {
            user: { email: "lp@example.com" },
          },
          status: "REVISION_REQUESTED",
        }),
      }),
    );
  });

  it("runs both counts in parallel", async () => {
    // Both queries should be called regardless of each other's result
    (prisma.signatureRecipient.count as jest.Mock).mockResolvedValue(5);
    (prisma.lPDocument.count as jest.Mock).mockResolvedValue(2);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    // Both mocks should have been called exactly once
    expect(prisma.signatureRecipient.count).toHaveBeenCalledTimes(1);
    expect(prisma.lPDocument.count).toHaveBeenCalledTimes(1);
  });

  it("returns 500 on unexpected error", async () => {
    (prisma.signatureRecipient.count as jest.Mock).mockRejectedValue(
      new Error("DB failure"),
    );
    (prisma.lPDocument.count as jest.Mock).mockResolvedValue(0);

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
  });
});
