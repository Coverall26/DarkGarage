/**
 * POST /api/billing/checkout — Create a Stripe Checkout Session for CRM billing.
 *
 * Body: { plan: "CRM_PRO" | "FUNDROOM", period: "monthly" | "yearly" }
 *
 * Creates an org-scoped checkout session for the CRM subscription.
 * Reuses existing Stripe customer if org already has stripeCustomerId.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAuthAppRouter } from "@/lib/auth/rbac";
import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { errorResponse } from "@/lib/errors";
import { stripeInstance } from "@/ee/stripe";
import { getCrmPriceId } from "@/lib/stripe/crm-products";
import { appRouterStrictRateLimit } from "@/lib/security/rate-limiter";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { validateBody } from "@/lib/middleware/validate";
import { BillingCheckoutSchema } from "@/lib/validations/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Rate limit
  const blocked = await appRouterStrictRateLimit(req);
  if (blocked) return blocked;

  try {
    // Auth
    const auth = await requireAuthAppRouter();
    if (auth instanceof NextResponse) return auth;

    // Validate body
    const parsed = await validateBody(req, BillingCheckoutSchema);
    if (parsed.error) return parsed.error;
    const { plan, period } = parsed.data;

    const priceId = getCrmPriceId(plan, period);
    if (!priceId) {
      return NextResponse.json(
        { error: "Price not configured for this plan." },
        { status: 400 },
      );
    }

    // Resolve user's organization
    const user = await prisma.user.findUnique({
      where: { email: auth.email },
      select: {
        id: true,
        email: true,
        teams: {
          select: {
            team: {
              select: {
                id: true,
                organization: {
                  select: {
                    id: true,
                    stripeCustomerId: true,
                    subscriptionTier: true,
                    name: true,
                  },
                },
              },
            },
            role: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find the user's org (must be OWNER or ADMIN)
    const adminTeam = user.teams.find(
      (t) => t.role === "ADMIN" || t.role === "OWNER" || t.role === "SUPER_ADMIN",
    );

    if (!adminTeam?.team.organization) {
      return NextResponse.json(
        { error: "No organization found. Only admins can manage billing." },
        { status: 403 },
      );
    }

    const org = adminTeam.team.organization;
    const teamId = adminTeam.team.id;

    // Prevent downgrade through checkout (must use portal)
    if (org.subscriptionTier === "FUNDROOM" && plan === "CRM_PRO") {
      return NextResponse.json(
        { error: "Use the billing portal to change plans." },
        { status: 400 },
      );
    }

    const stripe = stripeInstance();
    const baseUrl = process.env.NEXTAUTH_URL || "https://app.fundroom.ai";

    let checkoutSession;

    const lineItems = [
      {
        price: priceId,
        quantity: 1,
      },
    ];

    const sessionParams: Record<string, unknown> = {
      billing_address_collection: "required",
      success_url: `${baseUrl}/admin/settings?tab=billing&success=true`,
      cancel_url: `${baseUrl}/admin/settings?tab=billing&cancel=true`,
      line_items: lineItems,
      mode: "subscription",
      allow_promotion_codes: true,
      client_reference_id: org.id, // org ID for webhook lookup
      metadata: {
        orgId: org.id,
        teamId,
        system: "crm",
        plan,
        period,
      },
      subscription_data: {
        metadata: {
          orgId: org.id,
          system: "crm",
          plan,
        },
      },
    };

    if (org.stripeCustomerId) {
      // Existing customer
      checkoutSession = await stripe.checkout.sessions.create({
        customer: org.stripeCustomerId,
        customer_update: { name: "auto" },
        ...sessionParams,
      } as Parameters<typeof stripe.checkout.sessions.create>[0]);
    } else {
      // New customer
      checkoutSession = await stripe.checkout.sessions.create({
        customer_email: user.email ?? undefined,
        ...sessionParams,
      } as Parameters<typeof stripe.checkout.sessions.create>[0]);
    }

    // Audit log
    logAuditEvent({
      eventType: "BILLING_CHECKOUT_STARTED",
      resourceType: "Organization",
      resourceId: org.id,
      userId: user.id,
      metadata: { plan, period, checkoutSessionId: checkoutSession.id },
    }).catch((e) => reportError(e as Error));

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    return errorResponse(error, "billing-checkout");
  }
}
