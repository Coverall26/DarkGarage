import { NextRequest, NextResponse } from "next/server";

import { Brand, DataroomBrand, LinkAudienceType } from "@prisma/client";
import { getServerSession } from "next-auth/next";

import {
  fetchDataroomLinkData,
  fetchDocumentLinkData,
} from "@/lib/api/links/link-data";
import prisma from "@/lib/prisma";
import { CustomUser, WatermarkConfigSchema } from "@/lib/types";
import {
  decryptEncrpytedPassword,
  generateEncrpytedPassword,
} from "@/lib/utils";
import { checkGlobalBlockList } from "@/lib/utils/global-block-list";
import { authOptions } from "@/lib/auth/auth-options";
import { reportError } from "@/lib/error";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const { id } = await params;

  try {
    const link = await prisma.link.findUnique({
      where: { id },
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
        enableIndexFile: true,
        enableCustomMetatag: true,
        metaTitle: true,
        metaDescription: true,
        metaImage: true,
        metaFavicon: true,
        welcomeMessage: true,
        enableQuestion: true,
        linkType: true,
        feedback: {
          select: { id: true, data: true },
        },
        enableAgreement: true,
        agreement: true,
        enableSignSuiteNda: true,
        signSuiteNdaDocumentId: true,
        showBanner: true,
        enableWatermark: true,
        watermarkConfig: true,
        groupId: true,
        permissionGroupId: true,
        audienceType: true,
        dataroomId: true,
        teamId: true,
        team: {
          select: { plan: true, globalBlockList: true },
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
          orderBy: { orderIndex: "asc" },
        },
        enableAccreditation: true,
        accreditationType: true,
        accreditationMessage: true,
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

    const linkType = link.linkType;

    // Handle workflow links separately
    if (linkType === "WORKFLOW_LINK") {
      let brand: Partial<Brand> | null = null;
      if (link.teamId) {
        brand = await prisma.brand.findUnique({
          where: { teamId: link.teamId },
          select: { logo: true, brandColor: true, accentColor: true },
        });
      }
      return NextResponse.json({ linkType, brand });
    }

    let brand: Partial<Brand> | Partial<DataroomBrand> | null = null;
    let linkData: Record<string, unknown> = {};

    if (linkType === "DOCUMENT_LINK") {
      const data = await fetchDocumentLinkData({
        linkId: id,
        teamId: link.teamId!,
      });
      linkData = data.linkData;
      brand = data.brand;
    } else if (linkType === "DATAROOM_LINK") {
      const data = await fetchDataroomLinkData({
        linkId: id,
        dataroomId: link.dataroomId,
        teamId: link.teamId!,
        permissionGroupId: link.permissionGroupId || undefined,
        ...(link.audienceType === LinkAudienceType.GROUP &&
          link.groupId && { groupId: link.groupId }),
      });
      linkData = data.linkData;
      brand = data.brand;
      linkData.accessControls = data.accessControls;
    }

    const teamPlan = link.team?.plan || "free";

    const returnLink = {
      ...link,
      ...linkData,
      dataroomId: undefined,
      ...(teamPlan === "free" && {
        customFields: [],
        enableAgreement: false,
        enableWatermark: false,
        permissionGroupId: null,
      }),
    };

    return NextResponse.json({ linkType, link: returnLink, brand });
  } catch (error) {
    return errorResponse(error);
  }
}

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

  const userId = (session.user as CustomUser).id;
  const { id } = await params;

  try {
    const body = await req.json();
    const {
      targetId,
      linkType,
      password,
      expiresAt,
      teamId,
      ...linkDomainData
    } = body;

    const dataroomLink = linkType === "DATAROOM_LINK";
    const documentLink = linkType === "DOCUMENT_LINK";

    // Verify link exists and user has access
    const existingLink = await prisma.link.findUnique({
      where: {
        id,
        teamId,
        team: { users: { some: { userId } } },
      },
    });

    if (!existingLink) {
      return NextResponse.json(
        { error: "Link not found or unauthorized" },
        { status: 404 },
      );
    }

    const hashedPassword =
      password && password.length > 0
        ? await generateEncrpytedPassword(password)
        : null;
    const exat = expiresAt ? new Date(expiresAt) : null;

    let { domain, slug, ...linkData } = linkDomainData;

    // Strip domain/slug if user passes the platform domain itself
    const platformDomain =
      process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "fundroom.ai";
    if (
      domain &&
      (domain === platformDomain || domain === `www.${platformDomain}`)
    ) {
      domain = null;
      slug = null;
    }

    let domainObj: { id: string; slug: string } | null = null;

    if (domain && slug) {
      domainObj = await prisma.domain.findUnique({
        where: { slug: domain },
      });

      if (!domainObj) {
        return NextResponse.json(
          { error: "Domain not found." },
          { status: 400 },
        );
      }

      const currentLink = await prisma.link.findUnique({
        where: { id },
        select: { id: true, domainSlug: true, slug: true },
      });

      if (currentLink?.slug !== slug || currentLink?.domainSlug !== domain) {
        const duplicateLink = await prisma.link.findUnique({
          where: {
            domainSlug_slug: { slug, domainSlug: domain },
          },
        });

        if (duplicateLink) {
          return NextResponse.json(
            { error: "The link already exists." },
            { status: 400 },
          );
        }
      }
    }

    if (linkData.enableAgreement && !linkData.agreementId) {
      return NextResponse.json(
        { error: "No agreement selected." },
        { status: 400 },
      );
    }

    if (linkData.enableWatermark) {
      if (!linkData.watermarkConfig) {
        return NextResponse.json(
          {
            error:
              "Watermark configuration is required when watermark is enabled.",
          },
          { status: 400 },
        );
      }

      const validation = WatermarkConfigSchema.safeParse(
        linkData.watermarkConfig,
      );
      if (!validation.success) {
        return NextResponse.json(
          { error: "Invalid watermark configuration." },
          { status: 400 },
        );
      }
    }

    const normalizedAllowList =
      linkData.allowList?.map((email: string) =>
        email.trim().toLowerCase(),
      ) ?? null;
    const normalizedDenyList =
      linkData.denyList?.map((email: string) =>
        email.trim().toLowerCase(),
      ) ?? null;

    const updatedLink = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const link = await tx.link.update({
        where: { id, teamId },
        data: {
          documentId: documentLink ? targetId : null,
          dataroomId: dataroomLink ? targetId : null,
          password: hashedPassword,
          name: linkData.name || null,
          emailProtected:
            linkData.audienceType === LinkAudienceType.GROUP
              ? true
              : linkData.emailProtected,
          emailAuthenticated: linkData.emailAuthenticated,
          allowDownload: linkData.allowDownload,
          allowList: normalizedAllowList,
          denyList: normalizedDenyList,
          expiresAt: exat,
          domainId: domainObj?.id || null,
          domainSlug: domain || null,
          slug: slug || null,
          enableIndexFile: linkData.enableIndexFile || false,
          enableNotification: linkData.enableNotification,
          enableFeedback: linkData.enableFeedback,
          enableScreenshotProtection: linkData.enableScreenshotProtection,
          enableCustomMetatag: linkData.enableCustomMetatag,
          metaTitle: linkData.metaTitle || null,
          metaDescription: linkData.metaDescription || null,
          metaImage: linkData.metaImage || null,
          metaFavicon: linkData.metaFavicon || null,
          welcomeMessage: linkData.welcomeMessage || null,
          ...(linkData.customFields && {
            customFields: {
              deleteMany: {},
              createMany: {
                data: linkData.customFields.map(
                  (field: { type: string; identifier: string; label: string; placeholder?: string; required?: boolean; disabled?: boolean }, index: number) => ({
                    type: field.type,
                    identifier: field.identifier,
                    label: field.label,
                    placeholder: field.placeholder,
                    required: field.required,
                    disabled: field.disabled,
                    orderIndex: index,
                  }),
                ),
                skipDuplicates: true,
              },
            },
          }),
          enableQuestion: linkData.enableQuestion,
          ...(linkData.enableQuestion && {
            feedback: {
              upsert: {
                create: {
                  data: {
                    question: linkData.questionText,
                    type: linkData.questionType,
                  },
                },
                update: {
                  data: {
                    question: linkData.questionText,
                    type: linkData.questionType,
                  },
                },
              },
            },
          }),
          enableAgreement: linkData.enableAgreement,
          agreementId: linkData.agreementId || null,
          enableSignSuiteNda: linkData.enableSignSuiteNda || false,
          signSuiteNdaDocumentId: linkData.signSuiteNdaDocumentId || null,
          showBanner: linkData.showBanner,
          enableWatermark: linkData.enableWatermark || false,
          watermarkConfig: linkData.watermarkConfig || null,
          groupId: linkData.groupId || null,
          permissionGroupId: linkData.permissionGroupId || null,
          audienceType: linkData.audienceType || LinkAudienceType.GENERAL,
          enableConversation: linkData.enableConversation || false,
          enableAIAgents: linkData.enableAIAgents || false,
          enableUpload: linkData.enableUpload || false,
          isFileRequestOnly: linkData.isFileRequestOnly || false,
          uploadFolderId: linkData.uploadFolderId || null,
        },
        include: {
          customFields: true,
          views: { orderBy: { viewedAt: "desc" } },
          _count: { select: { views: true } },
        },
      });

      if (linkData.tags?.length) {
        await tx.tagItem.deleteMany({
          where: {
            linkId: id,
            itemType: "LINK_TAG",
            tagId: { notIn: linkData.tags },
          },
        });

        await tx.tagItem.createMany({
          data: linkData.tags.map((tagId: string) => ({
            tagId,
            itemType: "LINK_TAG",
            linkId: id,
            taggedBy: userId,
          })),
          skipDuplicates: true,
        });
      } else {
        await tx.tagItem.deleteMany({
          where: { linkId: id, itemType: "LINK_TAG" },
        });
      }

      const tags = await tx.tag.findMany({
        where: { items: { some: { linkId: link.id } } },
        select: { id: true, name: true, color: true, description: true },
      });

      return { ...link, tags };
    });

    if (!updatedLink) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    // Trigger revalidation
    fetch(
      `${process.env.NEXTAUTH_URL}/api/revalidate?secret=${process.env.REVALIDATE_TOKEN}&linkId=${id}&hasDomain=${updatedLink.domainId ? "true" : "false"}`,
    ).catch((e) => reportError(e as Error));

    // Decrypt the password for the updated link
    if (updatedLink.password !== null) {
      updatedLink.password = decryptEncrpytedPassword(updatedLink.password);
    }

    return NextResponse.json(updatedLink);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as CustomUser).id;
  const { id } = await params;

  try {
    const linkToBeDeleted = await prisma.link.findUnique({
      where: { id },
      include: {
        document: { select: { ownerId: true } },
        dataroom: { select: { teamId: true } },
        team: {
          select: {
            plan: true,
            users: {
              where: { userId },
              select: { userId: true, role: true },
            },
          },
        },
      },
    });

    if (!linkToBeDeleted) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    let isAuthorized = false;

    if (linkToBeDeleted.documentId && linkToBeDeleted.document) {
      isAuthorized = linkToBeDeleted.document.ownerId === userId;
    } else if (linkToBeDeleted.dataroomId && linkToBeDeleted.team) {
      isAuthorized = linkToBeDeleted.team.users.length > 0;
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized to delete this link" },
        { status: 401 },
      );
    }

    // Soft delete
    await prisma.link.update({
      where: { id },
      data: { deletedAt: new Date(), isArchived: true },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
