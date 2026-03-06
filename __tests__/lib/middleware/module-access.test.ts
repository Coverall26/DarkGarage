/**
 * Tests for Module Access Middleware (v3 Rebrand)
 *
 * Tests inline check functions (checkModuleAccess, checkModuleLimit,
 * checkModuleLimitAuto), HOF wrappers (withModuleAccess, withModuleAccessApp,
 * withModuleLimit, withModuleLimitAuto), and resolveOrgIdFromTeam helper.
 */

// Unmock so we test the real module-access implementation (overrides global mock in jest.setup.ts)
jest.unmock("@/lib/middleware/module-access");

// Mock prisma before imports
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    userTeam: {
      findFirst: jest.fn(),
    },
    team: {
      findUnique: jest.fn(),
    },
    orgProductModule: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    orgAddOn: {
      findMany: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth/auth-options", () => ({
  authOptions: {},
}));

jest.mock("@/lib/auth/getMiddlewareUser", () => ({
  getMiddlewareUser: jest.fn(),
}));

jest.mock("@/lib/modules/provision-engine", () => {
  const actual = jest.requireActual("@/lib/modules/provision-engine");
  return {
    ...actual,
    hasModule: jest.fn(),
    getModuleLimit: jest.fn(),
    isOverLimit: jest.fn(),
    getModuleUsage: jest.fn(),
  };
});

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { getMiddlewareUser } from "@/lib/auth/getMiddlewareUser";
import {
  hasModule,
  getModuleLimit,
  isOverLimit,
  getModuleUsage,
} from "@/lib/modules/provision-engine";
import {
  checkModuleAccess,
  checkModuleLimit,
  checkModuleLimitAuto,
  withModuleAccess,
  withModuleAccessApp,
  withModuleLimit,
  withModuleLimitAuto,
  resolveOrgIdFromTeam,
} from "@/lib/middleware/module-access";

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGetServerSession = getServerSession as jest.Mock;
const mockGetMiddlewareUser = getMiddlewareUser as jest.Mock;
const mockHasModule = hasModule as jest.Mock;
const mockGetModuleLimit = getModuleLimit as jest.Mock;
const mockIsOverLimit = isOverLimit as jest.Mock;
const mockGetModuleUsage = getModuleUsage as jest.Mock;

function mockRequest(url = "http://localhost:3000/api/test"): NextRequest {
  return new NextRequest(url);
}

function mockRequestWithHeaders(
  userId: string | null,
  url = "http://localhost:3000/api/test",
): NextRequest {
  const headers: Record<string, string> = {};
  if (userId) {
    headers["x-middleware-user-id"] = userId;
    headers["x-middleware-user-email"] = "user@test.com";
    headers["x-middleware-user-role"] = "ADMIN";
  }
  return new NextRequest(url, { headers });
}

// Helper: mock resolveOrgId via userTeam.findFirst
function mockResolveOrgId(orgId: string | null) {
  if (orgId) {
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue({
      team: { organizationId: orgId },
    });
  } else {
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);
  }
}

// ============================================================================
// resolveOrgIdFromTeam
// ============================================================================

describe("resolveOrgIdFromTeam", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns organizationId when team exists", async () => {
    (mockPrisma.team.findUnique as jest.Mock).mockResolvedValue({
      organizationId: "org-123",
    });

    const result = await resolveOrgIdFromTeam("team-1");
    expect(result).toBe("org-123");
    expect(mockPrisma.team.findUnique).toHaveBeenCalledWith({
      where: { id: "team-1" },
      select: { organizationId: true },
    });
  });

  it("returns null when team not found", async () => {
    (mockPrisma.team.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await resolveOrgIdFromTeam("nonexistent");
    expect(result).toBeNull();
  });

  it("returns null when team has no organizationId", async () => {
    (mockPrisma.team.findUnique as jest.Mock).mockResolvedValue({
      organizationId: null,
    });

    const result = await resolveOrgIdFromTeam("team-1");
    expect(result).toBeNull();
  });
});

// ============================================================================
// checkModuleAccess
// ============================================================================

describe("checkModuleAccess", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns null when module is enabled", async () => {
    mockHasModule.mockResolvedValue(true);

    const result = await checkModuleAccess("org-1", "SIGNSUITE");
    expect(result).toBeNull();
  });

  it("returns 403 NextResponse when module is not enabled", async () => {
    mockHasModule.mockResolvedValue(false);

    const result = await checkModuleAccess("org-1", "SIGNSUITE");
    expect(result).toBeInstanceOf(NextResponse);
    expect(result!.status).toBe(403);

    const body = await result!.json();
    expect(body.error).toBe("MODULE_NOT_AVAILABLE");
    expect(body.module).toBe("SIGNSUITE");
    expect(body.upgrade_paths).toBeDefined();
    expect(Array.isArray(body.upgrade_paths)).toBe(true);
  });

  it("returns 403 when module is not available (PIPELINE_IQ)", async () => {
    mockHasModule.mockResolvedValue(false);

    const result = await checkModuleAccess("org-1", "PIPELINE_IQ");
    expect(result).toBeInstanceOf(NextResponse);
    expect(result!.status).toBe(403);

    const body = await result!.json();
    expect(body.error).toBe("MODULE_NOT_AVAILABLE");
    expect(body.module).toBe("PIPELINE_IQ");
  });

  it("includes v3 upgrade paths for SIGNSUITE", async () => {
    mockHasModule.mockResolvedValue(false);

    const result = await checkModuleAccess("org-1", "SIGNSUITE");
    expect(result).toBeInstanceOf(NextResponse);
    const body = await result!.json();
    expect(body.upgrade_paths.length).toBeGreaterThan(0);
    expect(body.upgrade_paths[0].url).toBe("/admin/settings?tab=billing");
    // v3 naming: "Pro" not "CRM Pro"
    expect(body.upgrade_paths[0].name).toBe("Pro");
  });

  it("includes v3 upgrade paths for PIPELINE_IQ", async () => {
    mockHasModule.mockResolvedValue(false);

    const result = await checkModuleAccess("org-1", "PIPELINE_IQ");
    const body = await result!.json();
    expect(body.upgrade_paths.length).toBeGreaterThan(0);
    // v3 naming: "Pro" not "CRM Pro"
    expect(body.upgrade_paths.some((p: { name: string }) => p.name === "Pro")).toBe(true);
  });

  it("includes upgrade paths for RAISEROOM", async () => {
    mockHasModule.mockResolvedValue(false);

    const result = await checkModuleAccess("org-1", "RAISEROOM");
    const body = await result!.json();
    expect(body.upgrade_paths.length).toBe(3);
    expect(body.upgrade_paths[0].name).toBe("Pro");
    expect(body.upgrade_paths[1].name).toBe("Business");
    expect(body.upgrade_paths[2].name).toBe("FundRoom");
  });

  it("includes upgrade paths for RAISE_CRM", async () => {
    mockHasModule.mockResolvedValue(false);

    const result = await checkModuleAccess("org-1", "RAISE_CRM");
    const body = await result!.json();
    expect(body.upgrade_paths.length).toBe(3);
    expect(body.upgrade_paths[0].name).toBe("Pro — unlimited contacts");
    expect(body.upgrade_paths[1].name).toBe("Business — analytics & automation");
    expect(body.upgrade_paths[2].name).toBe("FundRoom");
  });

  it("returns empty upgrade paths for DATAROOM (available on all tiers)", async () => {
    mockHasModule.mockResolvedValue(false);

    const result = await checkModuleAccess("org-1", "DATAROOM");
    const body = await result!.json();
    expect(body.upgrade_paths).toEqual([]);
  });

  it("returns FundRoom-only upgrade path for FUNDROOM module", async () => {
    mockHasModule.mockResolvedValue(false);

    const result = await checkModuleAccess("org-1", "FUNDROOM");
    const body = await result!.json();
    expect(body.upgrade_paths.length).toBe(1);
    expect(body.upgrade_paths[0].name).toBe("FundRoom");
    expect(body.upgrade_paths[0].price).toBe("$79/mo");
  });

  it("returns fallback upgrade path for unknown module", async () => {
    mockHasModule.mockResolvedValue(false);

    const result = await checkModuleAccess("org-1", "UNKNOWN_MODULE" as any);
    const body = await result!.json();
    expect(body.upgrade_paths.length).toBe(1);
    expect(body.upgrade_paths[0].name).toBe("FundRoom");
  });
});

// ============================================================================
// checkModuleLimit
// ============================================================================

describe("checkModuleLimit", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns null when under limit", async () => {
    mockIsOverLimit.mockResolvedValue(false);

    const result = await checkModuleLimit("org-1", "PIPELINE_IQ_LITE", "MAX_CONTACTS", 10);
    expect(result).toBeNull();
  });

  it("returns 403 when at or over limit", async () => {
    mockIsOverLimit.mockResolvedValue(true);
    mockGetModuleLimit.mockResolvedValue(20);

    const result = await checkModuleLimit("org-1", "PIPELINE_IQ_LITE", "MAX_CONTACTS", 20);
    expect(result).toBeInstanceOf(NextResponse);
    expect(result!.status).toBe(403);

    const body = await result!.json();
    expect(body.error).toBe("LIMIT_EXCEEDED");
    expect(body.module).toBe("PIPELINE_IQ_LITE");
    expect(body.limitType).toBe("MAX_CONTACTS");
    expect(body.current).toBe(20);
    expect(body.limit).toBe(20);
  });

  it("returns 403 when over limit", async () => {
    mockIsOverLimit.mockResolvedValue(true);
    mockGetModuleLimit.mockResolvedValue(20);

    const result = await checkModuleLimit("org-1", "PIPELINE_IQ_LITE", "MAX_CONTACTS", 25);
    expect(result).toBeInstanceOf(NextResponse);

    const body = await result!.json();
    expect(body.error).toBe("LIMIT_EXCEEDED");
    expect(body.current).toBe(25);
    expect(body.limit).toBe(20);
  });

  it("returns null when not over limit (unlimited)", async () => {
    mockIsOverLimit.mockResolvedValue(false);

    const result = await checkModuleLimit("org-1", "PIPELINE_IQ", "MAX_CONTACTS", 5000);
    expect(result).toBeNull();
  });

  it("includes upgrade paths in limit exceeded response", async () => {
    mockIsOverLimit.mockResolvedValue(true);
    mockGetModuleLimit.mockResolvedValue(20);

    const result = await checkModuleLimit("org-1", "PIPELINE_IQ_LITE", "MAX_CONTACTS", 20);
    const body = await result!.json();
    expect(body.upgrade_paths).toBeDefined();
    expect(body.upgrade_paths.length).toBeGreaterThan(0);
  });

  it("returns limit as 0 when getModuleLimit returns null", async () => {
    mockIsOverLimit.mockResolvedValue(true);
    mockGetModuleLimit.mockResolvedValue(null);

    const result = await checkModuleLimit("org-1", "SIGNSUITE", "MONTHLY_ESIGN", 15);
    const body = await result!.json();
    expect(body.limit).toBe(0);
  });
});

// ============================================================================
// checkModuleLimitAuto
// ============================================================================

describe("checkModuleLimitAuto", () => {
  beforeEach(() => jest.clearAllMocks());

  it("auto-counts usage and returns null when under limit", async () => {
    mockGetModuleUsage.mockResolvedValue(5);
    mockIsOverLimit.mockResolvedValue(false);

    const result = await checkModuleLimitAuto("org-1", "SIGNSUITE", "MONTHLY_ESIGN");
    expect(result).toBeNull();
    expect(mockGetModuleUsage).toHaveBeenCalledWith("org-1", "SIGNSUITE", "MONTHLY_ESIGN");
  });

  it("auto-counts usage and returns 403 when over limit", async () => {
    mockGetModuleUsage.mockResolvedValue(15);
    mockIsOverLimit.mockResolvedValue(true);
    mockGetModuleLimit.mockResolvedValue(10);

    const result = await checkModuleLimitAuto("org-1", "SIGNSUITE", "MONTHLY_ESIGN");
    expect(result).toBeInstanceOf(NextResponse);
    expect(result!.status).toBe(403);

    const body = await result!.json();
    expect(body.error).toBe("LIMIT_EXCEEDED");
    expect(body.current).toBe(15);
    expect(body.limit).toBe(10);
  });

  it("passes auto-counted value to isOverLimit", async () => {
    mockGetModuleUsage.mockResolvedValue(8);
    mockIsOverLimit.mockResolvedValue(false);

    await checkModuleLimitAuto("org-1", "RAISE_CRM", "MAX_CONTACTS");
    expect(mockIsOverLimit).toHaveBeenCalledWith("org-1", "RAISE_CRM", "MAX_CONTACTS", 8);
  });
});

// ============================================================================
// withModuleAccess HOF (session-based auth)
// ============================================================================

describe("withModuleAccess", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const handler = jest.fn();
    const wrapped = withModuleAccess("SIGNSUITE")(handler);

    const response = await wrapped(mockRequest());
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when user has no org", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockResolveOrgId(null);

    const handler = jest.fn();
    const wrapped = withModuleAccess("SIGNSUITE")(handler);

    const response = await wrapped(mockRequest());
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when module not available", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockResolveOrgId("org-1");
    mockHasModule.mockResolvedValue(false);

    const handler = jest.fn();
    const wrapped = withModuleAccess("PIPELINE_IQ")(handler);

    const response = await wrapped(mockRequest());
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error).toBe("MODULE_NOT_AVAILABLE");
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler when module is available", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockResolveOrgId("org-1");
    mockHasModule.mockResolvedValue(true);

    const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withModuleAccess("SIGNSUITE")(handler);

    const response = await wrapped(mockRequest());
    expect(handler).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});

// ============================================================================
// withModuleAccessApp HOF (edge-auth headers)
// ============================================================================

describe("withModuleAccessApp", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when no user from edge-auth headers", async () => {
    mockGetMiddlewareUser.mockReturnValue({ id: null, email: null, role: null });

    const handler = jest.fn();
    const wrapped = withModuleAccessApp("RAISE_CRM")(handler);

    const response = await wrapped(mockRequest());
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when user has no org", async () => {
    mockGetMiddlewareUser.mockReturnValue({ id: "user-1", email: "u@test.com", role: "ADMIN" });
    mockResolveOrgId(null);

    const handler = jest.fn();
    const wrapped = withModuleAccessApp("RAISE_CRM")(handler);

    const response = await wrapped(mockRequest());
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when module not available", async () => {
    mockGetMiddlewareUser.mockReturnValue({ id: "user-1", email: "u@test.com", role: "ADMIN" });
    mockResolveOrgId("org-1");
    mockHasModule.mockResolvedValue(false);

    const handler = jest.fn();
    const wrapped = withModuleAccessApp("RAISE_CRM")(handler);

    const response = await wrapped(mockRequest());
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error).toBe("MODULE_NOT_AVAILABLE");
    expect(body.module).toBe("RAISE_CRM");
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler when module is available", async () => {
    mockGetMiddlewareUser.mockReturnValue({ id: "user-1", email: "u@test.com", role: "ADMIN" });
    mockResolveOrgId("org-1");
    mockHasModule.mockResolvedValue(true);

    const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withModuleAccessApp("RAISE_CRM")(handler);

    const response = await wrapped(mockRequest());
    expect(handler).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("uses getMiddlewareUser instead of getServerSession", async () => {
    mockGetMiddlewareUser.mockReturnValue({ id: "user-1", email: "u@test.com", role: "ADMIN" });
    mockResolveOrgId("org-1");
    mockHasModule.mockResolvedValue(true);

    const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withModuleAccessApp("SIGNSUITE")(handler);

    await wrapped(mockRequest());
    expect(mockGetMiddlewareUser).toHaveBeenCalled();
    expect(mockGetServerSession).not.toHaveBeenCalled();
  });
});

// ============================================================================
// withModuleLimit HOF (manual counting, session-based auth)
// ============================================================================

describe("withModuleLimit", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const countFn = jest.fn();
    const handler = jest.fn();
    const wrapped = withModuleLimit("PIPELINE_IQ_LITE", "MAX_CONTACTS", countFn)(handler);

    const response = await wrapped(mockRequest());
    expect(response.status).toBe(401);
    expect(countFn).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when user has no org", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockResolveOrgId(null);

    const countFn = jest.fn();
    const handler = jest.fn();
    const wrapped = withModuleLimit("PIPELINE_IQ_LITE", "MAX_CONTACTS", countFn)(handler);

    const response = await wrapped(mockRequest());
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when over limit", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockResolveOrgId("org-1");
    mockIsOverLimit.mockResolvedValue(true);
    mockGetModuleLimit.mockResolvedValue(20);

    const countFn = jest.fn().mockResolvedValue(20);
    const handler = jest.fn();
    const wrapped = withModuleLimit("PIPELINE_IQ_LITE", "MAX_CONTACTS", countFn)(handler);

    const response = await wrapped(mockRequest());
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error).toBe("LIMIT_EXCEEDED");
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler when under limit", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockResolveOrgId("org-1");
    mockIsOverLimit.mockResolvedValue(false);

    const countFn = jest.fn().mockResolvedValue(10);
    const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withModuleLimit("PIPELINE_IQ_LITE", "MAX_CONTACTS", countFn)(handler);

    const response = await wrapped(mockRequest());
    expect(handler).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("passes orgId to countFn", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mockResolveOrgId("org-1");
    mockIsOverLimit.mockResolvedValue(false);

    const countFn = jest.fn().mockResolvedValue(5);
    const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withModuleLimit("PIPELINE_IQ_LITE", "MAX_CONTACTS", countFn)(handler);

    const req = mockRequest();
    await wrapped(req);
    expect(countFn).toHaveBeenCalledWith(req, "org-1");
  });
});

// ============================================================================
// withModuleLimitAuto HOF (auto counting, edge-auth)
// ============================================================================

describe("withModuleLimitAuto", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when no user from edge-auth headers", async () => {
    mockGetMiddlewareUser.mockReturnValue({ id: null, email: null, role: null });

    const handler = jest.fn();
    const wrapped = withModuleLimitAuto("SIGNSUITE", "MONTHLY_ESIGN")(handler);

    const response = await wrapped(mockRequest());
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when user has no org", async () => {
    mockGetMiddlewareUser.mockReturnValue({ id: "user-1", email: "u@test.com", role: "ADMIN" });
    mockResolveOrgId(null);

    const handler = jest.fn();
    const wrapped = withModuleLimitAuto("SIGNSUITE", "MONTHLY_ESIGN")(handler);

    const response = await wrapped(mockRequest());
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when auto-counted usage exceeds limit", async () => {
    mockGetMiddlewareUser.mockReturnValue({ id: "user-1", email: "u@test.com", role: "ADMIN" });
    mockResolveOrgId("org-1");
    mockGetModuleUsage.mockResolvedValue(15);
    mockIsOverLimit.mockResolvedValue(true);
    mockGetModuleLimit.mockResolvedValue(10);

    const handler = jest.fn();
    const wrapped = withModuleLimitAuto("SIGNSUITE", "MONTHLY_ESIGN")(handler);

    const response = await wrapped(mockRequest());
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error).toBe("LIMIT_EXCEEDED");
    expect(body.module).toBe("SIGNSUITE");
    expect(body.limitType).toBe("MONTHLY_ESIGN");
    expect(body.current).toBe(15);
    expect(body.limit).toBe(10);
    expect(handler).not.toHaveBeenCalled();
  });

  it("calls handler when auto-counted usage is within limit", async () => {
    mockGetMiddlewareUser.mockReturnValue({ id: "user-1", email: "u@test.com", role: "ADMIN" });
    mockResolveOrgId("org-1");
    mockGetModuleUsage.mockResolvedValue(3);
    mockIsOverLimit.mockResolvedValue(false);

    const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withModuleLimitAuto("SIGNSUITE", "MONTHLY_ESIGN")(handler);

    const response = await wrapped(mockRequest());
    expect(handler).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("uses getMiddlewareUser instead of getServerSession", async () => {
    mockGetMiddlewareUser.mockReturnValue({ id: "user-1", email: "u@test.com", role: "ADMIN" });
    mockResolveOrgId("org-1");
    mockGetModuleUsage.mockResolvedValue(0);
    mockIsOverLimit.mockResolvedValue(false);

    const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withModuleLimitAuto("RAISE_CRM", "MAX_CONTACTS")(handler);

    await wrapped(mockRequest());
    expect(mockGetMiddlewareUser).toHaveBeenCalled();
    expect(mockGetServerSession).not.toHaveBeenCalled();
  });

  it("calls getModuleUsage with correct args", async () => {
    mockGetMiddlewareUser.mockReturnValue({ id: "user-1", email: "u@test.com", role: "ADMIN" });
    mockResolveOrgId("org-1");
    mockGetModuleUsage.mockResolvedValue(0);
    mockIsOverLimit.mockResolvedValue(false);

    const handler = jest.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withModuleLimitAuto("SIGNSUITE", "MONTHLY_ESIGN")(handler);

    await wrapped(mockRequest());
    expect(mockGetModuleUsage).toHaveBeenCalledWith("org-1", "SIGNSUITE", "MONTHLY_ESIGN");
  });
});
