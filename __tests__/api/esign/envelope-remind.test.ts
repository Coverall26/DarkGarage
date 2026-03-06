/**
 * Tests for POST /api/esign/envelopes/[id]/remind
 *
 * Sends reminder to pending signers on an envelope.
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

const mockSendReminder = jest.fn();
jest.mock("@/lib/esign/envelope-service", () => ({
  sendReminder: (...args: unknown[]) => mockSendReminder(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let POST: typeof import("@/app/api/esign/envelopes/[id]/remind/route").POST;

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
    "http://localhost:5000/api/esign/envelopes/env-1/remind",
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

  const mod = await import("@/app/api/esign/envelopes/[id]/remind/route");
  POST = mod.POST;
});

// ============================================================================
// Tests
// ============================================================================

describe("POST /api/esign/envelopes/[id]/remind", () => {
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

  it("sends reminder on success", async () => {
    const result = { remindersSent: 2 };
    mockSendReminder.mockResolvedValue(result);

    const res = await POST(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.remindersSent).toBe(2);
    expect(mockSendReminder).toHaveBeenCalledWith("env-1", "user-1", undefined);
  });

  it("passes recipientId to sendReminder when provided", async () => {
    mockSendReminder.mockResolvedValue({ remindersSent: 1 });

    const res = await POST(
      makeRequest({ recipientId: "r-5" }) as any,
      makeParams("env-1")
    );
    expect(res.status).toBe(200);
    expect(mockSendReminder).toHaveBeenCalledWith("env-1", "user-1", "r-5");
  });

  it("returns 400 when sendReminder throws 'Cannot send'", async () => {
    mockSendReminder.mockRejectedValue(
      new Error("Cannot send reminder: envelope is COMPLETED")
    );

    const res = await POST(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Cannot send");
  });

  it("returns 500 on unexpected error", async () => {
    mockSendReminder.mockRejectedValue(new Error("Database failure"));

    const res = await POST(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});
