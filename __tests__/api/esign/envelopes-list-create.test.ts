/**
 * Tests for /api/esign/envelopes — GET (list) + POST (create)
 *
 * GET: Lists envelopes for the authenticated user's team with pagination and status counts.
 * POST: Creates a new standalone e-signature envelope with recipients.
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

const mockCreateEnvelope = jest.fn();
jest.mock("@/lib/esign/envelope-service", () => ({
  createEnvelope: (...args: unknown[]) => mockCreateEnvelope(...args),
}));

jest.mock("@/lib/auth/paywall", () => ({
  requireFundroomActive: jest.fn().mockResolvedValue(true),
  PAYWALL_ERROR: { error: "This feature requires a FundRoom subscription." },
}));

jest.mock("@/lib/esig/usage-service", () => ({
  recordDocumentCreated: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let GET: typeof import("@/app/api/esign/envelopes/route").GET;
let POST: typeof import("@/app/api/esign/envelopes/route").POST;

const mockSession = {
  userId: "user-1",
  email: "gp@fundroom.ai",
  teamId: "",
  role: "MEMBER",
  session: { user: { id: "user-1", email: "gp@fundroom.ai" } },
};

const mockTeam = { teamId: "team-1" };

function makeGetRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:5000/api/esign/envelopes");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url);
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:5000/api/esign/envelopes", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  jest.clearAllMocks();
  mockRequireAuthAppRouter.mockResolvedValue(mockSession);
  (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(mockTeam);
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1" });

  const mod = await import("@/app/api/esign/envelopes/route");
  GET = mod.GET;
  POST = mod.POST;
});

// ============================================================================
// GET /api/esign/envelopes
// ============================================================================

describe("GET /api/esign/envelopes", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuthAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no active team", async () => {
    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("No active team");
  });

  it("returns paginated envelopes on success", async () => {
    const mockEnvelopes = [
      {
        id: "env-1",
        title: "Contract A",
        status: "DRAFT",
        createdAt: new Date().toISOString(),
        recipients: [],
        createdBy: { name: "GP Admin", email: "gp@fundroom.ai" },
      },
    ];

    (prisma.envelope.findMany as jest.Mock).mockResolvedValue(mockEnvelopes);
    (prisma.envelope.count as jest.Mock).mockResolvedValue(1);
    (prisma.envelope.groupBy as jest.Mock).mockResolvedValue([
      { status: "DRAFT", _count: { id: 1 } },
    ]);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.envelopes).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(20);
    expect(data.totalPages).toBe(1);
    expect(data.statusCounts).toEqual({ DRAFT: 1 });
  });

  it("respects pagination params", async () => {
    (prisma.envelope.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.envelope.count as jest.Mock).mockResolvedValue(0);
    (prisma.envelope.groupBy as jest.Mock).mockResolvedValue([]);

    const res = await GET(makeGetRequest({ page: "2", pageSize: "5" }));
    expect(res.status).toBe(200);

    expect(prisma.envelope.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 })
    );
  });

  it("caps pageSize at 100", async () => {
    (prisma.envelope.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.envelope.count as jest.Mock).mockResolvedValue(0);
    (prisma.envelope.groupBy as jest.Mock).mockResolvedValue([]);

    const res = await GET(makeGetRequest({ pageSize: "500" }));
    expect(res.status).toBe(200);

    expect(prisma.envelope.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });

  it("filters by status when param provided", async () => {
    (prisma.envelope.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.envelope.count as jest.Mock).mockResolvedValue(0);
    (prisma.envelope.groupBy as jest.Mock).mockResolvedValue([]);

    await GET(makeGetRequest({ status: "SENT" }));

    expect(prisma.envelope.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamId: "team-1", status: "SENT" },
      })
    );
  });

  it("returns 500 on internal error", async () => {
    (prisma.userTeam.findFirst as jest.Mock).mockRejectedValue(
      new Error("DB error")
    );

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});

// ============================================================================
// POST /api/esign/envelopes
// ============================================================================

describe("POST /api/esign/envelopes", () => {
  const validBody = {
    title: "NDA Agreement",
    recipients: [
      { name: "John Doe", email: "john@example.com", role: "SIGNER" },
    ],
    signingMode: "SEQUENTIAL",
  };

  it("returns 401 when not authenticated", async () => {
    mockRequireAuthAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 404 when user not found in DB", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("User not found");
  });

  it("returns 403 when user has no active team", async () => {
    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("No active team");
  });

  it("returns 402 when paywall check fails", async () => {
    const { requireFundroomActive } = jest.requireMock("@/lib/auth/paywall");
    requireFundroomActive.mockResolvedValueOnce(false);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.error).toContain("FundRoom subscription");
  });

  it("returns 400 when title is missing", async () => {
    const res = await POST(
      makePostRequest({ recipients: validBody.recipients })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Title is required");
  });

  it("returns 400 when recipients array is empty", async () => {
    const res = await POST(makePostRequest({ title: "NDA", recipients: [] }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("At least one recipient is required");
  });

  it("returns 400 when recipients is not an array", async () => {
    const res = await POST(
      makePostRequest({ title: "NDA", recipients: "not-array" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("At least one recipient is required");
  });

  it("returns 400 when recipient has no name", async () => {
    const res = await POST(
      makePostRequest({
        title: "NDA",
        recipients: [{ email: "john@example.com" }],
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Each recipient must have a name and email");
  });

  it("returns 400 when recipient has invalid email", async () => {
    const res = await POST(
      makePostRequest({
        title: "NDA",
        recipients: [{ name: "John", email: "not-an-email" }],
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid email address");
  });

  it("returns 400 for invalid signing mode", async () => {
    const res = await POST(
      makePostRequest({ ...validBody, signingMode: "INVALID_MODE" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid signing mode");
  });

  it("returns 400 when expiresAt is in the past", async () => {
    const res = await POST(
      makePostRequest({ ...validBody, expiresAt: "2020-01-01T00:00:00Z" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Expiration date must be in the future");
  });

  it("returns 400 when expiresAt is invalid date", async () => {
    const res = await POST(
      makePostRequest({ ...validBody, expiresAt: "not-a-date" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Expiration date must be in the future");
  });

  it("creates envelope on success (201)", async () => {
    const mockEnvelope = {
      id: "env-1",
      title: "NDA Agreement",
      status: "DRAFT",
      recipients: [
        { id: "r-1", name: "John Doe", email: "john@example.com" },
      ],
    };
    mockCreateEnvelope.mockResolvedValue(mockEnvelope);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.id).toBe("env-1");
    expect(data.title).toBe("NDA Agreement");

    expect(mockCreateEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        createdById: "user-1",
        title: "NDA Agreement",
        signingMode: "SEQUENTIAL",
      })
    );
  });

  it("defaults signingMode to SEQUENTIAL", async () => {
    mockCreateEnvelope.mockResolvedValue({ id: "env-1", status: "DRAFT" });

    await POST(
      makePostRequest({
        title: "NDA",
        recipients: [{ name: "Jane", email: "jane@example.com" }],
      })
    );

    expect(mockCreateEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({ signingMode: "SEQUENTIAL" })
    );
  });

  it("returns 400 when createEnvelope throws with SIGNER message", async () => {
    mockCreateEnvelope.mockRejectedValue(
      new Error("SIGNER role is required")
    );

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("SIGNER");
  });

  it("returns 500 on unexpected error", async () => {
    mockCreateEnvelope.mockRejectedValue(new Error("Database failure"));

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});
