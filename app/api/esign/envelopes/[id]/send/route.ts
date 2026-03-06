/**
 * POST /api/esign/envelopes/[id]/send — Send envelope to recipients
 *
 * Transitions envelope from DRAFT/PREPARING → SENT.
 * Sends signing emails to appropriate recipients based on signing mode.
 */
import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { errorResponse } from "@/lib/errors";
import { requireAuthAppRouter } from "@/lib/auth/rbac";
import { sendEnvelope, scheduleEnvelope } from "@/lib/esign/envelope-service";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import {
  requireFundroomActive,
  PAYWALL_ERROR,
} from "@/lib/auth/paywall";
import { sendSigningInvitationEmail } from "@/lib/emails/send-esign-notifications";
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

    // Paywall check — sending is a paid GP action
    const paywallAllowed = await requireFundroomActive(auth.teamId);
    if (!paywallAllowed) {
      return NextResponse.json(PAYWALL_ERROR, { status: 402 });
    }

    // Check if this is a scheduled send
    let scheduledSendAt: string | undefined;
    try {
      const body = await req.json();
      scheduledSendAt = body?.scheduledSendAt;
    } catch {
      // No body — immediate send
    }

    if (scheduledSendAt) {
      const sendDate = new Date(scheduledSendAt);
      if (isNaN(sendDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid scheduledSendAt date" },
          { status: 400 },
        );
      }
      const scheduled = await scheduleEnvelope(id, auth.userId, sendDate);
      return NextResponse.json(scheduled);
    }

    const sent = await sendEnvelope(id, auth.userId);

    // Fire-and-forget: Record e-sig document sent for tier enforcement
    import("@/lib/esig/usage-service").then(({ recordDocumentSent }) =>
      recordDocumentSent(auth.teamId)
    ).catch((e) => reportError(e as Error));

    // Fire-and-forget: Send signing invitation emails to SENT recipients
    if (sent?.recipients) {
      const sentRecipients = sent.recipients.filter(
        (r) => r.status === "SENT" && r.role === "SIGNER"
      );
      for (const r of sentRecipients) {
        sendSigningInvitationEmail(r.id, id).catch((e) =>
          reportError(e as Error)
        );
      }
    }

    return NextResponse.json(sent);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (
      message.includes("Cannot send") ||
      message.includes("Cannot schedule") ||
      message.includes("No signers") ||
      message.includes("must be in the future")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return errorResponse(error);
  }
}
