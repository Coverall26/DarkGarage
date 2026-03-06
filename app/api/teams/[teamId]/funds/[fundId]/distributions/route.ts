import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { reportError } from "@/lib/error";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

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
    });
    if (!fund) {
      return NextResponse.json({ error: "Fund not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { fundId, teamId };
    if (status && status !== "all") {
      where.status = status;
    }

    const [distributions, total] = await Promise.all([
      prisma.distribution.findMany({
        where,
        orderBy: { distributionDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.distribution.count({ where }),
    ]);

    return NextResponse.json({
      distributions: distributions.map((d) => ({
        ...d,
        totalAmount: d.totalAmount.toString(),
      })),
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit,
      },
    });
  } catch (error) {
    reportError(error as Error);
    logger.error("Error listing distributions", {
      module: "distributions",
      metadata: { fundId, error: (error as Error).message },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
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
    });
    if (!fund) {
      return NextResponse.json({ error: "Fund not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      totalAmount,
      distributionType = "DIVIDEND",
      distributionDate,
      notes,
    } = body;

    const amount = parseFloat(String(totalAmount).replace(/[^0-9.]/g, ""));
    if (isNaN(amount) || amount <= 0 || amount > 100_000_000_000) {
      return NextResponse.json(
        { error: "Amount must be a positive number up to $100B" },
        { status: 400 },
      );
    }

    const validTypes = ["DIVIDEND", "RETURN_OF_CAPITAL", "INTEREST", "OTHER"];
    if (!validTypes.includes(distributionType)) {
      return NextResponse.json(
        { error: "Invalid distribution type" },
        { status: 400 },
      );
    }

    if (!distributionDate) {
      return NextResponse.json(
        { error: "Distribution date is required" },
        { status: 400 },
      );
    }

    // Get next distribution number
    const lastDistribution = await prisma.distribution.findFirst({
      where: { fundId },
      orderBy: { distributionNumber: "desc" },
      select: { distributionNumber: true },
    });
    const distributionNumber = (lastDistribution?.distributionNumber || 0) + 1;

    const distribution = await prisma.distribution.create({
      data: {
        fundId,
        teamId,
        distributionNumber,
        totalAmount: amount,
        distributionType: distributionType as "DIVIDEND" | "RETURN_OF_CAPITAL" | "INTEREST" | "OTHER",
        distributionDate: new Date(distributionDate),
        status: "DRAFT",
      },
    });

    await logAuditEvent({
      teamId,
      userId: auth.userId,
      eventType: "DISTRIBUTION_CREATED",
      resourceType: "Distribution",
      resourceId: distribution.id,
      metadata: {
        fundId,
        distributionNumber,
        amount: amount.toString(),
        distributionType,
        notes,
      },
    });

    return NextResponse.json(
      {
        ...distribution,
        totalAmount: distribution.totalAmount.toString(),
      },
      { status: 201 },
    );
  } catch (error) {
    reportError(error as Error);
    logger.error("Error creating distribution", {
      module: "distributions",
      metadata: { fundId, error: (error as Error).message },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
