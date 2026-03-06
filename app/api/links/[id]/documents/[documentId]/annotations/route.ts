export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { reportError } from "@/lib/error";
import { getFeatureFlags } from "@/lib/featureFlags";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { log } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; documentId: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const { id: linkId, documentId: dataroomDocumentId } = await params;
  const viewId = req.nextUrl.searchParams.get("viewId") || "";

  try {
    const view = await prisma.view.findUnique({
      where: { id: viewId, linkId: linkId },
      select: {
        id: true,
        viewedAt: true,
        link: {
          select: {
            id: true,
            linkType: true,
            teamId: true,
            documentId: true,
            dataroomId: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!view) {
      return NextResponse.json({ error: "View not found" }, { status: 404 });
    }

    if (view.link.deletedAt) {
      return NextResponse.json({ error: "Link deleted" }, { status: 404 });
    }

    // Check TTL - deny access for views older than 23 hours
    if (view.viewedAt < new Date(Date.now() - 23 * 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Check if annotations feature is enabled for this team
    const featureFlags = await getFeatureFlags({
      teamId: view.link.teamId || undefined,
    });
    if (!featureFlags.annotations) {
      return NextResponse.json([]); // Return empty array if feature is disabled
    }

    let document = null;

    if (view.link.linkType === "DOCUMENT_LINK") {
      // For document links, get the document directly
      document = await prisma.document.findUnique({
        where: { id: view.link.documentId! },
        include: {
          annotations: {
            where: {
              isVisible: true, // Only return visible annotations for viewers
            },
            include: {
              images: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });
    } else if (view.link.linkType === "DATAROOM_LINK") {
      // For dataroom links, get the specific dataroom document
      const dataroomDocument = await prisma.dataroomDocument.findFirst({
        where: {
          id: dataroomDocumentId,
          dataroomId: view.link.dataroomId!,
        },
        include: {
          document: {
            include: {
              annotations: {
                where: {
                  isVisible: true, // Only return visible annotations for viewers
                },
                include: {
                  images: true,
                },
                orderBy: {
                  createdAt: "desc",
                },
              },
            },
          },
        },
      });

      document = dataroomDocument?.document;
    }

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    const annotations = document.annotations || [];

    // Remove sensitive information (don't expose createdBy details to viewers)
    const sanitizedAnnotations = annotations.map((annotation) => ({
      id: annotation.id,
      title: annotation.title,
      content: annotation.content,
      pages: annotation.pages,
      images: annotation.images,
      createdAt: annotation.createdAt,
    }));

    return NextResponse.json(sanitizedAnnotations);
  } catch (error) {
    log({
      message: `Failed to get annotations for link: _${linkId}_ and document: _${dataroomDocumentId}_. \n\n ${error}`,
      type: "error",
    });
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
