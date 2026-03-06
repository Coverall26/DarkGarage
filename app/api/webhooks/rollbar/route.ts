export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { reportError } from "@/lib/error";

function verifyRollbarSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
}

interface RollbarWebhookPayload {
  event_name: string;
  data: {
    item?: {
      id: number;
      counter: number;
      environment: string;
      framework: string;
      hash: string;
      level: string;
      occurrences: number;
      project_id: number;
      title: string;
      last_occurrence_timestamp: number;
      first_occurrence_timestamp: number;
      status: string;
      unique_occurrences: number;
    };
    occurrence?: {
      id: string;
      timestamp: number;
      version: number;
      body?: {
        message?: {
          body: string;
        };
        trace?: {
          exception?: {
            class: string;
            message: string;
          };
        };
      };
      environment: string;
      level: string;
      server?: {
        host: string;
      };
      request?: {
        url: string;
        method: string;
      };
    };
  };
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.ROLLBAR_WEBHOOK_SECRET;
    const signature = req.headers.get("x-rollbar-signature");

    if (webhookSecret) {
      if (!signature) {
        console.error("[ROLLBAR_WEBHOOK] Missing x-rollbar-signature header");
        return NextResponse.json(
          { error: "Missing signature" },
          { status: 401 },
        );
      }

      try {
        const isValid = verifyRollbarSignature(
          rawBody,
          signature,
          webhookSecret,
        );
        if (!isValid) {
          console.error("[ROLLBAR_WEBHOOK] Invalid signature");
          return NextResponse.json(
            { error: "Invalid signature" },
            { status: 401 },
          );
        }
      } catch (err) {
        console.error("[ROLLBAR_WEBHOOK] Signature verification error:", err);
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 },
        );
      }
    } else {
      console.warn(
        "[ROLLBAR_WEBHOOK] ROLLBAR_WEBHOOK_SECRET not configured - signature verification skipped",
      );
    }

    const _payload: RollbarWebhookPayload = JSON.parse(rawBody);

    // Handle different event types
    // Add custom handling here (e.g., Slack notification, PagerDuty, etc.)
    // Supported events: new_item, occurrence, reactivated_item, resolved_item, reopened_item, exp_repeat_item

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[ROLLBAR_WEBHOOK] Error processing webhook:", error);
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
