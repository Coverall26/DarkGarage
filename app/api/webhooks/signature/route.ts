/**
 * Webhook: /api/webhooks/signature — Legacy SignatureDocument System
 *
 * Handles lifecycle events from the legacy signature event system
 * (lib/webhook/triggers/signature-events.ts). Processes SignatureDocument +
 * SignatureRecipient model events. Also handles subscription document completion
 * for LP onboarding flow.
 *
 * Events: document.signed, document.completed, document.viewed, document.declined
 * Auth:   HMAC-SHA256 via x-signature header + SIGNATURE_WEBHOOK_SECRET env var
 *
 * DO NOT merge with /api/webhooks/esign — they handle different data models
 * (SignatureDocument vs Envelope). See docs/SIGNATURE-API-MAP.md for details.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/resend";
import CompletionNotification from "@/components/emails/completion-notification";
import { logAuditEventFromRequest } from "@/lib/audit/audit-logger";
import { reportError } from "@/lib/error";

function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = process.env.SIGNATURE_WEBHOOK_SECRET;

  if (!secret) {
    console.warn(
      "[SIGNATURE_WEBHOOK] No secret configured - accepting in development only",
    );
    return process.env.NODE_ENV === "development";
  }

  if (!signature) {
    console.error("[SIGNATURE_WEBHOOK] Missing x-signature header");
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex"),
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: {
    event: string;
    documentId: string;
    recipientId: string;
    reason?: string;
  };

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature");

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error("[SIGNATURE_WEBHOOK] Invalid or missing signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 },
      );
    }

    body = JSON.parse(rawBody);
  } catch (error) {
    console.error("[SIGNATURE_WEBHOOK] Failed to parse body:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  try {
    const { event, documentId, recipientId, reason } = body;

    switch (event) {
      case "document.signed":
        await handleDocumentSigned(req, documentId, recipientId);
        break;

      case "document.completed":
        await handleDocumentCompleted(req, documentId);
        break;

      case "document.viewed":
        await handleDocumentViewed(req, documentId, recipientId);
        break;

      case "document.declined":
        await handleDocumentDeclined(req, documentId, recipientId, reason);
        break;

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("[SIGNATURE_WEBHOOK] Error:", error);
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function handleDocumentSigned(
  req: NextRequest,
  documentId: string,
  recipientId: string,
) {
  const document = await prisma.signatureDocument.findUnique({
    where: { id: documentId },
    include: {
      recipients: true,
      team: true,
    },
  });

  if (!document) {
    return;
  }

  const recipient = document.recipients.find(
    (r: { id: string }) => r.id === recipientId,
  );

  await logAuditEventFromRequest(req, {
    eventType: "DOCUMENT_SIGNED",
    teamId: document.teamId,
    resourceType: "SignatureDocument",
    resourceId: documentId,
    metadata: {
      recipientId,
      recipientEmail: recipient?.email,
      recipientName: recipient?.name,
      documentTitle: document.title,
      documentType: document.documentType,
      timestamp: new Date().toISOString(),
    },
  });

  const investor = document.investorId
    ? await prisma.investor.findUnique({
        where: { id: document.investorId },
        include: { user: true },
      })
    : null;

  const allSigned = document.recipients.every(
    (r: { status: string }) => r.status === "SIGNED",
  );

  if (allSigned && document.status !== "COMPLETED") {
    await prisma.signatureDocument.update({
      where: { id: documentId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    if (document.documentType === "SUBSCRIPTION" && investor) {
      const subscription = await prisma.subscription.findFirst({
        where: { signatureDocumentId: documentId },
      });

      if (subscription) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: "SIGNED" },
        });
      }
    }

    await sendCompletionNotification(document, investor);
  }
}

async function handleDocumentCompleted(
  req: NextRequest,
  documentId: string,
) {
  const document = await prisma.signatureDocument.findUnique({
    where: { id: documentId },
    include: {
      team: true,
      recipients: true,
    },
  });

  if (!document) return;

  await logAuditEventFromRequest(req, {
    eventType: "DOCUMENT_COMPLETED",
    teamId: document.teamId,
    resourceType: "SignatureDocument",
    resourceId: documentId,
    metadata: {
      documentTitle: document.title,
      documentType: document.documentType,
      recipientCount: document.recipients.length,
      completedAt: new Date().toISOString(),
    },
  });

  const investor = document.investorId
    ? await prisma.investor.findUnique({
        where: { id: document.investorId },
        include: { user: true },
      })
    : null;

  if (document.status !== "COMPLETED") {
    await prisma.signatureDocument.update({
      where: { id: documentId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
  }

  if (document.documentType === "SUBSCRIPTION") {
    const subscription = await prisma.subscription.findFirst({
      where: { signatureDocumentId: documentId },
    });

    if (subscription && subscription.status !== "SIGNED") {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "SIGNED" },
      });
    }
  }

  await sendCompletionNotification(document, investor);
}

async function handleDocumentViewed(
  req: NextRequest,
  documentId: string,
  recipientId: string,
) {
  const recipient = await prisma.signatureRecipient.update({
    where: { id: recipientId },
    data: {
      viewedAt: new Date(),
    },
  });

  const document = await prisma.signatureDocument.findUnique({
    where: { id: documentId },
    select: { teamId: true, title: true },
  });

  await logAuditEventFromRequest(req, {
    eventType: "DOCUMENT_VIEWED",
    teamId: document?.teamId,
    resourceType: "SignatureDocument",
    resourceId: documentId,
    metadata: {
      recipientId,
      recipientEmail: recipient?.email,
      documentTitle: document?.title,
      timestamp: new Date().toISOString(),
    },
  });
}

async function handleDocumentDeclined(
  req: NextRequest,
  documentId: string,
  recipientId: string,
  reason?: string,
) {
  const recipient = await prisma.signatureRecipient.update({
    where: { id: recipientId },
    data: {
      status: "DECLINED",
      declinedAt: new Date(),
      declinedReason: reason,
    },
  });

  const document = await prisma.signatureDocument.update({
    where: { id: documentId },
    data: {
      status: "DECLINED",
    },
    select: { teamId: true, title: true },
  });

  await logAuditEventFromRequest(req, {
    eventType: "DOCUMENT_DECLINED",
    teamId: document?.teamId,
    resourceType: "SignatureDocument",
    resourceId: documentId,
    metadata: {
      recipientId,
      recipientEmail: recipient?.email,
      declinedReason: reason,
      documentTitle: document?.title,
      timestamp: new Date().toISOString(),
    },
  });
}

interface CompletionDocument {
  id: string;
  title: string;
  team: { id: string; name: string } | null;
}

interface CompletionInvestor {
  id: string;
  user: { email: string | null; name: string | null } | null;
}

async function sendCompletionNotification(
  document: CompletionDocument,
  investor: CompletionInvestor | null,
) {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://app.fundroom.ai";
  const certificateUrl = `${baseUrl}/sign/certificate/${document.id}`;

  const recipients: string[] = [];

  if (investor?.user?.email) {
    recipients.push(investor.user.email);
  }

  if (document.team) {
    const teamAdmins = await prisma.userTeam.findMany({
      where: {
        teamId: document.team.id,
        role: { in: ["OWNER", "ADMIN", "SUPER_ADMIN"] },
      },
      include: {
        user: true,
      },
    });

    teamAdmins.forEach(
      (admin: { user: { email: string | null } }) => {
        if (admin.user.email) {
          recipients.push(admin.user.email);
        }
      },
    );
  }

  for (const email of [...new Set(recipients)]) {
    try {
      await sendEmail({
        to: email,
        subject: `Document Signed: ${document.title}`,
        react: CompletionNotification({
          documentTitle: document.title,
          certificateUrl,
        }),
      });
    } catch (error) {
      reportError(error as Error);
    }
  }
}
