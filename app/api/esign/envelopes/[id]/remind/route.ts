/**
 * POST /api/esign/envelopes/[id]/remind — Send reminder to pending signers
 */
import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { requireAuthAppRouter } from "@/lib/auth/rbac";
import { sendReminder } from "@/lib/esign/envelope-service";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { validateBody } from "@/lib/middleware/validate";
import { EnvelopeRemindSchema } from "@/lib/validations/esign-outreach";
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

    // Parse optional JSON body — empty body is OK
    const parsed = await validateBody(req, EnvelopeRemindSchema);
    if (parsed.error) return parsed.error;
    const result = await sendReminder(id, auth.userId, parsed.data.recipientId ?? undefined);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("Cannot send")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return errorResponse(error);
  }
}
