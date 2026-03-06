/**
 * Tests for POST /api/esign/envelopes/[id]/decline
 *
 * Called by signer (authenticated via signing token, not session).
 * Declines the envelope and notifies creator.
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterRateLimit: jest.fn().mockResolvedValue(null),
}));

const mockDeclineEnvelope = jest.fn();
jest.mock("@/lib/esign/envelope-service", () => ({
  declineEnvelope: (...args: unknown[]) => mockDeclineEnvelope(...args),
}));

jest.mock("@/lib/emails/send-esign-notifications", () => ({
  sendEnvelopeDeclinedEmails: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let POST: typeof import("@/app/api/esign/envelopes/[id]/decline/route").POST;

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(
    "http://localhost:5000/api/esign/envelopes/env-1/decline",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "1.2.3.4",
        "user-agent": "Test/1.0",
      },
    }
  );
}

const mockRecipient = {
  id: "r-1",
  envelopeId: "env-1",
  name: "John Doe",
  email: "john@example.com",
  signingToken: "valid-token",
  envelope: { id: "env-1", teamId: "team-1" },
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  jest.clearAllMocks();
  (prisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue(
    mockRecipient
  );

  const mod = await import(
    "@/app/api/esign/envelopes/[id]/decline/route"
  );
  POST = mod.POST;
});

// ============================================================================
// Tests
// ============================================================================

describe("POST /api/esign/envelopes/[id]/decline", () => {
  it("returns 400 when signingToken is missing", async () => {
    const res = await POST(
      makeRequest({ reason: "Changed my mind" }),
      makeParams("env-1")
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Signing token is required");
  });

  it("returns 404 when recipient not found by token", async () => {
    (prisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await POST(
      makeRequest({ signingToken: "bad-token" }),
      makeParams("env-1")
    );
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Invalid signing token");
  });

  it("returns 400 when token does not match envelope id", async () => {
    (prisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
      ...mockRecipient,
      envelopeId: "env-other",
    });

    const res = await POST(
      makeRequest({ signingToken: "valid-token" }),
      makeParams("env-1")
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Token does not match envelope");
  });

  it("declines envelope on success", async () => {
    const declinedAt = new Date().toISOString();
    mockDeclineEnvelope.mockResolvedValue({
      status: "DECLINED",
      declinedAt,
    });

    const res = await POST(
      makeRequest({
        signingToken: "valid-token",
        reason: "Changed my mind",
      }),
      makeParams("env-1")
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("DECLINED");
    expect(data.declinedAt).toBe(declinedAt);

    expect(mockDeclineEnvelope).toHaveBeenCalledWith(
      "env-1",
      "r-1",
      "Changed my mind",
      "1.2.3.4",
      "Test/1.0"
    );
  });

  it("sends declined notification emails", async () => {
    mockDeclineEnvelope.mockResolvedValue({
      status: "DECLINED",
      declinedAt: new Date().toISOString(),
    });
    const { sendEnvelopeDeclinedEmails } = jest.requireMock(
      "@/lib/emails/send-esign-notifications"
    );

    await POST(
      makeRequest({ signingToken: "valid-token", reason: "Not interested" }),
      makeParams("env-1")
    );

    expect(sendEnvelopeDeclinedEmails).toHaveBeenCalledWith(
      "env-1",
      "John Doe",
      "john@example.com",
      "Not interested"
    );
  });

  it("returns 400 when declineEnvelope throws 'already' error", async () => {
    mockDeclineEnvelope.mockRejectedValue(
      new Error("Recipient already declined")
    );

    const res = await POST(
      makeRequest({ signingToken: "valid-token" }),
      makeParams("env-1")
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("already");
  });

  it("returns 500 on unexpected error", async () => {
    mockDeclineEnvelope.mockRejectedValue(new Error("Database failure"));

    const res = await POST(
      makeRequest({ signingToken: "valid-token" }),
      makeParams("env-1")
    );
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});
