import { NextRequest, NextResponse } from "next/server";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/fund/list
 * Returns all funds for the authenticated admin user's teams.
 * Used by fund selector dropdowns across admin pages.
 */
export async function GET(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const adminAuth = await requireAdminAppRouter();
  if (adminAuth instanceof NextResponse) return adminAuth;

  try {
    const user = await prisma.user.findUnique({
      where: { email: adminAuth.email },
      include: {
        teams: {
          where: { role: { in: ["ADMIN", "OWNER", "SUPER_ADMIN"] } },
          include: {
            team: {
              include: {
                funds: {
                  select: { id: true, name: true, teamId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const funds = user.teams.flatMap((ut) => ut.team.funds);

    return NextResponse.json({ funds });
  } catch (error) {
    return errorResponse(error);
  }
}
