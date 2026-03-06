/**
 * Tests for GET /api/lp/docs
 *
 * Returns the authenticated LP's document vault with signed URLs.
 * Tests: auth, profile lookup, document listing, signed URL generation, error handling.
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

const mockGetFile = jest.fn();
jest.mock("@/lib/files/get-file", () => ({
  getFile: (...args: any[]) => mockGetFile(...args),
}));

// ── Import handler after mocks ─────────────────────────────────────────────

import { GET } from "@/app/api/lp/docs/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest() {
  return new NextRequest("http://localhost/api/lp/docs", {
    method: "GET",
  });
}

const AUTH_RESULT = {
  userId: "user-1",
  email: "lp@example.com",
  investorId: "inv-1",
  session: { user: { id: "user-1", email: "lp@example.com" } },
};

const MOCK_DOCUMENTS = [
  {
    id: "doc-1",
    title: "NDA",
    documentType: "NDA",
    storageType: "S3_PATH",
    storageKey: "docs/nda.pdf",
    signedAt: new Date("2026-01-15"),
    createdAt: new Date("2026-01-10"),
  },
  {
    id: "doc-2",
    title: "Sub Agreement",
    documentType: "SUBSCRIPTION_AGREEMENT",
    storageType: "VERCEL_BLOB",
    storageKey: "docs/sub-ag.pdf",
    signedAt: null,
    createdAt: new Date("2026-01-20"),
  },
];

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/lp/docs", () => {
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

  it("returns 404 when investor profile not found", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Investor profile not found");
  });

  it("returns 404 when user has no investor profile", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: null,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  it("returns documents with signed URLs", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: {
        id: "inv-1",
        documents: MOCK_DOCUMENTS,
      },
    });
    mockGetFile.mockResolvedValue("https://s3.example.com/signed-url");

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.documents).toHaveLength(2);
    expect(json.documents[0].id).toBe("doc-1");
    expect(json.documents[0].title).toBe("NDA");
    expect(json.documents[0].fileUrl).toBe(
      "https://s3.example.com/signed-url",
    );
    expect(json.documents[1].id).toBe("doc-2");
  });

  it("returns empty array when no documents", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: {
        id: "inv-1",
        documents: [],
      },
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.documents).toEqual([]);
  });

  it("handles file URL generation failure gracefully", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: {
        id: "inv-1",
        documents: [MOCK_DOCUMENTS[0]],
      },
    });
    mockGetFile.mockRejectedValue(new Error("S3 error"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const json = await res.json();

    // Document returned but with null fileUrl
    expect(json.documents).toHaveLength(1);
    expect(json.documents[0].fileUrl).toBeNull();
  });

  it("returns 500 on unexpected error", async () => {
    (prisma.user.findUnique as jest.Mock).mockRejectedValue(
      new Error("DB failure"),
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
  });
});
