/**
 * POST /api/esign/envelopes/[id]/cancel-schedule — Cancel scheduled send
 *
 * Transitions envelope from SCHEDULED → DRAFT and clears scheduledSendAt.
 */
import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { errorResponse } from "@/lib/errors";
import { requireAuthAppRouter } from "@/lib/auth/rbac";
import { cancelScheduledEnvelope } from "@/lib/esign/envelope-service";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { checkModuleAccess, resolveOrgIdFromTeam } from "@/lib/middleware/module-access";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const auth = await requireAuthAppRouter();
    if (auth instanceof NextResponse) return auth;

    // Module access check — SIGNSUITE required
    const orgId = await resolveOrgIdFromTeam(auth.teamId);
    if (orgId) {
      const moduleBlocked = await checkModuleAccess(orgId, "SIGNSUITE");
      if (moduleBlocked) return moduleBlocked;
    }

    const { id } = await params;

    // Verify envelope belongs to user's team
    const envelope = await prisma.envelope.findUnique({
      where: { id },
      select: { teamId: true },
    });

    if (!envelope) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
    }

    if (envelope.teamId !== auth.teamId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const updated = await cancelScheduledEnvelope(id, auth.userId);
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("Cannot cancel")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return errorResponse(error);
  }
}
