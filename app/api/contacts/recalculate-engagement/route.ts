/**
 * POST /api/contacts/recalculate-engagement — Recalculate engagement scores
 * for all contacts on the team.
 *
 * Requires CRM MANAGER role.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { resolveCrmRole, hasCrmPermission } from "@/lib/auth/crm-roles";
import { recalculateTeamEngagement } from "@/lib/crm/contact-service";
import { checkModuleAccess, resolveOrgIdFromTeam } from "@/lib/middleware/module-access";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userTeam = await prisma.userTeam.findFirst({
      where: { userId: session.user.id },
      select: {
        role: true,
        crmRole: true,
        team: { select: { id: true } },
      },
    });

    if (!userTeam?.team) {
      return NextResponse.json({ error: "No team found" }, { status: 403 });
    }

    // Module access check — RAISE_CRM required for bulk engagement recalculation
    const orgId = await resolveOrgIdFromTeam(userTeam.team.id);
    if (orgId) {
      const moduleBlocked = await checkModuleAccess(orgId, "RAISE_CRM");
      if (moduleBlocked) return moduleBlocked;
    }

    const role = resolveCrmRole(userTeam.role, userTeam.crmRole);
    if (!hasCrmPermission(role, "MANAGER")) {
      return NextResponse.json(
        { error: "CRM Manager role required to recalculate team engagement" },
        { status: 403 },
      );
    }

    const result = await recalculateTeamEngagement(userTeam.team.id);

    return NextResponse.json({
      processed: result.processed,
      errors: result.errors,
      message: `Recalculated engagement scores for ${result.processed} contacts${result.errors > 0 ? ` (${result.errors} errors)` : ""}`,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
