/**
 * Funding Rounds API
 *
 * POST /api/teams/[teamId]/funds/[fundId]/funding-rounds — Create a funding round
 * GET  /api/teams/[teamId]/funds/[fundId]/funding-rounds — List all funding rounds
 *
 * ADMIN, OWNER, SUPER_ADMIN, and MANAGER roles.
 * Multi-tenant isolation: fund must belong to team.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { errorResponse } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { validateBody } from "@/lib/middleware/validate";
import { FundingRoundCreateSchema } from "@/lib/validations/fund";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ teamId: string; fundId: string }>;
};

const VALID_ROLES: Role[] = ["ADMIN", "OWNER", "SUPER_ADMIN", "MANAGER"];


async function authorizeGP(teamId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      session: null,
      orgId: null,
    };
  }

  const membership = await prisma.userTeam.findFirst({
    where: {
      userId: session.user.id,
      teamId,
      role: { in: VALID_ROLES },
    },
    include: {
      team: { select: { organizationId: true } },
    },
  });

  if (!membership) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
      orgId: null,
    };
  }

  return {
    error: null,
    session,
    orgId: membership.team.organizationId || "",
  };
}

/**
 * GET /api/teams/[teamId]/funds/[fundId]/funding-rounds
 * Returns all funding rounds for the fund, ordered by roundOrder.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const { teamId, fundId } = await params;
    const auth = await authorizeGP(teamId);
    if (auth.error) return auth.error;

    // Verify fund belongs to team
    const fund = await prisma.fund.findFirst({
      where: { id: fundId, teamId },
      select: { id: true, entityMode: true },
    });

    if (!fund) {
      return NextResponse.json({ error: "Fund not found" }, { status: 404 });
    }

    const rounds = await prisma.fundingRound.findMany({
      where: { fundId },
      orderBy: { roundOrder: "asc" },
    });

    return NextResponse.json({
      rounds: rounds.map((r) => ({
        id: r.id,
        fundId: r.fundId,
        roundName: r.roundName,
        roundOrder: r.roundOrder,
        amountRaised: r.amountRaised.toString(),
        targetAmount: r.targetAmount?.toString() || null,
        preMoneyVal: r.preMoneyVal?.toString() || null,
        postMoneyVal: r.postMoneyVal?.toString() || null,
        leadInvestor: r.leadInvestor,
        investorCount: r.investorCount,
        roundDate: r.roundDate?.toISOString() || null,
        closeDate: r.closeDate?.toISOString() || null,
        status: r.status,
        isExternal: r.isExternal,
        externalNotes: r.externalNotes,
        instrumentType: r.instrumentType,
        valuationCap: r.valuationCap?.toString() || null,
        discount: r.discount?.toString() || null,
        createdAt: r.createdAt.toISOString(),
      })),
      entityMode: fund.entityMode,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/teams/[teamId]/funds/[fundId]/funding-rounds
 * Creates a new funding round.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const { teamId, fundId } = await params;
    const auth = await authorizeGP(teamId);
    if (auth.error) return auth.error;

    // Verify fund belongs to team
    const fund = await prisma.fund.findFirst({
      where: { id: fundId, teamId },
      select: { id: true, entityMode: true },
    });

    if (!fund) {
      return NextResponse.json({ error: "Fund not found" }, { status: 404 });
    }

    const parsed = await validateBody(req, FundingRoundCreateSchema);
    if (parsed.error) return parsed.error;
    const data = parsed.data;

    // Check for duplicate round names within the same fund
    const existing = await prisma.fundingRound.findFirst({
      where: {
        fundId,
        roundName: data.roundName.trim(),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `A round named "${data.roundName.trim()}" already exists for this fund` },
        { status: 409 },
      );
    }

    // Only one ACTIVE round allowed
    if (data.status === "ACTIVE") {
      const activeRound = await prisma.fundingRound.findFirst({
        where: { fundId, status: "ACTIVE" },
      });
      if (activeRound) {
        return NextResponse.json(
          { error: `An active round already exists: "${activeRound.roundName}". Deactivate it first.` },
          { status: 409 },
        );
      }
    }

    // Auto-calculate roundOrder: next available order number
    const lastRound = await prisma.fundingRound.findFirst({
      where: { fundId },
      orderBy: { roundOrder: "desc" },
      select: { roundOrder: true },
    });
    const roundOrder = data.roundOrder
      ?? (lastRound?.roundOrder ?? 0) + 1;

    const round = await prisma.fundingRound.create({
      data: {
        fundId,
        roundName: data.roundName.trim(),
        roundOrder,
        amountRaised: data.amountRaised != null ? Number(data.amountRaised) : 0,
        targetAmount: data.targetAmount != null ? Number(data.targetAmount) : null,
        preMoneyVal: data.preMoneyVal != null ? Number(data.preMoneyVal) : null,
        postMoneyVal: data.postMoneyVal != null ? Number(data.postMoneyVal) : null,
        leadInvestor: data.leadInvestor?.trim() || null,
        investorCount: data.investorCount ?? 0,
        roundDate: data.roundDate ? new Date(data.roundDate) : null,
        closeDate: data.closeDate ? new Date(data.closeDate) : null,
        status: data.status,
        isExternal: data.isExternal === true,
        externalNotes: data.externalNotes?.trim() || null,
        instrumentType: data.instrumentType || null,
        valuationCap: data.valuationCap != null ? Number(data.valuationCap) : null,
        discount: data.discount != null ? Number(data.discount) : null,
        orgId: auth.orgId || "",
      },
    });

    // Audit log
    await logAuditEvent({
      eventType: "FUND_CREATED",
      userId: auth.session!.user!.id!,
      teamId,
      resourceType: "Fund",
      resourceId: fundId,
      metadata: {
        action: "funding_round_created",
        roundId: round.id,
        roundName: round.roundName,
        status: round.status,
        isExternal: round.isExternal,
        amountRaised: (data.amountRaised ?? 0).toString(),
      },
    }).catch((e) => reportError(e as Error));

    return NextResponse.json(
      {
        round: {
          id: round.id,
          fundId: round.fundId,
          roundName: round.roundName,
          roundOrder: round.roundOrder,
          amountRaised: round.amountRaised.toString(),
          targetAmount: round.targetAmount?.toString() || null,
          preMoneyVal: round.preMoneyVal?.toString() || null,
          postMoneyVal: round.postMoneyVal?.toString() || null,
          leadInvestor: round.leadInvestor,
          investorCount: round.investorCount,
          roundDate: round.roundDate?.toISOString() || null,
          closeDate: round.closeDate?.toISOString() || null,
          status: round.status,
          isExternal: round.isExternal,
          externalNotes: round.externalNotes,
          instrumentType: round.instrumentType,
          valuationCap: round.valuationCap?.toString() || null,
          discount: round.discount?.toString() || null,
          createdAt: round.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
