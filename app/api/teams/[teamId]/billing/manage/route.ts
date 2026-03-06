import { NextRequest, NextResponse } from "next/server";

import { stripeInstance } from "@/ee/stripe";
import { getQuantityFromPriceId } from "@/ee/stripe/functions/get-quantity-from-plan";
import getSubscriptionItem from "@/ee/stripe/functions/get-subscription-item";
import { isOldAccount } from "@/ee/stripe/utils";
import { waitUntil } from "@vercel/functions";
import { getServerSession } from "next-auth";

import { identifyUser, trackAnalytics } from "@/lib/analytics";
import { authOptions } from "@/lib/auth/auth-options";
import { errorResponse } from "@/lib/errors";
import { validateBody } from "@/lib/middleware/validate";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { CustomUser } from "@/lib/types";
import { BillingManageSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId } = await params;
  const userId = (session.user as CustomUser).id;
  const userEmail = (session.user as CustomUser).email;

  const { data: body, error: validationError } = await validateBody(req, BillingManageSchema);
  if (validationError) return validationError;

  const {
    priceId,
    upgradePlan,
    quantity,
    addSeat,
    proAnnualBanner,
    return_url,
    type,
  } = body;

  try {
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
        users: {
          some: {
            userId: userId,
          },
        },
      },
      select: {
        stripeId: true,
        subscriptionId: true,
        plan: true,
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team does not exists" },
        { status: 400 },
      );
    }
    if (!team.stripeId) {
      return NextResponse.json(
        { error: "No Stripe customer ID" },
        { status: 400 },
      );
    }

    if (!team.subscriptionId) {
      return NextResponse.json(
        { error: "No subscription ID" },
        { status: 400 },
      );
    }

    const {
      id: subscriptionItemId,
    } = await getSubscriptionItem(
      team.subscriptionId,
      isOldAccount(team.plan),
    );

    const minQuantity = getQuantityFromPriceId(priceId);

    const stripe = stripeInstance(isOldAccount(team.plan));
    const { url } = await stripe.billingPortal.sessions.create({
      customer: team.stripeId,
      return_url: `${process.env.NEXTAUTH_URL}/settings/billing?cancel=true`,
      ...(type === "manage" &&
        (upgradePlan || addSeat) &&
        subscriptionItemId && {
          flow_data: {
            type: "subscription_update_confirm",
            subscription_update_confirm: {
              subscription: team.subscriptionId,
              items: [
                {
                  id: subscriptionItemId,
                  quantity: isOldAccount(team.plan)
                    ? 1
                    : (quantity ?? minQuantity),
                  price: priceId,
                },
              ],
            },
            after_completion: {
              type: "redirect",
              redirect: {
                return_url:
                  return_url ??
                  `${process.env.NEXTAUTH_URL}/settings/billing?success=true`,
              },
            },
          },
        }),
      ...(type === "subscription_update" && {
        flow_data: {
          type: "subscription_update",
          subscription_update: {
            subscription: team.subscriptionId,
          },
        },
      }),
    });

    waitUntil(Promise.resolve(identifyUser(userEmail ?? userId)));
    waitUntil(
      Promise.resolve(
        trackAnalytics({
          event: "Stripe Billing Portal Clicked",
          teamId,
          action: proAnnualBanner ? "pro-annual-banner" : undefined,
        }),
      ),
    );

    return NextResponse.json(url);
  } catch (error) {
    return errorResponse(error);
  }
}
