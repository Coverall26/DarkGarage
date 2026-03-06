import { NextRequest, NextResponse } from "next/server";

import getSubscriptionItem, {
  SubscriptionDiscount,
} from "@/ee/stripe/functions/get-subscription-item";
import { isOldAccount } from "@/ee/stripe/utils";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth/auth-options";
import { errorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { resolveTier } from "@/lib/tier";
import { CustomUser } from "@/lib/types";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";

export async function GET(
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
  const withDiscount = req.nextUrl.searchParams.get("withDiscount") === "true";

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
        plan: true,
        stripeId: true,
        subscriptionId: true,
        startsAt: true,
        endsAt: true,
        pauseStartsAt: true,
        cancelledAt: true,
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Resolve the team's tier via TierResolver
    const tier = await resolveTier(teamId);

    // Calculate the plan cycle either yearly or monthly based on the startsAt and endsAt dates
    let subscriptionCycle = "monthly";
    if (team?.startsAt && team?.endsAt) {
      const durationInDays = Math.round(
        (team.endsAt.getTime() - team.startsAt.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      // If duration is more than 31 days, consider it yearly
      subscriptionCycle = durationInDays > 31 ? "yearly" : "monthly";
    }

    // Fetch discount information if team has an active subscription
    let discount: SubscriptionDiscount | null = null;
    if (
      withDiscount &&
      team?.subscriptionId &&
      team.plan &&
      team.plan !== "free" &&
      team.pauseStartsAt === null
    ) {
      try {
        const subscriptionData = await getSubscriptionItem(
          team.subscriptionId,
          isOldAccount(team.plan),
        );
        discount = subscriptionData.discount;
      } catch (error) {
        // If we can't fetch discount info, just log and continue without it
        reportError(error as Error);
      }
    }

    return NextResponse.json({
      plan: tier.planSlug,
      planName: tier.planName,
      startsAt: team.startsAt,
      endsAt: team.endsAt,
      isCustomer: tier.isPaidPlan,
      subscriptionCycle,
      subscriptionStatus: tier.subscriptionStatus,
      pauseStartsAt: team.pauseStartsAt,
      cancelledAt: team.cancelledAt,
      discount,
      isTrial: tier.isTrial,
      activationStatus: tier.activationStatus,
      fundroomActive: tier.fundroomActive,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
