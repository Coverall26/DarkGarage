import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/marketplace/auth";
import { requireLPAuthAppRouter } from "@/lib/auth/rbac";
import { uploadProofOfPayment } from "@/lib/wire-transfer";
import { reportError } from "@/lib/error";
import { appRouterUploadRateLimit } from "@/lib/security/rate-limiter";
import { validateBody } from "@/lib/middleware/validate";
import { ManualInvestmentProofSchema } from "@/lib/validations/lp";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ investmentId: string }>;
};

/**
 * POST /api/lp/manual-investments/[investmentId]/proof
 * LP uploads proof of payment for a manual investment.
 */
export async function POST(req: NextRequest, { params }: Params) {
  // Defense-in-depth: LP auth check (additive to edge middleware)
  const lpAuth = await requireLPAuthAppRouter();
  if (lpAuth instanceof NextResponse) return lpAuth;

  const blocked = await appRouterUploadRateLimit(req);
  if (blocked) return blocked;

  try {
    const { investmentId } = await params;
    const auth = await authenticateUser();
    if ("error" in auth) return auth.error;

    const parsed = await validateBody(req, ManualInvestmentProofSchema);
    if (parsed.error) return parsed.error;

    const result = await uploadProofOfPayment(
      investmentId,
      {
        storageKey: parsed.data.storageKey,
        storageType: parsed.data.storageType,
        fileType: parsed.data.fileType,
        fileName: parsed.data.fileName,
        fileSize: parsed.data.fileSize ?? 0,
        notes: parsed.data.notes,
      },
      auth.userId,
    );

    return NextResponse.json({ success: true, investment: result });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "";
    const status = message.includes("not found") ? 404
      : message.includes("Unauthorized") ? 403
      : message.includes("already been verified") ? 409
      : 500;
    reportError(error as Error);
    const clientMessage = status === 404 ? "Investment not found"
      : status === 403 ? "Unauthorized"
      : status === 409 ? "Payment has already been verified"
      : "Internal server error";
    return NextResponse.json({ error: clientMessage }, { status });
  }
}
