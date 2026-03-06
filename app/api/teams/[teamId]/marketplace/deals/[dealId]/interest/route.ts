import { NextRequest, NextResponse } from "next/server";
import { type InterestStatus } from "@prisma/client";
import { authenticateGP } from "@/lib/marketplace/auth";
import {
  expressInterest,
  listDealInterests,
  updateInterestStatus,
} from "@/lib/marketplace";
import { verifyNotBot } from "@/lib/security/bot-protection";
import { errorResponse } from "@/lib/errors";
import { validateBody } from "@/lib/middleware/validate";
import { DealInterestSchema, InterestStatusUpdateSchema } from "@/lib/validations/esign-outreach";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ teamId: string; dealId: string }>;
};

/**
 * GET /api/teams/[teamId]/marketplace/deals/[dealId]/interest
 * List all interest expressions for a deal (GP view).
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { teamId, dealId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status")?.split(",") as
      | import("@prisma/client").InterestStatus[]
      | undefined;

    const interests = await listDealInterests(dealId, statusFilter);
    return NextResponse.json({ interests });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

/**
 * POST /api/teams/[teamId]/marketplace/deals/[dealId]/interest
 * Express interest in a deal (can be LP or GP adding on behalf).
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const botCheck = await verifyNotBot();
    if (botCheck.blocked) return botCheck.response;

    const { teamId, dealId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const parsed = await validateBody(req, DealInterestSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    const interest = await expressInterest(
      {
        dealId,
        indicativeAmount: body.amount,
        notes: body.notes ?? undefined,
        conditionsOrTerms: undefined,
      },
      auth.userId,
      body.investorId,
    );

    return NextResponse.json({ success: true, interest }, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/teams/[teamId]/marketplace/deals/[dealId]/interest
 * Update interest status (GP action).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const botCheck = await verifyNotBot();
    if (botCheck.blocked) return botCheck.response;

    const { teamId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const parsed = await validateBody(req, InterestStatusUpdateSchema);
    if (parsed.error) return parsed.error;

    const interest = await updateInterestStatus(
      parsed.data.interestId,
      parsed.data.status as InterestStatus,
      auth.userId,
      parsed.data.gpNotes ?? undefined,
    );

    return NextResponse.json({ success: true, interest });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
