import { NextRequest, NextResponse } from "next/server";
import { authenticateGP } from "@/lib/marketplace/auth";
import { getPipelineStats, getDealKPIs } from "@/lib/marketplace";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * GET /api/teams/[teamId]/marketplace/pipeline
 * Get pipeline statistics and optionally deal-level KPIs.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const dealId = url.searchParams.get("dealId");

    if (dealId) {
      // Return KPIs for a specific deal
      const kpis = await getDealKPIs(dealId);
      return NextResponse.json({ kpis });
    }

    // Return overall pipeline stats
    const stats = await getPipelineStats(teamId);
    return NextResponse.json({ stats });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
