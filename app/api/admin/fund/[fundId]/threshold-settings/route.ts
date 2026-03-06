import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth/auth-options";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { reportError } from "@/lib/error";

export const dynamic = "force-dynamic";

/**
 * Shared auth check for threshold-settings endpoints.
 * Verifies session, fund existence (with aggregate), and admin team membership.
 */
async function verifyAccess(fundId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { teams: true },
  });

  if (!user) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const fund = await prisma.fund.findUnique({
    where: { id: fundId },
    include: { aggregate: true, team: true },
  });

  if (!fund) {
    return { error: NextResponse.json({ error: "Fund not found" }, { status: 404 }) };
  }

  const teamMembership = user.teams.find((t) => t.teamId === fund.teamId);
  if (!teamMembership || !["ADMIN", "OWNER", "SUPER_ADMIN"].includes(teamMembership.role)) {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }

  return { fund, user };
}

/**
 * GET /api/admin/fund/[fundId]/threshold-settings
 * Returns threshold, aggregate, and economics data for a fund.
 * Flat JSON response for backward compatibility with settings/fund page.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fundId: string }> },
) {
  const adminAuth = await requireAdminAppRouter();
  if (adminAuth instanceof NextResponse) return adminAuth;

  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const { fundId } = await params;
    const access = await verifyAccess(fundId);
    if ("error" in access) return access.error;

    const { fund } = access;
    const aggregate = fund.aggregate;

    // Priority chains: new fields → legacy fields → aggregate fallback
    const initialThresholdEnabled =
      fund.initialThresholdEnabled ||
      aggregate?.initialThresholdEnabled ||
      fund.capitalCallThresholdEnabled ||
      aggregate?.thresholdEnabled ||
      false;

    const initialThresholdAmount = fund.initialThresholdAmount
      ? Number(fund.initialThresholdAmount)
      : aggregate?.initialThresholdAmount
        ? Number(aggregate.initialThresholdAmount)
        : fund.capitalCallThreshold
          ? Number(fund.capitalCallThreshold)
          : aggregate?.thresholdAmount
            ? Number(aggregate.thresholdAmount)
            : null;

    const fullAuthorizedAmount = fund.fullAuthorizedAmount
      ? Number(fund.fullAuthorizedAmount)
      : aggregate?.fullAuthorizedAmount
        ? Number(aggregate.fullAuthorizedAmount)
        : null;

    const totalCommitted = aggregate ? Number(aggregate.totalCommitted) : 0;
    const totalInbound = aggregate ? Number(aggregate.totalInbound) : 0;
    const totalOutbound = aggregate ? Number(aggregate.totalOutbound) : 0;

    const initialThresholdMet =
      aggregate?.initialThresholdMet ||
      (initialThresholdAmount && totalCommitted >= initialThresholdAmount) ||
      false;

    const fullAuthorizedProgress =
      fullAuthorizedAmount && fullAuthorizedAmount > 0
        ? Math.min(100, (totalCommitted / fullAuthorizedAmount) * 100)
        : aggregate?.fullAuthorizedProgress
          ? Number(aggregate.fullAuthorizedProgress)
          : 0;

    return NextResponse.json({
      initialThresholdEnabled,
      initialThresholdAmount,
      fullAuthorizedAmount,
      initialThresholdMet,
      fullAuthorizedProgress,
      totalCommitted,
      totalInbound,
      totalOutbound,
      // Legacy aliases for backward compat
      thresholdEnabled: initialThresholdEnabled,
      thresholdAmount: initialThresholdAmount,
      // Economics (display values: stored decimal → percentage)
      managementFeePct: fund.managementFeePct ? Number(fund.managementFeePct) * 100 : null,
      carryPct: fund.carryPct ? Number(fund.carryPct) * 100 : null,
      hurdleRate: fund.hurdleRate ? Number(fund.hurdleRate) * 100 : null,
      waterfallType: fund.waterfallType,
      termYears: fund.termYears,
      extensionYears: fund.extensionYears,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/admin/fund/[fundId]/threshold-settings
 * Updates threshold and/or economics settings for a fund.
 * Dual-writes to Fund model and FundAggregate model for threshold changes.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ fundId: string }> },
) {
  const adminAuth = await requireAdminAppRouter();
  if (adminAuth instanceof NextResponse) return adminAuth;

  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const { fundId } = await params;
    const access = await verifyAccess(fundId);
    if ("error" in access) return access.error;

    const { fund, user } = access;
    const body = await req.json();

    const {
      initialThresholdEnabled,
      initialThresholdAmount,
      fullAuthorizedAmount,
      thresholdEnabled,
      thresholdAmount,
      managementFeePct,
      carryPct,
      hurdleRate,
      waterfallType,
      termYears,
      extensionYears,
    } = body;

    // Resolve legacy aliases
    const effectiveThresholdEnabled = initialThresholdEnabled ?? thresholdEnabled;
    const effectiveThresholdAmount = initialThresholdAmount ?? thresholdAmount;

    // Validate threshold amount when enabled
    if (effectiveThresholdEnabled && (!effectiveThresholdAmount || effectiveThresholdAmount <= 0)) {
      return NextResponse.json(
        { error: "Initial threshold amount must be greater than 0 when enabled" },
        { status: 400 },
      );
    }

    // Detect what changed
    const hasThresholdUpdate =
      effectiveThresholdEnabled !== undefined ||
      effectiveThresholdAmount !== undefined ||
      fullAuthorizedAmount !== undefined;

    const hasEconomicsUpdate =
      managementFeePct !== undefined ||
      carryPct !== undefined ||
      hurdleRate !== undefined ||
      waterfallType !== undefined ||
      termYears !== undefined ||
      extensionYears !== undefined;

    if (!hasThresholdUpdate && !hasEconomicsUpdate) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Build economics update (percentage fields: display value → stored decimal)
    const economicsUpdate: Record<string, unknown> = {};
    const previousValues: Record<string, unknown> = {};

    if (managementFeePct !== undefined) {
      previousValues.managementFeePct = fund.managementFeePct ? Number(fund.managementFeePct) * 100 : null;
      economicsUpdate.managementFeePct = managementFeePct ? parseFloat(managementFeePct) / 100 : null;
    }
    if (carryPct !== undefined) {
      previousValues.carryPct = fund.carryPct ? Number(fund.carryPct) * 100 : null;
      economicsUpdate.carryPct = carryPct ? parseFloat(carryPct) / 100 : null;
    }
    if (hurdleRate !== undefined) {
      previousValues.hurdleRate = fund.hurdleRate ? Number(fund.hurdleRate) * 100 : null;
      economicsUpdate.hurdleRate = hurdleRate ? parseFloat(hurdleRate) / 100 : null;
    }
    if (waterfallType !== undefined) {
      previousValues.waterfallType = fund.waterfallType;
      economicsUpdate.waterfallType = waterfallType;
    }
    if (termYears !== undefined) {
      previousValues.termYears = fund.termYears;
      economicsUpdate.termYears = termYears;
    }
    if (extensionYears !== undefined) {
      previousValues.extensionYears = fund.extensionYears;
      economicsUpdate.extensionYears = extensionYears;
    }

    // Build threshold update with legacy field sync
    const thresholdUpdate: Record<string, unknown> = {};
    if (hasThresholdUpdate) {
      if (effectiveThresholdEnabled !== undefined) {
        previousValues.initialThresholdEnabled = fund.initialThresholdEnabled;
        thresholdUpdate.initialThresholdEnabled = effectiveThresholdEnabled;
        thresholdUpdate.capitalCallThresholdEnabled = effectiveThresholdEnabled;
      }
      if (effectiveThresholdAmount !== undefined) {
        previousValues.initialThresholdAmount = fund.initialThresholdAmount
          ? Number(fund.initialThresholdAmount)
          : null;
        thresholdUpdate.initialThresholdAmount = effectiveThresholdEnabled
          ? effectiveThresholdAmount
          : null;
        thresholdUpdate.capitalCallThreshold = effectiveThresholdEnabled
          ? effectiveThresholdAmount
          : null;
      }
      if (fullAuthorizedAmount !== undefined) {
        previousValues.fullAuthorizedAmount = fund.fullAuthorizedAmount
          ? Number(fund.fullAuthorizedAmount)
          : null;
        thresholdUpdate.fullAuthorizedAmount = fullAuthorizedAmount || null;
      }
    }

    // Update Fund model
    await prisma.fund.update({
      where: { id: fundId },
      data: { ...thresholdUpdate, ...economicsUpdate },
    });

    // Dual-write to FundAggregate for threshold changes
    if (hasThresholdUpdate) {
      const aggregate = fund.aggregate;
      const auditEntry = {
        action: "threshold_update",
        userId: user.id,
        timestamp: new Date().toISOString(),
        changes: {
          initialThresholdEnabled: effectiveThresholdEnabled,
          initialThresholdAmount: effectiveThresholdEnabled ? effectiveThresholdAmount : null,
          fullAuthorizedAmount: fullAuthorizedAmount || null,
        },
      };

      if (aggregate) {
        const existingAudit = Array.isArray(aggregate.audit) ? aggregate.audit : [];
        await prisma.fundAggregate.update({
          where: { id: aggregate.id },
          data: {
            initialThresholdEnabled: effectiveThresholdEnabled,
            initialThresholdAmount: effectiveThresholdEnabled ? effectiveThresholdAmount : null,
            fullAuthorizedAmount: fullAuthorizedAmount || null,
            thresholdEnabled: effectiveThresholdEnabled,
            thresholdAmount: effectiveThresholdEnabled ? effectiveThresholdAmount : null,
            audit: [...(existingAudit as Record<string, unknown>[]), auditEntry],
          },
        });
      } else {
        await prisma.fundAggregate.create({
          data: {
            fundId,
            initialThresholdEnabled: effectiveThresholdEnabled ?? false,
            initialThresholdAmount: effectiveThresholdEnabled ? effectiveThresholdAmount : null,
            fullAuthorizedAmount: fullAuthorizedAmount || null,
            thresholdEnabled: effectiveThresholdEnabled ?? false,
            thresholdAmount: effectiveThresholdEnabled ? effectiveThresholdAmount : null,
            totalCommitted: 0,
            totalInbound: 0,
            totalOutbound: 0,
            audit: [auditEntry],
          },
        });
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        eventType: hasEconomicsUpdate ? "FUND_SETTINGS_UPDATE" : "FUND_THRESHOLD_UPDATE",
        userId: user.id,
        teamId: fund.teamId,
        resourceType: "FUND",
        resourceId: fundId,
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0] || "",
        userAgent: req.headers.get("user-agent") || "",
        metadata: {
          updatedFields: Object.keys({ ...thresholdUpdate, ...economicsUpdate }),
          previousValues,
        },
      },
    }).catch((e: unknown) => reportError(e as Error));

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
