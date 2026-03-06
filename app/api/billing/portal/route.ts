/**
 * POST /api/billing/portal — Create a Stripe Billing Portal session for CRM billing.
 *
 * Redirects the user to Stripe's hosted billing portal to manage
 * their CRM subscription (update plan, payment method, invoices).
 *
 * Body: { returnUrl?: string }
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAuthAppRouter } from "@/lib/auth/rbac";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { stripeInstance } from "@/ee/stripe";
import { appRouterStrictRateLimit } from "@/lib/security/rate-limiter";
import { validateBody } from "@/lib/middleware/validate";
import { BillingPortalSchema } from "@/lib/validations/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = await appRouterStrictRateLimit(req);
  if (blocked) return blocked;

  try {
    const auth = await requireAuthAppRouter();
    if (auth instanceof NextResponse) return auth;

    const parsed = await validateBody(req, BillingPortalSchema);
    if (parsed.error) return parsed.error;
    const { returnUrl } = parsed.data;

    // Resolve user's org
    const user = await prisma.user.findUnique({
      where: { email: auth.email },
      select: {
        id: true,
        teams: {
          select: {
            team: {
              select: {
                organization: {
                  select: {
                    id: true,
                    stripeCustomerId: true,
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

    const adminTeam = user.teams.find(
      (t) => t.role === "ADMIN" || t.role === "OWNER" || t.role === "SUPER_ADMIN",
    );

    if (!adminTeam?.team.organization) {
      return NextResponse.json(
        { error: "No organization found. Only admins can access billing." },
        { status: 403 },
      );
    }

    const org = adminTeam.team.organization;

    if (!org.stripeCustomerId) {
      return NextResponse.json(
        { error: "No active billing account. Subscribe to a plan first." },
        { status: 400 },
      );
    }

    const stripe = stripeInstance();
    const baseUrl = process.env.NEXTAUTH_URL || "https://app.fundroom.ai";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: returnUrl || `${baseUrl}/admin/settings?tab=billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    return errorResponse(error);
  }
}
