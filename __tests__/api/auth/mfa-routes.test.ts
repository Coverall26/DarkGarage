/**
 * Tests for MFA (Multi-Factor Authentication) API routes
 *
 * Routes tested:
 *   1. POST   /api/auth/mfa-setup   — Generate TOTP secret + QR URI
 *   2. PUT    /api/auth/mfa-setup   — Verify TOTP code and enable MFA
 *   3. DELETE /api/auth/mfa-setup   — Disable MFA
 *   4. POST   /api/auth/mfa-verify  — Verify TOTP code or recovery code
 *   5. GET    /api/auth/mfa-status   — Check MFA status
 *
 * Each route covers:
 *   - Auth enforcement (401 if not authenticated)
 *   - Rate limiting (rate limiter called)
 *   - Input validation (400 for bad input)
 *   - Happy path (200 response)
 *   - Error handling (500 + reportError)
 */

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mock function declarations — BEFORE jest.mock() calls
// ---------------------------------------------------------------------------

const mockRequireAuth = jest.fn();
const mockReportError = jest.fn();
const mockLogAuditEvent = jest.fn().mockResolvedValue(undefined);

const mockGenerateTotpSecret = jest.fn();
const mockBuildTotpUri = jest.fn();
const mockVerifyTotpCode = jest.fn();
const mockEncryptMfaSecret = jest.fn();
const mockDecryptMfaSecret = jest.fn();
const mockGenerateRecoveryCodes = jest.fn();
const mockFormatRecoveryCode = jest.fn();
const mockCheckMfaStatus = jest.fn();

const mockAppRouterStrictRateLimit = jest.fn().mockResolvedValue(null);
const mockAppRouterMfaRateLimit = jest.fn().mockResolvedValue(null);
const mockAppRouterRateLimit = jest.fn().mockResolvedValue(null);

// ---------------------------------------------------------------------------
// jest.mock() — with wrapper functions
// ---------------------------------------------------------------------------

jest.mock("@/lib/auth/rbac", () => ({
  requireAuthAppRouter: (...args: unknown[]) => mockRequireAuth(...args),
}));

jest.mock("@/lib/error", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

jest.mock("@/lib/audit/audit-logger", () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

jest.mock("@/lib/auth/mfa", () => ({
  generateTotpSecret: (...args: unknown[]) => mockGenerateTotpSecret(...args),
  buildTotpUri: (...args: unknown[]) => mockBuildTotpUri(...args),
  verifyTotpCode: (...args: unknown[]) => mockVerifyTotpCode(...args),
  encryptMfaSecret: (...args: unknown[]) => mockEncryptMfaSecret(...args),
  decryptMfaSecret: (...args: unknown[]) => mockDecryptMfaSecret(...args),
  generateRecoveryCodes: (...args: unknown[]) =>
    mockGenerateRecoveryCodes(...args),
  formatRecoveryCode: (...args: unknown[]) => mockFormatRecoveryCode(...args),
  checkMfaStatus: (...args: unknown[]) => mockCheckMfaStatus(...args),
}));

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterStrictRateLimit: (...args: unknown[]) =>
    mockAppRouterStrictRateLimit(...args),
  appRouterMfaRateLimit: (...args: unknown[]) =>
    mockAppRouterMfaRateLimit(...args),
  appRouterRateLimit: (...args: unknown[]) => mockAppRouterRateLimit(...args),
}));

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------

import {
  POST as setupPOST,
  PUT as setupPUT,
  DELETE as setupDELETE,
} from "@/app/api/auth/mfa-setup/route";
import { POST as verifyPOST } from "@/app/api/auth/mfa-verify/route";
import { GET as statusGET } from "@/app/api/auth/mfa-status/route";

const prisma = require("@/lib/prisma").default;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = "user-mfa-test-001";
const TEST_EMAIL = "mfa-test@fundroom.ai";
const TEST_TEAM_ID = "team-mfa-test-001";
const TEST_SECRET = "JBSWY3DPEHPK3PXP";
const TEST_ENCRYPTED_SECRET = "abc123:def456:789encrypted";
const TEST_URI =
  "otpauth://totp/FundRoom:mfa-test%40fundroom.ai?secret=JBSWY3DPEHPK3PXP&issuer=FundRoom&algorithm=SHA-1&digits=6&period=30";

function makeAuthResult(overrides = {}) {
  return {
    userId: TEST_USER_ID,
    email: TEST_EMAIL,
    teamId: TEST_TEAM_ID,
    role: "ADMIN",
    session: { user: { email: TEST_EMAIL } },
    ...overrides,
  };
}

function makePostRequest(url: string, body: Record<string, unknown> = {}) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makePutRequest(url: string, body: Record<string, unknown> = {}) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDeleteRequest(url: string, body: Record<string, unknown> = {}) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: "DELETE",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGetRequest(url: string) {
  return new NextRequest(`http://localhost:3000${url}`, {
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// Common setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  // Default: auth succeeds
  mockRequireAuth.mockResolvedValue(makeAuthResult());

  // Default: rate limiters allow
  mockAppRouterStrictRateLimit.mockResolvedValue(null);
  mockAppRouterMfaRateLimit.mockResolvedValue(null);
  mockAppRouterRateLimit.mockResolvedValue(null);

  // Default MFA helpers
  mockGenerateTotpSecret.mockReturnValue(TEST_SECRET);
  mockBuildTotpUri.mockReturnValue(TEST_URI);
  mockEncryptMfaSecret.mockReturnValue(TEST_ENCRYPTED_SECRET);
  mockDecryptMfaSecret.mockReturnValue(TEST_SECRET);
  mockVerifyTotpCode.mockReturnValue(true);
  mockGenerateRecoveryCodes.mockReturnValue([
    "ABCD1234",
    "EFGH5678",
    "IJKL9012",
    "MNOP3456",
    "QRST7890",
    "UVWX1234",
    "YZAB5678",
    "CDEF9012",
    "GHIJ3456",
    "KLMN7890",
  ]);
  mockFormatRecoveryCode.mockImplementation(
    (code: string) =>
      `${code.slice(0, 4)}-${code.slice(4)}`,
  );

  // Default Prisma mocks
  prisma.user.update.mockResolvedValue({ id: TEST_USER_ID });
  prisma.user.findUnique.mockResolvedValue({
    id: TEST_USER_ID,
    mfaSecret: TEST_ENCRYPTED_SECRET,
    mfaEnabled: false,
    mfaRecoveryCodes: [],
  });
  prisma.userTeam.findFirst.mockResolvedValue({
    teamId: TEST_TEAM_ID,
  });
});

// ===========================================================================
//   POST /api/auth/mfa-setup — Generate TOTP secret
// ===========================================================================

describe("POST /api/auth/mfa-setup", () => {
  const url = "/api/auth/mfa-setup";

  it("calls rate limiter before processing", async () => {
    const req = makePostRequest(url);
    await setupPOST(req);
    expect(mockAppRouterStrictRateLimit).toHaveBeenCalledWith(req);
  });

  it("returns 429 when rate limited", async () => {
    mockAppRouterStrictRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    );

    const res = await setupPOST(makePostRequest(url));
    expect(res.status).toBe(429);
    // Auth should not be called when rate limited
    expect(mockRequireAuth).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await setupPOST(makePostRequest(url));
    expect(res.status).toBe(401);
  });

  it("generates TOTP secret and stores encrypted version", async () => {
    const res = await setupPOST(makePostRequest(url));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.secret).toBe(TEST_SECRET);
    expect(body.uri).toBe(TEST_URI);
    expect(body.qrData).toBe(TEST_URI);

    // Verify secret was generated
    expect(mockGenerateTotpSecret).toHaveBeenCalledTimes(1);

    // Verify URI was built with secret and email
    expect(mockBuildTotpUri).toHaveBeenCalledWith(TEST_SECRET, TEST_EMAIL);

    // Verify secret was encrypted before storage
    expect(mockEncryptMfaSecret).toHaveBeenCalledWith(TEST_SECRET);

    // Verify encrypted secret was stored in DB
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: TEST_USER_ID },
      data: { mfaSecret: TEST_ENCRYPTED_SECRET },
    });
  });

  it("returns 500 and reports error on internal failure", async () => {
    const testError = new Error("DB connection lost");
    prisma.user.update.mockRejectedValueOnce(testError);

    const res = await setupPOST(makePostRequest(url));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
    expect(mockReportError).toHaveBeenCalledWith(testError);
  });

  it("returns 500 when encryption fails", async () => {
    const encryptionError = new Error("MFA_ENCRYPTION_KEY not configured");
    mockEncryptMfaSecret.mockImplementationOnce(() => {
      throw encryptionError;
    });

    const res = await setupPOST(makePostRequest(url));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
    expect(mockReportError).toHaveBeenCalledWith(encryptionError);
  });
});

// ===========================================================================
//   PUT /api/auth/mfa-setup — Verify TOTP code and enable MFA
// ===========================================================================

describe("PUT /api/auth/mfa-setup", () => {
  const url = "/api/auth/mfa-setup";

  it("calls rate limiter before processing", async () => {
    const req = makePutRequest(url, { code: "123456" });
    await setupPUT(req);
    expect(mockAppRouterStrictRateLimit).toHaveBeenCalledWith(req);
  });

  it("returns 429 when rate limited", async () => {
    mockAppRouterStrictRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    );

    const res = await setupPUT(makePutRequest(url, { code: "123456" }));
    expect(res.status).toBe(429);
    expect(mockRequireAuth).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await setupPUT(makePutRequest(url, { code: "123456" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing code", async () => {
    const res = await setupPUT(makePutRequest(url, {}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 for non-6-digit code", async () => {
    const res = await setupPUT(makePutRequest(url, { code: "12345" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 for code with letters", async () => {
    const res = await setupPUT(makePutRequest(url, { code: "12345a" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 when MFA setup not initiated (no mfaSecret)", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      mfaSecret: null,
      mfaEnabled: false,
    });

    const res = await setupPUT(makePutRequest(url, { code: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("MFA setup not initiated");
  });

  it("returns 400 when MFA is already enabled", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      mfaSecret: TEST_ENCRYPTED_SECRET,
      mfaEnabled: true,
    });

    const res = await setupPUT(makePutRequest(url, { code: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("MFA is already enabled");
  });

  it("returns 400 when TOTP code is invalid", async () => {
    mockVerifyTotpCode.mockReturnValueOnce(false);

    const res = await setupPUT(makePutRequest(url, { code: "999999" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid verification code");
  });

  it("enables MFA on valid code — happy path", async () => {
    const res = await setupPUT(makePutRequest(url, { code: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.enabled).toBe(true);
    expect(body.recoveryCodes).toBeDefined();
    expect(Array.isArray(body.recoveryCodes)).toBe(true);
    expect(body.recoveryCodes.length).toBe(10);

    // Verify secret was decrypted for TOTP verification
    expect(mockDecryptMfaSecret).toHaveBeenCalledWith(TEST_ENCRYPTED_SECRET);

    // Verify TOTP code was checked
    expect(mockVerifyTotpCode).toHaveBeenCalledWith(TEST_SECRET, "123456");

    // Verify recovery codes were generated
    expect(mockGenerateRecoveryCodes).toHaveBeenCalledWith(10);

    // Verify each recovery code was encrypted before storage
    expect(mockEncryptMfaSecret).toHaveBeenCalledTimes(10);

    // Verify MFA was enabled in DB
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_USER_ID },
        data: expect.objectContaining({
          mfaEnabled: true,
          mfaVerifiedAt: expect.any(Date),
          mfaRecoveryCodes: expect.any(Array),
        }),
      }),
    );
  });

  it("creates audit log entry on successful MFA enable", async () => {
    await setupPUT(makePutRequest(url, { code: "123456" }));

    expect(prisma.userTeam.findFirst).toHaveBeenCalledWith({
      where: { userId: TEST_USER_ID, status: "ACTIVE" },
      select: { teamId: true },
    });

    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      teamId: TEST_TEAM_ID,
      userId: TEST_USER_ID,
      eventType: "MFA_ENABLED",
      resourceType: "User",
      resourceId: TEST_USER_ID,
    });
  });

  it("skips audit log when user has no team membership", async () => {
    prisma.userTeam.findFirst.mockResolvedValueOnce(null);

    const res = await setupPUT(makePutRequest(url, { code: "123456" }));
    expect(res.status).toBe(200);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it("formats recovery codes for display", async () => {
    const res = await setupPUT(makePutRequest(url, { code: "123456" }));
    const body = await res.json();

    // formatRecoveryCode should be called for each recovery code via .map()
    // Note: Array.map passes (element, index, array) — so we check first arg
    expect(mockFormatRecoveryCode).toHaveBeenCalledTimes(10);
    expect(mockFormatRecoveryCode.mock.calls[0][0]).toBe("ABCD1234");
    expect(mockFormatRecoveryCode.mock.calls[1][0]).toBe("EFGH5678");
  });

  it("returns 500 and reports error on internal failure", async () => {
    const testError = new Error("Prisma connection timeout");
    prisma.user.findUnique.mockRejectedValueOnce(testError);

    const res = await setupPUT(makePutRequest(url, { code: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
    expect(mockReportError).toHaveBeenCalledWith(testError);
  });
});

// ===========================================================================
//   DELETE /api/auth/mfa-setup — Disable MFA
// ===========================================================================

describe("DELETE /api/auth/mfa-setup", () => {
  const url = "/api/auth/mfa-setup";

  beforeEach(() => {
    // For DELETE tests, user should have MFA enabled
    prisma.user.findUnique.mockResolvedValue({
      mfaSecret: TEST_ENCRYPTED_SECRET,
      mfaEnabled: true,
    });
  });

  it("calls rate limiter before processing", async () => {
    const req = makeDeleteRequest(url, { code: "123456" });
    await setupDELETE(req);
    expect(mockAppRouterStrictRateLimit).toHaveBeenCalledWith(req);
  });

  it("returns 429 when rate limited", async () => {
    mockAppRouterStrictRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    );

    const res = await setupDELETE(
      makeDeleteRequest(url, { code: "123456" }),
    );
    expect(res.status).toBe(429);
    expect(mockRequireAuth).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await setupDELETE(
      makeDeleteRequest(url, { code: "123456" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing code", async () => {
    const res = await setupDELETE(makeDeleteRequest(url, {}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 when MFA is not enabled", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      mfaSecret: null,
      mfaEnabled: false,
    });

    const res = await setupDELETE(
      makeDeleteRequest(url, { code: "123456" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("MFA is not enabled");
  });

  it("returns 400 when MFA enabled but no secret (edge case)", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      mfaSecret: null,
      mfaEnabled: true,
    });

    const res = await setupDELETE(
      makeDeleteRequest(url, { code: "123456" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("MFA is not enabled");
  });

  it("returns 400 when TOTP code is invalid", async () => {
    mockVerifyTotpCode.mockReturnValueOnce(false);

    const res = await setupDELETE(
      makeDeleteRequest(url, { code: "999999" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid verification code");
  });

  it("disables MFA on valid code — happy path", async () => {
    const res = await setupDELETE(
      makeDeleteRequest(url, { code: "123456" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.disabled).toBe(true);

    // Verify secret was decrypted for TOTP verification
    expect(mockDecryptMfaSecret).toHaveBeenCalledWith(TEST_ENCRYPTED_SECRET);
    expect(mockVerifyTotpCode).toHaveBeenCalledWith(TEST_SECRET, "123456");

    // Verify MFA was disabled in DB — all fields cleared
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: TEST_USER_ID },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaVerifiedAt: null,
        mfaRecoveryCodes: [],
      },
    });
  });

  it("creates audit log entry on successful MFA disable", async () => {
    await setupDELETE(makeDeleteRequest(url, { code: "123456" }));

    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      teamId: TEST_TEAM_ID,
      userId: TEST_USER_ID,
      eventType: "MFA_DISABLED",
      resourceType: "User",
      resourceId: TEST_USER_ID,
    });
  });

  it("skips audit log when user has no team membership", async () => {
    prisma.userTeam.findFirst.mockResolvedValueOnce(null);

    const res = await setupDELETE(
      makeDeleteRequest(url, { code: "123456" }),
    );
    expect(res.status).toBe(200);
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it("returns 500 and reports error on internal failure", async () => {
    const testError = new Error("DB write failed");
    prisma.user.update.mockRejectedValueOnce(testError);

    const res = await setupDELETE(
      makeDeleteRequest(url, { code: "123456" }),
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
    expect(mockReportError).toHaveBeenCalledWith(testError);
  });
});

// ===========================================================================
//   POST /api/auth/mfa-verify — Verify TOTP code or recovery code
// ===========================================================================

describe("POST /api/auth/mfa-verify", () => {
  const url = "/api/auth/mfa-verify";

  beforeEach(() => {
    // For verify tests, user should have MFA enabled
    prisma.user.findUnique.mockResolvedValue({
      mfaSecret: TEST_ENCRYPTED_SECRET,
      mfaEnabled: true,
      mfaRecoveryCodes: ["enc-code-1", "enc-code-2", "enc-code-3"],
    });
  });

  it("calls MFA-specific rate limiter before processing", async () => {
    const req = makePostRequest(url, { code: "123456" });
    await verifyPOST(req);
    expect(mockAppRouterMfaRateLimit).toHaveBeenCalledWith(req);
  });

  it("returns 429 when rate limited", async () => {
    mockAppRouterMfaRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    );

    const res = await verifyPOST(makePostRequest(url, { code: "123456" }));
    expect(res.status).toBe(429);
    expect(mockRequireAuth).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await verifyPOST(makePostRequest(url, { code: "123456" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing code", async () => {
    const res = await verifyPOST(makePostRequest(url, {}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 when MFA is not enabled on user", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      mfaSecret: null,
      mfaEnabled: false,
      mfaRecoveryCodes: [],
    });

    const res = await verifyPOST(makePostRequest(url, { code: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("MFA is not enabled");
  });

  it("returns 400 when MFA enabled but no secret", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      mfaSecret: null,
      mfaEnabled: true,
      mfaRecoveryCodes: [],
    });

    const res = await verifyPOST(makePostRequest(url, { code: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("MFA is not enabled");
  });

  // -- TOTP verification (default type) --

  it("returns 400 for non-6-digit TOTP code", async () => {
    const res = await verifyPOST(makePostRequest(url, { code: "12345" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid code format");
  });

  it("returns 400 for TOTP code with letters", async () => {
    const res = await verifyPOST(makePostRequest(url, { code: "12345a" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid code format");
  });

  it("returns 400 for invalid TOTP code", async () => {
    mockVerifyTotpCode.mockReturnValueOnce(false);

    const res = await verifyPOST(
      makePostRequest(url, { code: "999999", type: "totp" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid verification code");
  });

  it("verifies valid TOTP code — happy path", async () => {
    const res = await verifyPOST(
      makePostRequest(url, { code: "123456", type: "totp" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.verified).toBe(true);

    // Verify TOTP code was checked
    expect(mockDecryptMfaSecret).toHaveBeenCalledWith(TEST_ENCRYPTED_SECRET);
    expect(mockVerifyTotpCode).toHaveBeenCalledWith(TEST_SECRET, "123456");

    // Verify mfaVerifiedAt was updated
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: TEST_USER_ID },
      data: { mfaVerifiedAt: expect.any(Date) },
    });
  });

  it("defaults to totp type when type is omitted", async () => {
    const res = await verifyPOST(makePostRequest(url, { code: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.verified).toBe(true);

    // Should use TOTP verification path
    expect(mockDecryptMfaSecret).toHaveBeenCalledWith(TEST_ENCRYPTED_SECRET);
    expect(mockVerifyTotpCode).toHaveBeenCalledWith(TEST_SECRET, "123456");
  });

  // -- Recovery code verification --

  it("verifies valid recovery code — happy path", async () => {
    // Setup: decryptMfaSecret returns the matching recovery code for the first
    // encrypted code, and different values for the others
    mockDecryptMfaSecret
      .mockReturnValueOnce("ABCD1234") // first recovery code — matches
      .mockReturnValueOnce("EFGH5678") // second — no match
      .mockReturnValueOnce("IJKL9012"); // third — no match

    const res = await verifyPOST(
      makePostRequest(url, { code: "ABCD1234", type: "recovery" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.verified).toBe(true);

    // Used recovery code should be removed from remaining codes
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_USER_ID },
        data: {
          mfaRecoveryCodes: ["enc-code-2", "enc-code-3"],
        },
      }),
    );
  });

  it("accepts recovery code with dashes (XXXX-XXXX format)", async () => {
    mockDecryptMfaSecret
      .mockReturnValueOnce("ABCD1234")
      .mockReturnValueOnce("EFGH5678")
      .mockReturnValueOnce("IJKL9012");

    const res = await verifyPOST(
      makePostRequest(url, { code: "ABCD-1234", type: "recovery" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.verified).toBe(true);
  });

  it("accepts recovery code in lowercase", async () => {
    mockDecryptMfaSecret
      .mockReturnValueOnce("ABCD1234")
      .mockReturnValueOnce("EFGH5678")
      .mockReturnValueOnce("IJKL9012");

    const res = await verifyPOST(
      makePostRequest(url, { code: "abcd1234", type: "recovery" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.verified).toBe(true);
  });

  it("returns 400 for invalid recovery code", async () => {
    mockDecryptMfaSecret
      .mockReturnValueOnce("ABCD1234")
      .mockReturnValueOnce("EFGH5678")
      .mockReturnValueOnce("IJKL9012");

    const res = await verifyPOST(
      makePostRequest(url, { code: "WRONG000", type: "recovery" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid verification code");
  });

  it("handles decryption failure for individual recovery codes gracefully", async () => {
    // One code fails decryption but the second code matches
    mockDecryptMfaSecret
      .mockImplementationOnce(() => {
        throw new Error("Decryption failed");
      })
      .mockReturnValueOnce("EFGH5678") // matches
      .mockReturnValueOnce("IJKL9012");

    const res = await verifyPOST(
      makePostRequest(url, { code: "EFGH5678", type: "recovery" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.verified).toBe(true);

    // The failed-to-decrypt code should be kept (not removed)
    // The matched code (enc-code-2) should be removed
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          mfaRecoveryCodes: ["enc-code-1", "enc-code-3"],
        },
      }),
    );
  });

  // -- Audit logging --

  it("creates audit log entry with method on successful verification", async () => {
    await verifyPOST(
      makePostRequest(url, { code: "123456", type: "totp" }),
    );

    expect(mockLogAuditEvent).toHaveBeenCalledWith({
      teamId: TEST_TEAM_ID,
      userId: TEST_USER_ID,
      eventType: "MFA_VERIFIED",
      resourceType: "User",
      resourceId: TEST_USER_ID,
      metadata: { method: "totp" },
    });
  });

  it("logs recovery method in audit event", async () => {
    mockDecryptMfaSecret
      .mockReturnValueOnce("ABCD1234")
      .mockReturnValueOnce("EFGH5678")
      .mockReturnValueOnce("IJKL9012");

    await verifyPOST(
      makePostRequest(url, { code: "ABCD1234", type: "recovery" }),
    );

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "MFA_VERIFIED",
        metadata: { method: "recovery" },
      }),
    );
  });

  it("skips audit log when user has no team membership", async () => {
    prisma.userTeam.findFirst.mockResolvedValueOnce(null);

    await verifyPOST(makePostRequest(url, { code: "123456" }));
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  // -- Error handling --

  it("returns 500 and reports error on internal failure", async () => {
    const testError = new Error("Connection reset");
    prisma.user.findUnique.mockRejectedValueOnce(testError);

    const res = await verifyPOST(makePostRequest(url, { code: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
    expect(mockReportError).toHaveBeenCalledWith(testError);
  });

  it("returns 400 for invalid type value", async () => {
    const res = await verifyPOST(
      makePostRequest(url, { code: "123456", type: "sms" }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
  });
});

// ===========================================================================
//   GET /api/auth/mfa-status — Check MFA status
// ===========================================================================

describe("GET /api/auth/mfa-status", () => {
  const url = "/api/auth/mfa-status";

  it("calls standard rate limiter before processing", async () => {
    mockCheckMfaStatus.mockResolvedValueOnce({
      required: false,
      enabled: false,
      verified: false,
    });

    const req = makeGetRequest(url);
    await statusGET(req);
    expect(mockAppRouterRateLimit).toHaveBeenCalledWith(req);
  });

  it("returns 429 when rate limited", async () => {
    mockAppRouterRateLimit.mockResolvedValueOnce(
      NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    );

    const res = await statusGET(makeGetRequest(url));
    expect(res.status).toBe(429);
    expect(mockRequireAuth).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await statusGET(makeGetRequest(url));
    expect(res.status).toBe(401);
  });

  it("returns MFA disabled status", async () => {
    mockCheckMfaStatus.mockResolvedValueOnce({
      required: false,
      enabled: false,
      verified: false,
    });

    const res = await statusGET(makeGetRequest(url));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      required: false,
      enabled: false,
      verified: false,
    });

    expect(mockCheckMfaStatus).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it("returns MFA enabled and verified status", async () => {
    mockCheckMfaStatus.mockResolvedValueOnce({
      required: true,
      enabled: true,
      verified: true,
    });

    const res = await statusGET(makeGetRequest(url));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      required: true,
      enabled: true,
      verified: true,
    });
  });

  it("returns MFA required but not yet enabled", async () => {
    mockCheckMfaStatus.mockResolvedValueOnce({
      required: true,
      enabled: false,
      verified: false,
    });

    const res = await statusGET(makeGetRequest(url));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.required).toBe(true);
    expect(body.enabled).toBe(false);
    expect(body.verified).toBe(false);
  });

  it("returns MFA enabled but not verified in current session", async () => {
    mockCheckMfaStatus.mockResolvedValueOnce({
      required: true,
      enabled: true,
      verified: false,
    });

    const res = await statusGET(makeGetRequest(url));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.required).toBe(true);
    expect(body.enabled).toBe(true);
    expect(body.verified).toBe(false);
  });

  it("returns 500 and reports error on internal failure", async () => {
    const testError = new Error("checkMfaStatus failed");
    mockCheckMfaStatus.mockRejectedValueOnce(testError);

    const res = await statusGET(makeGetRequest(url));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
    expect(mockReportError).toHaveBeenCalledWith(testError);
  });
});
