export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { Brand, DataroomBrand, LinkAudienceType } from "@prisma/client";

import { fetchDataroomDocumentLinkData } from "@/lib/api/links/link-data";
import {
  fetchDataroomLinkData,
  fetchDocumentLinkData,
} from "@/lib/api/links/link-data";
import { reportError } from "@/lib/error";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { log } from "@/lib/utils";
import { checkGlobalBlockList } from "@/lib/utils/global-block-list";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ domainSlug: string[] }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const { domainSlug } = await params;

  const domain = domainSlug[0];
  const slug = domainSlug[1];
  const documentId = domainSlug[3];

  if (slug === "404") {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  try {
    const link = await prisma.link.findUnique({
      where: {
        domainSlug_slug: {
          slug: slug,
          domainSlug: domain,
        },
      },
      select: {
        id: true,
        expiresAt: true,
        emailProtected: true,
        allowDownload: true,
        password: true,
        isArchived: true,
        deletedAt: true,
        enableCustomMetatag: true,
        enableFeedback: true,
        enableScreenshotProtection: true,
        enableIndexFile: true,
        metaTitle: true,
        metaDescription: true,
        metaImage: true,
        metaFavicon: true,
        welcomeMessage: true,
        enableQuestion: true,
        dataroomId: true,
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

    // if link not found, return 404
    if (!link) {
      log({
        message: `Link not found for custom domain _${domain}/${slug}_`,
        type: "error",
        mention: true,
      });
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (link.isArchived) {
      return NextResponse.json(
        { error: "Link is archived" },
        { status: 404 },
      );
    }

    if (link.deletedAt) {
      return NextResponse.json(
        { error: "This link has been deleted" },
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

    const teamPlan = link.team?.plan || "free";
    const teamId = link.teamId;
    // if owner of document is on free plan, return 404
    if (teamPlan.includes("free")) {
      log({
        message: `Link is from a free team _${teamId}_ for custom domain _${domain}/${slug}_`,
        type: "info",
        mention: true,
      });
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const linkType = link.linkType;

    // Handle workflow links separately
    if (linkType === "WORKFLOW_LINK") {
      // For workflow links, fetch brand if available
      let brand: Partial<Brand> | null = null;
      if (link.teamId) {
        const teamBrand = await prisma.brand.findUnique({
          where: { teamId: link.teamId },
          select: {
            logo: true,
            brandColor: true,
            accentColor: true,
          },
        });
        brand = teamBrand;
      }

      return NextResponse.json({ linkType, brand, linkId: link.id });
    }

    let brand: Partial<Brand> | Partial<DataroomBrand> | null = null;
    let linkData: Record<string, unknown>;

    if (linkType === "DOCUMENT_LINK") {
      const data = await fetchDocumentLinkData({
        linkId: link.id,
        teamId: link.teamId!,
      });
      linkData = data.linkData;
      brand = data.brand;
    } else if (linkType === "DATAROOM_LINK") {
      if (documentId) {
        const data = await fetchDataroomDocumentLinkData({
          linkId: link.id,
          teamId: link.teamId!,
          dataroomDocumentId: documentId,
          permissionGroupId: link.permissionGroupId || undefined,
          ...(link.audienceType === LinkAudienceType.GROUP &&
            link.groupId && {
              groupId: link.groupId,
            }),
        });
        linkData = data.linkData;
        brand = data.brand;
      } else {
        const data = await fetchDataroomLinkData({
          linkId: link.id,
          dataroomId: link.dataroomId,
          teamId: link.teamId!,
          permissionGroupId: link.permissionGroupId || undefined,
          ...(link.audienceType === LinkAudienceType.GROUP &&
            link.groupId && {
              groupId: link.groupId,
            }),
        });
        linkData = data.linkData;
        brand = data.brand;
        // Include access controls in the link data for the frontend
        linkData.accessControls = data.accessControls;
      }
    } else {
      linkData = {};
    }

    // remove document and domain from link
    const sanitizedLink = {
      ...link,
      teamId: undefined,
      team: undefined,
      document: undefined,
      dataroom: undefined,
      ...(teamPlan === "free" && {
        customFields: [], // reset custom fields for free plan
        enableAgreement: false,
        enableWatermark: false,
        permissionGroupId: null,
      }),
    };

    // clean up the link return object
    const returnLink = {
      ...sanitizedLink,
      ...linkData,
      dataroomDocument:
        (linkData as Record<string, unknown>).dataroom &&
        ((linkData as Record<string, unknown>).dataroom as Record<string, unknown>)?.documents
          ? (
              ((linkData as Record<string, unknown>).dataroom as Record<string, unknown>)
                .documents as unknown[]
            )[0]
          : undefined,
    };

    return NextResponse.json({ linkType, link: returnLink, brand });
  } catch (error) {
    reportError(error as Error);
    log({
      message: `Cannot get link for custom domain _${domainSlug}_ \n\n${error}`,
      type: "error",
      mention: true,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
