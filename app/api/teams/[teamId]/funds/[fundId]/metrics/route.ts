import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { reportError } from "@/lib/error";
import { logger } from "@/lib/logger";
import { calculateAum, getAumHistory } from "@/lib/funds/aum-calculator";

export const dynamic = "force-dynamic";

/**
 * GET /api/teams/[teamId]/funds/[fundId]/metrics
 *
 * Returns fund performance metrics: AUM, NAV, IRR, TVPI, DPI, RVPI, MOIC.
 * Query params:
 *   - period: "DAILY" | "WEEKLY" | "MONTHLY" | "ANNUAL" (for history)
 *   - historyLimit: number of historical snapshots to return (default 12)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string; fundId: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const auth = await requireAdminAppRouter();
  if (auth instanceof NextResponse) return auth;

  const { teamId, fundId } = await params;

  if (teamId !== auth.teamId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const fund = await prisma.fund.findFirst({
      where: { id: fundId, teamId },
      select: {
        id: true,
        name: true,
        targetRaise: true,
        managementFeePct: true,
        carryPct: true,
        hurdleRate: true,
        waterfallType: true,
        termYears: true,
        createdAt: true,
      },
    });

    if (!fund) {
      return NextResponse.json({ error: "Fund not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "MONTHLY";
    const historyLimit = Math.min(
      parseInt(searchParams.get("historyLimit") || "12", 10),
      365,
    );

    // Calculate current AUM metrics
    const aum = await calculateAum(fundId);

    // Compute performance ratios
    const totalFunded = aum?.totalFunded || 0;
    const totalDistributed = aum?.totalDistributed || 0;
    const nav = aum?.nav || 0;

    // TVPI = (Distributions + NAV) / Capital Called
    const tvpi = totalFunded > 0 ? (totalDistributed + nav) / totalFunded : 0;

    // DPI = Distributions / Capital Called
    const dpi = totalFunded > 0 ? totalDistributed / totalFunded : 0;

    // RVPI = NAV / Capital Called
    const rvpi = totalFunded > 0 ? nav / totalFunded : 0;

    // MOIC = same as TVPI for fund-level
    const moic = tvpi;

    // IRR approximation using simplified Newton's method on cash flows
    const irr = await calculateIRR(fundId);

    // Get historical snapshots
    const history = await getAumHistory(fundId, {
      period: period as "DAILY" | "WEEKLY" | "MONTHLY" | "ANNUAL",
      limit: historyLimit,
    });

    // Format historical data for charts
    const historyFormatted = history.map((s) => ({
      date: s.date.toISOString(),
      grossAum: s.grossAum.toString(),
      netAum: s.netAum.toString(),
      nav: s.nav.toString(),
      totalCommitted: s.totalCommitted.toString(),
      totalFunded: s.totalFunded.toString(),
      totalDistributed: s.totalDistributed.toString(),
      investorCount: s.investorCount,
    }));

    return NextResponse.json({
      fund: {
        id: fund.id,
        name: fund.name,
        targetRaise: fund.targetRaise?.toString() || "0",
        waterfallType: fund.waterfallType,
        termYears: fund.termYears,
      },
      current: {
        grossAum: aum?.grossAum.toString() || "0",
        netAum: aum?.netAum.toString() || "0",
        nav: nav.toString(),
        totalCommitted: aum?.totalCommitted.toString() || "0",
        totalFunded: totalFunded.toString(),
        totalDistributed: totalDistributed.toString(),
        investorCount: aum?.investorCount || 0,
        fundAgeYears: round4(aum?.fundAgeYears || 0),
      },
      performance: {
        irr: round4(irr),
        tvpi: round4(tvpi),
        dpi: round4(dpi),
        rvpi: round4(rvpi),
        moic: round4(moic),
      },
      deductions: aum?.deductions || {
        managementFees: 0,
        performanceFees: 0,
        orgFees: 0,
        expenses: 0,
        total: 0,
      },
      rates: aum?.rates || {
        managementFeePct: 0,
        carryPct: 0,
        orgFeePct: 0,
        expenseRatioPct: 0,
      },
      ratios: aum?.ratios || {
        fundedRatio: 0,
        distributedRatio: 0,
        expenseRatio: 0,
      },
      history: historyFormatted,
    });
  } catch (error) {
    reportError(error as Error);
    logger.error("Error calculating fund metrics", {
      module: "metrics",
      metadata: { fundId, error: (error as Error).message },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Simplified IRR calculation using Newton's method on fund cash flows.
 * Returns annualized rate as a decimal (e.g. 0.15 = 15%).
 */
async function calculateIRR(fundId: string): Promise<number> {
  try {
    // Get all cash flows: capital calls (negative), distributions (positive)
    const [investments, distributions] = await Promise.all([
      prisma.investment.findMany({
        where: {
          fundId,
          status: { in: ["FUNDED", "PARTIALLY_FUNDED", "DOCS_APPROVED", "COMMITTED"] },
        },
        select: { fundedAmount: true, subscriptionDate: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.distribution.findMany({
        where: { fundId, status: { in: ["DISTRIBUTED", "COMPLETED"] } },
        select: { totalAmount: true, distributionDate: true },
        orderBy: { distributionDate: "asc" },
      }),
    ]);

    if (investments.length === 0) return 0;

    interface CashFlow {
      amount: number;
      date: Date;
    }

    const cashFlows: CashFlow[] = [];

    // Capital contributions are negative cash flows
    for (const inv of investments) {
      const amount = parseFloat(inv.fundedAmount.toString());
      if (amount > 0) {
        cashFlows.push({
          amount: -amount,
          date: inv.subscriptionDate || inv.createdAt,
        });
      }
    }

    // Distributions are positive cash flows
    for (const dist of distributions) {
      cashFlows.push({
        amount: parseFloat(dist.totalAmount.toString()),
        date: dist.distributionDate,
      });
    }

    if (cashFlows.length < 2) return 0;

    // Sort by date
    cashFlows.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Newton's method to find IRR
    const firstDate = cashFlows[0].date;
    const yearsFromStart = (d: Date) =>
      (d.getTime() - firstDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

    let rate = 0.10; // Initial guess: 10%

    for (let iteration = 0; iteration < 100; iteration++) {
      let npv = 0;
      let dnpv = 0; // derivative of NPV w.r.t. rate

      for (const cf of cashFlows) {
        const t = yearsFromStart(cf.date);
        const discountFactor = Math.pow(1 + rate, -t);
        npv += cf.amount * discountFactor;
        if (t > 0) {
          dnpv -= t * cf.amount * Math.pow(1 + rate, -t - 1);
        }
      }

      if (Math.abs(npv) < 0.01) break; // Converged
      if (Math.abs(dnpv) < 1e-10) break; // Avoid division by zero

      const newRate = rate - npv / dnpv;

      // Clamp to reasonable range
      if (newRate < -0.99) rate = -0.5;
      else if (newRate > 10) rate = 5;
      else rate = newRate;
    }

    // Final sanity check
    if (isNaN(rate) || !isFinite(rate) || rate < -1 || rate > 10) {
      return 0;
    }

    return rate;
  } catch {
    return 0;
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
