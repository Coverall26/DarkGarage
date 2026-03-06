import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { requireLPAuthAppRouter } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

/**
 * GET /api/lp/pending-counts
 * Returns pending document and signature counts for the authenticated LP.
 * Used by LP Bottom Tab Bar for badge indicators.
 */
export async function GET(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const auth = await requireLPAuthAppRouter();
  if (auth instanceof NextResponse) return auth;

  try {
    // Run both counts in parallel for efficiency
    const [pendingSignatures, pendingDocs] = await Promise.all([
      prisma.signatureRecipient.count({
        where: {
          email: auth.email,
          status: { in: ["PENDING", "SENT", "VIEWED"] },
          role: "SIGNER",
          document: {
            status: { in: ["SENT", "VIEWED", "PARTIALLY_SIGNED"] },
          },
        },
      }),
      prisma.lPDocument.count({
        where: {
          investor: {
            user: { email: auth.email },
          },
          status: "REVISION_REQUESTED",
        },
      }),
    ]);

    return NextResponse.json({
      pendingDocs,
      pendingSignatures,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
