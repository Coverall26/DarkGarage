import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { reportError } from "@/lib/error";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ teamId: string; fundId: string; distributionId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
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

    return NextResponse.json({
      ...distribution,
      totalAmount: distribution.totalAmount.toString(),
    });
  } catch (error) {
    reportError(error as Error);
    logger.error("Error fetching distribution", {
      module: "distributions",
      metadata: { distributionId, error: (error as Error).message },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
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

    if (distribution.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only DRAFT distributions can be updated" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (body.totalAmount !== undefined) {
      const amount = parseFloat(String(body.totalAmount).replace(/[^0-9.]/g, ""));
      if (isNaN(amount) || amount <= 0 || amount > 100_000_000_000) {
        return NextResponse.json(
          { error: "Amount must be a positive number up to $100B" },
          { status: 400 },
        );
      }
      updateData.totalAmount = amount;
    }

    if (body.distributionType !== undefined) {
      const validTypes = ["DIVIDEND", "RETURN_OF_CAPITAL", "INTEREST", "OTHER"];
      if (!validTypes.includes(body.distributionType)) {
        return NextResponse.json({ error: "Invalid distribution type" }, { status: 400 });
      }
      updateData.distributionType = body.distributionType;
    }

    if (body.distributionDate !== undefined) {
      updateData.distributionDate = new Date(body.distributionDate);
    }

    if (body.status !== undefined) {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ["PENDING", "CANCELLED"],
        PENDING: ["APPROVED", "CANCELLED"],
        APPROVED: ["PROCESSING", "CANCELLED"],
      };
      const allowed = validTransitions[distribution.status] || [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${distribution.status} to ${body.status}` },
          { status: 400 },
        );
      }
      updateData.status = body.status;
    }

    const updated = await prisma.distribution.update({
      where: { id: distributionId },
      data: updateData,
    });

    await logAuditEvent({
      teamId,
      userId: auth.userId,
      eventType: "DISTRIBUTION_UPDATED",
      resourceType: "Distribution",
      resourceId: distributionId,
      metadata: {
        fundId,
        changes: updateData,
        previousStatus: distribution.status,
      },
    }).catch((e) => reportError(e as Error));

    return NextResponse.json({
      ...updated,
      totalAmount: updated.totalAmount.toString(),
    });
  } catch (error) {
    reportError(error as Error);
    logger.error("Error updating distribution", {
      module: "distributions",
      metadata: { distributionId, error: (error as Error).message },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
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

    if (distribution.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only DRAFT distributions can be deleted" },
        { status: 400 },
      );
    }

    await prisma.distribution.delete({ where: { id: distributionId } });

    await logAuditEvent({
      teamId,
      userId: auth.userId,
      eventType: "DISTRIBUTION_DELETED",
      resourceType: "Distribution",
      resourceId: distributionId,
      metadata: { fundId, distributionNumber: distribution.distributionNumber },
    }).catch((e) => reportError(e as Error));

    return NextResponse.json({ success: true });
  } catch (error) {
    reportError(error as Error);
    logger.error("Error deleting distribution", {
      module: "distributions",
      metadata: { distributionId, error: (error as Error).message },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
