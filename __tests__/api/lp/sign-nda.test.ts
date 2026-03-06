/**
 * Tests for POST /api/lp/sign-nda
 *
 * Records NDA acceptance for an LP investor.
 * Tests: auth, validation, happy path, missing profile, audit logging.
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

const mockLogAuditEvent = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/audit/audit-logger", () => ({
  logAuditEvent: (...args: any[]) => mockLogAuditEvent(...args),
}));

jest.mock("@/lib/tracking/server-events", () => ({
  publishServerEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/emails/send-nda-signed-confirmation", () => ({
  sendNdaSignedConfirmation: jest.fn().mockResolvedValue(undefined),
}));

// ── Import handler after mocks ─────────────────────────────────────────────

import { POST } from "@/app/api/lp/sign-nda/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/lp/sign-nda", {
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

const MOCK_INVESTOR = {
  id: "inv-1",
  userId: "user-1",
  ndaSigned: false,
  ndaSignedAt: null,
  onboardingStep: 3,
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/lp/sign-nda", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireLPAuthAppRouter.mockResolvedValue(AUTH_RESULT);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireLPAuthAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await POST(makeRequest({ ndaAccepted: true }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when ndaAccepted is false", async () => {
    const res = await POST(makeRequest({ ndaAccepted: false }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 400 when ndaAccepted is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when user not found", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await POST(makeRequest({ ndaAccepted: true }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("User not found");
  });

  it("returns 404 when investor profile not found", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      email: "lp@example.com",
      investorProfile: null,
    });

    const res = await POST(makeRequest({ ndaAccepted: true }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain("Investor profile not found");
  });

  it("returns 200 and updates NDA status on success", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      email: "lp@example.com",
      investorProfile: MOCK_INVESTOR,
    });
    (prisma.investor.update as jest.Mock).mockResolvedValue({
      ...MOCK_INVESTOR,
      ndaSigned: true,
    });
    (prisma.fund.findUnique as jest.Mock).mockResolvedValue({
      teamId: "team-1",
    });

    const res = await POST(
      makeRequest({ ndaAccepted: true, fundId: "fund-1" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.ndaSigned).toBe(true);
    expect(json.ndaSignedAt).toBeDefined();

    // Verify investor updated
    expect(prisma.investor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-1" },
        data: expect.objectContaining({
          ndaSigned: true,
          ndaSignedAt: expect.any(Date),
          onboardingStep: 5,
        }),
      }),
    );
  });

  it("advances onboardingStep only if current is lower", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      email: "lp@example.com",
      investorProfile: { ...MOCK_INVESTOR, onboardingStep: 7 },
    });
    (prisma.investor.update as jest.Mock).mockResolvedValue({});

    const res = await POST(makeRequest({ ndaAccepted: true }));
    expect(res.status).toBe(200);

    expect(prisma.investor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboardingStep: 7, // Math.max(7, 5) = 7
        }),
      }),
    );
  });

  it("audit logs the NDA signing with correct metadata", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      email: "lp@example.com",
      investorProfile: MOCK_INVESTOR,
    });
    (prisma.investor.update as jest.Mock).mockResolvedValue({});
    (prisma.fund.findUnique as jest.Mock).mockResolvedValue({
      teamId: "team-1",
    });

    await POST(
      makeRequest({
        ndaAccepted: true,
        fundId: "fund-1",
        signatureMethod: "TYPED",
        signatureData: "John Doe",
      }),
    );

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "NDA_SIGNED",
        userId: "user-1",
        teamId: "team-1",
        resourceType: "Investor",
        resourceId: "inv-1",
        metadata: expect.objectContaining({
          fundId: "fund-1",
          signatureMethod: "TYPED",
          typedName: "John Doe",
        }),
      }),
    );
  });

  it("handles null fundId gracefully (no team lookup)", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      email: "lp@example.com",
      investorProfile: MOCK_INVESTOR,
    });
    (prisma.investor.update as jest.Mock).mockResolvedValue({});

    const res = await POST(makeRequest({ ndaAccepted: true }));
    expect(res.status).toBe(200);

    // fund.findUnique should not be called without fundId
    expect(prisma.fund.findUnique).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected error", async () => {
    (prisma.user.findUnique as jest.Mock).mockRejectedValue(
      new Error("DB connection failed"),
    );

    const res = await POST(makeRequest({ ndaAccepted: true }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
  });
});
