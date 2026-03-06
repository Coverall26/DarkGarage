/**
 * POST /api/cron/envelope-sends — Process scheduled envelope sends
 *
 * Cron job that finds SCHEDULED envelopes where scheduledSendAt <= now
 * and sends them via sendEnvelope(). Runs every 5 minutes via QStash.
 *
 * Schedule: every 5 minutes (cron: *​/5 * * * *)
 */
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { receiver, limiter } from "@/lib/cron";
import { log } from "@/lib/utils";
import { reportError } from "@/lib/error";
import { sendEnvelope } from "@/lib/esign/envelope-service";
import { sendSigningInvitationEmail } from "@/lib/emails/send-esign-notifications";
import { requireCronAuth } from "@/lib/middleware/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  // Verify QStash signature in production
  if (process.env.VERCEL === "1") {
    if (!receiver) {
      return new Response("Receiver not configured", { status: 500 });
    }
    const body = await req.text();
    try {
      const isValid = await receiver.verify({
        signature: req.headers.get("Upstash-Signature") || "",
        body,
      });
      if (!isValid) {
        return new Response("Unauthorized", { status: 401 });
      }
    } catch {
      return new Response("Unauthorized", { status: 401 });
    }
  } else {
    const cronAuth = requireCronAuth(req);
    if (cronAuth) return cronAuth;
  }

  try {
    const result = await processScheduledEnvelopes();
    return NextResponse.json(result);
  } catch (error) {
    reportError(error as Error);
    log({
      message: `Scheduled envelope sends cron failed: ${error}`,
      type: "cron",
      mention: true,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function processScheduledEnvelopes() {
  const now = new Date();

  // Find all SCHEDULED envelopes whose send time has arrived
  const envelopes = await prisma.envelope.findMany({
    where: {
      status: "SCHEDULED",
      scheduledSendAt: { lte: now },
    },
    select: {
      id: true,
      createdById: true,
      teamId: true,
      title: true,
    },
    take: 50, // Process in batches to avoid timeouts
  });

  if (envelopes.length === 0) {
    return { processed: 0, errors: 0 };
  }

  let processed = 0;
  let errors = 0;

  for (const envelope of envelopes) {
    try {
      await limiter.schedule(async () => {
        const sent = await sendEnvelope(envelope.id, envelope.createdById);

        // Fire-and-forget: Record e-sig usage
        import("@/lib/esig/usage-service")
          .then(({ recordDocumentSent }) =>
            recordDocumentSent(envelope.teamId),
          )
          .catch((e) => reportError(e as Error));

        // Fire-and-forget: Send signing invitation emails
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

        processed++;
      });
    } catch (error) {
      errors++;
      reportError(error as Error);
      log({
        message: `Failed to send scheduled envelope ${envelope.id}: ${error}`,
        type: "cron",
        mention: false,
      });
    }
  }

  log({
    message: `Scheduled envelope sends: ${processed} sent, ${errors} errors out of ${envelopes.length} total`,
    type: "cron",
    mention: errors > 0,
  });

  return { processed, errors, total: envelopes.length };
}
