import { NextRequest, NextResponse } from "next/server";

import { errorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { enforceRBACAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const { teamId } = await params;

  const auth = await enforceRBACAppRouter({
    roles: ["OWNER", "SUPER_ADMIN", "ADMIN"],
    teamId,
  });
  if (auth instanceof NextResponse) return auth;

  try {
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        id: true,
        subscriptionId: true,
        startsAt: true,
        endsAt: true,
        plan: true,
        _count: {
          select: {
            documents: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team does not exist" },
        { status: 400 },
      );
    }

    return NextResponse.json(team);
  } catch (error) {
    return errorResponse(error);
  }
}
