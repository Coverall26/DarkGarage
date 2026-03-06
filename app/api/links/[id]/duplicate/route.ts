export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth/auth-options";
import { Prisma } from "@prisma/client";
import { waitUntil } from "@vercel/functions";
import { getServerSession } from "next-auth/next";

import { reportError } from "@/lib/error";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { CustomUser } from "@/lib/types";
import { sendLinkCreatedWebhook } from "@/lib/webhook/triggers/link-created";

export async function POST(
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
  const { teamId } = (await req.json()) as { teamId: string };
  const userId = (session.user as CustomUser).id;

  try {
    const teamAccess = await prisma.userTeam.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!teamAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const link = await prisma.link.findUnique({
      where: { id, teamId },
      include: {
        tags: {
          select: {
            tag: {
              select: {
                id: true,
              },
            },
          },
        },
        permissionGroup: {
          include: {
            accessControls: true,
          },
        },
      },
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (link.deletedAt) {
      return NextResponse.json(
        { error: "Link has been deleted" },
        { status: 404 },
      );
    }

    const { tags, permissionGroup, permissionGroupId, ...rest } = link;
    const linkTags = tags.map((t) => t.tag.id);

    const newLinkName = link.name
      ? link.name + " (Copy)"
      : `Link #${link.id.slice(-5)} (Copy)`;

    const newLink = await prisma.$transaction(async (tx) => {
      // Duplicate permission group if it exists
      let newPermissionGroupId: string | null = null;
      if (permissionGroup) {
        // Create the new permission group
        const newPermissionGroup = await tx.permissionGroup.create({
          data: {
            name: permissionGroup.name + " (Copy)",
            description: permissionGroup.description,
            dataroomId: permissionGroup.dataroomId,
            teamId: permissionGroup.teamId,
          },
        });

        // Duplicate all access controls
        if (permissionGroup.accessControls.length > 0) {
          await tx.permissionGroupAccessControls.createMany({
            data: permissionGroup.accessControls.map((control) => ({
              groupId: newPermissionGroup.id,
              itemId: control.itemId,
              itemType: control.itemType,
              canView: control.canView,
              canDownload: control.canDownload,
              canDownloadOriginal: control.canDownloadOriginal,
            })),
          });
        }

        newPermissionGroupId = newPermissionGroup.id;
      }

      const createdLink = await tx.link.create({
        data: {
          ...rest,
          id: undefined,
          slug: link.slug ? link.slug + "-copy" : null,
          name: newLinkName,
          watermarkConfig: link.watermarkConfig || Prisma.JsonNull,
          createdAt: undefined,
          updatedAt: undefined,
          permissionGroupId: newPermissionGroupId,
        },
      });

      if (linkTags?.length) {
        await tx.tagItem.createMany({
          data: linkTags.map((tagId: string) => ({
            tagId,
            itemType: "LINK_TAG",
            linkId: createdLink.id,
            taggedBy: (session.user as CustomUser).id,
          })),
          skipDuplicates: true,
        });
      }

      const resolvedTags = linkTags?.length
        ? await tx.tag.findMany({
            where: { id: { in: linkTags } },
            select: { id: true, name: true, color: true, description: true },
          })
        : [];

      return { ...createdLink, tags: resolvedTags };
    });

    const linkWithView = {
      ...newLink,
      _count: { views: 0 },
      views: [],
    };

    waitUntil(
      sendLinkCreatedWebhook({
        teamId,
        data: {
          link_id: newLink.id,
          document_id: newLink.documentId,
          dataroom_id: newLink.dataroomId,
        },
      }),
    );

    return NextResponse.json(linkWithView, { status: 201 });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
