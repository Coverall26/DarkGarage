import { NextRequest, NextResponse } from "next/server";
import { authenticateGP } from "@/lib/marketplace/auth";
import { validateBody } from "@/lib/middleware/validate";
import {
  setWireInstructions,
  getWireInstructions,
  deleteWireInstructions,
} from "@/lib/wire-transfer";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { WireInstructionsSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ teamId: string; fundId: string }>;
};

/**
 * GET /api/teams/[teamId]/funds/[fundId]/wire-instructions
 * Get wire instructions for a fund (GP view — full details).
 */
export async function GET(req: NextRequest, { params }: Params) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const { teamId, fundId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const instructions = await getWireInstructions(fundId);

    if (!instructions) {
      return NextResponse.json(
        { instructions: null, configured: false },
      );
    }

    return NextResponse.json({ instructions, configured: true });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

/**
 * POST /api/teams/[teamId]/funds/[fundId]/wire-instructions
 * Set or update wire instructions for a fund.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const { teamId, fundId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const { data: body, error: validationError } = await validateBody(req, WireInstructionsSchema);
    if (validationError) return validationError;

    const fund = await setWireInstructions(fundId, {
      bankName: body.bankName,
      accountNumber: body.accountNumber,
      routingNumber: body.routingNumber,
      beneficiaryName: body.beneficiaryName,
      swiftCode: body.swiftCode ?? undefined,
      notes: body.specialInstructions ?? undefined,
      reference: body.memoFormat ?? undefined,
    }, auth.userId);
    return NextResponse.json({ success: true, fund });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/teams/[teamId]/funds/[fundId]/wire-instructions
 * Remove wire instructions from a fund.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const { teamId, fundId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const fund = await deleteWireInstructions(fundId, auth.userId);
    return NextResponse.json({ success: true, fund });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
