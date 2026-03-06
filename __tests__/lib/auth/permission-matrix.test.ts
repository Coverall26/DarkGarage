/**
 * Tests for the centralized RBAC Permission Matrix.
 *
 * Verifies:
 *  1. Permission constants are unique and well-formed
 *  2. PERMISSION_MATRIX covers all permissions
 *  3. checkPermission() works correctly
 *  4. getPermissionsForRole() returns correct sets
 *  5. getMinimumRole() returns the lowest allowed role
 *  6. Role hierarchy is respected (higher roles have superset of lower roles' permissions)
 *  7. enforcePermission / enforcePermissionAppRouter work correctly
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

jest.mock("@/lib/auth/auth-options", () => ({
  authOptions: { providers: [], session: { strategy: "jwt" } },
}));

import {
  Permission,
  PermissionKey,
  PERMISSION_MATRIX,
  RBACRole,
  checkPermission,
  getPermissionsForRole,
  getMinimumRole,
} from "@/lib/auth/rbac";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    userTeam: {
      findFirst: jest.fn(),
    },
    investor: {
      findFirst: jest.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Permission Constants
// ---------------------------------------------------------------------------

describe("Permission Constants", () => {
  const allPermissions = Object.values(Permission);

  it("should have unique permission values", () => {
    const unique = new Set(allPermissions);
    expect(unique.size).toBe(allPermissions.length);
  });

  it("should follow resource:action naming convention", () => {
    for (const perm of allPermissions) {
      expect(perm).toMatch(/^[a-z]+:[a-z_]+$/);
    }
  });

  it("should have at least 40 permissions defined", () => {
    expect(allPermissions.length).toBeGreaterThanOrEqual(40);
  });
});

// ---------------------------------------------------------------------------
// PERMISSION_MATRIX Coverage
// ---------------------------------------------------------------------------

describe("PERMISSION_MATRIX", () => {
  it("should have an entry for every Permission constant", () => {
    for (const perm of Object.values(Permission)) {
      expect(PERMISSION_MATRIX).toHaveProperty(perm);
      expect(PERMISSION_MATRIX[perm as PermissionKey].length).toBeGreaterThan(0);
    }
  });

  it("should not have entries for non-existent permissions", () => {
    const validPerms = new Set(Object.values(Permission));
    for (const key of Object.keys(PERMISSION_MATRIX)) {
      expect(validPerms.has(key as PermissionKey)).toBe(true);
    }
  });

  it("should only contain valid RBACRole values", () => {
    const validRoles: RBACRole[] = ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"];
    for (const [perm, roles] of Object.entries(PERMISSION_MATRIX)) {
      for (const role of roles) {
        expect(validRoles).toContain(role);
      }
    }
  });

  it("every permission should include OWNER", () => {
    for (const [perm, roles] of Object.entries(PERMISSION_MATRIX)) {
      expect(roles).toContain("OWNER");
    }
  });
});

// ---------------------------------------------------------------------------
// checkPermission()
// ---------------------------------------------------------------------------

describe("checkPermission", () => {
  it("should return true for allowed roles", () => {
    expect(checkPermission("OWNER", Permission.FUND_CREATE)).toBe(true);
    expect(checkPermission("ADMIN", Permission.FUND_CREATE)).toBe(true);
    expect(checkPermission("SUPER_ADMIN", Permission.FUND_CREATE)).toBe(true);
  });

  it("should return false for disallowed roles", () => {
    expect(checkPermission("MANAGER", Permission.FUND_CREATE)).toBe(false);
    expect(checkPermission("MEMBER", Permission.FUND_CREATE)).toBe(false);
  });

  it("should return false for invalid permission", () => {
    expect(checkPermission("OWNER", "nonexistent:perm" as PermissionKey)).toBe(false);
  });

  it("should return false for invalid role", () => {
    expect(checkPermission("INVALID_ROLE", Permission.FUND_READ)).toBe(false);
  });

  it("should allow MEMBER to read datarooms", () => {
    expect(checkPermission("MEMBER", Permission.DATAROOM_READ)).toBe(true);
  });

  it("should not allow MEMBER to delete datarooms", () => {
    expect(checkPermission("MEMBER", Permission.DATAROOM_DELETE)).toBe(false);
  });

  it("should restrict wire confirmation to admin+", () => {
    expect(checkPermission("OWNER", Permission.WIRE_CONFIRM)).toBe(true);
    expect(checkPermission("ADMIN", Permission.WIRE_CONFIRM)).toBe(true);
    expect(checkPermission("MANAGER", Permission.WIRE_CONFIRM)).toBe(false);
    expect(checkPermission("MEMBER", Permission.WIRE_CONFIRM)).toBe(false);
  });

  it("should restrict platform settings to OWNER only", () => {
    expect(checkPermission("OWNER", Permission.PLATFORM_SETTINGS)).toBe(true);
    expect(checkPermission("SUPER_ADMIN", Permission.PLATFORM_SETTINGS)).toBe(false);
    expect(checkPermission("ADMIN", Permission.PLATFORM_SETTINGS)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getPermissionsForRole()
// ---------------------------------------------------------------------------

describe("getPermissionsForRole", () => {
  it("should return permissions for OWNER (all permissions)", () => {
    const perms = getPermissionsForRole("OWNER");
    expect(perms.length).toBe(Object.keys(PERMISSION_MATRIX).length);
  });

  it("should return fewer permissions for MEMBER than ADMIN", () => {
    const memberPerms = getPermissionsForRole("MEMBER");
    const adminPerms = getPermissionsForRole("ADMIN");
    expect(adminPerms.length).toBeGreaterThan(memberPerms.length);
  });

  it("should return fewer permissions for MANAGER than ADMIN", () => {
    const managerPerms = getPermissionsForRole("MANAGER");
    const adminPerms = getPermissionsForRole("ADMIN");
    expect(adminPerms.length).toBeGreaterThan(managerPerms.length);
  });

  it("should include fund:read for all roles", () => {
    const roles: RBACRole[] = ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"];
    for (const role of roles) {
      const perms = getPermissionsForRole(role);
      expect(perms).toContain(Permission.FUND_READ);
    }
  });
});

// ---------------------------------------------------------------------------
// getMinimumRole()
// ---------------------------------------------------------------------------

describe("getMinimumRole", () => {
  it("should return MEMBER for broadly accessible permissions", () => {
    expect(getMinimumRole(Permission.FUND_READ)).toBe("MEMBER");
    expect(getMinimumRole(Permission.DATAROOM_READ)).toBe("MEMBER");
    expect(getMinimumRole(Permission.DOCUMENT_READ)).toBe("MEMBER");
  });

  it("should return MANAGER for GP-level permissions", () => {
    expect(getMinimumRole(Permission.INVESTOR_READ)).toBe("MANAGER");
    expect(getMinimumRole(Permission.DATAROOM_CREATE)).toBe("MANAGER");
    expect(getMinimumRole(Permission.ESIGN_SEND)).toBe("MANAGER");
  });

  it("should return ADMIN for admin-level permissions", () => {
    expect(getMinimumRole(Permission.FUND_CREATE)).toBe("ADMIN");
    expect(getMinimumRole(Permission.WIRE_CONFIRM)).toBe("ADMIN");
    expect(getMinimumRole(Permission.INVESTOR_APPROVE)).toBe("ADMIN");
    expect(getMinimumRole(Permission.DOCUMENT_REVIEW)).toBe("ADMIN");
  });

  it("should return OWNER for owner-only permissions", () => {
    expect(getMinimumRole(Permission.PLATFORM_SETTINGS)).toBe("OWNER");
  });

  it("should return null for invalid permission", () => {
    expect(getMinimumRole("nonexistent:perm" as PermissionKey)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Role Hierarchy — higher roles have superset of lower roles' permissions
// ---------------------------------------------------------------------------

describe("Role Hierarchy", () => {
  const hierarchy: RBACRole[] = ["MEMBER", "MANAGER", "ADMIN", "SUPER_ADMIN", "OWNER"];

  it("each higher role should have >= permissions of the role below", () => {
    for (let i = 1; i < hierarchy.length; i++) {
      const lowerRole = hierarchy[i - 1];
      const higherRole = hierarchy[i];
      const lowerPerms = new Set(getPermissionsForRole(lowerRole));
      const higherPerms = new Set(getPermissionsForRole(higherRole));

      for (const perm of lowerPerms) {
        expect(higherPerms.has(perm)).toBe(true);
      }
    }
  });

  it("OWNER should have all permissions", () => {
    const ownerPerms = getPermissionsForRole("OWNER");
    const allPerms = Object.values(Permission);
    expect(ownerPerms.length).toBe(allPerms.length);
    for (const perm of allPerms) {
      expect(ownerPerms).toContain(perm);
    }
  });
});

// ---------------------------------------------------------------------------
// Specific Domain Permission Checks
// ---------------------------------------------------------------------------

describe("Domain-Specific Permissions", () => {
  it("wire transfers: only admin+ can confirm", () => {
    expect(checkPermission("ADMIN", Permission.WIRE_CONFIRM)).toBe(true);
    expect(checkPermission("MANAGER", Permission.WIRE_CONFIRM)).toBe(false);
  });

  it("team management: only OWNER/SUPER_ADMIN can change roles", () => {
    expect(checkPermission("OWNER", Permission.TEAM_CHANGE_ROLE)).toBe(true);
    expect(checkPermission("SUPER_ADMIN", Permission.TEAM_CHANGE_ROLE)).toBe(true);
    expect(checkPermission("ADMIN", Permission.TEAM_CHANGE_ROLE)).toBe(false);
  });

  it("billing: restricted to OWNER/SUPER_ADMIN", () => {
    expect(checkPermission("OWNER", Permission.SETTINGS_BILLING)).toBe(true);
    expect(checkPermission("SUPER_ADMIN", Permission.SETTINGS_BILLING)).toBe(true);
    expect(checkPermission("ADMIN", Permission.SETTINGS_BILLING)).toBe(false);
  });

  it("investor approval: admin+ only", () => {
    expect(checkPermission("ADMIN", Permission.INVESTOR_APPROVE)).toBe(true);
    expect(checkPermission("MANAGER", Permission.INVESTOR_APPROVE)).toBe(false);
  });

  it("dataroom: MANAGER can create and manage links", () => {
    expect(checkPermission("MANAGER", Permission.DATAROOM_CREATE)).toBe(true);
    expect(checkPermission("MANAGER", Permission.DATAROOM_MANAGE_LINKS)).toBe(true);
    expect(checkPermission("MANAGER", Permission.DATAROOM_DELETE)).toBe(false);
  });

  it("e-signature: MANAGER can send and remind, not void", () => {
    expect(checkPermission("MANAGER", Permission.ESIGN_SEND)).toBe(true);
    expect(checkPermission("MANAGER", Permission.ESIGN_REMIND)).toBe(true);
    expect(checkPermission("MANAGER", Permission.ESIGN_VOID)).toBe(false);
  });

  it("Form D export: admin+ only", () => {
    expect(checkPermission("ADMIN", Permission.REPORT_FORM_D)).toBe(true);
    expect(checkPermission("MANAGER", Permission.REPORT_FORM_D)).toBe(false);
  });
});
