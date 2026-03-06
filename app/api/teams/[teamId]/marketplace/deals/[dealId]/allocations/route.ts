import { NextRequest, NextResponse } from "next/server";
import { authenticateGP } from "@/lib/marketplace/auth";
import {
  allocateDeal,
  listDealAllocations,
  respondToAllocation,
} from "@/lib/marketplace";
import { verifyNotBot } from "@/lib/security/bot-protection";
import { errorResponse } from "@/lib/errors";
import { validateBody } from "@/lib/middleware/validate";
import { DealAllocationSchema, AllocationResponseSchema } from "@/lib/validations/esign-outreach";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ teamId: string; dealId: string }>;
};

/**
 * GET /api/teams/[teamId]/marketplace/deals/[dealId]/allocations
 * List all allocations for a deal.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { teamId, dealId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const allocations = await listDealAllocations(dealId);
    return NextResponse.json({ allocations });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

/**
 * POST /api/teams/[teamId]/marketplace/deals/[dealId]/allocations
 * Create a new allocation (GP allocates to an investor).
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const botCheck = await verifyNotBot();
    if (botCheck.blocked) return botCheck.response;

    const { teamId, dealId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const parsed = await validateBody(req, DealAllocationSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    if (!body.investorId || !body.amount) {
      return NextResponse.json(
        { error: "investorId and amount are required" },
        { status: 400 },
      );
    }

    const allocation = await allocateDeal(
      {
        dealId,
        investorId: body.investorId,
        allocatedAmount: body.amount,
        allocationNotes: body.notes ?? undefined,
      },
      auth.userId,
    );

    return NextResponse.json(
      { success: true, allocation },
      { status: 201 },
    );
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/teams/[teamId]/marketplace/deals/[dealId]/allocations
 * LP responds to an allocation (accept/reject).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const botCheck = await verifyNotBot();
    if (botCheck.blocked) return botCheck.response;

    const { teamId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const parsed = await validateBody(req, AllocationResponseSchema);
    if (parsed.error) return parsed.error;

    const allocation = await respondToAllocation(
      parsed.data.allocationId,
      parsed.data.accept,
      parsed.data.confirmedAmount,
    );

    return NextResponse.json({ success: true, allocation });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
