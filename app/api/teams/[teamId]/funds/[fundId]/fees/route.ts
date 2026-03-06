/**
 * Fund Fee Management API
 *
 * GET  /api/teams/[teamId]/funds/[fundId]/fees — Get fee settings + AUM config
 * PATCH /api/teams/[teamId]/funds/[fundId]/fees — Update fee rates + AUM frequency
 *
 * ADMIN, OWNER, and SUPER_ADMIN roles only.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateGP } from "@/lib/marketplace/auth";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { validateBody } from "@/lib/middleware/validate";
import { FundFeesUpdateSchema } from "@/lib/validations/admin";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ teamId: string; fundId: string }>;
};

const VALID_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "ANNUAL"] as const;
const VALID_WATERFALL_TYPES = ["EUROPEAN", "AMERICAN", "DEAL_BY_DEAL"] as const;

/**
 * GET /api/teams/[teamId]/funds/[fundId]/fees
 * Returns current fee rates and AUM calculation settings.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { teamId, fundId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const fund = await prisma.fund.findFirst({
      where: { id: fundId, teamId },
      select: {
        id: true,
        name: true,
        managementFeePct: true,
        carryPct: true,
        hurdleRate: true,
        orgFeePct: true,
        expenseRatioPct: true,
        waterfallType: true,
        aumCalculationFrequency: true,
        aumTarget: true,
        termYears: true,
        extensionYears: true,
        currency: true,
        createdAt: true,
      },
    });

    if (!fund) {
      return NextResponse.json({ error: "Fund not found" }, { status: 404 });
    }

    return NextResponse.json({
      fundId: fund.id,
      fundName: fund.name,
      fees: {
        managementFeePct: fund.managementFeePct
          ? parseFloat(fund.managementFeePct.toString())
          : null,
        carryPct: fund.carryPct
          ? parseFloat(fund.carryPct.toString())
          : null,
        hurdleRate: fund.hurdleRate
          ? parseFloat(fund.hurdleRate.toString())
          : null,
        orgFeePct: fund.orgFeePct
          ? parseFloat(fund.orgFeePct.toString())
          : null,
        expenseRatioPct: fund.expenseRatioPct
          ? parseFloat(fund.expenseRatioPct.toString())
          : null,
        waterfallType: fund.waterfallType,
      },
      aumSettings: {
        calculationFrequency: fund.aumCalculationFrequency,
        aumTarget: fund.aumTarget
          ? parseFloat(fund.aumTarget.toString())
          : null,
      },
      terms: {
        termYears: fund.termYears,
        extensionYears: fund.extensionYears,
        currency: fund.currency,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/teams/[teamId]/funds/[fundId]/fees
 * Update fee rates and AUM calculation frequency.
 *
 * Body (all fields optional):
 *   managementFeePct: number (e.g., 0.02 for 2%)
 *   carryPct: number (e.g., 0.20 for 20%)
 *   hurdleRate: number (e.g., 0.08 for 8%)
 *   orgFeePct: number (e.g., 0.005 for 0.5%)
 *   expenseRatioPct: number (e.g., 0.003 for 0.3%)
 *   waterfallType: "EUROPEAN" | "AMERICAN" | "DEAL_BY_DEAL"
 *   aumCalculationFrequency: "DAILY" | "WEEKLY" | "MONTHLY" | "ANNUAL"
 *   aumTarget: number
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { teamId, fundId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fund = await prisma.fund.findFirst({
      where: { id: fundId, teamId },
      select: {
        id: true,
        managementFeePct: true,
        carryPct: true,
        hurdleRate: true,
        orgFeePct: true,
        expenseRatioPct: true,
        waterfallType: true,
        aumCalculationFrequency: true,
        aumTarget: true,
      },
    });

    if (!fund) {
      return NextResponse.json({ error: "Fund not found" }, { status: 404 });
    }

    const parsed = await validateBody(req, FundFeesUpdateSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    const updates: Record<string, unknown> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (body.managementFeePct !== undefined) {
      updates.managementFeePct = body.managementFeePct;
      changes.managementFeePct = {
        from: fund.managementFeePct?.toString() ?? null,
        to: body.managementFeePct,
      };
    }

    if (body.carryPct !== undefined) {
      updates.carryPct = body.carryPct;
      changes.carryPct = {
        from: fund.carryPct?.toString() ?? null,
        to: body.carryPct,
      };
    }

    if (body.hurdleRate !== undefined) {
      updates.hurdleRate = body.hurdleRate;
      changes.hurdleRate = {
        from: fund.hurdleRate?.toString() ?? null,
        to: body.hurdleRate,
      };
    }

    if (body.waterfallType !== undefined) {
      updates.waterfallType = body.waterfallType;
      changes.waterfallType = {
        from: fund.waterfallType,
        to: body.waterfallType,
      };
    }

    if (body.aumCalculationFrequency !== undefined) {
      updates.aumCalculationFrequency = body.aumCalculationFrequency;
      changes.aumCalculationFrequency = {
        from: fund.aumCalculationFrequency,
        to: body.aumCalculationFrequency,
      };
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const updated = await prisma.fund.update({
      where: { id: fundId },
      data: updates,
    });

    // Audit log
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (user) {
      try {
        await logAuditEvent({
          eventType: "ADMIN_ACTION",
          userId: user.id,
          teamId,
          resourceType: "Fund",
          resourceId: fundId,
          metadata: {
            action: "UPDATE_FUND_FEES",
            changes,
          },
        });
      } catch (error) {
        // Audit log failures are non-blocking
      }
    }

    return NextResponse.json({
      success: true,
      fundId: updated.id,
      updated: Object.keys(updates),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
