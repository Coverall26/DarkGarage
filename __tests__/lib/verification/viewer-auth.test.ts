import {
  sendVerificationCode,
  verifyCode,
  validateViewerSession,
} from "@/lib/verification/viewer-auth";

// Mock dependencies
jest.mock("@/lib/api/auth/token", () => ({
  hashToken: jest.fn((val: string) => `hashed_${val}`),
}));

jest.mock("@/lib/emails/send-email-otp-verification", () => ({
  sendOtpVerificationEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/id-helper", () => ({
  newId: jest.fn(() => "mock-session-token-id"),
}));

jest.mock("@/lib/utils/generate-otp", () => ({
  generateOTP: jest.fn(() => "123456"),
}));

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

import prisma from "@/lib/prisma";
import { hashToken } from "@/lib/api/auth/token";
import { sendOtpVerificationEmail } from "@/lib/emails/send-email-otp-verification";
import { generateOTP } from "@/lib/utils/generate-otp";

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe("viewer-auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // sendVerificationCode
  // =========================================================================
  describe("sendVerificationCode", () => {
    const baseParams = {
      email: "Test@Example.com",
      linkId: "link_123",
      teamId: "team_456",
      isDataroom: false,
      ipAddress: "1.2.3.4",
      userAgent: "Mozilla/5.0",
    };

    it("should delete existing codes, create hashed code, and send email", async () => {
      (mockPrisma.verificationCode.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (mockPrisma.verificationCode.create as jest.Mock).mockResolvedValue({
        id: "vc_1",
      });

      const result = await sendVerificationCode(baseParams);

      expect(result).toEqual({ success: true });

      // Should delete existing codes with lowercase email
      expect(mockPrisma.verificationCode.deleteMany).toHaveBeenCalledWith({
        where: { email: "test@example.com", linkId: "link_123" },
      });

      // Should create with hashed code (not plaintext)
      expect(mockPrisma.verificationCode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "test@example.com",
          code: "hashed_123456", // hashToken("123456")
          linkId: "link_123",
          teamId: "team_456",
          ipAddress: "1.2.3.4",
          userAgent: "Mozilla/5.0",
        }),
      });

      // Should have a future expiresAt
      const createCall = (mockPrisma.verificationCode.create as jest.Mock).mock
        .calls[0][0];
      expect(createCall.data.expiresAt).toBeInstanceOf(Date);
      expect(createCall.data.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Should send email with plaintext OTP
      expect(sendOtpVerificationEmail).toHaveBeenCalledWith(
        "Test@Example.com",
        "123456",
        false,
        "team_456",
      );
    });

    it("should normalize email to lowercase for storage", async () => {
      (mockPrisma.verificationCode.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });
      (mockPrisma.verificationCode.create as jest.Mock).mockResolvedValue({
        id: "vc_2",
      });

      await sendVerificationCode({
        ...baseParams,
        email: "USER@DOMAIN.COM",
      });

      expect(mockPrisma.verificationCode.deleteMany).toHaveBeenCalledWith({
        where: { email: "user@domain.com", linkId: "link_123" },
      });
      expect(mockPrisma.verificationCode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ email: "user@domain.com" }),
      });
    });

    it("should pass isDataroom flag to email sender", async () => {
      (mockPrisma.verificationCode.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });
      (mockPrisma.verificationCode.create as jest.Mock).mockResolvedValue({
        id: "vc_3",
      });

      await sendVerificationCode({ ...baseParams, isDataroom: true });

      expect(sendOtpVerificationEmail).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        true,
        "team_456",
      );
    });

    it("should handle undefined ipAddress and userAgent", async () => {
      (mockPrisma.verificationCode.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });
      (mockPrisma.verificationCode.create as jest.Mock).mockResolvedValue({
        id: "vc_4",
      });

      await sendVerificationCode({
        ...baseParams,
        ipAddress: null,
        userAgent: null,
      });

      const createCall = (mockPrisma.verificationCode.create as jest.Mock).mock
        .calls[0][0];
      expect(createCall.data.ipAddress).toBeUndefined();
      expect(createCall.data.userAgent).toBeUndefined();
    });
  });

  // =========================================================================
  // verifyCode
  // =========================================================================
  describe("verifyCode", () => {
    const baseParams = {
      email: "Test@Example.com",
      linkId: "link_123",
      code: "123456",
      teamId: "team_456",
      ipAddress: "1.2.3.4",
      userAgent: "Mozilla/5.0",
    };

    const validVerification = {
      id: "vc_1",
      email: "test@example.com",
      code: "hashed_123456",
      linkId: "link_123",
      teamId: "team_456",
      expiresAt: new Date(Date.now() + 600_000), // 10 min from now
      attempts: 0,
      usedAt: null,
      createdAt: new Date(),
    };

    it("should return verified=true and session token on valid code", async () => {
      (mockPrisma.verificationCode.findFirst as jest.Mock).mockResolvedValue(
        validVerification,
      );
      (mockPrisma.verificationCode.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.viewerSession.create as jest.Mock).mockResolvedValue({
        id: "vs_1",
      });

      const result = await verifyCode(baseParams);

      expect(result).toEqual({
        verified: true,
        sessionToken: "hashed_mock-session-token-id",
      });

      // Should mark the code as used
      expect(mockPrisma.verificationCode.update).toHaveBeenCalledWith({
        where: { id: "vc_1" },
        data: { usedAt: expect.any(Date) },
      });

      // Should create a ViewerSession
      expect(mockPrisma.viewerSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "test@example.com",
          linkId: "link_123",
          token: "hashed_mock-session-token-id",
          verified: true,
          ipAddress: "1.2.3.4",
          userAgent: "Mozilla/5.0",
        }),
      });
    });

    it("should return error when no verification code found", async () => {
      (mockPrisma.verificationCode.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await verifyCode(baseParams);

      expect(result).toEqual({
        verified: false,
        error: "Unauthorized access. Request new access.",
        resetVerification: true,
      });
    });

    it("should return error when code is expired", async () => {
      (mockPrisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        ...validVerification,
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      });
      (mockPrisma.verificationCode.delete as jest.Mock).mockResolvedValue({});

      const result = await verifyCode(baseParams);

      expect(result).toEqual({
        verified: false,
        error: "Access expired. Request new access.",
        resetVerification: true,
      });

      // Should clean up expired code
      expect(mockPrisma.verificationCode.delete).toHaveBeenCalledWith({
        where: { id: "vc_1" },
      });
    });

    it("should return error when max attempts exceeded", async () => {
      (mockPrisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        ...validVerification,
        attempts: 3, // MAX_ATTEMPTS
      });
      (mockPrisma.verificationCode.delete as jest.Mock).mockResolvedValue({});

      const result = await verifyCode(baseParams);

      expect(result).toEqual({
        verified: false,
        error: "Too many failed attempts. Request new access.",
        resetVerification: true,
      });

      // Should invalidate the code
      expect(mockPrisma.verificationCode.delete).toHaveBeenCalledWith({
        where: { id: "vc_1" },
      });
    });

    it("should increment attempts on wrong code", async () => {
      (mockPrisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        ...validVerification,
        code: "hashed_999999", // different from hashed_123456
      });
      (mockPrisma.verificationCode.update as jest.Mock).mockResolvedValue({});

      const result = await verifyCode(baseParams);

      expect(result).toEqual({
        verified: false,
        error: "Invalid verification code.",
      });

      // Should increment attempts
      expect(mockPrisma.verificationCode.update).toHaveBeenCalledWith({
        where: { id: "vc_1" },
        data: { attempts: { increment: 1 } },
      });
    });

    it("should normalize email to lowercase for lookup", async () => {
      (mockPrisma.verificationCode.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      await verifyCode({ ...baseParams, email: "USER@DOMAIN.COM" });

      expect(mockPrisma.verificationCode.findFirst).toHaveBeenCalledWith({
        where: {
          email: "user@domain.com",
          linkId: "link_123",
          usedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should pass attempt=2 and still allow verification", async () => {
      (mockPrisma.verificationCode.findFirst as jest.Mock).mockResolvedValue({
        ...validVerification,
        attempts: 2, // one less than MAX_ATTEMPTS
      });
      (mockPrisma.verificationCode.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.viewerSession.create as jest.Mock).mockResolvedValue({
        id: "vs_2",
      });

      const result = await verifyCode(baseParams);

      expect(result).toEqual({
        verified: true,
        sessionToken: expect.any(String),
      });
    });

    it("should handle null ipAddress and userAgent in session creation", async () => {
      (mockPrisma.verificationCode.findFirst as jest.Mock).mockResolvedValue(
        validVerification,
      );
      (mockPrisma.verificationCode.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.viewerSession.create as jest.Mock).mockResolvedValue({
        id: "vs_3",
      });

      await verifyCode({
        ...baseParams,
        ipAddress: null,
        userAgent: null,
      });

      const createCall = (mockPrisma.viewerSession.create as jest.Mock).mock
        .calls[0][0];
      expect(createCall.data.ipAddress).toBeUndefined();
      expect(createCall.data.userAgent).toBeUndefined();
    });
  });

  // =========================================================================
  // validateViewerSession
  // =========================================================================
  describe("validateViewerSession", () => {
    const baseParams = {
      token: "session_token_abc",
      linkId: "link_123",
      email: "Test@Example.com",
    };

    const validSession = {
      id: "vs_1",
      email: "test@example.com",
      linkId: "link_123",
      token: "session_token_abc",
      verified: true,
      expiresAt: new Date(Date.now() + 86_400_000), // 24 hours from now
      createdAt: new Date(),
    };

    it("should return valid=true for a valid, non-expired session", async () => {
      (mockPrisma.viewerSession.findFirst as jest.Mock).mockResolvedValue(
        validSession,
      );

      const result = await validateViewerSession(baseParams);

      expect(result).toEqual({ valid: true });

      // Should query with lowercase email
      expect(mockPrisma.viewerSession.findFirst).toHaveBeenCalledWith({
        where: {
          token: "session_token_abc",
          linkId: "link_123",
          email: "test@example.com",
        },
      });
    });

    it("should return error when session not found", async () => {
      (mockPrisma.viewerSession.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await validateViewerSession(baseParams);

      expect(result).toEqual({
        valid: false,
        error: "Unauthorized access. Request new access.",
        resetVerification: true,
      });
    });

    it("should return error and clean up when session is expired", async () => {
      (mockPrisma.viewerSession.findFirst as jest.Mock).mockResolvedValue({
        ...validSession,
        expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      });
      (mockPrisma.viewerSession.delete as jest.Mock).mockResolvedValue({});

      const result = await validateViewerSession(baseParams);

      expect(result).toEqual({
        valid: false,
        error: "Access expired. Request new access.",
        resetVerification: true,
      });

      // Should clean up expired session
      expect(mockPrisma.viewerSession.delete).toHaveBeenCalledWith({
        where: { id: "vs_1" },
      });
    });

    it("should normalize email to lowercase for lookup", async () => {
      (mockPrisma.viewerSession.findFirst as jest.Mock).mockResolvedValue(null);

      await validateViewerSession({
        ...baseParams,
        email: "USER@DOMAIN.COM",
      });

      expect(mockPrisma.viewerSession.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          email: "user@domain.com",
        }),
      });
    });

    it("should not throw when delete of expired session fails", async () => {
      (mockPrisma.viewerSession.findFirst as jest.Mock).mockResolvedValue({
        ...validSession,
        expiresAt: new Date(Date.now() - 1000),
      });
      (mockPrisma.viewerSession.delete as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      // Should not throw — delete failure is caught silently
      const result = await validateViewerSession(baseParams);

      expect(result).toEqual({
        valid: false,
        error: "Access expired. Request new access.",
        resetVerification: true,
      });
    });
  });
});
