import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth/auth-options";
import { reportError } from "@/lib/error";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { validateBody } from "@/lib/middleware/validate";
import { FundSettingsUpdateSchema } from "@/lib/validations/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/funds/[fundId]/settings
 *
 * Returns fund settings including investor portal toggles, economics, wire instructions.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fundId: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const { fundId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!fundId) {
    return NextResponse.json({ error: "Fund ID required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      teams: {
        include: {
          team: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const fund = await prisma.fund.findUnique({
    where: { id: fundId },
  });

  if (!fund) {
    return NextResponse.json({ error: "Fund not found" }, { status: 404 });
  }

  const hasAccess = user.teams.some(
    (ut: { teamId: string; role: string }) => ut.teamId === fund.teamId && ["ADMIN", "OWNER", "SUPER_ADMIN"].includes(ut.role),
  );

  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    fund: {
      id: fund.id,
      name: fund.name,
      entityMode: fund.entityMode,
      ndaGateEnabled: fund.ndaGateEnabled,
      stagedCommitmentsEnabled: fund.stagedCommitmentsEnabled,
      callFrequency: fund.callFrequency,
      minimumInvestment: fund.minimumInvestment ? Number(fund.minimumInvestment) : null,
      capitalCallThresholdEnabled: fund.capitalCallThresholdEnabled,
      capitalCallThreshold: fund.capitalCallThreshold ? Number(fund.capitalCallThreshold) : null,
      managementFeePct: fund.managementFeePct ? Number(fund.managementFeePct) * 100 : null,
      carryPct: fund.carryPct ? Number(fund.carryPct) * 100 : null,
      hurdleRate: fund.hurdleRate ? Number(fund.hurdleRate) * 100 : null,
      waterfallType: fund.waterfallType,
      currency: fund.currency,
      termYears: fund.termYears,
      extensionYears: fund.extensionYears,
      highWaterMark: fund.highWaterMark,
      gpCommitmentAmount: fund.gpCommitmentAmount ? Number(fund.gpCommitmentAmount) : null,
      gpCommitmentPct: fund.gpCommitmentPct ? Number(fund.gpCommitmentPct) * 100 : null,
      investmentPeriodYears: fund.investmentPeriodYears,
      preferredReturnMethod: fund.preferredReturnMethod,
      recyclingEnabled: fund.recyclingEnabled,
      clawbackProvision: fund.clawbackProvision,
      wireInstructions: fund.wireInstructions,
      wireInstructionsUpdatedAt: fund.wireInstructionsUpdatedAt,
      featureFlags: fund.featureFlags,
      currentRaise: Number(fund.currentRaise),
      targetRaise: Number(fund.targetRaise),
      status: fund.status,
      regulationDExemption: fund.regulationDExemption,
    },
  });
}

/**
 * PATCH /api/funds/[fundId]/settings
 *
 * Update fund settings (investor portal, economics, wire instructions, LP visibility).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ fundId: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const { fundId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!fundId) {
    return NextResponse.json({ error: "Fund ID required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      teams: {
        include: {
          team: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const fund = await prisma.fund.findUnique({
    where: { id: fundId },
  });

  if (!fund) {
    return NextResponse.json({ error: "Fund not found" }, { status: 404 });
  }

  const hasAccess = user.teams.some(
    (ut: { teamId: string; role: string }) => ut.teamId === fund.teamId && ["ADMIN", "OWNER", "SUPER_ADMIN"].includes(ut.role),
  );

  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const parsed = await validateBody(req, FundSettingsUpdateSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;
    const updateData: Record<string, unknown> = {};

    // Boolean toggles
    const booleanFields = [
      "ndaGateEnabled",
      "stagedCommitmentsEnabled",
      "capitalCallThresholdEnabled",
      "highWaterMark",
      "recyclingEnabled",
      "clawbackProvision",
    ] as const;

    for (const field of booleanFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // String enum fields (already validated by Zod)
    if (body.callFrequency !== undefined) updateData.callFrequency = body.callFrequency;
    if (body.waterfallType !== undefined) updateData.waterfallType = body.waterfallType;
    if (body.currency !== undefined) updateData.currency = body.currency;
    if (body.preferredReturnMethod !== undefined) updateData.preferredReturnMethod = body.preferredReturnMethod;

    // Numeric fields (already coerced and range-checked by Zod)
    if (body.minimumInvestment !== undefined) updateData.minimumInvestment = body.minimumInvestment;
    if (body.capitalCallThreshold !== undefined) updateData.capitalCallThreshold = body.capitalCallThreshold;
    if (body.termYears !== undefined) updateData.termYears = body.termYears;
    if (body.extensionYears !== undefined) updateData.extensionYears = body.extensionYears;
    if (body.investmentPeriodYears !== undefined) updateData.investmentPeriodYears = body.investmentPeriodYears;
    if (body.gpCommitmentAmount !== undefined) updateData.gpCommitmentAmount = body.gpCommitmentAmount;

    // Percentage fields — client sends display value (e.g. 2.5), stored as decimal (0.025)
    if (body.managementFeePct != null) updateData.managementFeePct = body.managementFeePct / 100;
    if (body.carryPct != null) updateData.carryPct = body.carryPct / 100;
    if (body.hurdleRate != null) updateData.hurdleRate = body.hurdleRate / 100;
    if (body.gpCommitmentPct != null) updateData.gpCommitmentPct = body.gpCommitmentPct / 100;

    // Wire instructions (JSON)
    if (body.wireInstructions !== undefined) {
      updateData.wireInstructions = body.wireInstructions;
      updateData.wireInstructionsUpdatedAt = new Date();
      updateData.wireInstructionsUpdatedBy = user.id;
    }

    // Feature flags merge (LP visibility toggles stored in featureFlags JSON)
    if (body.featureFlags !== undefined) {
      const existing = (fund.featureFlags as Record<string, unknown>) || {};
      updateData.featureFlags = { ...existing, ...body.featureFlags };
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updatedFund = await prisma.fund.update({
      where: { id: fundId },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        eventType: "FUND_SETTINGS_UPDATE",
        userId: user.id,
        teamId: fund.teamId,
        resourceType: "FUND",
        resourceId: fundId,
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0] || "",
        userAgent: req.headers.get("user-agent") || "",
        metadata: {
          updatedFields: Object.keys(updateData),
          previousValues: Object.fromEntries(
            Object.keys(updateData).map((k) => [k, (fund as Record<string, unknown>)[k]]),
          ),
        },
      },
    }).catch((e: unknown) => reportError(e as Error));

    return NextResponse.json({
      fund: {
        id: updatedFund.id,
        name: updatedFund.name,
        entityMode: updatedFund.entityMode,
        ndaGateEnabled: updatedFund.ndaGateEnabled,
        stagedCommitmentsEnabled: updatedFund.stagedCommitmentsEnabled,
        callFrequency: updatedFund.callFrequency,
        minimumInvestment: updatedFund.minimumInvestment ? Number(updatedFund.minimumInvestment) : null,
        capitalCallThresholdEnabled: updatedFund.capitalCallThresholdEnabled,
        capitalCallThreshold: updatedFund.capitalCallThreshold ? Number(updatedFund.capitalCallThreshold) : null,
        managementFeePct: updatedFund.managementFeePct ? Number(updatedFund.managementFeePct) * 100 : null,
        carryPct: updatedFund.carryPct ? Number(updatedFund.carryPct) * 100 : null,
        hurdleRate: updatedFund.hurdleRate ? Number(updatedFund.hurdleRate) * 100 : null,
        waterfallType: updatedFund.waterfallType,
        currency: updatedFund.currency,
        termYears: updatedFund.termYears,
        extensionYears: updatedFund.extensionYears,
        highWaterMark: updatedFund.highWaterMark,
        gpCommitmentAmount: updatedFund.gpCommitmentAmount ? Number(updatedFund.gpCommitmentAmount) : null,
        gpCommitmentPct: updatedFund.gpCommitmentPct ? Number(updatedFund.gpCommitmentPct) * 100 : null,
        investmentPeriodYears: updatedFund.investmentPeriodYears,
        preferredReturnMethod: updatedFund.preferredReturnMethod,
        recyclingEnabled: updatedFund.recyclingEnabled,
        clawbackProvision: updatedFund.clawbackProvision,
        wireInstructions: updatedFund.wireInstructions,
        wireInstructionsUpdatedAt: updatedFund.wireInstructionsUpdatedAt,
        featureFlags: updatedFund.featureFlags,
        currentRaise: Number(updatedFund.currentRaise),
        targetRaise: Number(updatedFund.targetRaise),
        status: updatedFund.status,
        regulationDExemption: updatedFund.regulationDExemption,
      },
    });
  } catch (error) {
    reportError(error as Error, { action: "fund_settings_update", fundId });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
