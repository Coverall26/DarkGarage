import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { reportError } from "@/lib/error";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Investor Updates Webhook (App Router)
 *
 * POST /api/lp/webhooks/investor-updates
 *
 * INTENTIONALLY_PUBLIC: Webhook endpoint — uses HMAC-SHA256 signature verification
 * instead of session auth. Session auth is inappropriate for webhooks because
 * the caller is an external/internal system, not a browser with cookies.
 *
 * Handles investor update events from internal or external systems.
 * Verifies HMAC-SHA256 webhook signature or allowed IP source.
 * Processes: capital calls, distributions, documents, KYC, transactions, fund thresholds.
 */

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

const ALLOWED_IPS = new Set(
  (process.env.WEBHOOK_ALLOWED_IPS || "127.0.0.1,::1,localhost")
    .split(",")
    .map((s) => s.trim()),
);

interface WebhookPayload {
  event: string;
  investorId: string;
  fundId?: string;
  data: Record<string, any>;
  timestamp: string;
}

function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
): boolean {
  if (!signature || !WEBHOOK_SECRET) return false;

  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex"),
    );
  } catch (error) {
    return false;
  }
}

function isAllowedSource(req: NextRequest): boolean {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "";

  return ALLOWED_IPS.has(clientIp);
}

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-webhook-signature") || undefined;

    // Read raw body for signature verification
    const rawBodyArrayBuffer = await req.arrayBuffer();
    const rawBody = Buffer.from(rawBodyArrayBuffer);
    const parsedBody: WebhookPayload = JSON.parse(rawBody.toString());

    if (WEBHOOK_SECRET) {
      if (!verifyWebhookSignature(rawBody, signature)) {
        reportError(new Error("Webhook signature verification failed: investor-updates"));
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 },
        );
      }
    } else if (!isAllowedSource(req)) {
      reportError(new Error("Webhook from unauthorized source without signature: investor-updates"));
      return NextResponse.json(
        { error: "Unauthorized source" },
        { status: 401 },
      );
    }

    const { event, investorId, fundId, data, timestamp } = parsedBody;

    if (!event || !investorId) {
      return NextResponse.json(
        { error: "Missing required fields: event, investorId" },
        { status: 400 },
      );
    }

    const investor = await prisma.investor.findUnique({
      where: { id: investorId },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!investor) {
      return NextResponse.json(
        { error: "Investor not found" },
        { status: 404 },
      );
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    const auditEntry = {
      event,
      timestamp: timestamp || new Date().toISOString(),
      fundId,
      data,
      ip: ipAddress,
    };

    switch (event) {
      case "capital_call.created":
      case "capital_call.updated":
      case "capital_call.reminder":
        await handleCapitalCallEvent(investorId, fundId, data);
        break;

      case "distribution.created":
      case "distribution.completed":
        await handleDistributionEvent(investorId, fundId, data, auditEntry);
        break;

      case "document.ready":
      case "document.signed":
        await handleDocumentEvent(investorId, data);
        break;

      case "kyc.status_changed":
        await handleKycEvent(investorId, data);
        break;

      case "transaction.status_changed":
        await handleTransactionEvent(data);
        break;

      case "fund.threshold_met":
        await handleThresholdEvent(investorId, fundId, data, auditEntry);
        break;

      default:
        break;
    }

    return NextResponse.json({
      success: true,
      event,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

async function handleCapitalCallEvent(
  investorId: string,
  fundId: string | undefined,
  data: Record<string, any>,
) {
  if (data.capitalCallId) {
    await prisma.capitalCallResponse.updateMany({
      where: {
        investorId,
        capitalCallId: data.capitalCallId,
      },
      data: {
        status: data.status || "PENDING",
        updatedAt: new Date(),
      },
    });
  }
}

async function handleDistributionEvent(
  investorId: string,
  fundId: string | undefined,
  data: Record<string, any>,
  auditEntry: Record<string, any>,
) {
  if (data.distributionId && data.amount) {
    // Resolve teamId from fund for multi-tenant defense-in-depth
    let teamId: string | undefined;
    if (fundId) {
      const fund = await prisma.fund.findUnique({
        where: { id: fundId },
        select: { teamId: true },
      });
      teamId = fund?.teamId || undefined;
    }

    await prisma.transaction.create({
      data: {
        investorId,
        type: "DISTRIBUTION",
        amount: data.amount,
        distributionId: data.distributionId,
        fundId,
        teamId,
        status: data.status || "PENDING",
        description:
          data.description ||
          `Distribution #${data.distributionNumber || ""}`,
        auditTrail: [auditEntry],
      },
    });
  }
}

async function handleDocumentEvent(
  investorId: string,
  data: Record<string, any>,
) {
  const { documentId, status, documentType } = data;
  if (!documentId) return;

  // Handle signature document events (document.ready / document.signed)
  if (documentType === "signature" && status) {
    await prisma.signatureRecipient.updateMany({
      where: {
        documentId,
        email: {
          in: await prisma.investor
            .findUnique({
              where: { id: investorId },
              select: { user: { select: { email: true } } },
            })
            .then((inv) => (inv?.user?.email ? [inv.user.email] : [])),
        },
      },
      data: {
        status:
          status === "SIGNED" ? ("SIGNED" as const) : ("PENDING" as const),
        ...(status === "SIGNED" ? { signedAt: new Date() } : {}),
      },
    });
  }

  // Handle LP document events (document.ready for review-complete docs)
  if (documentType === "lp_document" && status) {
    await prisma.lPDocument.updateMany({
      where: { id: documentId, investorId },
      data: { status },
    });
  }
}

async function handleKycEvent(
  investorId: string,
  data: Record<string, any>,
) {
  if (data.status) {
    await prisma.$executeRaw`
      UPDATE "Investor"
      SET "personaStatus" = ${data.status},
          "personaVerifiedAt" = ${data.status === "APPROVED" ? new Date() : null}
      WHERE id = ${investorId}
    `;
  }
}

async function handleTransactionEvent(data: Record<string, any>) {
  if (data.transactionId && data.status) {
    await prisma.transaction.update({
      where: { id: data.transactionId },
      data: {
        status: data.status,
        statusMessage: data.statusMessage,
        processedAt:
          data.status === "PROCESSING" ? new Date() : undefined,
        completedAt:
          data.status === "COMPLETED" ? new Date() : undefined,
        failedAt: data.status === "FAILED" ? new Date() : undefined,
      },
    });
  }
}

async function handleThresholdEvent(
  investorId: string,
  fundId: string | undefined,
  data: Record<string, any>,
  auditEntry: Record<string, any>,
) {
  if (!fundId) return;

  const { thresholdType, thresholdValue, currentValue } = data;

  await prisma.auditLog.create({
    data: {
      eventType: "FUND_THRESHOLD_MET",
      userId: investorId,
      resourceType: "FUND",
      resourceId: fundId,
      metadata: {
        thresholdType: thresholdType || "MINIMUM_RAISE",
        thresholdValue,
        currentValue,
        investorId,
        ...auditEntry,
      },
    },
  });

  if (
    thresholdType === "MINIMUM_RAISE" ||
    thresholdType === "TARGET_RAISE"
  ) {
    const openClose = await prisma.fundClose.findFirst({
      where: { fundId, status: "OPEN" },
      orderBy: { closeNumber: "asc" },
    });

    if (openClose) {
      await prisma.fundClose.update({
        where: { id: openClose.id },
        data: {
          notes: `${thresholdType} threshold met: ${currentValue}/${thresholdValue}`,
        },
      });
    }
  }
}
