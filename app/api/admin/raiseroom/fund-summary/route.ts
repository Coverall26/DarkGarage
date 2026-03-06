import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/raiseroom/fund-summary
 *
 * Returns raise-focused data for the RaiseRoom dashboard:
 * - Fund raise details (target, committed, regulation D, etc.)
 * - Investor counts, NDA counts, signature status
 * - Offering page info
 * - Recent activity feed
 */
export async function GET(req: NextRequest) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const auth = await requireAdminAppRouter(undefined, {
      requireTeamId: false,
    });
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");
    const fundId = searchParams.get("fundId");

    if (!teamId) {
      return NextResponse.json(
        { error: "teamId is required" },
        { status: 400 },
      );
    }

    // Verify user is admin of this team
    const membership = await prisma.userTeam.findFirst({
      where: {
        userId: auth.userId,
        teamId,
        role: { in: ["OWNER", "ADMIN", "SUPER_ADMIN"] },
        status: "ACTIVE",
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 },
      );
    }

    // Get fund(s) for this team
    const fundWhere = fundId
      ? { id: fundId, teamId }
      : { teamId };

    const fund = await prisma.fund.findFirst({
      where: fundWhere,
      select: {
        id: true,
        name: true,
        status: true,
        entityMode: true,
        targetRaise: true,
        minimumInvestment: true,
        regulationDExemption: true,
        closingDate: true,
      },
    });

    if (!fund) {
      return NextResponse.json(
        { error: "No fund found" },
        { status: 404 },
      );
    }

    // Parallel queries for raise-focused data
    const [
      aggregate,
      investorCount,
      ndaCount,
      signingPending,
      signingComplete,
      offeringPage,
      recentViews,
      recentInvestments,
    ] = await Promise.all([
      // Fund aggregate totals
      prisma.fundAggregate.findFirst({
        where: { fundId: fund.id },
        select: { totalCommitted: true, totalInbound: true },
      }),

      // Investor count for this fund
      prisma.investor.count({
        where: { fundId: fund.id },
      }),

      // NDA signed count
      prisma.investor.count({
        where: { fundId: fund.id, ndaSigned: true },
      }),

      // Pending e-signatures (envelopes in SENT/VIEWED/PARTIALLY_SIGNED)
      prisma.envelope.count({
        where: {
          teamId,
          status: { in: ["SENT", "VIEWED", "PARTIALLY_SIGNED"] },
        },
      }),

      // Completed e-signatures
      prisma.envelope.count({
        where: {
          teamId,
          status: "COMPLETED",
        },
      }),

      // Offering page info (check if a link exists for this fund)
      prisma.link.findFirst({
        where: {
          document: { teamId },
          slug: { not: null },
        },
        select: { slug: true, emailProtected: true },
        orderBy: { createdAt: "desc" },
      }),

      // Recent dataroom/document views (last 30 days, up to 20)
      prisma.view.findMany({
        where: {
          OR: [
            { dataroom: { teamId } },
            { link: { document: { teamId } } },
          ],
          viewedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: {
          id: true,
          viewerEmail: true,
          viewedAt: true,
        },
        orderBy: { viewedAt: "desc" },
        take: 10,
      }),

      // Recent investments
      prisma.investment.findMany({
        where: {
          fund: { teamId },
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: {
          id: true,
          status: true,
          commitmentAmount: true,
          createdAt: true,
          investor: {
            select: {
              user: { select: { name: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    // Build activity feed from recent views and investments
    const activity: Array<{
      id: string;
      type: string;
      description: string;
      timestamp: string;
    }> = [];

    for (const view of recentViews) {
      activity.push({
        id: view.id,
        type: "VIEW",
        description: `${view.viewerEmail || "Anonymous"} viewed a document`,
        timestamp: view.viewedAt.toISOString(),
      });
    }

    for (const inv of recentInvestments) {
      const name =
        inv.investor?.user?.name || inv.investor?.user?.email || "Unknown";
      const amount = Number(inv.commitmentAmount) || 0;
      activity.push({
        id: inv.id,
        type:
          inv.status === "FUNDED"
            ? "FUNDED"
            : inv.status === "COMMITTED"
              ? "COMMITMENT"
              : "INVESTOR",
        description:
          inv.status === "FUNDED"
            ? `${name} wire confirmed ($${amount.toLocaleString()})`
            : inv.status === "COMMITTED"
              ? `${name} committed $${amount.toLocaleString()}`
              : `${name} started onboarding`,
        timestamp: inv.createdAt.toISOString(),
      });
    }

    // Sort activity by timestamp descending
    activity.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    // Offering page view count (past 30 days)
    const offeringViews = recentViews.length;

    // Build response matching the FundRaiseData + RaiseStats interfaces
    const totalCommitted = Number(aggregate?.totalCommitted) || 0;
    const totalTarget = Number(fund.targetRaise) || 0;

    return NextResponse.json({
      fund: {
        id: fund.id,
        name: fund.name,
        status: fund.status,
        entityMode: fund.entityMode || "FUND",
        targetRaise: fund.targetRaise?.toString() ?? null,
        minimumInvestment: fund.minimumInvestment?.toString() ?? null,
        regulationDExemption: fund.regulationDExemption ?? null,
        closingDate: fund.closingDate?.toISOString() ?? null,
        aggregate: aggregate
          ? {
              totalCommitted: aggregate.totalCommitted?.toString() ?? null,
              totalInbound: aggregate.totalInbound?.toString() ?? null,
            }
          : null,
        investorCount,
        ndaCount,
        signingPending,
        signingComplete,
        offeringSlug: offeringPage?.slug ?? null,
        offeringPublic: !!offeringPage,
      },
      stats: {
        totalRaised: totalCommitted,
        totalTarget,
        investorCount,
        pendingSignatures: signingPending,
        completedSignatures: signingComplete,
        ndaSigned: ndaCount,
        offeringViews,
        recentActivity: activity.slice(0, 20),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
