export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { updateInvestorKycStatus } from "@/lib/persona-hooks";
import { verifyWebhookSignature, parseWebhookEvent } from "@/lib/persona";
import { reportError } from "@/lib/error";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Verify webhook signature - REQUIRED for security
    const webhookSecret = process.env.PERSONA_WEBHOOK_SECRET;
    const signature = req.headers.get("persona-signature");

    if (!webhookSecret) {
      logger.error("[PERSONA_WEBHOOK] PERSONA_WEBHOOK_SECRET not configured", { module: "persona-webhook" });
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    if (!signature) {
      logger.error("[PERSONA_WEBHOOK] Missing persona-signature header", { module: "persona-webhook" });
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 },
      );
    }

    const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      logger.error("[PERSONA_WEBHOOK] Invalid signature", { module: "persona-webhook" });
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 },
      );
    }

    const payload = JSON.parse(rawBody);

    // Parse the webhook event
    const event = parseWebhookEvent(payload);

    // Handle different event types
    switch (event.eventName) {
      case "inquiry.completed":
      case "inquiry.approved":
      case "inquiry.declined":
      case "inquiry.expired":
      case "inquiry.failed":
      case "inquiry.transitioned":
        await updateInvestorKycStatus({
          inquiryId: event.inquiryId,
          status: event.status,
          referenceId: event.referenceId,
          data: event.data,
        });
        break;

      case "inquiry.started":
      case "inquiry.created":
        // No action needed for these events
        break;

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    reportError(error as Error);
    logger.error("[PERSONA_WEBHOOK] Error processing webhook", { module: "persona-webhook", metadata: { error: (error as Error).message } });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
