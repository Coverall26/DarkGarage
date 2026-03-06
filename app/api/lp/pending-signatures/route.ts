import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { requireLPAuthAppRouter } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

/**
 * GET /api/lp/pending-signatures
 * Returns pending signature documents for the authenticated LP.
 */
export async function GET(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const auth = await requireLPAuthAppRouter();
  if (auth instanceof NextResponse) return auth;

  try {
    const pendingSignatures = await prisma.signatureRecipient.findMany({
      where: {
        email: auth.email,
        status: { in: ["PENDING", "SENT", "VIEWED"] },
        role: "SIGNER",
        document: {
          status: { in: ["SENT", "VIEWED", "PARTIALLY_SIGNED"] },
        },
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            sentAt: true,
            expirationDate: true,
            team: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedSignatures = pendingSignatures.map((sig) => ({
      id: sig.id,
      documentId: sig.document.id,
      documentTitle: sig.document.title,
      teamName: sig.document.team.name,
      signingToken: sig.signingToken,
      status: sig.status,
      sentAt: sig.document.sentAt,
      expirationDate: sig.document.expirationDate,
    }));

    return NextResponse.json({
      pendingSignatures: formattedSignatures,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
