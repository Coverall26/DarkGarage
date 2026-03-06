export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { AnnotationImage, DocumentAnnotation } from "@prisma/client";

import { reportError } from "@/lib/error";
import { getFeatureFlags } from "@/lib/featureFlags";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { log } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const { id: linkId } = await params;
  const viewId = req.nextUrl.searchParams.get("viewId") || "";

  try {
    const view = await prisma.view.findUnique({
      where: { id: viewId, linkId: linkId },
      include: {
        link: true,
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

    if (!view) {
      return NextResponse.json(
        { error: "Annotation not found" },
        { status: 404 },
      );
    }

    if (view.link.deletedAt) {
      return NextResponse.json({ error: "Link deleted" }, { status: 404 });
    }

    if (view.viewedAt < new Date(Date.now() - 1000 * 60 * 60 * 23)) {
      // if view is older than 23 hours, we should not allow the annotations to be accessed
      return NextResponse.json(
        { error: "Annotation not found" },
        { status: 404 },
      );
    }

    // Check if annotations feature is enabled for this team
    const featureFlags = await getFeatureFlags({
      teamId: view.teamId || undefined,
    });
    if (!featureFlags.annotations) {
      return NextResponse.json([]); // Return empty array if feature is disabled
    }

    // This endpoint only handles DOCUMENT_LINK types
    // For DATAROOM_LINK types, use /api/links/[id]/documents/[documentId]/annotations
    let annotations: (DocumentAnnotation & { images: AnnotationImage[] })[] =
      [];
    if (view.link.linkType === "DOCUMENT_LINK" && view.document) {
      annotations = view.document.annotations || [];
    } else if (view.link.linkType === "DATAROOM_LINK") {
      // For dataroom links, return empty array - they should use the specific document endpoint
      annotations = [];
    }

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
      message: `Failed to get annotations for link: _${linkId}_. \n\n ${error}`,
      type: "error",
    });
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
