/**
 * Tests for POST /api/esign/envelopes/[id]/send
 *
 * Transitions envelope from DRAFT/PREPARING to SENT and sends signing emails.
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

const mockSendEnvelope = jest.fn();
jest.mock("@/lib/esign/envelope-service", () => ({
  sendEnvelope: (...args: unknown[]) => mockSendEnvelope(...args),
}));

jest.mock("@/lib/auth/paywall", () => ({
  requireFundroomActive: jest.fn().mockResolvedValue(true),
  PAYWALL_ERROR: { error: "This feature requires a FundRoom subscription." },
}));

jest.mock("@/lib/esig/usage-service", () => ({
  recordDocumentSent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/emails/send-esign-notifications", () => ({
  sendSigningInvitationEmail: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let POST: typeof import("@/app/api/esign/envelopes/[id]/send/route").POST;

const mockSessionData = {
  user: { id: "user-1", email: "gp@fundroom.ai", name: "GP Admin" },
  expires: "2099-01-01",
};

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(): Request {
  return new Request("http://localhost:5000/api/esign/envelopes/env-1/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
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

  const mod = await import("@/app/api/esign/envelopes/[id]/send/route");
  POST = mod.POST;
});

// ============================================================================
// Tests
// ============================================================================

describe("POST /api/esign/envelopes/[id]/send", () => {
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

  it("returns 402 when paywall check fails", async () => {
    const { requireFundroomActive } = jest.requireMock("@/lib/auth/paywall");
    requireFundroomActive.mockResolvedValueOnce(false);

    const res = await POST(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(402);
  });

  it("sends envelope on success", async () => {
    const sentEnvelope = {
      id: "env-1",
      status: "SENT",
      recipients: [
        {
          id: "r-1",
          status: "SENT",
          role: "SIGNER",
          email: "john@example.com",
        },
      ],
    };
    mockSendEnvelope.mockResolvedValue(sentEnvelope);

    const res = await POST(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("SENT");
    expect(mockSendEnvelope).toHaveBeenCalledWith("env-1", "user-1");
  });

  it("returns 400 when sendEnvelope throws 'Cannot send'", async () => {
    mockSendEnvelope.mockRejectedValue(
      new Error("Cannot send envelope: not in DRAFT status")
    );

    const res = await POST(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Cannot send");
  });

  it("returns 400 when sendEnvelope throws 'No signers'", async () => {
    mockSendEnvelope.mockRejectedValue(
      new Error("No signers found on envelope")
    );

    const res = await POST(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("No signers");
  });

  it("returns 500 on unexpected error", async () => {
    mockSendEnvelope.mockRejectedValue(new Error("Database failure"));

    const res = await POST(makeRequest() as any, makeParams("env-1"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});
