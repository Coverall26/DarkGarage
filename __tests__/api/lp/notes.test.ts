/**
 * Tests for POST /api/lp/notes
 *
 * Creates a new investor note/message to the GP team.
 * Tests: auth, validation, note creation, email notification, error handling.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockRequireLPAuthAppRouter = jest.fn();

jest.mock("@/lib/auth/rbac", () => ({
  requireLPAuthAppRouter: (...args: any[]) =>
    mockRequireLPAuthAppRouter(...args),
  enforceRBAC: jest.fn(),
  requireAdmin: jest.fn(),
  enforceRBACAppRouter: jest.fn(),
  requireAdminAppRouter: jest.fn(),
}));

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

// Mock Resend — the route constructs it inline with `new Resend()`
const mockResendSend = jest.fn().mockResolvedValue({ id: "email-1" });
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockResendSend },
  })),
}));

// ── Import handler after mocks ─────────────────────────────────────────────

import { POST } from "@/app/api/lp/notes/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/lp/notes", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const AUTH_RESULT = {
  userId: "user-1",
  email: "lp@example.com",
  investorId: "inv-1",
  session: { user: { id: "user-1", email: "lp@example.com" } },
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/lp/notes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireLPAuthAppRouter.mockResolvedValue(AUTH_RESULT);
    // Set RESEND_API_KEY for email tests
    process.env.RESEND_API_KEY = "re_test_123";
  });

  afterAll(() => {
    delete process.env.RESEND_API_KEY;
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireLPAuthAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await POST(makeRequest({ content: "Hello" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when content is empty", async () => {
    const res = await POST(makeRequest({ content: "" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 400 when content is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when content exceeds 5000 chars", async () => {
    const res = await POST(makeRequest({ content: "x".repeat(5001) }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when investor profile not found", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await POST(makeRequest({ content: "Hello GP team" }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Investor profile not found");
  });

  it("returns 500 when no default team found", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: { id: "inv-1", entityName: "Acme LLC" },
    });
    (prisma.team.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await POST(makeRequest({ content: "Test note" }));
    expect(res.status).toBe(500);
  });

  it("creates note and returns success", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: { id: "inv-1", entityName: "Acme LLC" },
    });
    (prisma.team.findFirst as jest.Mock).mockResolvedValue({
      id: "team-1",
      name: "GP Team",
    });
    (prisma.investorNote.create as jest.Mock).mockResolvedValue({
      id: "note-1",
      content: "Hello GP team",
      isFromInvestor: true,
    });
    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
      user: { email: "gp@example.com" },
    });

    const res = await POST(makeRequest({ content: "  Hello GP team  " }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    // Verify note creation with trimmed content
    expect(prisma.investorNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          investorId: "inv-1",
          teamId: "team-1",
          content: "Hello GP team",
          isFromInvestor: true,
        }),
      }),
    );
  });

  it("sends email notification to team owner", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: { id: "inv-1", entityName: "Acme LLC" },
    });
    (prisma.team.findFirst as jest.Mock).mockResolvedValue({
      id: "team-1",
    });
    (prisma.investorNote.create as jest.Mock).mockResolvedValue({
      id: "note-1",
    });
    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
      user: { email: "gp@example.com" },
    });

    await POST(makeRequest({ content: "Question about the fund" }));

    expect(mockResendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "gp@example.com",
        subject: expect.stringContaining("New Message from Investor"),
      }),
    );
  });

  it("does not fail if email send fails", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: { id: "inv-1", entityName: "Acme LLC" },
    });
    (prisma.team.findFirst as jest.Mock).mockResolvedValue({
      id: "team-1",
    });
    (prisma.investorNote.create as jest.Mock).mockResolvedValue({
      id: "note-1",
    });
    (prisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
      user: { email: "gp@example.com" },
    });
    mockResendSend.mockRejectedValue(new Error("Email failure"));

    const res = await POST(
      makeRequest({ content: "Test despite email fail" }),
    );
    // Should still return success — email is fire-and-forget
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("skips email when RESEND_API_KEY is not set", async () => {
    delete process.env.RESEND_API_KEY;

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: { id: "inv-1", entityName: null },
    });
    (prisma.team.findFirst as jest.Mock).mockResolvedValue({
      id: "team-1",
    });
    (prisma.investorNote.create as jest.Mock).mockResolvedValue({
      id: "note-2",
    });

    const res = await POST(makeRequest({ content: "No email" }));
    expect(res.status).toBe(200);

    // Email send should not be called
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected error", async () => {
    (prisma.user.findUnique as jest.Mock).mockRejectedValue(
      new Error("DB failure"),
    );

    const res = await POST(makeRequest({ content: "Test" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
  });
});
