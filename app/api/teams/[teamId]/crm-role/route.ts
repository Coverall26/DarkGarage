/**
 * PATCH /api/teams/[teamId]/crm-role — Update a team member's CRM role.
 *
 * Body: { userId: string, crmRole: "VIEWER" | "CONTRIBUTOR" | "MANAGER" }
 * Auth: Requires ADMIN+ team role.
 */

import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { enforceRBACAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { validateBody } from "@/lib/middleware/validate";
import { CrmRoleUpdateSchema } from "@/lib/validations/teams";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const { teamId } = await params;

    const auth = await enforceRBACAppRouter({
      roles: ["OWNER", "SUPER_ADMIN", "ADMIN"],
      teamId,
    });
    if (auth instanceof NextResponse) return auth;

    // Validate body with Zod schema
    const parsed = await validateBody(req, CrmRoleUpdateSchema);
    if (parsed.error) return parsed.error;
    const { userId, crmRole } = parsed.data;

    // Verify target user is a member of this team
    const targetMember = await prisma.userTeam.findFirst({
      where: { teamId, userId },
      select: { role: true, userId: true },
    });

    if (!targetMember) {
      return NextResponse.json(
        { error: "User is not a member of this team" },
        { status: 404 },
      );
    }

    // Update CRM role
    await prisma.userTeam.update({
      where: {
        userId_teamId: { userId, teamId },
      },
      data: { crmRole },
    });

    return NextResponse.json({ success: true, userId, crmRole });
  } catch (error) {
    return errorResponse(error);
  }
}
