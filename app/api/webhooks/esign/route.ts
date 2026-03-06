/**
 * Webhook: /api/webhooks/esign — Envelope System (App Router)
 *
 * Handles lifecycle events from the standalone envelope system (lib/esign/envelope-service.ts).
 * Processes Envelope + EnvelopeRecipient model events.
 *
 * Events: signature.recipient_signed, signature.document_completed,
 *         signature.document_declined, signature.document_viewed
 * Auth:   HMAC-SHA256 via x-esign-signature header + ESIGN_WEBHOOK_SECRET env var
 *
 * DO NOT merge with /api/webhooks/signature — they handle different data models
 * (Envelope vs SignatureDocument). See docs/SIGNATURE-API-MAP.md for details.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/resend";
import SignatureCompletedEmail from "@/components/emails/signature-completed";
import { SignatureEventType } from "@/lib/webhook/triggers/signature-events";
import { reportError } from "@/lib/error";

interface EsignWebhookPayload {
  id: string;
  event: SignatureEventType;
  timestamp: string;
  data: {
    documentId: string;
    documentTitle: string;
    teamId: string;
    teamName: string;
    recipientId?: string;
    recipientName?: string;
    recipientEmail?: string;
    status: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    allRecipients?: Array<{
      name: string;
      email: string;
      status: string;
      signedAt?: string | null;
    }>;
  };
}

interface AuditEntry {
  event: string;
  timestamp: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  recipientEmail?: string | null;
  status?: string;
  details?: Record<string, unknown>;
}

function verifyWebhookSignature(
  payload: string,
  signature: string | undefined | null,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let payload: EsignWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as EsignWebhookPayload;
    } catch {
      console.error("[ESIGN_WEBHOOK] Invalid JSON in request body");
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const webhookSecret = process.env.ESIGN_WEBHOOK_SECRET;
    const signature = req.headers.get("x-esign-signature");

    // In production, webhook secret is required
    if (process.env.NODE_ENV === "production" && !webhookSecret) {
      console.error("[ESIGN_WEBHOOK] ESIGN_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    // Signature verification is mandatory when secret is configured
    if (webhookSecret) {
      if (!signature) {
        console.error("[ESIGN_WEBHOOK] Missing signature header");
        return NextResponse.json(
          { error: "Missing signature header" },
          { status: 401 },
        );
      }

      // Use deterministic JSON serialization for signature verification
      const sortedBody = JSON.stringify(
        payload,
        Object.keys(payload).sort(),
      );

      if (!verifyWebhookSignature(sortedBody, signature, webhookSecret)) {
        console.error("[ESIGN_WEBHOOK] Invalid signature");
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 401 },
        );
      }
    }

    if (!payload.event || !payload.data?.documentId) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 },
      );
    }

    // Verify document exists and belongs to the claimed team
    const document = await prisma.signatureDocument.findUnique({
      where: { id: payload.data.documentId },
      select: { id: true, teamId: true, status: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    if (document.teamId !== payload.data.teamId) {
      console.error("[ESIGN_WEBHOOK] Team mismatch");
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 },
      );
    }

    // Verify recipient exists if recipientId is provided
    if (payload.data.recipientId) {
      const recipient = await prisma.signatureRecipient.findFirst({
        where: {
          id: payload.data.recipientId,
          documentId: payload.data.documentId,
        },
      });

      if (!recipient) {
        return NextResponse.json(
          { error: "Recipient not found" },
          { status: 404 },
        );
      }
    }

    // Use IP from payload if provided (from original signer), otherwise use request IP
    const ipAddress =
      payload.data.ipAddress ||
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      "unknown";
    const userAgent =
      payload.data.userAgent || req.headers.get("user-agent") || null;

    const auditEntry: AuditEntry = {
      event: payload.event,
      timestamp: new Date().toISOString(),
      ipAddress,
      userAgent,
      recipientEmail: payload.data.recipientEmail || null,
      status: payload.data.status,
      details: {
        source: "webhook",
        webhookId: payload.id,
        originalTimestamp: payload.timestamp,
      },
    };

    switch (payload.event) {
      case "signature.recipient_signed":
        await handleRecipientSigned(payload.data, auditEntry);
        break;

      case "signature.document_completed":
        await handleDocumentCompleted(payload.data, auditEntry);
        break;

      case "signature.document_declined":
        await handleDocumentDeclined(payload.data, auditEntry);
        break;

      case "signature.document_viewed":
        await handleDocumentViewed(payload.data, auditEntry);
        break;

      default:
        break;
    }

    return NextResponse.json({
      success: true,
      message: "Webhook processed",
      event: payload.event,
      documentId: payload.data.documentId,
    });
  } catch (error) {
    reportError(error as Error);
    console.error("[ESIGN_WEBHOOK] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function appendToAuditTrail(documentId: string, entry: AuditEntry) {
  try {
    const doc = await prisma.signatureDocument.findUnique({
      where: { id: documentId },
      select: { auditTrail: true },
    });

    const currentAudit = (doc?.auditTrail as {
      entries?: AuditEntry[];
    }) || { entries: [] };
    const entries = currentAudit.entries || [];
    entries.push(entry);

    await prisma.signatureDocument.update({
      where: { id: documentId },
      data: {
        auditTrail: JSON.parse(JSON.stringify({ entries })),
      },
    });
  } catch (error) {
    reportError(error as Error);
    console.error("[AUDIT_TRAIL] Failed to append:", error);
  }
}

async function handleRecipientSigned(
  data: EsignWebhookPayload["data"],
  auditEntry: AuditEntry,
) {
  await prisma.$transaction(async (tx) => {
    if (data.recipientId) {
      await tx.signatureRecipient.update({
        where: { id: data.recipientId },
        data: {
          status: "SIGNED",
          signedAt: new Date(),
          ipAddress: auditEntry.ipAddress || null,
          userAgent: auditEntry.userAgent || null,
        },
      });
    }

    const allRecipients = await tx.signatureRecipient.findMany({
      where: { documentId: data.documentId },
    });

    const signersAndApprovers = allRecipients.filter(
      (r: { role: string }) =>
        r.role === "SIGNER" || r.role === "APPROVER",
    );
    const signedCount = signersAndApprovers.filter(
      (r: { status: string }) => r.status === "SIGNED",
    ).length;

    if (signedCount > 0 && signedCount < signersAndApprovers.length) {
      await tx.signatureDocument.update({
        where: { id: data.documentId },
        data: { status: "PARTIALLY_SIGNED" },
      });
    }
  });

  await appendToAuditTrail(data.documentId, {
    ...auditEntry,
    details: {
      ...auditEntry.details,
      recipientName: data.recipientName,
    },
  });
}

async function handleDocumentCompleted(
  data: EsignWebhookPayload["data"],
  auditEntry: AuditEntry,
) {
  await prisma.signatureDocument.update({
    where: { id: data.documentId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  await appendToAuditTrail(data.documentId, {
    ...auditEntry,
    details: {
      ...auditEntry.details,
      allRecipients: data.allRecipients,
    },
  });

  if (data.allRecipients && data.allRecipients.length > 0) {
    const completedAt = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const signersList = data.allRecipients
      .filter((r) => r.status === "SIGNED")
      .map((r) => `${r.name} (${r.email})`);

    for (const recipient of data.allRecipients) {
      try {
        await sendEmail({
          to: recipient.email,
          subject: `Completed: ${data.documentTitle}`,
          react: SignatureCompletedEmail({
            recipientName: recipient.name,
            documentTitle: data.documentTitle,
            teamName: data.teamName,
            completedAt,
            signersList,
          }),
        });
      } catch (err) {
        reportError(err as Error);
        console.error(
          `[ESIGN_WEBHOOK] Failed to send email to ${recipient.email}:`,
          err,
        );
      }
    }
  }
}

async function handleDocumentDeclined(
  data: EsignWebhookPayload["data"],
  auditEntry: AuditEntry,
) {
  await prisma.$transaction(async (tx) => {
    if (data.recipientId) {
      await tx.signatureRecipient.update({
        where: { id: data.recipientId },
        data: {
          status: "DECLINED",
          declinedAt: new Date(),
          ipAddress: auditEntry.ipAddress || null,
          userAgent: auditEntry.userAgent || null,
        },
      });
    }

    await tx.signatureDocument.update({
      where: { id: data.documentId },
      data: {
        status: "DECLINED",
        declinedAt: new Date(),
      },
    });
  });

  await appendToAuditTrail(data.documentId, auditEntry);
}

async function handleDocumentViewed(
  data: EsignWebhookPayload["data"],
  auditEntry: AuditEntry,
) {
  if (data.recipientId) {
    await prisma.signatureRecipient.update({
      where: { id: data.recipientId },
      data: {
        status: "VIEWED",
        viewedAt: new Date(),
      },
    });
  }

  await appendToAuditTrail(data.documentId, auditEntry);
}
