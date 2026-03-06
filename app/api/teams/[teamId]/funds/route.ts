import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { enforceRBACAppRouter } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

/**
 * GET /api/teams/[teamId]/funds
 *
 * List all funds for a team. Requires admin role.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;

  const auth = await enforceRBACAppRouter({
    roles: ["OWNER", "SUPER_ADMIN", "ADMIN"],
    teamId,
  });
  if (auth instanceof NextResponse) return auth;

  try {
    const funds = await prisma.fund.findMany({
      where: { teamId },
      include: {
        _count: {
          select: { investments: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      funds: funds.map((fund: {
        id: string;
        name: string;
        description: string | null;
        status: string;
        ndaGateEnabled: boolean;
        targetRaise: { toString(): string };
        currentRaise: { toString(): string };
        _count: { investments: number };
      }) => ({
        id: fund.id,
        name: fund.name,
        description: fund.description,
        status: fund.status,
        ndaGateEnabled: fund.ndaGateEnabled,
        targetRaise: fund.targetRaise.toString(),
        currentRaise: fund.currentRaise.toString(),
        _count: fund._count,
      })),
    });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
