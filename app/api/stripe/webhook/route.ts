import { NextRequest, NextResponse } from "next/server";

import { processPaymentFailure } from "@/ee/features/security";
import { stripeInstance } from "@/ee/stripe";
import { checkoutSessionCompleted } from "@/ee/stripe/webhooks/checkout-session-completed";
import { customerSubscriptionDeleted } from "@/ee/stripe/webhooks/customer-subscription-deleted";
import { customerSubsciptionUpdated } from "@/ee/stripe/webhooks/customer-subscription-updated";
import { invoiceUpcoming } from "@/ee/stripe/webhooks/invoice-upcoming";
import type Stripe from "stripe";

import { reportError } from "@/lib/error";
import { publishServerEvent } from "@/lib/tracking/server-events";
import { log } from "@/lib/utils";

export const dynamic = "force-dynamic";

const relevantEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "payment_intent.payment_failed",
  "invoice.upcoming",
]);

// Create a no-op response adapter for webhook handlers that expect NextApiResponse.
// These handlers call res.status(200).json() at various points for early returns,
// but in App Router we control the final response ourselves.
function createNoopRes() {
  const noopRes: Record<string, unknown> = {};
  noopRes.status = () => noopRes;
  noopRes.json = () => noopRes;
  noopRes.send = () => noopRes;
  noopRes.end = () => noopRes;
  noopRes.setHeader = () => noopRes;
  return noopRes;
}

export async function POST(req: NextRequest) {
  // Read raw body for Stripe signature verification
  const buf = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  try {
    if (!sig || !webhookSecret) {
      return NextResponse.json(
        { error: "Missing signature or webhook secret" },
        { status: 400 },
      );
    }
    const stripe = stripeInstance();
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err: unknown) {
    reportError(err, {
      path: "/api/stripe/webhook",
      action: "webhook_signature_verification",
    });
    return new NextResponse("Webhook signature verification failed", {
      status: 400,
    });
  }

  // Ignore unsupported events
  if (!relevantEvents.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  // Webhook handlers expect a NextApiResponse-like object for early returns
  const noopRes = createNoopRes();

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await checkoutSessionCompleted(event);
        break;
      case "customer.subscription.updated":
        await customerSubsciptionUpdated(event, noopRes as any);
        break;
      case "customer.subscription.deleted":
        await customerSubscriptionDeleted(event, noopRes as any);
        break;
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        // Fire-and-forget — no sensitive payment details, just error type + decline code
        publishServerEvent("funnel_payment_failure", {
          teamId: paymentIntent.metadata?.teamId ?? undefined,
          errorType: paymentIntent.last_payment_error?.type ?? "unknown",
          declineCode:
            paymentIntent.last_payment_error?.decline_code ?? undefined,
        });
        await processPaymentFailure(event);
        break;
      }
      case "invoice.upcoming":
        await invoiceUpcoming(event, noopRes as any);
        break;
    }
  } catch (error) {
    reportError(error, {
      path: "/api/stripe/webhook",
      action: "stripe_webhook",
      eventType: event.type,
      eventId: event.id,
    });
    await log({
      message: `Stripe webhook failed. Error: ${error}`,
      type: "error",
    });
    return new NextResponse(
      "Webhook error: Webhook handler failed. View logs.",
      { status: 400 },
    );
  }

  return NextResponse.json({ received: true });
}
