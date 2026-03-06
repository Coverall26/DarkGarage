/**
 * Tests for POST /api/esign/envelopes/[id]/void
 *
 * GP voids (cancels) an in-flight envelope.
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

const mockVoidEnvelope = jest.fn();
jest.mock("@/lib/esign/envelope-service", () => ({
  voidEnvelope: (...args: unknown[]) => mockVoidEnvelope(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let POST: typeof import("@/app/api/esign/envelopes/[id]/void/route").POST;

const mockSessionData = {
  user: { id: "user-1", email: "gp@fundroom.ai", name: "GP Admin" },
  expires: "2099-01-01",
};

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(body?: unknown): Request {
  const options: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  return new Request(
    "http://localhost:5000/api/esign/envelopes/env-1/void",
    options
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  jest.clearAllMocks();
  (getServerSession as jest.Mock).mockResolvedValue(mockSessionData);
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1" });
  (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
    teamId: "team-1",
  });
  (prisma.envelope.findUnique as jest.Mock).mockResolvedValue({
    id: "env-1",
    teamId: "team-1",
  });

  const mod = await import("@/app/api/esign/envelopes/[id]/void/route");
  POST = mod.POST;
});

// ============================================================================
// Tests
// ============================================================================

describe("POST /api/esign/envelopes/[id]/void", () => {
  it("returns 401 when not authenticated", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const res = await POST(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user has no active team", async () => {
    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await POST(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("No active team");
  });

  it("returns 404 when envelope not found", async () => {
    (prisma.envelope.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await POST(makeRequest() as any, makeParams("env-404"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Envelope not found");
  });

  it("returns 403 when envelope belongs to different team", async () => {
    (prisma.envelope.findUnique as jest.Mock).mockResolvedValue({
      id: "env-1",
      teamId: "other-team",
    });

    const res = await POST(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Access denied");
  });

  it("voids envelope on success", async () => {
    const voided = { id: "env-1", status: "VOIDED", voidedAt: new Date() };
    mockVoidEnvelope.mockResolvedValue(voided);

    const res = await POST(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(200);

    expect(mockVoidEnvelope).toHaveBeenCalledWith(
      "env-1",
      "user-1",
      undefined
    );
  });

  it("passes reason to voidEnvelope when provided", async () => {
    mockVoidEnvelope.mockResolvedValue({ id: "env-1", status: "VOIDED" });

    const res = await POST(
      makeRequest({ reason: "Sent to wrong person" }) as any,
      makeParams("env-1")
    );
    expect(res.status).toBe(200);
    expect(mockVoidEnvelope).toHaveBeenCalledWith(
      "env-1",
      "user-1",
      "Sent to wrong person"
    );
  });

  it("returns 400 when voidEnvelope throws 'Cannot void'", async () => {
    mockVoidEnvelope.mockRejectedValue(
      new Error("Cannot void: envelope already completed")
    );

    const res = await POST(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Cannot void");
  });

  it("returns 500 on unexpected error", async () => {
    mockVoidEnvelope.mockRejectedValue(new Error("Database failure"));

    const res = await POST(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});
