import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getFile } from "@/lib/files/get-file";
import { reportError } from "@/lib/error";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { requireLPAuthAppRouter } from "@/lib/auth/rbac";
import type { DocumentStorageType } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/lp/docs
 * Returns the authenticated LP's document vault with signed URLs.
 */
export async function GET(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const auth = await requireLPAuthAppRouter();
    if (auth instanceof NextResponse) return auth;

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      include: {
        investorProfile: {
          include: {
            documents: {
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    if (!user?.investorProfile) {
      return NextResponse.json(
        { error: "Investor profile not found" },
        { status: 404 },
      );
    }

    // Generate signed URLs for each document
    const documentsWithUrls = await Promise.all(
      user.investorProfile.documents.map(async (doc) => {
        let fileUrl = null;
        try {
          fileUrl = await getFile({
            type: doc.storageType as DocumentStorageType,
            data: doc.storageKey,
          });
        } catch (err) {
          reportError(err as Error);
        }
        return {
          id: doc.id,
          title: doc.title,
          documentType: doc.documentType,
          fileUrl,
          signedAt: doc.signedAt,
          createdAt: doc.createdAt,
        };
      }),
    );

    return NextResponse.json({
      documents: documentsWithUrls,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
