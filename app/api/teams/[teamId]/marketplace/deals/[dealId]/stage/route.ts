import { NextRequest, NextResponse } from "next/server";
import { type DealStage } from "@prisma/client";
import { authenticateGP } from "@/lib/marketplace/auth";
import { transitionDealStage } from "@/lib/marketplace";
import { verifyNotBot } from "@/lib/security/bot-protection";
import { reportError } from "@/lib/error";
import { validateBody } from "@/lib/middleware/validate";
import { DealStageTransitionSchema } from "@/lib/validations/esign-outreach";

export const dynamic = "force-dynamic";

/**
 * POST /api/teams/[teamId]/marketplace/deals/[dealId]/stage
 * Transition a deal to a new pipeline stage.
 */
export async function POST(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ teamId: string; dealId: string }> },
) {
  try {
    const botCheck = await verifyNotBot();
    if (botCheck.blocked) return botCheck.response;

    const { teamId, dealId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const parsed = await validateBody(req, DealStageTransitionSchema);
    if (parsed.error) return parsed.error;
    const { toStage, reason, metadata } = parsed.data;

    const deal = await transitionDealStage(
      dealId,
      { toStage: toStage as DealStage, reason, metadata },
      auth.userId,
    );

    return NextResponse.json({ success: true, deal });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "";
    const status = message.includes("Invalid stage transition") ? 400 : 500;
    reportError(error as Error);
    return NextResponse.json(
      status === 400
        ? { error: "Invalid stage transition" }
        : { error: "Internal server error" },
      { status },
    );
  }
}
