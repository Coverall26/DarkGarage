import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth/auth-options";
import type { Role } from "@prisma/client";
import { ROLE_HIERARCHY } from "@/lib/auth/role-hierarchy";

/**
 * @deprecated Use `enforceRBACAppRouter` or `requireAdminAppRouter` from `@/lib/auth/rbac` instead.
 *
 * Team-scoped RBAC authentication helper for App Router API routes.
 * This module has zero production imports — all callers use rbac.ts.
 *
 * Validates:
 * 1. User is authenticated (valid session)
 * 2. User has membership in the requested team
 * 3. User's team role meets the minimum required role
 * 4. Returns org context for multi-tenant query scoping
 *
 * Usage:
 *   const auth = await withTeamAuth(teamId);
 *   if ("error" in auth) return auth.error;
 *   // auth.userId, auth.teamId, auth.orgId, auth.role are available
 */

export interface TeamAuthResult {
  userId: string;
  userEmail: string;
  teamId: string;
  orgId: string | null;
  role: Role;
  teamName: string;
}

export interface TeamAuthError {
  error: NextResponse;
}

/**
 * Authenticate user and verify team membership with minimum role.
 *
 * @param teamId - The team ID from URL params
 * @param options.minRole - Minimum role required (default: MEMBER)
 * @returns TeamAuthResult on success, TeamAuthError on failure
 */
export async function withTeamAuth(
  teamId: string,
  options: { minRole?: Role } = {},
): Promise<TeamAuthResult | TeamAuthError> {
  const { minRole = "MEMBER" } = options;

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const membership = await prisma.userTeam.findFirst({
    where: {
      userId: session.user.id,
      teamId,
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          organizationId: true,
        },
      },
    },
  });

  if (!membership) {
    return {
      error: NextResponse.json(
        { error: "Forbidden: not a member of this team" },
        { status: 403 },
      ),
    };
  }

  // Check role hierarchy
  const userLevel = ROLE_HIERARCHY[membership.role] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;

  if (userLevel < requiredLevel) {
    return {
      error: NextResponse.json(
        { error: `Forbidden: requires ${minRole} role or higher` },
        { status: 403 },
      ),
    };
  }

  return {
    userId: session.user.id,
    userEmail: session.user.email!,
    teamId: membership.team.id,
    orgId: membership.team.organizationId,
    role: membership.role,
    teamName: membership.team.name,
  };
}

/**
 * Convenience: require ADMIN or OWNER role.
 */
export async function withAdminAuth(
  teamId: string,
): Promise<TeamAuthResult | TeamAuthError> {
  return withTeamAuth(teamId, { minRole: "ADMIN" });
}

/**
 * Convenience: require OWNER role.
 */
export async function withOwnerAuth(
  teamId: string,
): Promise<TeamAuthResult | TeamAuthError> {
  return withTeamAuth(teamId, { minRole: "OWNER" });
}
