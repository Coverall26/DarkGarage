export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth/auth-options";
import { reportError } from "@/lib/error";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { isArchived } = await req.json();

  try {
    // Update the link in the database
    const updatedLink = await prisma.link.update({
      where: { id: id, deletedAt: null },
      data: {
        isArchived: isArchived,
      },
      include: {
        views: {
          orderBy: {
            viewedAt: "desc",
          },
        },
        _count: {
          select: { views: true },
        },
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                description: true,
                color: true,
              },
            },
          },
        },
      },
    });
    if (!updatedLink) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const { tags, ...rest } = updatedLink;
    const linkTags = tags.map((t) => t.tag);

    await fetch(
      `${process.env.NEXTAUTH_URL}/api/revalidate?secret=${process.env.REVALIDATE_TOKEN}&linkId=${id}&hasDomain=${updatedLink.domainId ? "true" : "false"}`,
    );

    return NextResponse.json({ ...rest, tags: linkTags });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
