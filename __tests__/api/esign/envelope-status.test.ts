/**
 * Tests for GET /api/esign/envelopes/[id]/status
 *
 * Returns signing progress for an envelope: current group, signed count,
 * waiting groups (for sequential/mixed mode).
 */

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth/auth-options", () => ({
  authOptions: {},
}));

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterRateLimit: jest.fn().mockResolvedValue(null),
}));

const mockGetSigningStatus = jest.fn();
jest.mock("@/lib/esign/signing-session", () => ({
  getSigningStatus: (...args: unknown[]) => mockGetSigningStatus(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let GET: typeof import("@/app/api/esign/envelopes/[id]/status/route").GET;

const mockSessionData = {
  user: { id: "user-1", email: "gp@fundroom.ai", name: "GP Admin" },
  expires: "2099-01-01",
};

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(): Request {
  return new Request(
    "http://localhost:5000/api/esign/envelopes/env-1/status",
    { method: "GET" }
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  jest.clearAllMocks();
  (getServerSession as jest.Mock).mockResolvedValue(mockSessionData);
  (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
    teamId: "team-1",
  });
  (prisma.envelope.findUnique as jest.Mock).mockResolvedValue({
    id: "env-1",
    teamId: "team-1",
  });

  const mod = await import(
    "@/app/api/esign/envelopes/[id]/status/route"
  );
  GET = mod.GET;
});

// ============================================================================
// Tests
// ============================================================================

describe("GET /api/esign/envelopes/[id]/status", () => {
  it("returns 401 when not authenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const res = await GET(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no active team", async () => {
    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await GET(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("No active team");
  });

  it("returns 404 when envelope not found", async () => {
    (prisma.envelope.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await GET(makeRequest() as any, makeParams("env-404"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Envelope not found");
  });

  it("returns 403 when envelope belongs to different team", async () => {
    (prisma.envelope.findUnique as jest.Mock).mockResolvedValue({
      id: "env-1",
      teamId: "other-team",
    });

    const res = await GET(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Access denied");
  });

  it("returns signing status on success", async () => {
    const statusData = {
      signingMode: "SEQUENTIAL",
      totalSigners: 3,
      signedCount: 1,
      currentGroup: 2,
      waitingGroups: [3],
      isComplete: false,
    };
    mockGetSigningStatus.mockResolvedValue(statusData);

    const res = await GET(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.signingMode).toBe("SEQUENTIAL");
    expect(data.totalSigners).toBe(3);
    expect(data.signedCount).toBe(1);
    expect(data.isComplete).toBe(false);
    expect(mockGetSigningStatus).toHaveBeenCalledWith("env-1");
  });

  it("returns 500 on internal error", async () => {
    mockGetSigningStatus.mockRejectedValue(new Error("Database failure"));

    const res = await GET(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});
