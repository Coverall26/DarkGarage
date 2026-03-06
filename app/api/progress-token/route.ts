export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";
import { reportError } from "@/lib/error";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export async function GET(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documentVersionId = req.nextUrl.searchParams.get("documentVersionId");

  if (!documentVersionId) {
    return NextResponse.json(
      { error: "Document version ID is required" },
      { status: 400 },
    );
  }

  // Resource-level authorization: verify the user belongs to the team that owns this document
  const userId = (session.user as CustomUser).id;
  const docVersion = await prisma.documentVersion.findFirst({
    where: {
      id: documentVersionId,
      document: {
        team: {
          users: {
            some: {
              userId,
            },
          },
        },
      },
    },
    select: { id: true },
  });

  if (!docVersion) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  try {
    const { generateTriggerPublicAccessToken } = await import(
      "@/lib/utils/generate-trigger-auth-token"
    );

    const publicAccessToken = await generateTriggerPublicAccessToken(
      `version:${documentVersionId}`,
    );
    return NextResponse.json({ publicAccessToken });
  } catch (error: unknown) {
    reportError(error as Error);
    return NextResponse.json({
      publicAccessToken: null,
      status: "not_configured",
      message: "Document processing status not available",
    });
  }
}
