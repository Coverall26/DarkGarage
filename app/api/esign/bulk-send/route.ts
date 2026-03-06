/**
 * POST /api/esign/bulk-send — Bulk send a document to multiple recipients
 *
 * Creates one Envelope per recipient (not one envelope with multiple signers).
 * All envelopes share the same batchId for batch tracking.
 *
 * Flow:
 *   1. Auth + team scoping
 *   2. SIGNSUITE module access check
 *   3. E-sig monthly limit check (remaining >= recipient count)
 *   4. Deduplicate recipients by email
 *   5. Create envelopes — inline for <=10, background for >10
 *   6. Return batch info immediately
 *
 * GET /api/esign/bulk-send?batchId=xxx — Get batch status
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuthAppRouter } from "@/lib/auth/rbac";
import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { BulkSendSchema } from "@/lib/validations/esign-outreach";
import { validateBody } from "@/lib/middleware/validate";
import {
  checkModuleAccess,
  resolveOrgIdFromTeam,
} from "@/lib/middleware/module-access";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { logger } from "@/lib/logger";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST — Create bulk send batch
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const auth = await requireAuthAppRouter();
    if (auth instanceof NextResponse) return auth;

    // Module access check
    const orgId = await resolveOrgIdFromTeam(auth.teamId);
    if (!orgId) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }
    const moduleBlocked = await checkModuleAccess(orgId, "SIGNSUITE");
    if (moduleBlocked) return moduleBlocked;

    // Validate body
    const parsed = await validateBody(req, BulkSendSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    // Deduplicate recipients by email (case-insensitive)
    const seen = new Set<string>();
    const uniqueRecipients = body.recipients.filter((r) => {
      const email = r.email.toLowerCase().trim();
      if (seen.has(email)) return false;
      seen.add(email);
      return true;
    });

    if (uniqueRecipients.length === 0) {
      return NextResponse.json(
        { error: "No valid recipients after deduplication" },
        { status: 400 },
      );
    }

    // Check monthly e-sig limit — need enough remaining for all recipients
    const { getUsageSummary } = await import("@/lib/esig/usage-service");
    const usage = await getUsageSummary(auth.teamId);
    if (usage.remaining !== null && usage.remaining < uniqueRecipients.length) {
      return NextResponse.json(
        {
          error: `Monthly e-signature limit would be exceeded. You have ${usage.remaining} remaining but need ${uniqueRecipients.length}. Upgrade your plan for more.`,
          code: "ESIG_LIMIT_EXCEEDED",
          remaining: usage.remaining,
          required: uniqueRecipients.length,
        },
        { status: 403 },
      );
    }

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

    // Generate batch ID
    const batchId = crypto.randomUUID();
    const batchName = body.batchName?.trim() || `Bulk: ${body.title}`;

    // Build shared envelope config
    const sharedConfig = {
      teamId: auth.teamId,
      createdById: user.id,
      title: body.title.trim(),
      signingMode: "PARALLEL" as const, // Each envelope has single recipient
      emailSubject: body.emailSubject?.trim() || `Please sign: ${body.title.trim()}`,
      emailMessage: body.emailMessage?.trim(),
      expiresAt,
      reminderEnabled: true,
      reminderDays: 3,
      maxReminders: 3,
      sourceFile: body.sourceFile ?? undefined,
      sourceStorageType: body.sourceStorageType ?? undefined,
      sourceFileName: body.sourceFileName ?? undefined,
      sourceMimeType: body.sourceMimeType ?? undefined,
      sourceFileSize: body.sourceFileSize ? BigInt(body.sourceFileSize) : undefined,
      sourceNumPages: body.sourceNumPages ?? undefined,
      sourceModule: "SIGNSUITE" as const,
      batchId,
      batchName,
    };

    // For <=10 recipients, create inline. For >10, process in background.
    if (uniqueRecipients.length <= 10) {
      const envelopeIds = await createEnvelopesBatch(
        sharedConfig,
        uniqueRecipients,
        auth.teamId,
      );

      logAuditEvent({
        eventType: "BULK_SEND",
        userId: user.id,
        teamId: auth.teamId,
        resourceType: "Envelope",
        resourceId: batchId,
        metadata: {
          batchId,
          batchName,
          recipientCount: uniqueRecipients.length,
          envelopeCount: envelopeIds.length,
        },
      }).catch((e) => reportError(e as Error));

      logger.info("Bulk send completed (inline)", {
        module: "signsuite",
        metadata: { batchId, envelopeCount: envelopeIds.length, teamId: auth.teamId },
      });

      return NextResponse.json(
        {
          batchId,
          batchName,
          envelopeCount: envelopeIds.length,
          recipientCount: uniqueRecipients.length,
          status: "COMPLETED",
          envelopeIds,
        },
        { status: 201 },
      );
    }

    // >10 recipients: Create first batch inline, queue remainder
    // Process first 10 inline for immediate feedback
    const firstBatch = uniqueRecipients.slice(0, 10);
    const remainingRecipients = uniqueRecipients.slice(10);

    const firstEnvelopeIds = await createEnvelopesBatch(
      sharedConfig,
      firstBatch,
      auth.teamId,
    );

    // Process remaining in background (fire-and-forget)
    processRemainingInBackground(
      sharedConfig,
      remainingRecipients,
      auth.teamId,
      user.id,
      batchId,
    ).catch((e) => reportError(e as Error));

    logAuditEvent({
      eventType: "BULK_SEND",
      userId: user.id,
      teamId: auth.teamId,
      resourceType: "Envelope",
      resourceId: batchId,
      metadata: {
        batchId,
        batchName,
        recipientCount: uniqueRecipients.length,
        inlineCount: firstBatch.length,
        backgroundCount: remainingRecipients.length,
      },
    }).catch((e) => reportError(e as Error));

    logger.info("Bulk send initiated (background)", {
      module: "signsuite",
      metadata: {
        batchId,
        totalRecipients: uniqueRecipients.length,
        inlineProcessed: firstBatch.length,
        backgroundQueued: remainingRecipients.length,
        teamId: auth.teamId,
      },
    });

    return NextResponse.json(
      {
        batchId,
        batchName,
        envelopeCount: firstEnvelopeIds.length,
        recipientCount: uniqueRecipients.length,
        status: "PROCESSING",
        processedSoFar: firstBatch.length,
        remaining: remainingRecipients.length,
      },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

// ---------------------------------------------------------------------------
// GET — Batch status
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const auth = await requireAuthAppRouter();
    if (auth instanceof NextResponse) return auth;

    const batchId = req.nextUrl.searchParams.get("batchId");
    if (!batchId) {
      // List all batches for the team
      const batches = await prisma.envelope.groupBy({
        by: ["batchId", "batchName"],
        where: {
          teamId: auth.teamId,
          batchId: { not: null },
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 50,
      });

      // For each batch, get status breakdown
      const batchDetails = await Promise.all(
        batches.map(async (b) => {
          if (!b.batchId) return null;
          const statuses = await prisma.envelope.groupBy({
            by: ["status"],
            where: { batchId: b.batchId, teamId: auth.teamId },
            _count: { id: true },
          });

          const statusMap: Record<string, number> = {};
          for (const s of statuses) {
            statusMap[s.status] = s._count.id;
          }

          // Get created date from first envelope
          const first = await prisma.envelope.findFirst({
            where: { batchId: b.batchId, teamId: auth.teamId },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true, title: true },
          });

          return {
            batchId: b.batchId,
            batchName: b.batchName,
            documentTitle: first?.title ?? null,
            totalEnvelopes: b._count.id,
            createdAt: first?.createdAt ?? null,
            statuses: statusMap,
            sent: (statusMap.SENT ?? 0) + (statusMap.VIEWED ?? 0) + (statusMap.PARTIALLY_SIGNED ?? 0),
            signed: statusMap.COMPLETED ?? 0,
            pending: (statusMap.DRAFT ?? 0) + (statusMap.PREPARING ?? 0),
          };
        }),
      );

      return NextResponse.json({
        batches: batchDetails.filter(Boolean),
      });
    }

    // Single batch detail
    const envelopes = await prisma.envelope.findMany({
      where: { batchId, teamId: auth.teamId },
      include: {
        recipients: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            signedAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (envelopes.length === 0) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const statusCounts: Record<string, number> = {};
    for (const env of envelopes) {
      statusCounts[env.status] = (statusCounts[env.status] ?? 0) + 1;
    }

    return NextResponse.json({
      batchId,
      batchName: envelopes[0]?.batchName ?? null,
      documentTitle: envelopes[0]?.title ?? null,
      totalEnvelopes: envelopes.length,
      statuses: statusCounts,
      sent: (statusCounts.SENT ?? 0) + (statusCounts.VIEWED ?? 0) + (statusCounts.PARTIALLY_SIGNED ?? 0),
      signed: statusCounts.COMPLETED ?? 0,
      pending: (statusCounts.DRAFT ?? 0) + (statusCounts.PREPARING ?? 0),
      envelopes: envelopes.map((e) => ({
        id: e.id,
        status: e.status,
        recipientName: e.recipients[0]?.name ?? "",
        recipientEmail: e.recipients[0]?.email ?? "",
        recipientStatus: e.recipients[0]?.status ?? null,
        signedAt: e.recipients[0]?.signedAt ?? null,
        sentAt: e.sentAt,
        completedAt: e.completedAt,
        createdAt: e.createdAt,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SharedEnvelopeConfig {
  teamId: string;
  createdById: string;
  title: string;
  signingMode: "PARALLEL";
  emailSubject: string;
  emailMessage?: string;
  expiresAt?: Date;
  reminderEnabled: boolean;
  reminderDays: number;
  maxReminders: number;
  sourceFile?: string;
  sourceStorageType?: string;
  sourceFileName?: string;
  sourceMimeType?: string;
  sourceFileSize?: bigint;
  sourceNumPages?: number;
  sourceModule: "SIGNSUITE";
  batchId: string;
  batchName: string;
}

async function createEnvelopesBatch(
  config: SharedEnvelopeConfig,
  recipients: Array<{ name: string; email: string }>,
  teamId: string,
): Promise<string[]> {
  const envelopeIds: string[] = [];

  for (const recipient of recipients) {
    try {
      const envelope = await prisma.envelope.create({
        data: {
          teamId: config.teamId,
          createdById: config.createdById,
          title: config.title,
          signingMode: config.signingMode,
          emailSubject: config.emailSubject,
          emailMessage: config.emailMessage,
          expiresAt: config.expiresAt,
          reminderEnabled: config.reminderEnabled,
          reminderDays: config.reminderDays,
          maxReminders: config.maxReminders,
          sourceFile: config.sourceFile,
          sourceStorageType: config.sourceStorageType as import("@prisma/client").DocumentStorageType | undefined,
          sourceFileName: config.sourceFileName,
          sourceMimeType: config.sourceMimeType,
          sourceFileSize: config.sourceFileSize,
          sourceNumPages: config.sourceNumPages,
          sourceModule: config.sourceModule,
          batchId: config.batchId,
          batchName: config.batchName,
          status: "SENT",
          sentAt: new Date(),
          recipients: {
            create: {
              name: recipient.name,
              email: recipient.email.toLowerCase().trim(),
              role: "SIGNER",
              order: 1,
              status: "SENT",
              signingToken: crypto.randomBytes(32).toString("hex"),
            },
          },
        },
      });
      envelopeIds.push(envelope.id);

      // Fire-and-forget: record usage
      import("@/lib/esig/usage-service").then(async ({ recordDocumentCreated, recordDocumentSent }) => {
        await recordDocumentCreated(teamId);
        await recordDocumentSent(teamId);
      }).catch((e) => reportError(e as Error));

      // Fire-and-forget: auto-create CRM contact
      import("@/lib/crm/contact-upsert-job").then(({ captureFromSigningEvent }) => {
        captureFromSigningEvent({
          email: recipient.email.toLowerCase().trim(),
          name: recipient.name,
          teamId,
          signatureDocumentId: envelope.id,
          eventType: "DOCUMENT_SENT",
        }).catch((e) => reportError(e as Error));
      }).catch((e) => reportError(e as Error));

      // Fire-and-forget: send signing invitation email
      import("@/lib/emails/send-esign-notifications").then(({ sendSigningInvitationEmail }) => {
        // Get the first recipient from the created envelope
        prisma.envelopeRecipient
          .findFirst({ where: { envelopeId: envelope.id } })
          .then((r) => {
            if (r) sendSigningInvitationEmail(r.id, envelope.id).catch((e) => reportError(e as Error));
          })
          .catch((e) => reportError(e as Error));
      }).catch((e) => reportError(e as Error));
    } catch (error) {
      logger.error("Failed to create envelope in bulk send", {
        module: "signsuite",
        metadata: {
          email: recipient.email,
          batchId: config.batchId,
          error: (error as Error).message,
        },
      });
      reportError(error as Error);
      // Continue with next recipient
    }
  }

  return envelopeIds;
}

async function processRemainingInBackground(
  config: SharedEnvelopeConfig,
  recipients: Array<{ name: string; email: string }>,
  teamId: string,
  userId: string,
  batchId: string,
): Promise<void> {
  // Process in chunks of 10 to avoid overwhelming the database
  const CHUNK_SIZE = 10;
  for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
    const chunk = recipients.slice(i, i + CHUNK_SIZE);
    await createEnvelopesBatch(config, chunk, teamId);

    // Small delay between chunks to avoid overwhelming resources
    if (i + CHUNK_SIZE < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  logger.info("Background bulk send completed", {
    module: "signsuite",
    metadata: { batchId, processedCount: recipients.length, teamId },
  });
}
