import { NextRequest, NextResponse } from "next/server";
import { authenticateGP } from "@/lib/marketplace/auth";
import { createDeal, listDeals } from "@/lib/marketplace";
import type { DealFilters, CreateDealInput } from "@/lib/marketplace/types";
import { verifyNotBot } from "@/lib/security/bot-protection";
import { errorResponse } from "@/lib/errors";
import { validateBody } from "@/lib/middleware/validate";
import { DealUpdateSchema } from "@/lib/validations/esign-outreach";

export const dynamic = "force-dynamic";

/**
 * GET /api/teams/[teamId]/marketplace/deals
 * List deals for a team with optional filtering.
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
    const page = parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "25", 10);

    const filters: DealFilters = {};
    const stage = url.searchParams.get("stage");
    if (stage) filters.stage = stage.split(",") as DealFilters["stage"];
    const dealType = url.searchParams.get("dealType");
    if (dealType)
      filters.dealType = dealType.split(",") as DealFilters["dealType"];
    const search = url.searchParams.get("search");
    if (search) filters.search = search;
    const sector = url.searchParams.get("sector");
    if (sector) filters.sector = sector;
    const geography = url.searchParams.get("geography");
    if (geography) filters.geography = geography;
    const fundId = url.searchParams.get("fundId");
    if (fundId) filters.fundId = fundId;
    const tags = url.searchParams.get("tags");
    if (tags) filters.tags = tags.split(",");

    const result = await listDeals(teamId, filters, page, pageSize);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

/**
 * POST /api/teams/[teamId]/marketplace/deals
 * Create a new deal.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const botCheck = await verifyNotBot();
    if (botCheck.blocked) return botCheck.response;

    const { teamId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const parsed = await validateBody(req, DealUpdateSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    if (!body.name) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 },
      );
    }

    const deal = await createDeal(teamId, body as CreateDealInput, auth.userId);
    return NextResponse.json({ success: true, deal }, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
