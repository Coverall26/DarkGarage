import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { reportError } from "@/lib/error";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/teams/[teamId]/funds/[fundId]/distributions/[distributionId]/execute
 *
 * Transitions an APPROVED distribution through PROCESSING → DISTRIBUTED.
 * Updates FundAggregate.totalOutbound atomically.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string; fundId: string; distributionId: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const auth = await requireAdminAppRouter();
  if (auth instanceof NextResponse) return auth;

  const { teamId, fundId, distributionId } = await params;

  if (teamId !== auth.teamId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const distribution = await prisma.distribution.findFirst({
      where: { id: distributionId, fundId, teamId },
    });

    if (!distribution) {
      return NextResponse.json({ error: "Distribution not found" }, { status: 404 });
    }

    if (distribution.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Only APPROVED distributions can be executed" },
        { status: 400 },
      );
    }

    // Atomic transaction: update distribution status + FundAggregate.totalOutbound
    const [updated] = await prisma.$transaction([
      prisma.distribution.update({
        where: { id: distributionId },
        data: { status: "DISTRIBUTED" },
      }),
      prisma.fundAggregate.upsert({
        where: { fundId },
        create: {
          fundId,
          totalOutbound: distribution.totalAmount,
          totalInbound: 0,
          totalCommitted: 0,
        },
        update: {
          totalOutbound: {
            increment: distribution.totalAmount,
          },
        },
      }),
    ]);

    await logAuditEvent({
      teamId,
      userId: auth.userId,
      eventType: "DISTRIBUTION_COMPLETED",
      resourceType: "Distribution",
      resourceId: distributionId,
      metadata: {
        fundId,
        distributionNumber: distribution.distributionNumber,
        amount: distribution.totalAmount.toString(),
        distributionType: distribution.distributionType,
      },
    }).catch((e) => reportError(e as Error));

    return NextResponse.json({
      ...updated,
      totalAmount: updated.totalAmount.toString(),
    });
  } catch (error) {
    reportError(error as Error);
    logger.error("Error executing distribution", {
      module: "distributions",
      metadata: { distributionId, error: (error as Error).message },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
