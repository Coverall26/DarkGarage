import { NextRequest, NextResponse } from "next/server";

import { stripeInstance } from "@/ee/stripe";
import { runs } from "@/lib/jobs";
import { waitUntil } from "@vercel/functions";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth/auth-options";
import { reportError } from "@/lib/error";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { clearTierCache } from "@/lib/tier";
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
          },
        },
      },
      select: {
        id: true,
        stripeId: true,
        subscriptionId: true,
        endsAt: true,
        plan: true,
        pauseStartsAt: true,
        pauseEndsAt: true,
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

    if (!team.pauseStartsAt || !team.pauseEndsAt) {
      return NextResponse.json(
        { error: "Subscription is not paused" },
        { status: 400 },
      );
    }

    const isOldAccount = team.plan.includes("+old");
    const stripe = stripeInstance(isOldAccount);

    const subscription = await stripe.subscriptions.retrieve(
      team.subscriptionId,
    );

    const now = new Date();
    const originalPauseStart = team.pauseStartsAt;
    const isInOriginalBillingCycle = now <= originalPauseStart;
    const isOldPauseMethod = subscription.pause_collection !== null;

    if (isOldPauseMethod) {
      await stripe.subscriptions.update(team.subscriptionId, {
        pause_collection: "",
      });
    } else {
      if (isInOriginalBillingCycle) {
        await stripe.subscriptions.deleteDiscount(team.subscriptionId);
      } else {
        await stripe.subscriptions.deleteDiscount(team.subscriptionId);
        await stripe.subscriptions.update(team.subscriptionId, {
          proration_behavior: "create_prorations",
          billing_cycle_anchor: "now",
        });
      }
    }

    await prisma.team.update({
      where: { id: teamId },
      data: {
        pausedAt: null,
        pauseStartsAt: null,
        pauseEndsAt: null,
      },
    });

    clearTierCache(teamId);

    const allRuns = await runs.list({
      taskIdentifier: [
        "send-pause-resume-notification",
        "automatic-unpause-subscription",
      ],
      tag: [`team_${teamId}`],
      status: ["DELAYED", "QUEUED"],
      period: "90d",
    });

    waitUntil(
      Promise.all([
        allRuns.data.map((run) => runs.cancel(run.id)),
        log({
          message: `Team ${teamId} (${team.plan}) manually unpaused their subscription using ${isOldPauseMethod ? "pause_collection method" : "coupon method"}${!isOldPauseMethod ? (isInOriginalBillingCycle ? " within original billing cycle" : " with billing cycle reset") : ""}.`,
          type: "info",
        }),
      ]),
    );

    return NextResponse.json({
      success: true,
      message: "Subscription unpaused successfully",
    });
  } catch (error) {
    reportError(error as Error);
    await log({
      message: `Error unpausing subscription for team ${teamId}: ${error}`,
      type: "error",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
