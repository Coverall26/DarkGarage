import { sendOrgEmail } from "@/lib/resend";
import prisma from "@/lib/prisma";
import SignatureRequestEmail from "@/components/emails/signature-request";
import SignatureCompletedEmail from "@/components/emails/signature-completed";
import SignatureReminderEmail from "@/components/emails/signature-reminder";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// E-Sign Email Notification Functions
//
// Five fire-and-forget email senders wired into the envelope lifecycle:
//   1. sendSigningInvitationEmail  — recipient invited to sign
//   2. sendSigningReminderEmail    — reminder for pending signers
//   3. sendSigningCompletedEmail   — CC recipients + creator on completion
//   4. sendNextSignerEmail         — next signer(s) in sequential/mixed flow
//   5. sendEnvelopeDeclinedEmail   — creator + recipients on decline
//
// All use Tier 2 (org-branded) email via sendOrgEmail().
// Errors are logged but never thrown (fire-and-forget).
// ---------------------------------------------------------------------------

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://app.fundroom.ai";

/**
 * 1. Send signing invitation email to a recipient.
 * Called when an envelope is first sent — notifies signers that need to sign.
 */
export async function sendSigningInvitationEmail(
  recipientId: string,
  envelopeId: string,
): Promise<void> {
  try {
    const recipient = await prisma.envelopeRecipient.findUnique({
      where: { id: recipientId },
      include: {
        envelope: {
          include: {
            team: { select: { name: true } },
            createdBy: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!recipient?.envelope) {
      logger.warn("Recipient or envelope not found for signing invitation", { module: "send-esign-notifications", recipientId });
      return;
    }

    const { envelope } = recipient;
    const signingUrl = `${BASE_URL}/sign/${recipient.signingToken}`;

    await sendOrgEmail({
      teamId: envelope.teamId,
      to: recipient.email,
      subject: envelope.emailSubject || `Please sign: ${envelope.title}`,
      react: SignatureRequestEmail({
        recipientName: recipient.name || recipient.email,
        documentTitle: envelope.title,
        senderName: envelope.createdBy?.name || "The sender",
        teamName: envelope.team?.name || "the team",
        message: envelope.emailMessage || undefined,
        signingUrl,
      }),
      test: process.env.NODE_ENV === "development",
    });
  } catch (error) {
    logger.error("Failed to send signing invitation", { module: "send-esign-notifications", error: String(error), recipientId, envelopeId });
  }
}

/**
 * 2. Send reminder email to a pending signer.
 * Called from envelope-service.ts sendReminders() for each pending recipient.
 */
export async function sendSigningReminderEmail(
  recipientId: string,
  envelopeId: string,
): Promise<void> {
  try {
    const recipient = await prisma.envelopeRecipient.findUnique({
      where: { id: recipientId },
      include: {
        envelope: {
          include: {
            team: { select: { name: true } },
            createdBy: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!recipient?.envelope) {
      logger.warn("Recipient not found for signing reminder", { module: "send-esign-notifications", recipientId });
      return;
    }

    const { envelope } = recipient;
    const signingUrl = `${BASE_URL}/sign/${recipient.signingToken}`;

    // Calculate days waiting
    const sentAt = recipient.sentAt || envelope.sentAt;
    const daysWaiting = sentAt
      ? Math.floor((Date.now() - new Date(sentAt).getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    // Format expiration date if set
    const expirationDate = envelope.expiresAt
      ? new Date(envelope.expiresAt).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : undefined;

    await sendOrgEmail({
      teamId: envelope.teamId,
      to: recipient.email,
      subject: `Reminder: Your signature is needed on "${envelope.title}"`,
      react: SignatureReminderEmail({
        recipientName: recipient.name || recipient.email,
        documentTitle: envelope.title,
        senderName: envelope.createdBy?.name || "The sender",
        teamName: envelope.team?.name || "the team",
        signingUrl,
        daysWaiting,
        expirationDate,
      }),
      test: process.env.NODE_ENV === "development",
    });
  } catch (error) {
    logger.error("Failed to send signing reminder", { module: "send-esign-notifications", error: String(error), recipientId, envelopeId });
  }
}

/**
 * 3. Send completion email to CC recipients and envelope creator.
 * Called from signing-session.ts when all signers have completed.
 */
export async function sendSigningCompletedEmails(
  envelopeId: string,
): Promise<void> {
  try {
    const envelope = await prisma.envelope.findUnique({
      where: { id: envelopeId },
      include: {
        recipients: true,
        team: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });

    if (!envelope) {
      logger.warn("Envelope not found for completion notification", { module: "send-esign-notifications", envelopeId });
      return;
    }

    const completedAt = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    // Build signers list for the email
    const signersList = envelope.recipients
      .filter((r) => r.role === "SIGNER")
      .map((r) => r.name || r.email);

    const documentUrl = `${BASE_URL}/admin/documents`;

    // Collect all email targets: CC recipients + envelope creator
    const emailTargets: { email: string; name: string }[] = [];

    // CC recipients
    const ccRecipients = envelope.recipients.filter(
      (r) => r.role === "CC" || r.role === "CERTIFIED_DELIVERY"
    );
    for (const cc of ccRecipients) {
      emailTargets.push({ email: cc.email, name: cc.name || cc.email });
    }

    // Envelope creator
    if (envelope.createdBy?.email) {
      const creatorAlreadyIncluded = emailTargets.some(
        (t) => t.email.toLowerCase() === envelope.createdBy!.email!.toLowerCase()
      );
      if (!creatorAlreadyIncluded) {
        emailTargets.push({
          email: envelope.createdBy.email,
          name: envelope.createdBy.name || envelope.createdBy.email,
        });
      }
    }

    // Send to each target
    for (const target of emailTargets) {
      await sendOrgEmail({
        teamId: envelope.teamId,
        to: target.email,
        subject: `Signing complete: ${envelope.title}`,
        react: SignatureCompletedEmail({
          recipientName: target.name,
          documentTitle: envelope.title,
          teamName: envelope.team?.name || "the team",
          completedAt,
          signersList,
          documentUrl,
        }),
        test: process.env.NODE_ENV === "development",
      }).catch((e) => {
        logger.error("Failed to send completion email to recipient", { module: "send-esign-notifications", error: String(e), email: target.email, envelopeId });
      });
    }
  } catch (error) {
    logger.error("Failed to send completion emails", { module: "send-esign-notifications", error: String(error), envelopeId });
  }
}

/**
 * 4. Send signing invitation to the next signer(s) in sequential/mixed mode.
 * Called from signing-session.ts after a signer completes and the next group is unlocked.
 */
export async function sendNextSignerEmails(
  envelopeId: string,
  nextRecipientEmails: string[],
): Promise<void> {
  if (!nextRecipientEmails.length) return;

  try {
    const recipients = await prisma.envelopeRecipient.findMany({
      where: {
        envelopeId,
        email: { in: nextRecipientEmails },
      },
    });

    for (const recipient of recipients) {
      await sendSigningInvitationEmail(recipient.id, envelopeId);
    }
  } catch (error) {
    logger.error("Failed to send next-signer emails", { module: "send-esign-notifications", error: String(error), envelopeId, recipientCount: nextRecipientEmails.length });
  }
}

/**
 * 5. Send decline notification to envelope creator and other recipients.
 * Called from decline/route.ts when a signer declines to sign.
 */
export async function sendEnvelopeDeclinedEmails(
  envelopeId: string,
  declinerName: string,
  declinerEmail: string,
  reason?: string,
): Promise<void> {
  try {
    const envelope = await prisma.envelope.findUnique({
      where: { id: envelopeId },
      include: {
        recipients: true,
        team: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });

    if (!envelope) {
      logger.warn("Envelope not found for decline notification", { module: "send-esign-notifications", envelopeId });
      return;
    }

    // Notify envelope creator
    if (envelope.createdBy?.email) {
      await sendOrgEmail({
        teamId: envelope.teamId,
        to: envelope.createdBy.email,
        subject: `Signing declined: ${envelope.title}`,
        react: SignatureCompletedEmail({
          recipientName: envelope.createdBy.name || envelope.createdBy.email,
          documentTitle: envelope.title,
          teamName: envelope.team?.name || "the team",
          completedAt: `Declined by ${declinerName}${reason ? `: ${reason}` : ""}`,
          signersList: [`${declinerName} (${declinerEmail}) — DECLINED`],
          documentUrl: `${BASE_URL}/admin/documents`,
        }),
        test: process.env.NODE_ENV === "development",
      }).catch((e) => {
        logger.error("Failed to send decline notification to creator", { module: "send-esign-notifications", error: String(e), envelopeId, creatorEmail: envelope.createdBy?.email });
      });
    }

    // Notify other signers who haven't completed yet
    const otherSigners = envelope.recipients.filter(
      (r) =>
        r.role === "SIGNER" &&
        r.email.toLowerCase() !== declinerEmail.toLowerCase() &&
        r.status !== "SIGNED"
    );

    for (const signer of otherSigners) {
      await sendOrgEmail({
        teamId: envelope.teamId,
        to: signer.email,
        subject: `Signing declined: ${envelope.title}`,
        react: SignatureCompletedEmail({
          recipientName: signer.name || signer.email,
          documentTitle: envelope.title,
          teamName: envelope.team?.name || "the team",
          completedAt: `Declined by ${declinerName}${reason ? `: ${reason}` : ""}`,
          signersList: [`${declinerName} (${declinerEmail}) — DECLINED`],
        }),
        test: process.env.NODE_ENV === "development",
      }).catch((e) => {
        logger.error("Failed to send decline notification to signer", { module: "send-esign-notifications", error: String(e), envelopeId, signerEmail: signer.email });
      });
    }
  } catch (error) {
    logger.error("Failed to send decline emails", { module: "send-esign-notifications", error: String(error), envelopeId, declinerEmail });
  }
}
