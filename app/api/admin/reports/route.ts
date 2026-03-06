import { NextRequest, NextResponse } from "next/server";

import { reportError } from "@/lib/error";
import prisma from "@/lib/prisma";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports?fundId=xxx
 *
 * Returns: raise summary, pipeline stages, conversion funnel, recent activity
 */
export async function GET(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const auth = await requireAdminAppRouter();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const fundId = searchParams.get("fundId");
  if (!fundId) {
    return NextResponse.json(
      { error: "fundId is required" },
      { status: 400 },
    );
  }

  try {
    // Verify access — user must belong to the team that owns this fund
    const fund = await prisma.fund.findUnique({
      where: { id: fundId },
      select: {
        id: true,
        name: true,
        targetRaise: true,
        teamId: true,
      },
    });

    if (!fund) {
      return NextResponse.json({ error: "Fund not found" }, { status: 404 });
    }

    const userTeam = await prisma.userTeam.findFirst({
      where: {
        userId: auth.userId,
        teamId: fund.teamId,
        role: { in: ["OWNER", "ADMIN", "SUPER_ADMIN"] },
        status: "ACTIVE",
      },
    });

    if (!userTeam) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use parallel queries with aggregations instead of fetching all investors + looping
    const [
      investorCount,
      investmentAggregates,
      investorsForStages,
      onboardingStartedCount,
      ndaSignedCount,
      dataroomViewerCount,
    ] = await Promise.all([
      // Total investor count
      prisma.investor.count({ where: { fundId } }),
      // Sum commitment + funded amounts via aggregate (avoids loading all records)
      prisma.investment.aggregate({
        where: { fundId },
        _sum: { commitmentAmount: true, fundedAmount: true },
      }),
      // Fetch only the fields needed for stage distribution (no investments join)
      prisma.investor.findMany({
        where: { fundId },
        select: { fundData: true },
      }),
      // Conversion funnel counts via DB-level counting
      prisma.investor.count({ where: { fundId, onboardingStep: { gt: 0 } } }),
      prisma.investor.count({ where: { fundId, ndaSigned: true } }),
      // Dataroom viewer count via aggregate
      prisma.viewer.count({
        where: { dataroom: { teamId: fund.teamId } },
      }),
    ]);

    // Calculate stage distribution from fundData (lightweight — no investments loaded)
    const stages = {
      applied: 0,
      underReview: 0,
      approved: 0,
      committed: 0,
      funded: 0,
      rejected: 0,
    };

    for (const investor of investorsForStages) {
      const fundData = investor.fundData as Record<string, unknown> | null;
      const stage = (fundData?.stage as string) || "APPLIED";

      switch (stage) {
        case "APPLIED":
          stages.applied++;
          break;
        case "UNDER_REVIEW":
          stages.underReview++;
          break;
        case "APPROVED":
          stages.approved++;
          break;
        case "COMMITTED":
          stages.committed++;
          break;
        case "FUNDED":
          stages.funded++;
          break;
        case "REJECTED":
          stages.rejected++;
          break;
        default:
          stages.applied++;
      }
    }

    const totalCommitted = Number(investmentAggregates._sum.commitmentAmount) || 0;
    const totalFunded = Number(investmentAggregates._sum.fundedAmount) || 0;

    // Build conversion funnel
    const dataroomViews = dataroomViewerCount;
    const emailsCaptured = dataroomViews;

    const conversionFunnel = {
      dataroomViews,
      emailsCaptured,
      onboardingStarted: onboardingStartedCount,
      ndaSigned: ndaSignedCount,
      committed: stages.committed + stages.funded,
      funded: stages.funded,
    };

    const report = {
      id: fund.id,
      name: fund.name,
      targetRaise: Number(fund.targetRaise) || 0,
      totalCommitted,
      totalFunded,
      investorCount,
      stages,
      conversionFunnel,
      recentActivity: [],
    };

    return NextResponse.json({ report });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
