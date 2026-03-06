/**
 * Comprehensive test suite for lib/auth/rbac.ts
 *
 * Tests all 13 exports:
 *  1. enforceRBAC (Pages Router)
 *  2. enforceRBACAppRouter (App Router)
 *  3. requireAdmin (Pages Router shortcut)
 *  4. requireTeamMember (Pages Router shortcut)
 *  5. requireGPAccess (Pages Router shortcut)
 *  6. hasRole (boolean check)
 *  7. requireAdminAppRouter (App Router shortcut)
 *  8. requireTeamMemberAppRouter (App Router shortcut)
 *  9. requireGPAccessAppRouter (App Router shortcut)
 * 10. requireAuthAppRouter (session-only App Router)
 * 11. withAuth (HOF for Pages Router)
 * 12. requireLPAuth (Pages Router LP auth)
 * 13. requireLPAuthAppRouter (App Router LP auth)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

jest.mock("@/lib/auth/auth-options", () => ({
  authOptions: { providers: [], session: { strategy: "jwt" } },
}));

import {
  enforceRBAC,
  enforceRBACAppRouter,
  requireAdmin,
  requireTeamMember,
  requireGPAccess,
  hasRole,
  requireAdminAppRouter,
  requireTeamMemberAppRouter,
  requireGPAccessAppRouter,
  requireAuthAppRouter,
  withAuth,
  requireLPAuth,
  requireLPAuthAppRouter,
  RBACRole,
} from "@/lib/auth/rbac";
import prisma from "@/lib/prisma";

const mockGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ---------- Helpers ----------

function makeReq(
  overrides: Partial<NextApiRequest> = {},
): NextApiRequest {
  return {
    query: {},
    body: {},
    method: "GET",
    ...overrides,
  } as unknown as NextApiRequest;
}

function makeRes(): NextApiResponse & {
  status: jest.Mock;
  json: jest.Mock;
  setHeader: jest.Mock;
} {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  } as unknown as NextApiResponse & {
    status: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
  };
}

const MOCK_USER = {
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
};

const MOCK_SESSION = {
  user: MOCK_USER,
  expires: new Date(Date.now() + 86400000).toISOString(),
};

const MOCK_USER_TEAM = {
  id: "ut-1",
  userId: "user-123",
  teamId: "team-abc",
  role: "ADMIN",
  status: "ACTIVE",
};

// ---------- Global Setup ----------

beforeEach(() => {
  jest.clearAllMocks();
});

// ================================================================
// 1. enforceRBAC (Pages Router)
// ================================================================
describe("enforceRBAC (Pages Router)", () => {
  it("returns null and sends 401 when no session", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const req = makeReq();
    const res = makeRes();

    const result = await enforceRBAC(req, res, { roles: ["ADMIN"] });

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("returns null and sends 401 when session has no user id", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { email: "no-id@example.com" },
      expires: "",
    } as any);
    const req = makeReq();
    const res = makeRes();

    const result = await enforceRBAC(req, res, { roles: ["ADMIN"] });

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns null and sends 400 when teamId missing and requireTeamId is not false", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    const req = makeReq();
    const res = makeRes();

    const result = await enforceRBAC(req, res, { roles: ["ADMIN"] });

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "teamId is required" });
  });

  it("returns RBACResult with empty teamId when requireTeamId=false and no teamId", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    const req = makeReq();
    const res = makeRes();

    const result = await enforceRBAC(req, res, {
      roles: ["ADMIN"],
      requireTeamId: false,
    });

    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user-123");
    expect(result!.email).toBe("test@example.com");
    expect(result!.teamId).toBe("");
    expect(result!.role).toBe("MEMBER");
    expect(mockPrisma.userTeam.findFirst).not.toHaveBeenCalled();
  });

  it("returns null and sends 403 when userTeam not found (wrong role)", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const req = makeReq();
    const res = makeRes();

    const result = await enforceRBAC(req, res, {
      roles: ["OWNER"],
      teamId: "team-abc",
    });

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Forbidden: insufficient permissions",
    });
  });

  it("returns RBACResult when authorized with explicit teamId", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(
      MOCK_USER_TEAM,
    );
    const req = makeReq();
    const res = makeRes();

    const result = await enforceRBAC(req, res, {
      roles: ["ADMIN", "OWNER"],
      teamId: "team-abc",
    });

    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user-123");
    expect(result!.email).toBe("test@example.com");
    expect(result!.teamId).toBe("team-abc");
    expect(result!.role).toBe("ADMIN");
    expect(result!.session.user).toEqual(MOCK_USER);
  });

  it("extracts teamId from req.query", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(
      MOCK_USER_TEAM,
    );
    const req = makeReq({ query: { teamId: "team-from-query" } });
    const res = makeRes();

    const result = await enforceRBAC(req, res, { roles: ["ADMIN"] });

    expect(result).not.toBeNull();
    expect(result!.teamId).toBe("team-from-query");
    expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ teamId: "team-from-query" }),
      }),
    );
  });

  it("extracts teamId from req.body", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(
      MOCK_USER_TEAM,
    );
    const req = makeReq({ query: {}, body: { teamId: "team-from-body" } });
    const res = makeRes();

    const result = await enforceRBAC(req, res, { roles: ["ADMIN"] });

    expect(result).not.toBeNull();
    expect(result!.teamId).toBe("team-from-body");
  });

  it("prefers options.teamId over query and body", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(
      MOCK_USER_TEAM,
    );
    const req = makeReq({
      query: { teamId: "team-query" },
      body: { teamId: "team-body" },
    });
    const res = makeRes();

    const result = await enforceRBAC(req, res, {
      roles: ["ADMIN"],
      teamId: "team-options",
    });

    expect(result).not.toBeNull();
    expect(result!.teamId).toBe("team-options");
  });

  it("queries Prisma with correct where clause including ACTIVE status", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(
      MOCK_USER_TEAM,
    );
    const req = makeReq();
    const res = makeRes();

    await enforceRBAC(req, res, {
      roles: ["OWNER", "SUPER_ADMIN", "ADMIN"],
      teamId: "team-abc",
    });

    expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-123",
        teamId: "team-abc",
        role: { in: ["OWNER", "SUPER_ADMIN", "ADMIN"] },
        status: "ACTIVE",
      },
    });
  });

  it("handles user with no email gracefully", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: "user-no-email" },
      expires: "",
    });
    const req = makeReq();
    const res = makeRes();

    const result = await enforceRBAC(req, res, {
      roles: ["ADMIN"],
      requireTeamId: false,
    });

    expect(result).not.toBeNull();
    expect(result!.email).toBe("");
  });

  it("allows each of the five roles when they are in the required list", async () => {
    const allRoles: RBACRole[] = [
      "OWNER",
      "SUPER_ADMIN",
      "ADMIN",
      "MANAGER",
      "MEMBER",
    ];
    for (const role of allRoles) {
      jest.clearAllMocks();
      mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce({
        ...MOCK_USER_TEAM,
        role,
      });
      const req = makeReq();
      const res = makeRes();

      const result = await enforceRBAC(req, res, {
        roles: [role],
        teamId: "team-abc",
      });

      expect(result).not.toBeNull();
      expect(result!.role).toBe(role);
    }
  });
});

// ================================================================
// 2. enforceRBACAppRouter
// ================================================================
describe("enforceRBACAppRouter", () => {
  it("returns NextResponse 401 when no session", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const result = await enforceRBACAppRouter({
      roles: ["ADMIN"],
      teamId: "team-abc",
    });

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns NextResponse 400 when teamId missing and requireTeamId not false", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);

    const result = await enforceRBACAppRouter({ roles: ["ADMIN"] });

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("teamId is required");
  });

  it("returns RBACResult when requireTeamId=false and no teamId", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);

    const result = await enforceRBACAppRouter({
      roles: ["ADMIN"],
      requireTeamId: false,
    });

    expect(result).not.toBeInstanceOf(NextResponse);
    const auth = result as any;
    expect(auth.userId).toBe("user-123");
    expect(auth.teamId).toBe("");
    expect(auth.role).toBe("MEMBER");
    expect(mockPrisma.userTeam.findFirst).not.toHaveBeenCalled();
  });

  it("returns NextResponse 403 when unauthorized", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const result = await enforceRBACAppRouter({
      roles: ["OWNER"],
      teamId: "team-abc",
    });

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden: insufficient permissions");
  });

  it("returns RBACResult when authorized", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(
      MOCK_USER_TEAM,
    );

    const result = await enforceRBACAppRouter({
      roles: ["ADMIN", "OWNER"],
      teamId: "team-abc",
    });

    expect(result).not.toBeInstanceOf(NextResponse);
    const auth = result as any;
    expect(auth.userId).toBe("user-123");
    expect(auth.teamId).toBe("team-abc");
    expect(auth.role).toBe("ADMIN");
    expect(auth.session.user).toEqual(MOCK_USER);
  });

  it("queries Prisma with correct where clause", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(
      MOCK_USER_TEAM,
    );

    await enforceRBACAppRouter({
      roles: ["OWNER", "SUPER_ADMIN"],
      teamId: "team-xyz",
    });

    expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-123",
        teamId: "team-xyz",
        role: { in: ["OWNER", "SUPER_ADMIN"] },
        status: "ACTIVE",
      },
    });
  });

  it("returns session-only result with empty teamId when no teamId and requireTeamId=false", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: "user-no-email" },
      expires: "",
    });

    const result = await enforceRBACAppRouter({
      roles: ["ADMIN"],
      requireTeamId: false,
    });

    expect(result).not.toBeInstanceOf(NextResponse);
    const auth = result as any;
    expect(auth.email).toBe("");
    expect(auth.teamId).toBe("");
  });
});

// ================================================================
// 3-5. requireAdmin / requireTeamMember / requireGPAccess (Pages Router)
// ================================================================
describe("requireAdmin / requireTeamMember / requireGPAccess", () => {
  it("requireAdmin passes OWNER, SUPER_ADMIN, ADMIN roles", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce({
      ...MOCK_USER_TEAM,
      role: "OWNER",
    });
    const req = makeReq();
    const res = makeRes();

    const result = await requireAdmin(req, res, "team-abc");

    expect(result).not.toBeNull();
    expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        role: { in: ["OWNER", "SUPER_ADMIN", "ADMIN"] },
      }),
    });
  });

  it("requireTeamMember passes all five roles", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce({
      ...MOCK_USER_TEAM,
      role: "MEMBER",
    });
    const req = makeReq();
    const res = makeRes();

    const result = await requireTeamMember(req, res, "team-abc");

    expect(result).not.toBeNull();
    expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        role: {
          in: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],
        },
      }),
    });
  });

  it("requireGPAccess passes OWNER, SUPER_ADMIN, ADMIN, MANAGER roles", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce({
      ...MOCK_USER_TEAM,
      role: "MANAGER",
    });
    const req = makeReq();
    const res = makeRes();

    const result = await requireGPAccess(req, res, "team-abc");

    expect(result).not.toBeNull();
    expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        role: { in: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"] },
      }),
    });
  });

  it("requireAdmin without explicit teamId extracts from req.query", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(
      MOCK_USER_TEAM,
    );
    const req = makeReq({ query: { teamId: "team-from-query" } });
    const res = makeRes();

    const result = await requireAdmin(req, res);

    expect(result).not.toBeNull();
    expect(result!.teamId).toBe("team-from-query");
  });

  it("requireAdmin rejects MANAGER role", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const req = makeReq();
    const res = makeRes();

    const result = await requireAdmin(req, res, "team-abc");

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("requireGPAccess rejects MEMBER role", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const req = makeReq();
    const res = makeRes();

    const result = await requireGPAccess(req, res, "team-abc");

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ================================================================
// 7-10. App Router shortcut functions
// ================================================================
describe("requireAdminAppRouter / requireTeamMemberAppRouter / requireGPAccessAppRouter / requireAuthAppRouter", () => {
  it("requireAdminAppRouter passes correct roles with teamId", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(
      MOCK_USER_TEAM,
    );

    const result = await requireAdminAppRouter("team-abc");

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        role: { in: ["OWNER", "SUPER_ADMIN", "ADMIN"] },
      }),
    });
  });

  it("requireAdminAppRouter without teamId sets requireTeamId=false by default", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);

    const result = await requireAdminAppRouter();

    expect(result).not.toBeInstanceOf(NextResponse);
    const auth = result as any;
    expect(auth.userId).toBe("user-123");
    expect(auth.teamId).toBe("");
    expect(mockPrisma.userTeam.findFirst).not.toHaveBeenCalled();
  });

  it("requireAdminAppRouter with requireTeamId override forces 400 when no teamId", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);

    const result = await requireAdminAppRouter(undefined, {
      requireTeamId: true,
    });

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });

  it("requireAdminAppRouter with teamId sets requireTeamId=true", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(
      MOCK_USER_TEAM,
    );

    const result = await requireAdminAppRouter("team-abc");

    // Should have queried Prisma (requireTeamId=true when teamId provided)
    expect(mockPrisma.userTeam.findFirst).toHaveBeenCalled();
    expect(result).not.toBeInstanceOf(NextResponse);
  });

  it("requireTeamMemberAppRouter passes all five roles", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce({
      ...MOCK_USER_TEAM,
      role: "MEMBER",
    });

    const result = await requireTeamMemberAppRouter("team-abc");

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        role: {
          in: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],
        },
      }),
    });
  });

  it("requireTeamMemberAppRouter without teamId sets requireTeamId=false", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);

    const result = await requireTeamMemberAppRouter();

    expect(result).not.toBeInstanceOf(NextResponse);
    const auth = result as any;
    expect(auth.teamId).toBe("");
    expect(mockPrisma.userTeam.findFirst).not.toHaveBeenCalled();
  });

  it("requireGPAccessAppRouter passes correct roles", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce({
      ...MOCK_USER_TEAM,
      role: "MANAGER",
    });

    const result = await requireGPAccessAppRouter("team-abc");

    expect(result).not.toBeInstanceOf(NextResponse);
    expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        role: { in: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"] },
      }),
    });
  });

  it("requireGPAccessAppRouter without teamId sets requireTeamId=false", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);

    const result = await requireGPAccessAppRouter();

    expect(result).not.toBeInstanceOf(NextResponse);
    const auth = result as any;
    expect(auth.teamId).toBe("");
    expect(mockPrisma.userTeam.findFirst).not.toHaveBeenCalled();
  });

  it("requireAuthAppRouter returns RBACResult for any logged-in user", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);

    const result = await requireAuthAppRouter();

    expect(result).not.toBeInstanceOf(NextResponse);
    const auth = result as any;
    expect(auth.userId).toBe("user-123");
    expect(auth.teamId).toBe("");
    expect(auth.role).toBe("MEMBER");
    expect(mockPrisma.userTeam.findFirst).not.toHaveBeenCalled();
  });

  it("requireAuthAppRouter returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const result = await requireAuthAppRouter();

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(401);
  });

  it("requireGPAccessAppRouter returns 403 when user lacks role", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const result = await requireGPAccessAppRouter("team-abc");

    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(403);
  });
});

// ================================================================
// 6. hasRole
// ================================================================
describe("hasRole", () => {
  it("returns true when user has the required role", async () => {
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(
      MOCK_USER_TEAM,
    );

    const result = await hasRole("user-123", "team-abc", ["ADMIN", "OWNER"]);

    expect(result).toBe(true);
    expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-123",
        teamId: "team-abc",
        role: { in: ["ADMIN", "OWNER"] },
        status: "ACTIVE",
      },
    });
  });

  it("returns false when user does not have the required role", async () => {
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const result = await hasRole("user-123", "team-abc", ["OWNER"]);

    expect(result).toBe(false);
  });

  it("does not send any HTTP response (no req/res)", async () => {
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(null);

    // hasRole only returns boolean — no side effects beyond Prisma query
    const result = await hasRole("user-999", "team-xyz", ["ADMIN"]);

    expect(result).toBe(false);
  });

  it("checks multiple roles at once", async () => {
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce({
      role: "SUPER_ADMIN",
    });

    const result = await hasRole("user-123", "team-abc", [
      "OWNER",
      "SUPER_ADMIN",
      "ADMIN",
    ]);

    expect(result).toBe(true);
    expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: { in: ["OWNER", "SUPER_ADMIN", "ADMIN"] },
        }),
      }),
    );
  });

  it("queries with ACTIVE status filter", async () => {
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(null);

    await hasRole("user-1", "team-1", ["ADMIN"]);

    expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      }),
    );
  });
});

// ================================================================
// 11. withAuth HOF
// ================================================================
describe("withAuth HOF", () => {
  it("returns 405 for disallowed method", async () => {
    const handler = jest.fn();
    const wrapped = withAuth({ level: "public", methods: ["POST"] }, handler);
    const req = makeReq({ method: "GET" });
    const res = makeRes();

    await wrapped(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({
      error: "Method GET not allowed",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("sets Allow header on 405", async () => {
    const handler = jest.fn();
    const wrapped = withAuth(
      { level: "admin", methods: ["POST", "PUT"] },
      handler,
    );
    const req = makeReq({ method: "DELETE" });
    const res = makeRes();

    await wrapped(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST, PUT");
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('"public" level passes empty auth and skips session check', async () => {
    const handler = jest.fn();
    const wrapped = withAuth({ level: "public" }, handler);
    const req = makeReq();
    const res = makeRes();

    await wrapped(req, res);

    expect(handler).toHaveBeenCalledWith(req, res, {
      userId: "",
      email: "",
      teamId: "",
      role: "MEMBER",
      session: { user: expect.any(Object) },
    });
    expect(mockGetServerSession).not.toHaveBeenCalled();
  });

  it('"authenticated" level requires session, no role check', async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    const handler = jest.fn();
    const wrapped = withAuth({ level: "authenticated" }, handler);
    const req = makeReq();
    const res = makeRes();

    await wrapped(req, res);

    expect(handler).toHaveBeenCalledWith(
      req,
      res,
      expect.objectContaining({
        userId: "user-123",
        email: "test@example.com",
        teamId: "",
        role: "MEMBER",
      }),
    );
    expect(mockPrisma.userTeam.findFirst).not.toHaveBeenCalled();
  });

  it('"authenticated" level returns 401 when no session', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const handler = jest.fn();
    const wrapped = withAuth({ level: "authenticated" }, handler);
    const req = makeReq();
    const res = makeRes();

    await wrapped(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('"admin" level enforces RBAC with OWNER, SUPER_ADMIN, ADMIN', async () => {
    mockGetServerSession
      .mockResolvedValueOnce(MOCK_SESSION) // withAuth session check
      .mockResolvedValueOnce(MOCK_SESSION); // enforceRBAC session check
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(
      MOCK_USER_TEAM,
    );
    const handler = jest.fn();
    const wrapped = withAuth({ level: "admin" }, handler);
    const req = makeReq({ query: { teamId: "team-abc" } });
    const res = makeRes();

    await wrapped(req, res);

    expect(handler).toHaveBeenCalledWith(
      req,
      res,
      expect.objectContaining({
        userId: "user-123",
        role: "ADMIN",
      }),
    );
    expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        role: { in: ["OWNER", "SUPER_ADMIN", "ADMIN"] },
      }),
    });
  });

  it('"gp" level enforces RBAC with OWNER, SUPER_ADMIN, ADMIN, MANAGER', async () => {
    mockGetServerSession
      .mockResolvedValueOnce(MOCK_SESSION)
      .mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce({
      ...MOCK_USER_TEAM,
      role: "MANAGER",
    });
    const handler = jest.fn();
    const wrapped = withAuth({ level: "gp" }, handler);
    const req = makeReq({ query: { teamId: "team-abc" } });
    const res = makeRes();

    await wrapped(req, res);

    expect(handler).toHaveBeenCalledWith(
      req,
      res,
      expect.objectContaining({ role: "MANAGER" }),
    );
    expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        role: { in: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"] },
      }),
    });
  });

  it('"member" level enforces RBAC with all five roles', async () => {
    mockGetServerSession
      .mockResolvedValueOnce(MOCK_SESSION)
      .mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce({
      ...MOCK_USER_TEAM,
      role: "MEMBER",
    });
    const handler = jest.fn();
    const wrapped = withAuth({ level: "member" }, handler);
    const req = makeReq({ query: { teamId: "team-abc" } });
    const res = makeRes();

    await wrapped(req, res);

    expect(handler).toHaveBeenCalledWith(
      req,
      res,
      expect.objectContaining({ role: "MEMBER" }),
    );
    expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        role: {
          in: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],
        },
      }),
    });
  });

  it('"owner" level enforces RBAC with OWNER only', async () => {
    mockGetServerSession
      .mockResolvedValueOnce(MOCK_SESSION)
      .mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce({
      ...MOCK_USER_TEAM,
      role: "OWNER",
    });
    const handler = jest.fn();
    const wrapped = withAuth({ level: "owner" }, handler);
    const req = makeReq({ query: { teamId: "team-abc" } });
    const res = makeRes();

    await wrapped(req, res);

    expect(handler).toHaveBeenCalledWith(
      req,
      res,
      expect.objectContaining({ role: "OWNER" }),
    );
    expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        role: { in: ["OWNER"] },
      }),
    });
  });

  it("does not call handler when RBAC fails (403)", async () => {
    mockGetServerSession
      .mockResolvedValueOnce(MOCK_SESSION)
      .mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const handler = jest.fn();
    const wrapped = withAuth({ level: "admin" }, handler);
    const req = makeReq({ query: { teamId: "team-abc" } });
    const res = makeRes();

    await wrapped(req, res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows method when in the methods list", async () => {
    const handler = jest.fn();
    const wrapped = withAuth(
      { level: "public", methods: ["GET", "POST"] },
      handler,
    );
    const req = makeReq({ method: "POST" });
    const res = makeRes();

    await wrapped(req, res);

    expect(handler).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(405);
  });

  it("allows any method when methods option is omitted", async () => {
    const handler = jest.fn();
    const wrapped = withAuth({ level: "public" }, handler);
    const req = makeReq({ method: "PATCH" });
    const res = makeRes();

    await wrapped(req, res);

    expect(handler).toHaveBeenCalled();
  });

  it("calls handler with auth result for role-based levels", async () => {
    mockGetServerSession
      .mockResolvedValueOnce(MOCK_SESSION)
      .mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValueOnce({
      ...MOCK_USER_TEAM,
      role: "ADMIN",
    });
    const handler = jest.fn();
    const wrapped = withAuth({ level: "admin", methods: ["GET"] }, handler);
    const req = makeReq({ method: "GET", query: { teamId: "team-abc" } });
    const res = makeRes();

    await wrapped(req, res);

    expect(handler).toHaveBeenCalledTimes(1);
    const authArg = handler.mock.calls[0][2];
    expect(authArg.userId).toBe("user-123");
    expect(authArg.teamId).toBe("team-abc");
    expect(authArg.role).toBe("ADMIN");
  });
});

// ================================================================
// 12. requireLPAuth (Pages Router)
// ================================================================
describe("requireLPAuth (Pages Router)", () => {
  it("returns null and sends 401 when no session", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const req = makeReq();
    const res = makeRes();

    const result = await requireLPAuth(req, res);

    expect(result).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("returns LPAuthResult with investorId when investor found", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.investor.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv-456",
    });
    const req = makeReq();
    const res = makeRes();

    const result = await requireLPAuth(req, res);

    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user-123");
    expect(result!.email).toBe("test@example.com");
    expect(result!.investorId).toBe("inv-456");
    expect(result!.session.user).toEqual(MOCK_USER);
  });

  it("returns LPAuthResult with null investorId when no investor found", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.investor.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const req = makeReq();
    const res = makeRes();

    const result = await requireLPAuth(req, res);

    expect(result).not.toBeNull();
    expect(result!.investorId).toBeNull();
    expect(result!.userId).toBe("user-123");
  });

  it("queries investor by userId OR email", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.investor.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const req = makeReq();
    const res = makeRes();

    await requireLPAuth(req, res);

    expect(mockPrisma.investor.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: "user-123" },
          { user: { email: "test@example.com" } },
        ],
      },
      select: { id: true },
    });
  });

  it("handles user with no email in investor query", async () => {
    mockGetServerSession.mockResolvedValueOnce({
      user: { id: "user-no-email" },
      expires: "",
    });
    (mockPrisma.investor.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const req = makeReq();
    const res = makeRes();

    const result = await requireLPAuth(req, res);

    expect(result).not.toBeNull();
    expect(result!.email).toBe("");
    expect(mockPrisma.investor.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: "user-no-email" },
          { user: { email: "" } },
        ],
      },
      select: { id: true },
    });
  });
});

// ================================================================
// 13. requireLPAuthAppRouter
// ================================================================
describe("requireLPAuthAppRouter", () => {
  it("returns NextResponse 401 when no session", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const result = await requireLPAuthAppRouter();

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns LPAuthResult with investorId when investor found", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.investor.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv-789",
    });

    const result = await requireLPAuthAppRouter();

    expect(result).not.toBeInstanceOf(NextResponse);
    const auth = result as any;
    expect(auth.userId).toBe("user-123");
    expect(auth.email).toBe("test@example.com");
    expect(auth.investorId).toBe("inv-789");
  });

  it("returns LPAuthResult with null investorId when no investor found", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.investor.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const result = await requireLPAuthAppRouter();

    expect(result).not.toBeInstanceOf(NextResponse);
    const auth = result as any;
    expect(auth.investorId).toBeNull();
  });

  it("queries investor by userId OR email (App Router variant)", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.investor.findFirst as jest.Mock).mockResolvedValueOnce(null);

    await requireLPAuthAppRouter();

    expect(mockPrisma.investor.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { userId: "user-123" },
          { user: { email: "test@example.com" } },
        ],
      },
      select: { id: true },
    });
  });

  it("returns session in result when authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(MOCK_SESSION);
    (mockPrisma.investor.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "inv-abc",
    });

    const result = await requireLPAuthAppRouter();

    expect(result).not.toBeInstanceOf(NextResponse);
    const auth = result as any;
    expect(auth.session.user).toEqual(MOCK_USER);
  });
});
