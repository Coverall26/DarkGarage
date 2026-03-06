/**
 * GET /api/esign/envelopes/[id]/status — Get signing progress for an envelope
 *
 * Returns which signers are in the current group, who has signed,
 * and which groups are waiting (for sequential/mixed mode).
 */
import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { requireAuthAppRouter } from "@/lib/auth/rbac";
import { getSigningStatus } from "@/lib/esign/signing-session";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { checkModuleAccess, resolveOrgIdFromTeam } from "@/lib/middleware/module-access";

export const dynamic = "force-dynamic";

export async function GET(
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
      return NextResponse.json(
        { error: "Envelope not found" },
        { status: 404 }
      );
    }

    if (envelope.teamId !== auth.teamId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const status = await getSigningStatus(id);

    return NextResponse.json(status);
  } catch (error) {
    return errorResponse(error);
  }
}
