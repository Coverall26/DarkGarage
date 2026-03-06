import { NextRequest, NextResponse } from "next/server";

import { stripeInstance } from "@/ee/stripe";
import { getCouponFromPlan } from "@/ee/stripe/functions/get-coupon-from-plan";
import { isOldAccount } from "@/ee/stripe/utils";
import { waitUntil } from "@vercel/functions";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth/auth-options";
import { reportError } from "@/lib/error";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { CustomUser } from "@/lib/types";
import { log } from "@/lib/utils";

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

  try {
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
        users: {
          some: {
            userId: userId,
            role: {
              in: ["ADMIN", "MANAGER"],
            },
          },
        },
      },
      select: {
        id: true,
        stripeId: true,
        subscriptionId: true,
        plan: true,
        pausedAt: true,
        startsAt: true,
        endsAt: true,
        limits: true,
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team does not exist" },
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

    let isAnnualPlan = false;
    if (team?.startsAt && team?.endsAt) {
      const durationInDays = Math.round(
        (team.endsAt.getTime() - team.startsAt.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      isAnnualPlan = durationInDays > 31;
    }

    const stripe = stripeInstance(isOldAccount(team.plan));
    const couponId = getCouponFromPlan(team.plan, isAnnualPlan);

    await stripe.subscriptions.update(team.subscriptionId, {
      discounts: [
        {
          coupon: couponId,
        },
      ],
    });

    waitUntil(
      log({
        message: `Retention offer applied to team ${teamId}: 30% off for ${
          isAnnualPlan ? "12 months" : "3 months"
        }`,
        type: "info",
      }),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    reportError(error as Error);
    await log({
      message: `Error applying retention offer for team ${teamId}: ${error}`,
      type: "error",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
