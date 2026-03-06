/**
 * Multi-Tenant Isolation Tests
 *
 * Comprehensive test suite for the RBAC enforcement system covering:
 *
 *   1. Unauthenticated access prevention (401)
 *   2. Cross-tenant access prevention (403)
 *   3. Role-based access control (5-level role hierarchy)
 *   4. Shortcut functions (requireAdmin, requireGPAccess, requireTeamMember)
 *   5. hasRole utility
 *   6. Permission matrix (50+ permissions, role→permission mapping)
 *   7. App Router RBAC variants
 *   8. withAuth higher-order function (6 auth levels)
 *   9. LP authentication helpers
 *  10. Edge auth middleware (route classification, JWT validation, header injection)
 *  11. Permission enforcement helpers (enforcePermission, enforcePermissionAppRouter)
 *  12. Role hierarchy invariants (higher roles inherit lower permissions)
 *
 * Source files:
 *   - lib/auth/rbac.ts (785 lines — RBAC enforcement, permission matrix)
 *   - lib/middleware/edge-auth.ts (187 lines — edge JWT validation)
 *   - lib/middleware/route-config.ts (220 lines — route classification)
 */

import { createMocks } from "node-mocks-http";
import { getServerSession } from "next-auth/next";

jest.mock("@/lib/auth/auth-options", () => ({
  authOptions: { providers: [], session: { strategy: "jwt" } },
}));

import prisma from "@/lib/prisma";
import {
  enforceRBAC,
  requireAdmin,
  requireGPAccess,
  requireTeamMember,
  hasRole,
  checkPermission,
  getPermissionsForRole,
  getMinimumRole,
  enforceRBACAppRouter,
  requireAdminAppRouter,
  requireTeamMemberAppRouter,
  requireGPAccessAppRouter,
  requireAuthAppRouter,
  requireLPAuth,
  requireLPAuthAppRouter,
  withAuth,
  enforcePermission,
  enforcePermissionAppRouter,
  Permission,
  PERMISSION_MATRIX,
} from "@/lib/auth/rbac";
import type { RBACRole, PermissionKey } from "@/lib/auth/rbac";
import { NextResponse } from "next/server";
import {
  classifyRoute,
  RouteCategory,
  PUBLIC_PATHS,
  CRON_PATHS,
  ADMIN_PATHS,
  TEAM_SCOPED_PATHS,
  AUTHENTICATED_PATHS,
} from "@/lib/middleware/route-config";

const mockGetServerSession = getServerSession as jest.MockedFunction<
  typeof getServerSession
>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(userId: string, email: string) {
  return {
    user: { id: userId, email, name: "Test User" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}

function makeUserTeam(
  userId: string,
  teamId: string,
  role: string,
  status = "ACTIVE",
) {
  return {
    id: `ut-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    teamId,
    role,
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const ALL_ROLES: RBACRole[] = [
  "OWNER",
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "MEMBER",
];

const ROLE_HIERARCHY: RBACRole[] = [
  "MEMBER",
  "MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
  "OWNER",
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Multi-Tenant Isolation — RBAC Enforcement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. Unauthenticated Access
  // =========================================================================

  describe("Unauthenticated Access", () => {
    it("should return 401 when no session exists", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-1" },
      });

      const result = await enforceRBAC(req, res, {
        roles: ["ADMIN"],
      });

      expect(result).toBeNull();
      expect(res._getStatusCode()).toBe(401);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe("Unauthorized");
    });

    it("should return 401 when session has no user id", async () => {
      mockGetServerSession.mockResolvedValue({ user: { email: "x@y.com" } });
      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-1" },
      });

      const result = await enforceRBAC(req, res, {
        roles: ["ADMIN"],
      });

      expect(result).toBeNull();
      expect(res._getStatusCode()).toBe(401);
    });

    it("should return 401 when session user object is null", async () => {
      mockGetServerSession.mockResolvedValue({ user: null });
      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-1" },
      });

      const result = await enforceRBAC(req, res, { roles: ["ADMIN"] });

      expect(result).toBeNull();
      expect(res._getStatusCode()).toBe(401);
    });

    it("should return 401 when session is empty object", async () => {
      mockGetServerSession.mockResolvedValue({});
      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-1" },
      });

      const result = await enforceRBAC(req, res, { roles: ["ADMIN"] });

      expect(result).toBeNull();
      expect(res._getStatusCode()).toBe(401);
    });
  });

  // =========================================================================
  // 2. Cross-Tenant Access Prevention
  // =========================================================================

  describe("Cross-Tenant Access Prevention", () => {
    it("should block user from accessing another team's resources", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "admin@team-a.com"),
      );
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-b" },
      });

      const result = await enforceRBAC(req, res, {
        roles: ["OWNER", "ADMIN"],
      });

      expect(result).toBeNull();
      expect(res._getStatusCode()).toBe(403);
      const data = JSON.parse(res._getData());
      expect(data.error).toMatch(/Forbidden/i);
    });

    it("should allow user to access their own team", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "admin@team-a.com"),
      );
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
        makeUserTeam("user-1", "team-a", "ADMIN"),
      );

      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-a" },
      });

      const result = await enforceRBAC(req, res, {
        roles: ["OWNER", "ADMIN"],
      });

      expect(result).not.toBeNull();
      expect(result!.userId).toBe("user-1");
      expect(result!.teamId).toBe("team-a");
      expect(result!.role).toBe("ADMIN");
    });

    it("should only query ACTIVE team memberships", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "admin@team-a.com"),
      );
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-a" },
      });

      await enforceRBAC(req, res, { roles: ["ADMIN"] });

      expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "ACTIVE",
          }),
        }),
      );
    });

    it("should extract teamId from request body when not in query", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "admin@team-a.com"),
      );
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
        makeUserTeam("user-1", "team-body", "OWNER"),
      );

      const { req, res } = createMocks({
        method: "POST",
        body: { teamId: "team-body" },
      });

      const result = await enforceRBAC(req, res, {
        roles: ["OWNER"],
      });

      expect(result).not.toBeNull();
      expect(result!.teamId).toBe("team-body");
    });

    it("should use explicit teamId option over query/body", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "admin@team-a.com"),
      );
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
        makeUserTeam("user-1", "team-explicit", "ADMIN"),
      );

      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-query" },
      });

      const result = await enforceRBAC(req, res, {
        roles: ["ADMIN"],
        teamId: "team-explicit",
      });

      expect(result).not.toBeNull();
      expect(result!.teamId).toBe("team-explicit");
    });

    it("should include correct userId and teamId in Prisma query", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-42", "user42@test.com"),
      );
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-99" },
      });

      await enforceRBAC(req, res, { roles: ["ADMIN", "OWNER"] });

      expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith({
        where: {
          userId: "user-42",
          teamId: "team-99",
          role: { in: ["ADMIN", "OWNER"] },
          status: "ACTIVE",
        },
      });
    });
  });

  // =========================================================================
  // 3. Role-Based Access Control
  // =========================================================================

  describe("Role-Based Access Control", () => {
    it("should block MEMBER from admin-only endpoints", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "member@test.com"),
      );
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-1" },
      });

      const result = await enforceRBAC(req, res, {
        roles: ["OWNER", "SUPER_ADMIN", "ADMIN"],
      });

      expect(result).toBeNull();
      expect(res._getStatusCode()).toBe(403);
    });

    it("should allow OWNER access to owner-only endpoints", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "owner@test.com"),
      );
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
        makeUserTeam("user-1", "team-1", "OWNER"),
      );

      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-1" },
      });

      const result = await enforceRBAC(req, res, {
        roles: ["OWNER"],
      });

      expect(result).not.toBeNull();
      expect(result!.role).toBe("OWNER");
    });

    it("should return 400 when teamId is required but missing", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "admin@test.com"),
      );

      const { req, res } = createMocks({ method: "GET" });

      const result = await enforceRBAC(req, res, {
        roles: ["ADMIN"],
        requireTeamId: true,
      });

      expect(result).toBeNull();
      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toMatch(/teamId/i);
    });

    it("should allow no team scoping when requireTeamId is false", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "admin@test.com"),
      );

      const { req, res } = createMocks({ method: "GET" });

      const result = await enforceRBAC(req, res, {
        roles: ["ADMIN"],
        requireTeamId: false,
      });

      expect(result).not.toBeNull();
      expect(result!.userId).toBe("user-1");
      expect(result!.teamId).toBe("");
      expect(result!.role).toBe("MEMBER");
    });

    it("should return result with correct email field", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "alice@acme.com"),
      );
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
        makeUserTeam("user-1", "team-1", "MANAGER"),
      );

      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-1" },
      });

      const result = await enforceRBAC(req, res, {
        roles: ["MANAGER", "ADMIN", "OWNER"],
      });

      expect(result).not.toBeNull();
      expect(result!.email).toBe("alice@acme.com");
    });

    it("should set email to empty string when session email is null", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-1", email: null, name: "No Email" },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const { req, res } = createMocks({ method: "GET" });

      const result = await enforceRBAC(req, res, {
        roles: ["ADMIN"],
        requireTeamId: false,
      });

      expect(result).not.toBeNull();
      expect(result!.email).toBe("");
    });

    it("should default requireTeamId to true when not specified", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "admin@test.com"),
      );

      const { req, res } = createMocks({ method: "GET" });

      const result = await enforceRBAC(req, res, { roles: ["ADMIN"] });

      // No teamId in query, body, or options => should fail with 400
      expect(result).toBeNull();
      expect(res._getStatusCode()).toBe(400);
    });
  });

  // =========================================================================
  // 4. Shortcut Functions
  // =========================================================================

  describe("Shortcut Functions", () => {
    beforeEach(() => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "admin@test.com"),
      );
    });

    it("requireAdmin should allow OWNER, SUPER_ADMIN, ADMIN", async () => {
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
        makeUserTeam("user-1", "team-1", "ADMIN"),
      );

      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-1" },
      });
      const result = await requireAdmin(req, res);

      expect(result).not.toBeNull();
      expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: { in: ["OWNER", "SUPER_ADMIN", "ADMIN"] },
          }),
        }),
      );
    });

    it("requireGPAccess should allow OWNER, SUPER_ADMIN, ADMIN, MANAGER", async () => {
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
        makeUserTeam("user-1", "team-1", "MANAGER"),
      );

      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-1" },
      });
      const result = await requireGPAccess(req, res);

      expect(result).not.toBeNull();
      expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: { in: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"] },
          }),
        }),
      );
    });

    it("requireTeamMember should allow all five roles", async () => {
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
        makeUserTeam("user-1", "team-1", "MEMBER"),
      );

      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-1" },
      });
      const result = await requireTeamMember(req, res);

      expect(result).not.toBeNull();
      expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: {
              in: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],
            },
          }),
        }),
      );
    });

    it("requireAdmin should accept explicit teamId parameter", async () => {
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
        makeUserTeam("user-1", "team-explicit", "ADMIN"),
      );

      const { req, res } = createMocks({ method: "GET" });
      const result = await requireAdmin(req, res, "team-explicit");

      expect(result).not.toBeNull();
      expect(result!.teamId).toBe("team-explicit");
    });
  });

  // =========================================================================
  // 5. hasRole Utility
  // =========================================================================

  describe("hasRole utility", () => {
    it("should return true when user has the role", async () => {
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
        makeUserTeam("user-1", "team-1", "ADMIN"),
      );

      const result = await hasRole("user-1", "team-1", ["ADMIN", "OWNER"]);
      expect(result).toBe(true);
    });

    it("should return false when user does not have the role", async () => {
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await hasRole("user-1", "team-1", ["OWNER"]);
      expect(result).toBe(false);
    });

    it("should pass correct parameters to Prisma", async () => {
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

      await hasRole("user-abc", "team-xyz", ["ADMIN", "MANAGER"]);

      expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith({
        where: {
          userId: "user-abc",
          teamId: "team-xyz",
          role: { in: ["ADMIN", "MANAGER"] },
          status: "ACTIVE",
        },
      });
    });

    it("should only match ACTIVE memberships", async () => {
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

      await hasRole("user-1", "team-1", ["OWNER"]);

      expect(mockPrisma.userTeam.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "ACTIVE",
          }),
        }),
      );
    });
  });

  // =========================================================================
  // 6. Permission Matrix
  // =========================================================================

  describe("Permission Matrix", () => {
    it("checkPermission should grant OWNER access to all permissions", () => {
      const allPermissions = Object.values(Permission);
      for (const perm of allPermissions) {
        expect(checkPermission("OWNER", perm)).toBe(true);
      }
    });

    it("checkPermission should deny MEMBER access to admin-only permissions", () => {
      expect(checkPermission("MEMBER", Permission.WIRE_CONFIRM)).toBe(false);
      expect(checkPermission("MEMBER", Permission.INVESTOR_APPROVE)).toBe(false);
      expect(checkPermission("MEMBER", Permission.SETTINGS_UPDATE)).toBe(false);
      expect(checkPermission("MEMBER", Permission.FUND_DELETE)).toBe(false);
      expect(checkPermission("MEMBER", Permission.INVESTOR_DELETE)).toBe(false);
      expect(checkPermission("MEMBER", Permission.ESIGN_VOID)).toBe(false);
      expect(checkPermission("MEMBER", Permission.TEAM_INVITE)).toBe(false);
    });

    it("checkPermission should grant MEMBER access to read permissions", () => {
      expect(checkPermission("MEMBER", Permission.FUND_READ)).toBe(true);
      expect(checkPermission("MEMBER", Permission.DOCUMENT_READ)).toBe(true);
      expect(checkPermission("MEMBER", Permission.DATAROOM_READ)).toBe(true);
      expect(checkPermission("MEMBER", Permission.ESIGN_READ)).toBe(true);
      expect(checkPermission("MEMBER", Permission.TEAM_READ_MEMBERS)).toBe(true);
    });

    it("checkPermission should return false for invalid permissions", () => {
      expect(
        checkPermission("OWNER", "nonexistent:permission" as never),
      ).toBe(false);
    });

    it("getPermissionsForRole should return correct count for each role", () => {
      const ownerPerms = getPermissionsForRole("OWNER");
      const memberPerms = getPermissionsForRole("MEMBER");
      const managerPerms = getPermissionsForRole("MANAGER");
      const adminPerms = getPermissionsForRole("ADMIN");

      // OWNER has all permissions
      expect(ownerPerms.length).toBe(Object.keys(PERMISSION_MATRIX).length);
      // MEMBER has fewer than MANAGER
      expect(memberPerms.length).toBeLessThan(managerPerms.length);
      // MANAGER has fewer than ADMIN
      expect(managerPerms.length).toBeLessThan(adminPerms.length);
      // ADMIN has fewer or equal to OWNER
      expect(adminPerms.length).toBeLessThanOrEqual(ownerPerms.length);
      // All roles have at least one permission
      expect(memberPerms.length).toBeGreaterThan(0);
    });

    it("getMinimumRole should return lowest role that has the permission", () => {
      // FUND_READ is available to all roles including MEMBER
      expect(getMinimumRole(Permission.FUND_READ)).toBe("MEMBER");
      // WIRE_CONFIRM is admin-only
      expect(getMinimumRole(Permission.WIRE_CONFIRM)).toBe("ADMIN");
      // PLATFORM_SETTINGS is owner-only
      expect(getMinimumRole(Permission.PLATFORM_SETTINGS)).toBe("OWNER");
      // TEAM_CHANGE_ROLE is SUPER_ADMIN+
      expect(getMinimumRole(Permission.TEAM_CHANGE_ROLE)).toBe("SUPER_ADMIN");
      // INVESTOR_READ is MANAGER+
      expect(getMinimumRole(Permission.INVESTOR_READ)).toBe("MANAGER");
    });

    it("getMinimumRole should return null for invalid permissions", () => {
      expect(getMinimumRole("nonexistent:perm" as PermissionKey)).toBeNull();
    });

    it("PERMISSION_MATRIX should have entry for every Permission constant", () => {
      const permValues = Object.values(Permission);
      for (const perm of permValues) {
        expect(PERMISSION_MATRIX[perm]).toBeDefined();
        expect(Array.isArray(PERMISSION_MATRIX[perm])).toBe(true);
        expect(PERMISSION_MATRIX[perm].length).toBeGreaterThan(0);
      }
    });

    it("PERMISSION_MATRIX entries should only contain valid roles", () => {
      const validRoles = new Set(ALL_ROLES);
      for (const [perm, roles] of Object.entries(PERMISSION_MATRIX)) {
        for (const role of roles) {
          expect(validRoles.has(role as RBACRole)).toBe(true);
        }
      }
    });

    it("should enforce MANAGER can access GP-scoped permissions", () => {
      // MANAGER should have INVESTOR_READ, INVESTOR_CREATE, INVESTOR_UPDATE, etc.
      expect(checkPermission("MANAGER", Permission.INVESTOR_READ)).toBe(true);
      expect(checkPermission("MANAGER", Permission.INVESTOR_CREATE)).toBe(true);
      expect(checkPermission("MANAGER", Permission.INVESTOR_EXPORT)).toBe(true);
      expect(checkPermission("MANAGER", Permission.ESIGN_SEND)).toBe(true);
      expect(checkPermission("MANAGER", Permission.DATAROOM_CREATE)).toBe(true);
    });

    it("MANAGER should NOT have destructive permissions", () => {
      expect(checkPermission("MANAGER", Permission.INVESTOR_DELETE)).toBe(false);
      expect(checkPermission("MANAGER", Permission.FUND_DELETE)).toBe(false);
      expect(checkPermission("MANAGER", Permission.DOCUMENT_DELETE)).toBe(false);
      expect(checkPermission("MANAGER", Permission.DATAROOM_DELETE)).toBe(false);
    });

    it("SETTINGS_BILLING should be OWNER and SUPER_ADMIN only", () => {
      expect(checkPermission("OWNER", Permission.SETTINGS_BILLING)).toBe(true);
      expect(checkPermission("SUPER_ADMIN", Permission.SETTINGS_BILLING)).toBe(true);
      expect(checkPermission("ADMIN", Permission.SETTINGS_BILLING)).toBe(false);
      expect(checkPermission("MANAGER", Permission.SETTINGS_BILLING)).toBe(false);
      expect(checkPermission("MEMBER", Permission.SETTINGS_BILLING)).toBe(false);
    });
  });

  // =========================================================================
  // 7. Role Hierarchy Invariant
  // =========================================================================

  describe("Role Hierarchy Invariant", () => {
    it("higher roles should inherit all permissions of lower roles", () => {
      // For every permission, if role[i] has it, all roles above it should too
      const allPermissions = Object.values(Permission);

      for (const perm of allPermissions) {
        let seenGrant = false;
        // Walk hierarchy from OWNER (highest) down to MEMBER (lowest)
        for (let i = ROLE_HIERARCHY.length - 1; i >= 0; i--) {
          const role = ROLE_HIERARCHY[i];
          const hasPerm = checkPermission(role, perm);

          if (seenGrant && !hasPerm) {
            // A higher role had this permission but a lower role within the
            // granted set does not. This is fine — the invariant is that
            // HIGHER roles inherit from LOWER, not vice versa.
          }

          if (hasPerm) {
            seenGrant = true;
            // Verify all roles ABOVE this one in the hierarchy also have it
            for (let j = i + 1; j < ROLE_HIERARCHY.length; j++) {
              expect(checkPermission(ROLE_HIERARCHY[j], perm)).toBe(true);
            }
          }
        }
      }
    });

    it("OWNER should always have more or equal permissions than SUPER_ADMIN", () => {
      const ownerPerms = new Set(getPermissionsForRole("OWNER"));
      const superAdminPerms = getPermissionsForRole("SUPER_ADMIN");

      for (const perm of superAdminPerms) {
        expect(ownerPerms.has(perm)).toBe(true);
      }
    });

    it("SUPER_ADMIN should always have more or equal permissions than ADMIN", () => {
      const superAdminPerms = new Set(getPermissionsForRole("SUPER_ADMIN"));
      const adminPerms = getPermissionsForRole("ADMIN");

      for (const perm of adminPerms) {
        expect(superAdminPerms.has(perm)).toBe(true);
      }
    });
  });

  // =========================================================================
  // 8. App Router Variant
  // =========================================================================

  describe("App Router — enforceRBACAppRouter", () => {
    it("should return NextResponse 401 when unauthenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const result = await enforceRBACAppRouter({
        roles: ["ADMIN"],
        teamId: "team-1",
      });

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(401);
    });

    it("should return NextResponse 403 when role not matched", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "member@test.com"),
      );
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await enforceRBACAppRouter({
        roles: ["OWNER"],
        teamId: "team-1",
      });

      expect(result).toBeInstanceOf(NextResponse);
      const response = result as NextResponse;
      expect(response.status).toBe(403);
    });

    it("should return RBACResult when authorized", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "admin@test.com"),
      );
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
        makeUserTeam("user-1", "team-1", "ADMIN"),
      );

      const result = await enforceRBACAppRouter({
        roles: ["ADMIN", "OWNER"],
        teamId: "team-1",
      });

      expect(result).not.toBeInstanceOf(NextResponse);
      const auth = result as { userId: string; teamId: string; role: string };
      expect(auth.userId).toBe("user-1");
      expect(auth.teamId).toBe("team-1");
      expect(auth.role).toBe("ADMIN");
    });

    it("requireAdminAppRouter should work without teamId", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "admin@test.com"),
      );

      const result = await requireAdminAppRouter();

      expect(result).not.toBeInstanceOf(NextResponse);
      const auth = result as { userId: string; role: string };
      expect(auth.userId).toBe("user-1");
    });

    it("requireTeamMemberAppRouter should work with teamId", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "member@test.com"),
      );
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
        makeUserTeam("user-1", "team-1", "MEMBER"),
      );

      const result = await requireTeamMemberAppRouter("team-1");

      expect(result).not.toBeInstanceOf(NextResponse);
      const auth = result as { userId: string; teamId: string; role: string };
      expect(auth.role).toBe("MEMBER");
    });

    it("requireGPAccessAppRouter should work with teamId", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "manager@test.com"),
      );
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
        makeUserTeam("user-1", "team-1", "MANAGER"),
      );

      const result = await requireGPAccessAppRouter("team-1");

      expect(result).not.toBeInstanceOf(NextResponse);
      const auth = result as { userId: string; role: string };
      expect(auth.role).toBe("MANAGER");
    });

    it("requireAuthAppRouter should only require valid session", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "any@test.com"),
      );

      const result = await requireAuthAppRouter();

      expect(result).not.toBeInstanceOf(NextResponse);
      const auth = result as { userId: string };
      expect(auth.userId).toBe("user-1");
    });

    it("should return 400 when teamId required but not provided", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "admin@test.com"),
      );

      const result = await enforceRBACAppRouter({
        roles: ["ADMIN"],
        requireTeamId: true,
      });

      expect(result).toBeInstanceOf(NextResponse);
      expect((result as NextResponse).status).toBe(400);
    });
  });

  // =========================================================================
  // 9. withAuth Higher-Order Function
  // =========================================================================

  describe("withAuth HOF", () => {
    it("should enforce method restriction", async () => {
      const handler = jest.fn();
      const wrapped = withAuth({ level: "public", methods: ["POST"] }, handler);

      const { req, res } = createMocks({ method: "GET" });
      await wrapped(req, res);

      expect(res._getStatusCode()).toBe(405);
      expect(handler).not.toHaveBeenCalled();
    });

    it("should set Allow header on method restriction", async () => {
      const handler = jest.fn();
      const wrapped = withAuth(
        { level: "public", methods: ["POST", "PUT"] },
        handler,
      );

      const { req, res } = createMocks({ method: "GET" });
      await wrapped(req, res);

      expect(res.getHeader("Allow")).toBe("POST, PUT");
    });

    it("should pass through public routes without auth", async () => {
      const handler = jest.fn();
      const wrapped = withAuth({ level: "public" }, handler);

      const { req, res } = createMocks({ method: "GET" });
      await wrapped(req, res);

      expect(handler).toHaveBeenCalledTimes(1);
      // auth object should have empty values for public routes
      const auth = handler.mock.calls[0][2];
      expect(auth.userId).toBe("");
      expect(auth.email).toBe("");
      expect(auth.teamId).toBe("");
    });

    it("should require session for authenticated level", async () => {
      mockGetServerSession.mockResolvedValue(null);
      const handler = jest.fn();
      const wrapped = withAuth({ level: "authenticated" }, handler);

      const { req, res } = createMocks({ method: "GET" });
      await wrapped(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    });

    it("should pass auth result for authenticated level", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "user@test.com"),
      );
      const handler = jest.fn();
      const wrapped = withAuth({ level: "authenticated" }, handler);

      const { req, res } = createMocks({ method: "GET" });
      await wrapped(req, res);

      expect(handler).toHaveBeenCalledTimes(1);
      const auth = handler.mock.calls[0][2];
      expect(auth.userId).toBe("user-1");
      expect(auth.email).toBe("user@test.com");
    });

    it("should map level to correct role set for admin", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "admin@test.com"),
      );
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
        makeUserTeam("user-1", "team-1", "ADMIN"),
      );

      const handler = jest.fn();
      const wrapped = withAuth({ level: "admin" }, handler);

      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-1" },
      });
      await wrapped(req, res);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should map level to correct role set for gp", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "gp@test.com"),
      );
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
        makeUserTeam("user-1", "team-1", "MANAGER"),
      );

      const handler = jest.fn();
      const wrapped = withAuth({ level: "gp" }, handler);

      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-1" },
      });
      await wrapped(req, res);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should map level to correct role set for owner", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "owner@test.com"),
      );
      (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
        makeUserTeam("user-1", "team-1", "OWNER"),
      );

      const handler = jest.fn();
      const wrapped = withAuth({ level: "owner" }, handler);

      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-1" },
      });
      await wrapped(req, res);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should return 500 for invalid auth level", async () => {
      mockGetServerSession.mockResolvedValue(
        makeSession("user-1", "user@test.com"),
      );

      const handler = jest.fn();
      const wrapped = withAuth({ level: "invalid_level" as never }, handler);

      const { req, res } = createMocks({
        method: "GET",
        query: { teamId: "team-1" },
      });
      await wrapped(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 10. LP Authentication Helpers
  // =========================================================================

  describe("LP Authentication", () => {
    describe("requireLPAuth (Pages Router)", () => {
      it("should return 401 when no session exists", async () => {
        mockGetServerSession.mockResolvedValue(null);
        const { req, res } = createMocks({ method: "GET" });

        const result = await requireLPAuth(req, res);

        expect(result).toBeNull();
        expect(res._getStatusCode()).toBe(401);
      });

      it("should return LP context with investor ID when found", async () => {
        mockGetServerSession.mockResolvedValue(
          makeSession("user-1", "lp@investor.com"),
        );
        (mockPrisma.investor.findFirst as jest.Mock).mockResolvedValue({
          id: "investor-123",
        });

        const { req, res } = createMocks({ method: "GET" });
        const result = await requireLPAuth(req, res);

        expect(result).not.toBeNull();
        expect(result!.userId).toBe("user-1");
        expect(result!.email).toBe("lp@investor.com");
        expect(result!.investorId).toBe("investor-123");
      });

      it("should return null investorId when investor not found", async () => {
        mockGetServerSession.mockResolvedValue(
          makeSession("user-1", "noinvestor@test.com"),
        );
        (mockPrisma.investor.findFirst as jest.Mock).mockResolvedValue(null);

        const { req, res } = createMocks({ method: "GET" });
        const result = await requireLPAuth(req, res);

        expect(result).not.toBeNull();
        expect(result!.investorId).toBeNull();
      });

      it("should query investor by both userId and email", async () => {
        mockGetServerSession.mockResolvedValue(
          makeSession("user-1", "lp@test.com"),
        );
        (mockPrisma.investor.findFirst as jest.Mock).mockResolvedValue(null);

        const { req, res } = createMocks({ method: "GET" });
        await requireLPAuth(req, res);

        expect(mockPrisma.investor.findFirst).toHaveBeenCalledWith({
          where: {
            OR: [
              { userId: "user-1" },
              { user: { email: "lp@test.com" } },
            ],
          },
          select: { id: true },
        });
      });
    });

    describe("requireLPAuthAppRouter", () => {
      it("should return NextResponse 401 when no session", async () => {
        mockGetServerSession.mockResolvedValue(null);

        const result = await requireLPAuthAppRouter();

        expect(result).toBeInstanceOf(NextResponse);
        expect((result as NextResponse).status).toBe(401);
      });

      it("should return LPAuthResult when authenticated", async () => {
        mockGetServerSession.mockResolvedValue(
          makeSession("user-1", "lp@test.com"),
        );
        (mockPrisma.investor.findFirst as jest.Mock).mockResolvedValue({
          id: "inv-1",
        });

        const result = await requireLPAuthAppRouter();

        expect(result).not.toBeInstanceOf(NextResponse);
        const auth = result as { userId: string; investorId: string | null };
        expect(auth.userId).toBe("user-1");
        expect(auth.investorId).toBe("inv-1");
      });
    });
  });

  // =========================================================================
  // 11. Permission Enforcement Helpers
  // =========================================================================

  describe("Permission Enforcement", () => {
    describe("enforcePermission (Pages Router)", () => {
      it("should allow user with correct permission", async () => {
        mockGetServerSession.mockResolvedValue(
          makeSession("user-1", "admin@test.com"),
        );
        (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
          makeUserTeam("user-1", "team-1", "ADMIN"),
        );

        const { req, res } = createMocks({
          method: "GET",
          query: { teamId: "team-1" },
        });

        const result = await enforcePermission(
          req,
          res,
          Permission.WIRE_CONFIRM,
          "team-1",
        );

        expect(result).not.toBeNull();
      });

      it("should return 500 for invalid permission key", async () => {
        mockGetServerSession.mockResolvedValue(
          makeSession("user-1", "admin@test.com"),
        );

        const { req, res } = createMocks({
          method: "GET",
          query: { teamId: "team-1" },
        });

        const result = await enforcePermission(
          req,
          res,
          "invalid:permission" as PermissionKey,
          "team-1",
        );

        expect(result).toBeNull();
        expect(res._getStatusCode()).toBe(500);
      });
    });

    describe("enforcePermissionAppRouter", () => {
      it("should allow user with correct permission", async () => {
        mockGetServerSession.mockResolvedValue(
          makeSession("user-1", "admin@test.com"),
        );
        (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(
          makeUserTeam("user-1", "team-1", "ADMIN"),
        );

        const result = await enforcePermissionAppRouter(
          Permission.FUND_UPDATE,
          "team-1",
        );

        expect(result).not.toBeInstanceOf(NextResponse);
      });

      it("should return 500 for invalid permission key", async () => {
        const result = await enforcePermissionAppRouter(
          "invalid:perm" as PermissionKey,
          "team-1",
        );

        expect(result).toBeInstanceOf(NextResponse);
        expect((result as NextResponse).status).toBe(500);
      });

      it("should block user without sufficient role", async () => {
        mockGetServerSession.mockResolvedValue(
          makeSession("user-1", "member@test.com"),
        );
        (mockPrisma.userTeam.findFirst as jest.Mock).mockResolvedValue(null);

        const result = await enforcePermissionAppRouter(
          Permission.WIRE_CONFIRM,
          "team-1",
        );

        expect(result).toBeInstanceOf(NextResponse);
        expect((result as NextResponse).status).toBe(403);
      });
    });
  });

  // =========================================================================
  // 12. Route Classification (Edge Auth)
  // =========================================================================

  describe("Route Classification", () => {
    it("should classify auth endpoints as PUBLIC", () => {
      expect(classifyRoute("/api/auth/signin")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/auth/callback/google")).toBe(RouteCategory.PUBLIC);
    });

    it("should classify webhook endpoints as PUBLIC", () => {
      expect(classifyRoute("/api/webhooks/stripe")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/webhooks/persona")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/webhooks/resend")).toBe(RouteCategory.PUBLIC);
    });

    it("should classify health endpoint as PUBLIC", () => {
      expect(classifyRoute("/api/health")).toBe(RouteCategory.PUBLIC);
    });

    it("should classify tracking endpoints as PUBLIC", () => {
      expect(classifyRoute("/api/record_click")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/record_view")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/record_video_view")).toBe(RouteCategory.PUBLIC);
    });

    it("should classify cron endpoints as CRON", () => {
      expect(classifyRoute("/api/cron/daily-digest")).toBe(RouteCategory.CRON);
      expect(classifyRoute("/api/cron/expire-links")).toBe(RouteCategory.CRON);
    });

    it("should classify admin endpoints as ADMIN", () => {
      expect(classifyRoute("/api/admin/investors")).toBe(RouteCategory.ADMIN);
      expect(classifyRoute("/api/admin/settings/full")).toBe(RouteCategory.ADMIN);
      expect(classifyRoute("/api/admin/reports")).toBe(RouteCategory.ADMIN);
    });

    it("should classify team-scoped endpoints as TEAM_SCOPED", () => {
      expect(classifyRoute("/api/teams/123/funds")).toBe(RouteCategory.TEAM_SCOPED);
      expect(classifyRoute("/api/billing/checkout")).toBe(RouteCategory.TEAM_SCOPED);
      expect(classifyRoute("/api/funds/create")).toBe(RouteCategory.TEAM_SCOPED);
      expect(classifyRoute("/api/contacts/123")).toBe(RouteCategory.TEAM_SCOPED);
    });

    it("should classify LP endpoints as AUTHENTICATED", () => {
      expect(classifyRoute("/api/lp/fund-context")).toBe(RouteCategory.AUTHENTICATED);
      expect(classifyRoute("/api/esign/envelopes")).toBe(RouteCategory.AUTHENTICATED);
      expect(classifyRoute("/api/user/notification-preferences")).toBe(
        RouteCategory.AUTHENTICATED,
      );
    });

    it("should classify unknown /api/ paths as AUTHENTICATED (fail-safe)", () => {
      expect(classifyRoute("/api/unknown/endpoint")).toBe(RouteCategory.AUTHENTICATED);
    });

    it("should classify non-API paths as PUBLIC", () => {
      expect(classifyRoute("/admin/dashboard")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/lp/onboard")).toBe(RouteCategory.PUBLIC);
    });

    it("should classify outreach public sub-routes as PUBLIC", () => {
      expect(classifyRoute("/api/outreach/unsubscribe")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/outreach/track/click")).toBe(RouteCategory.PUBLIC);
    });

    it("should classify outreach main routes as TEAM_SCOPED", () => {
      expect(classifyRoute("/api/outreach/sequences")).toBe(RouteCategory.TEAM_SCOPED);
      expect(classifyRoute("/api/outreach/templates")).toBe(RouteCategory.TEAM_SCOPED);
    });

    it("should classify jobs endpoints as PUBLIC (uses INTERNAL_API_KEY)", () => {
      expect(classifyRoute("/api/jobs/process-queue")).toBe(RouteCategory.PUBLIC);
    });

    it("should classify branding endpoints as PUBLIC", () => {
      expect(classifyRoute("/api/branding/tenant")).toBe(RouteCategory.PUBLIC);
    });

    it("PUBLIC_PATHS should not overlap with ADMIN_PATHS", () => {
      for (const pub of PUBLIC_PATHS) {
        for (const admin of ADMIN_PATHS) {
          // Neither should be a prefix of the other
          expect(pub.startsWith(admin)).toBe(false);
        }
      }
    });

    it("every path array should contain only strings starting with /api/", () => {
      const allPaths = [
        ...PUBLIC_PATHS,
        ...CRON_PATHS,
        ...ADMIN_PATHS,
        ...TEAM_SCOPED_PATHS,
        ...AUTHENTICATED_PATHS,
      ];

      for (const path of allPaths) {
        expect(path.startsWith("/api/")).toBe(true);
      }
    });
  });
});
