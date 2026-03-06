/**
 * Tests for /api/esign/sign — GET (authenticate signer) + POST (record signature)
 *
 * Token-based authentication (no session required — supports external signers).
 */

import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterRateLimit: jest.fn().mockResolvedValue(null),
}));

const mockAuthenticateSigner = jest.fn();
const mockRecordSignerCompletion = jest.fn();
jest.mock("@/lib/esign/signing-session", () => ({
  authenticateSigner: (...args: unknown[]) => mockAuthenticateSigner(...args),
  recordSignerCompletion: (...args: unknown[]) =>
    mockRecordSignerCompletion(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let GET: typeof import("@/app/api/esign/sign/route").GET;
let POST: typeof import("@/app/api/esign/sign/route").POST;

function makeGetRequest(token?: string): NextRequest {
  const url = new URL("http://localhost:5000/api/esign/sign");
  if (token) url.searchParams.set("token", token);
  return new NextRequest(url);
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:5000/api/esign/sign", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "1.2.3.4",
      "user-agent": "Test/1.0",
    },
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  jest.clearAllMocks();

  const mod = await import("@/app/api/esign/sign/route");
  GET = mod.GET;
  POST = mod.POST;
});

// ============================================================================
// GET /api/esign/sign?token=xxx
// ============================================================================

describe("GET /api/esign/sign", () => {
  it("returns 400 when token is missing", async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Signing token is required");
  });

  it("returns signing session on valid token", async () => {
    const sessionData = {
      recipientId: "r-1",
      envelopeId: "env-1",
      email: "john@example.com",
      name: "John Doe",
      role: "SIGNER",
      status: "SENT",
      signingMode: "SEQUENTIAL",
      order: 1,
      canSign: true,
      reason: null,
      envelope: { title: "NDA", description: null },
    };
    mockAuthenticateSigner.mockResolvedValue(sessionData);

    const res = await GET(makeGetRequest("valid-token"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.recipientId).toBe("r-1");
    expect(data.envelopeId).toBe("env-1");
    expect(data.email).toBe("john@example.com");
    expect(data.canSign).toBe(true);
    expect(data.signingMode).toBe("SEQUENTIAL");
    expect(mockAuthenticateSigner).toHaveBeenCalledWith("valid-token");
  });

  it("returns 404 when token is invalid", async () => {
    mockAuthenticateSigner.mockRejectedValue(
      new Error("Invalid signing token")
    );

    const res = await GET(makeGetRequest("bad-token"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Invalid signing token");
  });

  it("returns 500 on unexpected error", async () => {
    mockAuthenticateSigner.mockRejectedValue(new Error("Database failure"));

    const res = await GET(makeGetRequest("some-token"));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});

// ============================================================================
// POST /api/esign/sign
// ============================================================================

describe("POST /api/esign/sign", () => {
  const validBody = {
    signingToken: "valid-token",
    signatureImage: "data:image/png;base64,abc123",
    signatureType: "draw",
    esignConsent: true,
    fieldValues: { field1: "value1" },
  };

  it("returns 400 when signingToken is missing", async () => {
    const res = await POST(
      makePostRequest({ esignConsent: true })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Signing token is required");
  });

  it("returns 400 when esignConsent is missing/false", async () => {
    const res = await POST(
      makePostRequest({ signingToken: "valid-token" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("ESIGN consent is required");
  });

  it("records signature completion on success", async () => {
    const result = {
      success: true,
      isEnvelopeComplete: false,
      nextRecipients: [
        { id: "r-2", name: "Jane", email: "jane@example.com" },
      ],
    };
    mockRecordSignerCompletion.mockResolvedValue(result);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.isComplete).toBe(false);
    expect(data.nextRecipients).toHaveLength(1);

    expect(mockRecordSignerCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        signingToken: "valid-token",
        signatureImage: "data:image/png;base64,abc123",
        signatureType: "draw",
        ipAddress: "1.2.3.4",
        userAgent: "Test/1.0",
        esignConsent: true,
        fieldValues: { field1: "value1" },
      })
    );
  });

  it("returns 400 when token is invalid", async () => {
    mockRecordSignerCompletion.mockRejectedValue(
      new Error("Invalid signing token")
    );

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid signing token");
  });

  it("returns 400 when signer has already signed", async () => {
    mockRecordSignerCompletion.mockRejectedValue(
      new Error("Recipient has already signed")
    );

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("already");
  });

  it("returns 400 when Cannot sign error", async () => {
    mockRecordSignerCompletion.mockRejectedValue(
      new Error("Cannot sign: envelope is VOIDED")
    );

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Cannot sign");
  });

  it("returns 500 on unexpected error", async () => {
    mockRecordSignerCompletion.mockRejectedValue(
      new Error("Database failure")
    );

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });
});
