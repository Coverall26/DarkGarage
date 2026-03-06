export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import notion from "@/lib/notion";
import { addSignedUrls } from "@/lib/notion/utils";
import { CustomUser } from "@/lib/types";
import { reportError } from "@/lib/error";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export async function POST(req: NextRequest) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resource-level authorization: verify the user belongs to at least one team
    const userId = (session.user as CustomUser).id;
    const teamMembership = await prisma.userTeam.findFirst({
      where: { userId },
      select: { userId: true },
    });

    if (!teamMembership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { pageId } = (await req.json()) as { pageId: string };

    const recordMap = await notion.getPage(pageId, { signFileUrls: false });
    // Workaround: sign file URLs separately due to react-notion-x#580
    await addSignedUrls({ recordMap });

    if (!recordMap) {
      return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 },
      );
    }

    return NextResponse.json(recordMap);
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
