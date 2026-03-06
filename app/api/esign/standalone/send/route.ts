/**
 * POST /api/esign/standalone/send — One-step envelope create + send
 *
 * Combines envelope creation and sending into a single API call for the
 * SignSuite standalone send wizard. Enforces module access, monthly usage
 * limits, and auto-creates CRM contacts for new recipient emails.
 *
 * Flow:
 *   1. Auth + team scoping
 *   2. SIGNSUITE module access check
 *   3. E-sig monthly limit enforcement
 *   4. Create envelope with sourceModule: SIGNSUITE
 *   5. Send envelope (transitions DRAFT → SENT, emails signers)
 *   6. Fire-and-forget: record usage, auto-create CRM contacts
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuthAppRouter } from "@/lib/auth/rbac";
import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { errorResponse } from "@/lib/errors";
import { createEnvelope, sendEnvelope } from "@/lib/esign/envelope-service";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import {
  requireFundroomActive,
  PAYWALL_ERROR,
} from "@/lib/auth/paywall";
import { validateBody } from "@/lib/middleware/validate";
import { StandaloneSendSchema } from "@/lib/validations/esign-outreach";
import {
  checkModuleAccess,
  checkModuleLimit,
  resolveOrgIdFromTeam,
} from "@/lib/middleware/module-access";
import { sendSigningInvitationEmail } from "@/lib/emails/send-esign-notifications";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const auth = await requireAuthAppRouter();
    if (auth instanceof NextResponse) return auth;

    // Resolve org for module checks
    const orgId = await resolveOrgIdFromTeam(auth.teamId);
    if (!orgId) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 403 },
      );
    }

    // Module access check — SIGNSUITE required
    const moduleBlocked = await checkModuleAccess(orgId, "SIGNSUITE");
    if (moduleBlocked) return moduleBlocked;

    // Monthly e-sig limit check
    const { canSendDocument } = await import("@/lib/esig/usage-service");
    const canSend = await canSendDocument(auth.teamId);
    if (!canSend) {
      const limitBlocked = await checkModuleLimit(
        orgId,
        "SIGNSUITE",
        "MONTHLY_ESIGN",
        999999, // Force over-limit response
      );
      if (limitBlocked) return limitBlocked;
      // Fallback if checkModuleLimit doesn't trigger
      return NextResponse.json(
        { error: "Monthly e-signature limit reached. Upgrade your plan for more." },
        { status: 403 },
      );
    }

    // Paywall check
    const paywallAllowed = await requireFundroomActive(auth.teamId);
    if (!paywallAllowed) {
      return NextResponse.json(PAYWALL_ERROR, { status: 402 });
    }

    // Validate body
    const parsed = await validateBody(req, StandaloneSendSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    // Validate expiration
    let expiresAt: Date | undefined;
    if (body.expiresAt) {
      expiresAt = new Date(body.expiresAt);
      if (isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        return NextResponse.json(
          { error: "Expiration date must be in the future" },
          { status: 400 },
        );
      }
    }

    // Resolve user
    const user = await prisma.user.findUnique({
      where: { email: auth.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Step 1: Create envelope with sourceModule
    const envelope = await createEnvelope({
      teamId: auth.teamId,
      createdById: user.id,
      title: body.title.trim(),
      description: body.description?.trim(),
      signingMode: body.signingMode,
      emailSubject: body.emailSubject?.trim(),
      emailMessage: body.emailMessage?.trim(),
      expiresAt,
      reminderEnabled: body.reminderEnabled,
      reminderDays: body.reminderDays,
      maxReminders: body.maxReminders,
      recipients: body.recipients,
      sourceFile: body.sourceFile ?? undefined,
      sourceStorageType: body.sourceStorageType ?? undefined,
      sourceFileName: body.sourceFileName ?? undefined,
      sourceMimeType: body.sourceMimeType ?? undefined,
      sourceFileSize: body.sourceFileSize ?? undefined,
      sourceNumPages: body.sourceNumPages ?? undefined,
      sourceModule: "SIGNSUITE",
    });

    // Step 2: Send envelope immediately
    const sent = await sendEnvelope(envelope.id, user.id);

    // Fire-and-forget: Record usage (created + sent)
    import("@/lib/esig/usage-service").then(async ({ recordDocumentCreated, recordDocumentSent }) => {
      await recordDocumentCreated(auth.teamId);
      await recordDocumentSent(auth.teamId);
    }).catch((e) => reportError(e as Error));

    // Fire-and-forget: Auto-create CRM contacts for each recipient
    import("@/lib/crm/contact-upsert-job").then(({ captureFromSigningEvent }) => {
      for (const r of body.recipients) {
        captureFromSigningEvent({
          email: r.email.toLowerCase().trim(),
          name: r.name,
          teamId: auth.teamId,
          signatureDocumentId: envelope.id,
          eventType: "DOCUMENT_SENT",
        }).catch((e) => reportError(e as Error));
      }
    }).catch((e) => reportError(e as Error));

    // Fire-and-forget: Send signing invitation emails to SENT recipients
    if (sent?.recipients) {
      const sentRecipients = sent.recipients.filter(
        (r) => r.status === "SENT" && r.role === "SIGNER",
      );
      for (const r of sentRecipients) {
        sendSigningInvitationEmail(r.id, envelope.id).catch((e) =>
          reportError(e as Error),
        );
      }
    }

    logger.info("Standalone envelope sent", {
      module: "signsuite",
      metadata: {
        envelopeId: envelope.id,
        recipientCount: body.recipients.length,
        teamId: auth.teamId,
      },
    });

    return NextResponse.json(sent, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("required") || message.includes("SIGNER") || message.includes("Cannot send")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return errorResponse(error);
  }
}
