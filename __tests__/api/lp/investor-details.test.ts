/**
 * Tests for POST /api/lp/investor-details
 *
 * Saves investor entity type, details, tax ID (encrypted), and address.
 * Tests: auth, validation, entity types, tax ID encryption, audit logging.
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

const mockEncryptTaxId = jest.fn().mockReturnValue("encrypted-tax-id");
jest.mock("@/lib/crypto/secure-storage", () => ({
  encryptTaxId: (...args: any[]) => mockEncryptTaxId(...args),
}));

// ── Import handler after mocks ─────────────────────────────────────────────

import { POST } from "@/app/api/lp/investor-details/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/lp/investor-details", {
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
  entityType: null,
  onboardingStep: 2,
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/lp/investor-details", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireLPAuthAppRouter.mockResolvedValue(AUTH_RESULT);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireLPAuthAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await POST(makeRequest({ entityType: "INDIVIDUAL" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid entity type", async () => {
    const res = await POST(makeRequest({ entityType: "INVALID_TYPE" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 404 when user not found", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await POST(makeRequest({ entityType: "INDIVIDUAL" }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("User not found");
  });

  it("returns 404 when investor profile not found", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: null,
    });

    const res = await POST(makeRequest({ entityType: "INDIVIDUAL" }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Investor profile not found");
  });

  it("saves entity type successfully", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: MOCK_INVESTOR,
    });
    (prisma.investor.update as jest.Mock).mockResolvedValue({
      ...MOCK_INVESTOR,
      entityType: "LLC_CORPORATION",
    });

    const res = await POST(
      makeRequest({
        entityType: "LLC_CORPORATION",
        entityName: "Acme LLC",
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.entityType).toBe("LLC_CORPORATION");

    expect(prisma.investor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inv-1" },
        data: expect.objectContaining({
          entityType: "LLC_CORPORATION",
          entityName: "Acme LLC",
          onboardingStep: 4,
        }),
      }),
    );
  });

  it("encrypts tax ID when provided", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: MOCK_INVESTOR,
    });
    (prisma.investor.update as jest.Mock).mockResolvedValue({});

    const res = await POST(
      makeRequest({
        entityType: "INDIVIDUAL",
        taxId: "123-45-6789",
        taxIdType: "SSN",
      }),
    );
    expect(res.status).toBe(200);

    // Verify tax ID was encrypted (dashes/spaces stripped)
    expect(mockEncryptTaxId).toHaveBeenCalledWith("123456789");

    expect(prisma.investor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taxIdEncrypted: "encrypted-tax-id",
          taxIdType: "SSN",
        }),
      }),
    );
  });

  it("defaults taxIdType to SSN for Individual", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: MOCK_INVESTOR,
    });
    (prisma.investor.update as jest.Mock).mockResolvedValue({});

    await POST(
      makeRequest({
        entityType: "INDIVIDUAL",
        taxId: "123456789",
      }),
    );

    expect(prisma.investor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taxIdType: "SSN",
        }),
      }),
    );
  });

  it("defaults taxIdType to EIN for LLC", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: MOCK_INVESTOR,
    });
    (prisma.investor.update as jest.Mock).mockResolvedValue({});

    await POST(
      makeRequest({
        entityType: "LLC",
        taxId: "123456789",
      }),
    );

    expect(prisma.investor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taxIdType: "EIN",
        }),
      }),
    );
  });

  it("saves address when provided", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: MOCK_INVESTOR,
    });
    (prisma.investor.update as jest.Mock).mockResolvedValue({});

    const address = {
      street1: "123 Main St",
      city: "New York",
      state: "NY",
      zip: "10001",
      country: "US",
    };

    const res = await POST(
      makeRequest({ entityType: "INDIVIDUAL", address }),
    );
    expect(res.status).toBe(200);

    expect(prisma.investor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          address,
        }),
      }),
    );
  });

  it("saves authorized signer info", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: MOCK_INVESTOR,
    });
    (prisma.investor.update as jest.Mock).mockResolvedValue({});

    const res = await POST(
      makeRequest({
        entityType: "LLC_CORPORATION",
        authorizedSignerName: "Jane Smith",
        authorizedSignerTitle: "CEO",
        authorizedSignerEmail: "jane@acme.com",
      }),
    );
    expect(res.status).toBe(200);

    expect(prisma.investor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authorizedSignerName: "Jane Smith",
          authorizedSignerTitle: "CEO",
          authorizedSignerEmail: "jane@acme.com",
        }),
      }),
    );
  });

  it("resolves teamId from fundId for audit", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: MOCK_INVESTOR,
    });
    (prisma.investor.update as jest.Mock).mockResolvedValue({});
    (prisma.fund.findUnique as jest.Mock).mockResolvedValue({
      teamId: "team-1",
    });

    await POST(
      makeRequest({ entityType: "TRUST", fundId: "fund-1" }),
    );

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "INVESTOR_UPDATED",
        teamId: "team-1",
        metadata: expect.objectContaining({
          entityType: "TRUST",
          fundId: "fund-1",
        }),
      }),
    );
  });

  it("does not advance onboardingStep if current is higher", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: { ...MOCK_INVESTOR, onboardingStep: 8 },
    });
    (prisma.investor.update as jest.Mock).mockResolvedValue({});

    await POST(makeRequest({ entityType: "INDIVIDUAL" }));

    expect(prisma.investor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboardingStep: 8, // Math.max(8, 4) = 8
        }),
      }),
    );
  });

  it("returns 500 on unexpected error", async () => {
    (prisma.user.findUnique as jest.Mock).mockRejectedValue(
      new Error("DB error"),
    );

    const res = await POST(makeRequest({ entityType: "INDIVIDUAL" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
  });

  it("accepts all valid entity types", async () => {
    const validTypes = [
      "INDIVIDUAL", "JOINT", "TRUST", "TRUST_ESTATE",
      "LLC", "LLC_CORPORATION", "CORPORATION", "PARTNERSHIP",
      "IRA", "IRA_RETIREMENT", "CHARITY", "CHARITY_FOUNDATION", "OTHER",
    ];

    for (const entityType of validTypes) {
      jest.clearAllMocks();
      mockRequireLPAuthAppRouter.mockResolvedValue(AUTH_RESULT);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user-1",
        investorProfile: MOCK_INVESTOR,
      });
      (prisma.investor.update as jest.Mock).mockResolvedValue({});

      const res = await POST(makeRequest({ entityType }));
      expect(res.status).toBe(200);
    }
  });
});
