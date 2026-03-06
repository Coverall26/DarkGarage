/**
 * Canonical Role Hierarchy
 *
 * Single source of truth for role privilege ordering.
 * Higher index = more privileges. Used by team auth modules.
 *
 * Import this instead of defining ROLE_HIERARCHY locally.
 */

import type { Role } from "@prisma/client";

/** Role hierarchy: MEMBER(0) < MANAGER(1) < ADMIN(2) < SUPER_ADMIN(3) < OWNER(4) */
export const ROLE_HIERARCHY: Record<Role, number> = {
  MEMBER: 0,
  MANAGER: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
  OWNER: 4,
};

/** Check if a role meets or exceeds a minimum required role */
export function meetsMinimumRole(userRole: Role, minRole: Role): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0);
}

/** GP-level roles: OWNER, SUPER_ADMIN, ADMIN, MANAGER */
export const GP_ROLES: Role[] = ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"];

/** Admin-level roles: OWNER, SUPER_ADMIN, ADMIN */
export const ADMIN_ROLES: Role[] = ["OWNER", "SUPER_ADMIN", "ADMIN"];

/** All team roles */
export const ALL_ROLES: Role[] = ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"];
