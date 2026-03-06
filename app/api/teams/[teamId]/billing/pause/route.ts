import { NextRequest, NextResponse } from "next/server";

import { PAUSE_COUPON_ID } from "@/ee/features/billing/cancellation/constants";
import { sendPauseResumeNotificationTask } from "@/ee/features/billing/cancellation/lib/trigger/pause-resume-notification";
import { automaticUnpauseTask } from "@/ee/features/billing/cancellation/lib/trigger/unpause-task";
import { stripeInstance } from "@/ee/stripe";
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

    const isOldAccount = team.plan.includes("+old");
    const stripe = stripeInstance(isOldAccount);

    const pauseStartsAt = team.endsAt ? new Date(team.endsAt) : new Date();
    const pauseEndsAt = new Date(pauseStartsAt);
    pauseEndsAt.setDate(pauseStartsAt.getDate() + 90);
    const reminderAt = new Date(pauseEndsAt);
    reminderAt.setDate(pauseEndsAt.getDate() - 3);

    await stripe.subscriptions.update(team.subscriptionId, {
      discounts: [
        {
          coupon:
            PAUSE_COUPON_ID[isOldAccount ? "old" : "new"][
              process.env.VERCEL_ENV === "production" ? "prod" : "test"
            ],
        },
      ],
      metadata: {
        pause_starts_at: pauseStartsAt.toISOString(),
        pause_ends_at: pauseEndsAt.toISOString(),
        paused_reason: "user_request",
        original_plan: team.plan,
        pause_coupon_id:
          PAUSE_COUPON_ID[isOldAccount ? "old" : "new"][
            process.env.VERCEL_ENV === "production" ? "prod" : "test"
          ],
      },
    });

    await prisma.team.update({
      where: { id: teamId },
      data: {
        pausedAt: new Date(),
        pauseStartsAt,
        pauseEndsAt,
      },
    });

    clearTierCache(teamId);

    waitUntil(
      Promise.all([
        sendPauseResumeNotificationTask.trigger(
          { teamId },
          {
            delay: { until: reminderAt },
            tags: [`team_${teamId}`],
            idempotencyKey: `pause-resume-${teamId}-${new Date().getTime()}`,
          },
        ),
        automaticUnpauseTask.trigger(
          { teamId },
          {
            delay: { until: pauseEndsAt },
            tags: [`team_${teamId}`],
            idempotencyKey: `automatic-unpause-${teamId}-${new Date().getTime()}`,
          },
        ),
        log({
          message: `Team ${teamId} (${team.plan}) paused their subscription for 3 months.`,
          type: "info",
        }),
      ]),
    );

    return NextResponse.json({
      success: true,
      message: "Subscription paused successfully",
    });
  } catch (error) {
    reportError(error as Error);
    await log({
      message: `Error pausing subscription for team ${teamId}: ${error}`,
      type: "error",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
