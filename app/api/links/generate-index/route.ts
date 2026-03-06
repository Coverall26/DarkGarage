export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { ItemType } from "@prisma/client";

import { generateDataroomIndex } from "@/lib/dataroom/index-generator";
import { reportError } from "@/lib/error";
import { getFeatureFlags } from "@/lib/featureFlags";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { LinkWithDataroom } from "@/lib/types";
import { IndexFileFormat } from "@/lib/types/index-file";

export async function POST(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const {
    format = "excel",
    linkId,
    viewId,
    dataroomId,
    viewerId,
  } = (await req.json()) as {
    format: IndexFileFormat;
    linkId: string;
    viewId: string;
    dataroomId: string;
    viewerId: string;
  };

  try {
    const view = await prisma.view.findUnique({
      where: {
        id: viewId,
        linkId: linkId,
      },
      select: {
        id: true,
        linkId: true,
        dataroomId: true,
        viewerId: true,
        link: {
          select: {
            id: true,
            dataroomId: true,
            linkType: true,
            url: true,
            name: true,
            slug: true,
            expiresAt: true,
            createdAt: true,
            updatedAt: true,
            teamId: true,
            isArchived: true,
            deletedAt: true,
            domainId: true,
            domainSlug: true,
            groupId: true,
            permissionGroupId: true,
            enableIndexFile: true,
            dataroom: {
              select: {
                id: true,
                name: true,
                teamId: true,
                documents: {
                  include: {
                    document: {
                      include: {
                        versions: { where: { isPrimary: true } },
                      },
                    },
                  },
                },
                folders: true,
                updatedAt: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (
      !view ||
      !view.link ||
      view.dataroomId !== dataroomId ||
      view.viewerId !== viewerId
    ) {
      return NextResponse.json({ error: "View not found" }, { status: 404 });
    }

    const link = view.link;

    if (!link || !link.dataroom || link.dataroom.id !== dataroomId) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (!link.enableIndexFile) {
      return NextResponse.json(
        { error: "Index file is not enabled for this link" },
        { status: 404 },
      );
    }

    // check if link is expired or archived
    if (link.expiresAt && link.expiresAt < new Date()) {
      return NextResponse.json({ error: "Link expired" }, { status: 404 });
    }

    if (link.isArchived) {
      return NextResponse.json({ error: "Link archived" }, { status: 404 });
    }

    if (link.deletedAt) {
      return NextResponse.json({ error: "Link deleted" }, { status: 404 });
    }

    // Check if the link is a group link and remove the folder/documents from the dataroom if not part of the group permissions
    if (link.groupId) {
      const groupAccessControls =
        await prisma.viewerGroupAccessControls.findMany({
          where: {
            groupId: link.groupId,
            OR: [{ canView: true }, { canDownload: true }],
          },
          select: {
            itemId: true,
            itemType: true,
          },
        });

      const allowedDocuments = groupAccessControls
        .filter((control) => control.itemType === ItemType.DATAROOM_DOCUMENT)
        .map((control) => control.itemId);
      const allowedFolders = groupAccessControls
        .filter((control) => control.itemType === ItemType.DATAROOM_FOLDER)
        .map((control) => control.itemId);

      link.dataroom.documents = link.dataroom.documents.filter((doc) =>
        allowedDocuments.includes(doc.id),
      );
      link.dataroom.folders = link.dataroom.folders.filter((folder) =>
        allowedFolders.includes(folder.id),
      );
    }

    // Check if the link has permission group restrictions and filter accordingly
    if (link.permissionGroupId) {
      const permissionGroupAccessControls =
        await prisma.permissionGroupAccessControls.findMany({
          where: {
            groupId: link.permissionGroupId,
            OR: [{ canView: true }, { canDownload: true }],
          },
          select: {
            itemId: true,
            itemType: true,
          },
        });

      const allowedDocuments = permissionGroupAccessControls
        .filter((control) => control.itemType === ItemType.DATAROOM_DOCUMENT)
        .map((control) => control.itemId);
      const allowedFolders = permissionGroupAccessControls
        .filter((control) => control.itemType === ItemType.DATAROOM_FOLDER)
        .map((control) => control.itemId);

      link.dataroom.documents = link.dataroom.documents.filter((doc) =>
        allowedDocuments.includes(doc.id),
      );
      link.dataroom.folders = link.dataroom.folders.filter((folder) =>
        allowedFolders.includes(folder.id),
      );
    }

    // Map updatedAt to lastUpdatedAt for the dataroom and transform document versions
    // Prisma select returns a subset of Link fields; assertion is safe because
    // generateDataroomIndex only accesses dataroom, id, domainId, domainSlug, and slug
    const linkWithDataroom = {
      ...link,
      dataroom: {
        ...link.dataroom,
        createdAt: link.dataroom.createdAt,
        lastUpdatedAt: link.dataroom.updatedAt,
        documents: link.dataroom.documents.map((doc) => ({
          id: doc.id,
          folderId: doc.folderId,
          orderIndex: doc.orderIndex,
          updatedAt: doc.updatedAt,
          createdAt: doc.createdAt,
          hierarchicalIndex: doc.hierarchicalIndex,
          document: {
            id: doc.document.id,
            name: doc.document.name,
            versions: doc.document.versions.map((version) => ({
              id: version.id,
              versionNumber: version.versionNumber,
              type: version.contentType || "unknown",
              hasPages: version.hasPages,
              file: version.file,
              isVertical: version.isVertical,
              numPages: version.numPages,
              updatedAt: version.updatedAt,
              fileSize:
                typeof version.fileSize === "bigint"
                  ? Number(version.fileSize)
                  : version.fileSize,
            })),
          },
        })),
      },
    } as unknown as LinkWithDataroom;

    const { dataroomIndex } = await getFeatureFlags({
      teamId: link.dataroom.teamId,
    });

    // Generate the index file using the appropriate generator
    const { data, filename, mimeType } = await generateDataroomIndex(
      linkWithDataroom,
      {
        format,
        baseUrl: link.domainId
          ? `${link.domainSlug}/${link.slug}`
          : `${process.env.NEXT_PUBLIC_MARKETING_URL}/view/${link.id}`,
        showHierarchicalIndex: dataroomIndex,
      },
    );

    // Return the file as a binary response
    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", mimeType);
    responseHeaders.set(
      "Content-Disposition",
      `attachment; filename=${filename}`,
    );

    return new NextResponse(data as BodyInit, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
