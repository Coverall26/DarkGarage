/**
 * Tests for GET /api/lp/pending-signatures
 *
 * Returns pending signature documents for the authenticated LP.
 * Tests: auth, query behavior, response formatting, error handling.
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

import { GET } from "@/app/api/lp/pending-signatures/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest() {
  return new NextRequest("http://localhost/api/lp/pending-signatures", {
    method: "GET",
  });
}

const AUTH_RESULT = {
  userId: "user-1",
  email: "lp@example.com",
  investorId: "inv-1",
  session: { user: { id: "user-1", email: "lp@example.com" } },
};

const MOCK_SIGNATURE_RECIPIENTS = [
  {
    id: "sig-1",
    signingToken: "token-abc",
    status: "PENDING",
    createdAt: new Date("2026-02-10"),
    document: {
      id: "doc-1",
      title: "NDA Agreement",
      sentAt: new Date("2026-02-09"),
      expirationDate: new Date("2026-03-09"),
      team: { name: "Acme Capital" },
    },
  },
  {
    id: "sig-2",
    signingToken: "token-def",
    status: "VIEWED",
    createdAt: new Date("2026-02-12"),
    document: {
      id: "doc-2",
      title: "Subscription Agreement",
      sentAt: new Date("2026-02-11"),
      expirationDate: null,
      team: { name: "Acme Capital" },
    },
  },
];

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/lp/pending-signatures", () => {
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

  it("returns pending signatures for authenticated LP", async () => {
    (prisma.signatureRecipient.findMany as jest.Mock).mockResolvedValue(
      MOCK_SIGNATURE_RECIPIENTS,
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.pendingSignatures).toHaveLength(2);

    // Verify first signature formatting
    const sig1 = json.pendingSignatures[0];
    expect(sig1.id).toBe("sig-1");
    expect(sig1.documentId).toBe("doc-1");
    expect(sig1.documentTitle).toBe("NDA Agreement");
    expect(sig1.teamName).toBe("Acme Capital");
    expect(sig1.signingToken).toBe("token-abc");
    expect(sig1.status).toBe("PENDING");
    expect(sig1.sentAt).toBeDefined();
    expect(sig1.expirationDate).toBeDefined();

    // Verify second signature
    const sig2 = json.pendingSignatures[1];
    expect(sig2.documentTitle).toBe("Subscription Agreement");
    expect(sig2.status).toBe("VIEWED");
    expect(sig2.expirationDate).toBeNull();
  });

  it("returns empty array when no pending signatures", async () => {
    (prisma.signatureRecipient.findMany as jest.Mock).mockResolvedValue([]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.pendingSignatures).toEqual([]);
  });

  it("queries with correct filters", async () => {
    (prisma.signatureRecipient.findMany as jest.Mock).mockResolvedValue([]);

    await GET(makeRequest());

    expect(prisma.signatureRecipient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: "lp@example.com",
          status: { in: ["PENDING", "SENT", "VIEWED"] },
          role: "SIGNER",
          document: {
            status: { in: ["SENT", "VIEWED", "PARTIALLY_SIGNED"] },
          },
        }),
        include: expect.objectContaining({
          document: expect.objectContaining({
            select: expect.objectContaining({
              id: true,
              title: true,
              sentAt: true,
              expirationDate: true,
              team: { select: { name: true } },
            }),
          }),
        }),
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("orders results by createdAt desc", async () => {
    (prisma.signatureRecipient.findMany as jest.Mock).mockResolvedValue(
      MOCK_SIGNATURE_RECIPIENTS,
    );

    await GET(makeRequest());

    expect(prisma.signatureRecipient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("returns 500 on unexpected error", async () => {
    (prisma.signatureRecipient.findMany as jest.Mock).mockRejectedValue(
      new Error("DB failure"),
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
  });
});
