import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuthAppRouter } from "@/lib/auth/rbac";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { validateBody } from "@/lib/middleware/validate";
import { FundCreateSchema } from "@/lib/validations/admin";
import { appRouterStrictRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const blocked = await appRouterStrictRateLimit(req);
  if (blocked) return blocked;

  const auth = await requireAuthAppRouter();
  if (auth instanceof NextResponse) return auth;

  try {
    const parsed = await validateBody(req, FundCreateSchema);
    if (parsed.error) return parsed.error;
    const {
      name,
      teamId,
      description,
      entityMode,
      style,
      fundSubType,
      targetRaise,
      minimumInvestment,
      aumTarget,
      currency,
      managementFeePct,
      carryPct,
      hurdleRate,
      gpCommitmentAmount,
      gpCommitmentPct,
      mgmtFeeOffsetPct,
      waterfallType,
      preferredReturnMethod,
      termYears,
      extensionYears,
      investmentPeriodYears,
      callFrequency,
      highWaterMark,
      recyclingEnabled,
      keyPersonEnabled,
      keyPersonName,
      clawbackProvision,
      stagedCommitmentsEnabled,
      thresholdEnabled,
      thresholdAmount,
      noFaultDivorceThreshold,
      marketplaceInterest,
      marketplaceDescription,
      marketplaceCategory,
      featureFlags,
      wireInstructions,
      useOfProceeds,
      salesCommissions,
      fundStrategy,
      instrumentType,
      regulationDExemption,
      investmentCompanyExemption,
    } = parsed.data;

    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        users: {
          some: {
            userId: auth.userId,
            role: { in: ["ADMIN", "OWNER", "SUPER_ADMIN"] },
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team not found or insufficient permissions" },
        { status: 403 }
      );
    }

    const resolvedEntityMode = entityMode || "FUND";
    const parsedTargetRaise = targetRaise ?? 0;
    const parsedMinimumInvestment = minimumInvestment ?? 0;

    const fund = await prisma.fund.create({
      data: {
        teamId,
        name,
        description: description || null,
        entityMode: resolvedEntityMode,
        style: style || null,
        fundSubType: fundSubType || null,
        fundStrategy: fundStrategy || null,
        instrumentType: instrumentType || null,
        targetRaise: parsedTargetRaise,
        minimumInvestment: parsedMinimumInvestment,
        currency: currency || "USD",
        aumTarget: aumTarget ?? null,
        callFrequency: callFrequency || "AS_NEEDED",
        capitalCallThresholdEnabled: thresholdEnabled || false,
        capitalCallThreshold: thresholdAmount ?? null,
        stagedCommitmentsEnabled: stagedCommitmentsEnabled || false,
        // Fund Economics (store percentages as decimals: 2.5% → 0.0250)
        managementFeePct: managementFeePct != null ? managementFeePct / 100 : null,
        carryPct: carryPct != null ? carryPct / 100 : null,
        hurdleRate: hurdleRate != null ? hurdleRate / 100 : null,
        waterfallType: waterfallType || null,
        termYears: termYears ?? null,
        extensionYears: extensionYears ?? null,
        highWaterMark: highWaterMark ?? false,
        gpCommitmentAmount: gpCommitmentAmount ?? null,
        gpCommitmentPct: gpCommitmentPct != null ? gpCommitmentPct / 100 : null,
        recyclingEnabled: recyclingEnabled ?? false,
        keyPersonEnabled: keyPersonEnabled ?? false,
        keyPersonName: keyPersonEnabled ? (keyPersonName || null) : null,
        noFaultDivorceThreshold: noFaultDivorceThreshold ?? null,
        investmentPeriodYears: investmentPeriodYears ?? null,
        preferredReturnMethod: preferredReturnMethod || "COMPOUNDED",
        clawbackProvision: clawbackProvision ?? true,
        mgmtFeeOffsetPct: mgmtFeeOffsetPct ?? null,
        regulationDExemption: regulationDExemption || null,
        investmentCompanyExemption: investmentCompanyExemption || null,
        marketplaceInterest: marketplaceInterest ?? false,
        marketplaceDescription: marketplaceDescription || null,
        marketplaceCategory: marketplaceCategory || null,
        marketplaceInterestDate: marketplaceInterest ? new Date() : null,
        wireInstructions: (wireInstructions as Prisma.InputJsonValue) || Prisma.JsonNull,
        useOfProceeds: useOfProceeds || null,
        salesCommissions: salesCommissions != null ? String(salesCommissions) : null,
        createdBy: auth.userId,
        audit: [
          {
            timestamp: new Date().toISOString(),
            userId: auth.userId,
            action: "FUND_CREATED",
            details: {
              name,
              fundSubType,
              targetRaise,
              minimumInvestment,
              managementFeePct,
              carryPct,
              hurdleRate,
              waterfallType,
              termYears,
              highWaterMark,
            },
          },
        ],
      },
    });

    await prisma.fundAggregate.create({
      data: {
        fundId: fund.id,
        totalInbound: 0,
        totalOutbound: 0,
        totalCommitted: 0,
        thresholdEnabled: thresholdEnabled || false,
        thresholdAmount: thresholdAmount ?? null,
        audit: [
          {
            timestamp: new Date().toISOString(),
            action: "AGGREGATE_CREATED",
            fundId: fund.id,
          },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      fund: { id: fund.id, name: fund.name }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
