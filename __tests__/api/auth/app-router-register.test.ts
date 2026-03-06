/**
 * Tests for POST /api/auth/register (App Router)
 *
 * Route: app/api/auth/register/route.ts
 *
 * Covers:
 *   1. Rate limiting enforcement (returns 429 when blocked)
 *   2. Input validation (missing email/password, weak password, missing/short name)
 *   3. New user creation — happy path (201, hashed password, audit log)
 *   4. Existing user without password — sets password (200, audit log)
 *   5. Existing user with password — conflict (409)
 *   6. Error handling (500 + reportError)
 *   7. Email normalization and request metadata extraction
 */

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports that reference them)
// ---------------------------------------------------------------------------

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterAuthRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

const mockLogAuditEvent = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/audit/audit-logger", () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

const mockHash = jest.fn().mockResolvedValue("hashed-password-12rounds");
jest.mock("bcryptjs", () => ({
  __esModule: true,
  default: {
    hash: (...args: unknown[]) => mockHash(...args),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST } from "@/app/api/auth/register/route";
import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { appRouterAuthRateLimit } from "@/lib/security/rate-limiter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "192.168.1.100",
      "user-agent": "Jest Test Agent",
    },
  });
}

const VALID_BODY = {
  email: "newuser@example.com",
  password: "SecureP@ss1",
  name: "Test User",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Rate limiting
  // -------------------------------------------------------------------------
  describe("rate limiting", () => {
    it("returns 429 when rate limit blocks the request", async () => {
      const rateLimitResponse = NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
      (appRouterAuthRateLimit as jest.Mock).mockResolvedValueOnce(
        rateLimitResponse,
      );

      const res = await POST(makeRequest(VALID_BODY));

      expect(res.status).toBe(429);
      expect(appRouterAuthRateLimit).toHaveBeenCalled();
      // Should not reach any database call
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("proceeds to handler when rate limit returns null", async () => {
      (appRouterAuthRateLimit as jest.Mock).mockResolvedValueOnce(null);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: "new-user-id",
        email: "newuser@example.com",
      });

      const res = await POST(makeRequest(VALID_BODY));

      expect(res.status).toBe(201);
      expect(appRouterAuthRateLimit).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Input validation — missing/invalid fields and weak passwords
  // -------------------------------------------------------------------------
  describe("input validation", () => {
    it("returns 400 for missing email", async () => {
      const res = await POST(
        makeRequest({ password: "SecureP@ss1", name: "Test" }),
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBeDefined();
    });

    it("returns 400 for invalid email format", async () => {
      const res = await POST(
        makeRequest({ email: "not-an-email", password: "SecureP@ss1", name: "Test" }),
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBeDefined();
    });

    it("returns 400 for missing password", async () => {
      const res = await POST(
        makeRequest({ email: "user@example.com", name: "Test" }),
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBeDefined();
    });

    it("returns 400 for weak password — too short", async () => {
      const res = await POST(
        makeRequest({ email: "user@example.com", password: "Sh@1", name: "Test" }),
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("at least 8 characters");
    });

    it("returns 400 for weak password — no number", async () => {
      const res = await POST(
        makeRequest({ email: "user@example.com", password: "NoNumbers@!", name: "Test" }),
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("number");
    });

    it("returns 400 for weak password — no special character", async () => {
      const res = await POST(
        makeRequest({
          email: "user@example.com",
          password: "NoSpecial1abc",
          name: "Test",
        }),
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toContain("special character");
    });

    it("returns 400 for missing name", async () => {
      const res = await POST(
        makeRequest({ email: "user@example.com", password: "SecureP@ss1" }),
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBeDefined();
    });

    it("returns 400 for name shorter than 2 characters", async () => {
      const res = await POST(
        makeRequest({ email: "user@example.com", password: "SecureP@ss1", name: "A" }),
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Happy path — creates new user successfully
  // -------------------------------------------------------------------------
  describe("new user creation (happy path)", () => {
    it("creates user with hashed password and returns 201", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: "new-user-id",
        email: "newuser@example.com",
        name: "Test User",
      });

      const res = await POST(makeRequest(VALID_BODY));
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.message).toBe("Account created");
      expect(json.userId).toBe("new-user-id");

      // bcrypt called with password + 12 salt rounds
      expect(mockHash).toHaveBeenCalledWith("SecureP@ss1", 12);

      // Prisma create called with correct shape
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: "newuser@example.com",
          password: "hashed-password-12rounds",
          name: "Test User",
          role: "GP",
        },
      });
    });

    it("audit logs USER_REGISTERED event", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: "new-user-id",
        email: "newuser@example.com",
      });

      await POST(makeRequest(VALID_BODY));

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "USER_REGISTERED",
          userId: "new-user-id",
          resourceType: "User",
          resourceId: "new-user-id",
          metadata: expect.objectContaining({
            method: "email_password",
            source: "signup_page",
          }),
        }),
      );
    });

    it("normalizes email to lowercase and trims whitespace", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: "user-id",
        email: "user@example.com",
      });

      await POST(
        makeRequest({
          email: "  USER@Example.COM  ",
          password: "SecureP@ss1",
          name: "Test User",
        }),
      );

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "user@example.com" },
        select: { id: true, password: true },
      });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "user@example.com",
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 4. Sets password for existing user (no password yet)
  // -------------------------------------------------------------------------
  describe("existing user without password", () => {
    it("sets password for user created via magic link and returns 200", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "existing-user-id",
        password: null,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: "existing-user-id",
      });

      const res = await POST(makeRequest(VALID_BODY));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toBe("Password set successfully");

      expect(mockHash).toHaveBeenCalledWith("SecureP@ss1", 12);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: "newuser@example.com" },
        data: {
          password: "hashed-password-12rounds",
          name: "Test User",
        },
      });
    });

    it("audit logs USER_PASSWORD_SET event", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "existing-user-id",
        password: null,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: "existing-user-id",
      });

      await POST(makeRequest(VALID_BODY));

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "USER_PASSWORD_SET",
          userId: "existing-user-id",
          resourceType: "User",
          resourceId: "existing-user-id",
          metadata: expect.objectContaining({
            method: "registration",
            hasExistingAccount: true,
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 5. Existing user with password — conflict
  // -------------------------------------------------------------------------
  describe("existing user with password", () => {
    it("returns 409 when account already has a password", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "existing-user-id",
        password: "existing-hashed-password",
      });

      const res = await POST(makeRequest(VALID_BODY));
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error).toBe("An account with this email already exists");

      // Should NOT hash, update, or create anything
      expect(mockHash).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 6. Error handling
  // -------------------------------------------------------------------------
  describe("error handling", () => {
    it("returns 500 and reports error on database failure", async () => {
      const dbError = new Error("Database connection failed");
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(dbError);

      const res = await POST(makeRequest(VALID_BODY));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Internal server error");
      expect(reportError).toHaveBeenCalledWith(dbError);
    });

    it("returns 500 when user create throws", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const createError = new Error("Unique constraint violation");
      (prisma.user.create as jest.Mock).mockRejectedValue(createError);

      const res = await POST(makeRequest(VALID_BODY));
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.error).toBe("Internal server error");
      expect(reportError).toHaveBeenCalledWith(createError);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Request metadata extraction
  // -------------------------------------------------------------------------
  describe("request metadata extraction", () => {
    it("extracts IP from x-forwarded-for and user-agent for audit log", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: "user-id",
        email: "newuser@example.com",
      });

      await POST(makeRequest(VALID_BODY));

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: "192.168.1.100",
          userAgent: "Jest Test Agent",
        }),
      );
    });
  });
});
