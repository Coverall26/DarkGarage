export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { ItemType, ViewType } from "@prisma/client";

import { reportError } from "@/lib/error";
import { getFile } from "@/lib/files/get-file";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { getFileNameWithPdfExtension } from "@/lib/utils";
import { getIpAddress } from "@/lib/utils/ip";

export async function POST(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const { linkId, viewId, documentId } = (await req.json()) as {
    linkId: string;
    viewId: string;
    documentId: string;
  };

  try {
    const view = await prisma.view.findUnique({
      where: {
        id: viewId,
        linkId: linkId,
        viewType: { equals: ViewType.DATAROOM_VIEW },
      },
      select: {
        id: true,
        viewedAt: true,
        viewerEmail: true,
        viewerId: true,
        verified: true,
        link: {
          select: {
            allowDownload: true,
            expiresAt: true,
            isArchived: true,
            deletedAt: true,
            enableWatermark: true,
            watermarkConfig: true,
            name: true,
            permissionGroupId: true,
            teamId: true,
          },
        },
        groupId: true,
        dataroom: {
          select: {
            id: true,
            documents: {
              where: { document: { id: documentId } },
              select: {
                id: true,
                document: {
                  select: {
                    id: true,
                    name: true,
                    versions: {
                      where: { isPrimary: true },
                      select: {
                        id: true,
                        type: true,
                        file: true,
                        storageType: true,
                        originalFile: true,
                        numPages: true,
                        contentType: true,
                      },
                      take: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // if view does not exist, we should not allow the download
    if (!view) {
      return NextResponse.json({ error: "Error downloading" }, { status: 404 });
    }

    // if link does not allow download, we should not allow the download
    if (!view.link.allowDownload) {
      return NextResponse.json({ error: "Error downloading" }, { status: 403 });
    }

    // if link is archived, we should not allow the download
    if (view.link.isArchived) {
      return NextResponse.json({ error: "Error downloading" }, { status: 403 });
    }

    // if link is deleted, we should not allow the download
    if (view.link.deletedAt) {
      return NextResponse.json({ error: "Error downloading" }, { status: 403 });
    }

    // if link is expired, we should not allow the download
    if (view.link.expiresAt && view.link.expiresAt < new Date()) {
      return NextResponse.json({ error: "Error downloading" }, { status: 403 });
    }

    // if dataroom does not exist, we should not allow the download
    if (!view.dataroom) {
      return NextResponse.json({ error: "Error downloading" }, { status: 404 });
    }

    // if viewedAt is longer than 23 hours ago, we should not allow the download
    if (
      view.viewedAt &&
      view.viewedAt < new Date(Date.now() - 23 * 60 * 60 * 1000)
    ) {
      return NextResponse.json({ error: "Error downloading" }, { status: 403 });
    }

    let downloadDocuments = view.dataroom.documents;

    // Check permissions based on groupId (ViewerGroup) or permissionGroupId (PermissionGroup)
    const effectiveGroupId = view.groupId || view.link.permissionGroupId;

    if (effectiveGroupId) {
      let groupPermissions: {
        itemType: ItemType;
        itemId: string;
        canDownload: boolean;
      }[] = [];

      if (view.groupId) {
        groupPermissions = await prisma.viewerGroupAccessControls.findMany({
          where: { groupId: view.groupId, canDownload: true },
        });
      } else if (view.link.permissionGroupId) {
        groupPermissions =
          await prisma.permissionGroupAccessControls.findMany({
            where: {
              groupId: view.link.permissionGroupId,
              canDownload: true,
            },
          });
      }

      const permittedDocumentIds = groupPermissions
        .filter(
          (permission) => permission.itemType === ItemType.DATAROOM_DOCUMENT,
        )
        .map((permission) => permission.itemId);

      downloadDocuments = downloadDocuments.filter((doc) =>
        permittedDocumentIds.includes(doc.id),
      );
    }

    //creates new view for document
    await prisma.view.create({
      data: {
        viewType: "DOCUMENT_VIEW",
        documentId: documentId,
        linkId: linkId,
        dataroomId: view.dataroom.id,
        groupId: view.groupId,
        dataroomViewId: view.id,
        viewerEmail: view.viewerEmail,
        downloadedAt: new Date(),
        downloadType: "SINGLE",
        viewerId: view.viewerId,
        verified: view.verified,
      },
    });

    const file =
      view.link.enableWatermark &&
      downloadDocuments[0].document!.versions[0].type === "pdf"
        ? downloadDocuments[0].document!.versions[0].file
        : (downloadDocuments[0].document!.versions[0].originalFile ??
          downloadDocuments[0].document!.versions[0].file);

    const downloadUrl = await getFile({
      type: downloadDocuments[0].document!.versions[0].storageType,
      data: file,
      isDownload: true,
    });

    // Convert NextRequest headers to plain object for getIpAddress
    const headersObj: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    // For PDF files with watermark, always buffer and process
    if (
      downloadDocuments[0].document!.versions[0].type === "pdf" &&
      view.link.enableWatermark &&
      view.link.watermarkConfig
    ) {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/mupdf/annotate-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
          },
          body: JSON.stringify({
            url: downloadUrl,
            numPages: downloadDocuments[0].document!.versions[0].numPages,
            watermarkConfig: view.link.watermarkConfig,
            originalFileName: downloadDocuments[0].document!.name,
            viewerData: {
              email: view.viewerEmail,
              date: (view.viewedAt
                ? new Date(view.viewedAt)
                : new Date()
              ).toLocaleDateString(),
              ipAddress: getIpAddress(headersObj),
              link: view.link.name,
              time: (view.viewedAt
                ? new Date(view.viewedAt)
                : new Date()
              ).toLocaleTimeString(),
            },
          }),
        },
      );

      if (!response.ok) {
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }

      const pdfBuffer = await response.arrayBuffer();

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(getFileNameWithPdfExtension(downloadDocuments[0].document!.name))}"`,
          "Content-Length": String(pdfBuffer.byteLength),
        },
      });
    }

    // For non-watermarked PDFs, we need to buffer and set proper headers
    if (
      downloadDocuments[0].document!.versions[0].contentType ===
        "application/pdf" ||
      (downloadDocuments[0].document!.versions[0].contentType === null &&
        downloadDocuments[0].document!.versions[0].type === "pdf") ||
      downloadDocuments[0].document!.versions[0].contentType?.startsWith(
        "image/",
      )
    ) {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }

      const pdfBuffer = await response.arrayBuffer();

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(downloadDocuments[0].document!.name)}"`,
          "Content-Length": String(pdfBuffer.byteLength),
          "Cache-Control": "no-cache",
        },
      });
    }

    const headResponse = await fetch(downloadUrl, { method: "HEAD" });
    const contentType =
      downloadDocuments[0].document!.versions[0].contentType ||
      headResponse.headers.get("content-type") ||
      "application/octet-stream";
    const fileName = downloadDocuments[0].document!.name;

    // For all other files, return direct download URL
    return NextResponse.json({
      downloadUrl,
      fileName,
      contentType,
      isDirectDownload: true,
    });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
