import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";

/**
 * GET /api/dataroom/activity — recent filing activity for the team
 */
export async function GET(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const auth = await requireAdminAppRouter();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = req.nextUrl;
    const teamId = searchParams.get("teamId");
    if (!teamId) {
      return NextResponse.json(
        { error: "teamId is required" },
        { status: 400 },
      );
    }

    // Verify team membership
    const membership = await prisma.userTeam.findFirst({
      where: {
        userId: auth.userId,
        teamId,
        status: "ACTIVE",
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get recent filing activity
    const filings = await prisma.documentFiling.findMany({
      where: { teamId },
      select: {
        id: true,
        filedFileName: true,
        sourceType: true,
        destinationType: true,
        createdAt: true,
        filedById: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Batch-fetch user emails for filedBy
    const userIds = [
      ...new Set(filings.map((f) => f.filedById).filter(Boolean)),
    ] as string[];
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u.email]));

    const activities = filings.map((f) => ({
      id: f.id,
      fileName: f.filedFileName ?? "Untitled",
      sourceType: f.sourceType,
      destinationType: f.destinationType,
      filedByEmail: f.filedById ? (userMap.get(f.filedById) ?? null) : null,
      createdAt: f.createdAt,
    }));

    return NextResponse.json({ activities });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
