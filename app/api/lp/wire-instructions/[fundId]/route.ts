import { NextRequest, NextResponse } from "next/server";
import { getWireInstructionsPublic } from "@/lib/wire-transfer";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { requireLPAuthAppRouter } from "@/lib/auth/rbac";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ fundId: string }>;
};

/**
 * GET /api/lp/wire-instructions/[fundId]
 * LP retrieves wire instructions for a fund (masked account number).
 * Verifies the LP has an investment relationship to the requested fund.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const { fundId } = await params;
    const auth = await requireLPAuthAppRouter();
    if (auth instanceof NextResponse) return auth;

    // Verify the LP has a relationship to this fund (investment or investor.fundId)
    const hasAccess = await prisma.investment.findFirst({
      where: {
        fundId,
        investor: {
          OR: [
            { userId: auth.userId },
            { user: { email: auth.email } },
          ],
        },
      },
      select: { id: true },
    });

    if (!hasAccess) {
      // Also check direct investor.fundId linkage
      const investor = await prisma.investor.findFirst({
        where: {
          fundId,
          OR: [
            { userId: auth.userId },
            { user: { email: auth.email } },
          ],
        },
        select: { id: true },
      });
      if (!investor) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const instructions = await getWireInstructionsPublic(fundId);

    if (!instructions) {
      return NextResponse.json(
        { error: "Wire instructions not configured for this fund" },
        { status: 404 },
      );
    }

    return NextResponse.json({ instructions });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
