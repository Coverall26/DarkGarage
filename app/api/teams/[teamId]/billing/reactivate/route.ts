import { NextRequest, NextResponse } from "next/server";

import { stripeInstance } from "@/ee/stripe";
import { isOldAccount } from "@/ee/stripe/utils";
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

    const stripe = stripeInstance(isOldAccount(team.plan));

    await stripe.subscriptions.update(team.subscriptionId, {
      cancel_at_period_end: false,
    });

    await prisma.team.update({
      where: { id: teamId },
      data: {
        cancelledAt: null,
        pauseStartsAt: null,
      },
    });

    clearTierCache(teamId);

    waitUntil(
      log({
        message: `Team ${teamId} reactivated their subscription.`,
        type: "info",
      }),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    reportError(error as Error);
    await log({
      message: `Error reactivating subscription for team ${teamId}: ${error}`,
      type: "error",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
