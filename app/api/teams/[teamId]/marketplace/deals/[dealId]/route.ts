import { NextRequest, NextResponse } from "next/server";
import { authenticateGP } from "@/lib/marketplace/auth";
import { getDeal, updateDeal, deleteDeal } from "@/lib/marketplace";
import type { UpdateDealInput } from "@/lib/marketplace/types";
import { verifyNotBot } from "@/lib/security/bot-protection";
import { errorResponse } from "@/lib/errors";
import { validateBody } from "@/lib/middleware/validate";
import { DealUpdateSchema } from "@/lib/validations/esign-outreach";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ teamId: string; dealId: string }> };

/**
 * GET /api/teams/[teamId]/marketplace/deals/[dealId]
 * Get deal details.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { teamId, dealId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const deal = await getDeal(dealId);
    if (!deal || deal.teamId !== teamId) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    return NextResponse.json({ deal });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/teams/[teamId]/marketplace/deals/[dealId]
 * Update deal details.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const botCheck = await verifyNotBot();
    if (botCheck.blocked) return botCheck.response;

    const { teamId, dealId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const parsed = await validateBody(req, DealUpdateSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;
    const deal = await updateDeal(dealId, body as UpdateDealInput, auth.userId);
    return NextResponse.json({ success: true, deal });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/teams/[teamId]/marketplace/deals/[dealId]
 * Soft-delete a deal.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const botCheck = await verifyNotBot();
    if (botCheck.blocked) return botCheck.response;

    const { teamId, dealId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const deal = await deleteDeal(dealId, auth.userId);
    return NextResponse.json({ success: true, deal });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
