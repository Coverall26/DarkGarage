export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { DataroomBrand, LinkAudienceType } from "@prisma/client";

import { fetchDataroomDocumentLinkData } from "@/lib/api/links/link-data";
import { reportError } from "@/lib/error";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { checkGlobalBlockList } from "@/lib/utils/global-block-list";

export async function GET(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; documentId: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const { id, documentId: dataroomDocumentId } = await params;

  try {
    // First fetch the link and verify it's a dataroom link
    const link = await prisma.link.findUnique({
      where: { id, linkType: "DATAROOM_LINK" },
      select: {
        id: true,
        expiresAt: true,
        emailProtected: true,
        emailAuthenticated: true,
        allowDownload: true,
        enableFeedback: true,
        enableScreenshotProtection: true,
        password: true,
        isArchived: true,
        deletedAt: true,
        enableCustomMetatag: true,
        metaTitle: true,
        metaDescription: true,
        metaImage: true,
        metaFavicon: true,
        welcomeMessage: true,
        enableQuestion: true,
        linkType: true,
        feedback: {
          select: {
            id: true,
            data: true,
          },
        },
        enableAgreement: true,
        agreement: true,
        showBanner: true,
        enableWatermark: true,
        watermarkConfig: true,
        groupId: true,
        permissionGroupId: true,
        audienceType: true,
        dataroomId: true,
        teamId: true,
        team: {
          select: {
            plan: true,
            globalBlockList: true,
          },
        },
        customFields: {
          select: {
            id: true,
            type: true,
            identifier: true,
            label: true,
            placeholder: true,
            required: true,
            disabled: true,
            orderIndex: true,
          },
          orderBy: {
            orderIndex: "asc",
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

    if (link.isArchived) {
      return NextResponse.json(
        { error: "Link is archived" },
        { status: 404 },
      );
    }

    const email = req.nextUrl.searchParams.get("email") || undefined;
    const globalBlockCheck = checkGlobalBlockList(
      email,
      link.team?.globalBlockList,
    );
    if (globalBlockCheck.error) {
      return NextResponse.json(
        { error: globalBlockCheck.error },
        { status: 400 },
      );
    }
    if (globalBlockCheck.isBlocked) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    let brand: Partial<DataroomBrand> | null = null;
    let linkData: Record<string, unknown>;

    const data = await fetchDataroomDocumentLinkData({
      linkId: id,
      teamId: link.teamId!,
      dataroomDocumentId: dataroomDocumentId,
      permissionGroupId: link.permissionGroupId || undefined,
      ...(link.audienceType === LinkAudienceType.GROUP &&
        link.groupId && {
          groupId: link.groupId,
        }),
    });

    linkData = data.linkData;
    brand = data.brand;

    const teamPlan = link.team?.plan || "free";
    const linkType = link.linkType;

    const returnLink = {
      ...link,
      dataroomDocument: (linkData.dataroom as Record<string, unknown>)
        ?.documents
        ? (
            (linkData.dataroom as Record<string, unknown>)
              .documents as unknown[]
          )[0]
        : undefined,
      ...(teamPlan === "free" && {
        customFields: [], // reset custom fields for free plan
        enableAgreement: false,
        enableWatermark: false,
        permissionGroupId: null,
      }),
    };

    return NextResponse.json({ linkType, link: returnLink, brand });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
