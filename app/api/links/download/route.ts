import { NextRequest, NextResponse } from "next/server";

import { LinkType } from "@prisma/client";

import { getFile } from "@/lib/files/get-file";
import prisma from "@/lib/prisma";
import { getFileNameWithPdfExtension } from "@/lib/utils";
import { reportError } from "@/lib/error";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const body = await req.json();
    const { linkId, viewId } = body as { linkId: string; viewId: string };

    const view = await prisma.view.findUnique({
      where: {
        id: viewId,
        linkId: linkId,
      },
      select: {
        id: true,
        viewedAt: true,
        viewerEmail: true,
        link: {
          select: {
            linkType: true,
            allowDownload: true,
            expiresAt: true,
            isArchived: true,
            deletedAt: true,
            enableWatermark: true,
            watermarkConfig: true,
            name: true,
          },
        },
        document: {
          select: {
            id: true,
            teamId: true,
            downloadOnly: true,
            name: true,
            versions: {
              where: { isPrimary: true },
              select: {
                type: true,
                file: true,
                storageType: true,
                numPages: true,
                originalFile: true,
                contentType: true,
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!view) {
      return NextResponse.json({ error: "Error downloading" }, { status: 404 });
    }

    if (!view.document?.downloadOnly && !view.link.allowDownload) {
      return NextResponse.json({ error: "Error downloading" }, { status: 403 });
    }

    if (view.link.isArchived) {
      return NextResponse.json({ error: "Error downloading" }, { status: 403 });
    }

    if (view.link.deletedAt) {
      return NextResponse.json({ error: "Error downloading" }, { status: 403 });
    }

    if (view.link.expiresAt && view.link.expiresAt < new Date()) {
      return NextResponse.json({ error: "Error downloading" }, { status: 403 });
    }

    if (view.document!.versions[0].type === "notion") {
      return NextResponse.json({ error: "Error downloading" }, { status: 403 });
    }

    // Time-based access control
    if (
      (view.link.linkType === LinkType.DOCUMENT_LINK &&
        view.viewedAt < new Date(Date.now() - 30 * 60 * 1000)) ||
      (view.link.linkType === LinkType.DATAROOM_LINK &&
        view.viewedAt < new Date(Date.now() - 23 * 60 * 60 * 1000))
    ) {
      return NextResponse.json({ error: "Error downloading" }, { status: 403 });
    }

    // Update the view with the downloadedAt timestamp
    await prisma.view.update({
      where: { id: viewId },
      data: { downloadedAt: new Date() },
    });

    // Determine which file to download
    const file =
      view.link.enableWatermark &&
      view.link.watermarkConfig &&
      view.document!.versions[0].type === "pdf"
        ? view.document!.versions[0].file
        : (view.document!.versions[0].originalFile ??
            view.document!.versions[0].file);

    const downloadUrl = await getFile({
      type: view.document!.versions[0].storageType,
      data: file,
      isDownload: true,
    });

    // If watermarking is enabled for PDF, fetch watermarked version
    if (
      view.document!.versions[0].type === "pdf" &&
      view.link.enableWatermark &&
      view.link.watermarkConfig
    ) {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown";

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
            numPages: view.document!.versions[0].numPages,
            watermarkConfig: view.link.watermarkConfig,
            originalFileName: view.document!.name,
            viewerData: {
              email: view.viewerEmail,
              date: new Date(
                view.viewedAt ? view.viewedAt : new Date(),
              ).toLocaleDateString(),
              ipAddress: ip,
              link: view.link.name,
              time: new Date(
                view.viewedAt ? view.viewedAt : new Date(),
              ).toLocaleTimeString(),
            },
          }),
        },
      );

      if (!response.ok) {
        reportError(new Error(`Watermarking API returned status ${response.status}`));
        return NextResponse.json(
          { error: "Internal server error" },
          { status: 500 },
        );
      }

      const pdfBuffer = await response.arrayBuffer();

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(getFileNameWithPdfExtension(view.document!.name))}"`,
          "Content-Length": String(pdfBuffer.byteLength),
        },
      });
    }

    return NextResponse.json({ downloadUrl });
  } catch (error) {
    return errorResponse(error);
  }
}
