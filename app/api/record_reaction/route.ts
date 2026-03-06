export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

const reactionSchema = z.object({
  viewId: z.string().min(1),
  pageNumber: z.number().int().nonnegative(),
  type: z.string().min(1).max(50),
});

export async function POST(req: NextRequest) {
  // Rate limit -- public endpoint, prevent abuse
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { viewId, pageNumber, type } = parsed.data;

  try {
    const reaction = await prisma.reaction.create({
      data: {
        viewId,
        pageNumber,
        type,
      },
      include: {
        view: {
          select: {
            documentId: true,
            dataroomId: true,
            linkId: true,
            viewerEmail: true,
            viewerId: true,
            teamId: true,
          },
        },
      },
    });

    if (!reaction) {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
