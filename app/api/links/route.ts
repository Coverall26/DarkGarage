import { NextRequest, NextResponse } from "next/server";

import { LinkAudienceType, Tag } from "@prisma/client";
import { waitUntil } from "@vercel/functions";
import { getServerSession } from "next-auth/next";

import prisma from "@/lib/prisma";
import { CustomUser, WatermarkConfigSchema } from "@/lib/types";
import {
  decryptEncrpytedPassword,
  generateEncrpytedPassword,
} from "@/lib/utils";
import { sendLinkCreatedWebhook } from "@/lib/webhook/triggers/link-created";
import { authOptions } from "@/lib/auth/auth-options";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as CustomUser).id;

  try {
    const body = await req.json();
    const {
      targetId,
      linkType,
      password,
      expiresAt,
      teamId,
      enableIndexFile,
      ...linkDomainData
    } = body;

    const dataroomLink = linkType === "DATAROOM_LINK";
    const documentLink = linkType === "DOCUMENT_LINK";

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
        users: {
          some: { userId },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found." }, { status: 400 });
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

      const existingLink = await prisma.link.findUnique({
        where: {
          domainSlug_slug: {
            slug: slug,
            domainSlug: domain,
          },
        },
      });

      if (existingLink) {
        return NextResponse.json(
          { error: "The link already exists." },
          { status: 400 },
        );
      }
    }

    if (linkData.enableAgreement && !linkData.agreementId) {
      return NextResponse.json(
        { error: "No agreement selected." },
        { status: 400 },
      );
    }

    if (
      linkData.audienceType === LinkAudienceType.GROUP &&
      !linkData.groupId
    ) {
      return NextResponse.json(
        { error: "No group selected." },
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
      const link = await tx.link.create({
        data: {
          documentId: documentLink ? targetId : null,
          dataroomId: dataroomLink ? targetId : null,
          linkType,
          teamId,
          password: hashedPassword,
          name: linkData.name || null,
          emailProtected:
            linkData.audienceType === LinkAudienceType.GROUP
              ? true
              : linkData.emailProtected,
          emailAuthenticated: linkData.emailAuthenticated,
          expiresAt: exat,
          allowDownload: linkData.allowDownload,
          domainId: domainObj?.id || null,
          domainSlug: domain || null,
          slug: slug || null,
          enableIndexFile: enableIndexFile,
          enableNotification: linkData.enableNotification,
          enableFeedback: linkData.enableFeedback,
          enableScreenshotProtection: linkData.enableScreenshotProtection,
          enableCustomMetatag: linkData.enableCustomMetatag,
          metaTitle: linkData.metaTitle || null,
          metaDescription: linkData.metaDescription || null,
          metaImage: linkData.metaImage || null,
          metaFavicon: linkData.metaFavicon || null,
          welcomeMessage: linkData.welcomeMessage || null,
          allowList: normalizedAllowList,
          denyList: normalizedDenyList,
          audienceType: linkData.audienceType,
          groupId:
            linkData.audienceType === LinkAudienceType.GROUP
              ? linkData.groupId
              : null,
          ...(linkData.enableQuestion && {
            enableQuestion: linkData.enableQuestion,
            feedback: {
              create: {
                data: {
                  question: linkData.questionText,
                  type: linkData.questionType,
                },
              },
            },
          }),
          ...(linkData.enableAgreement && {
            enableAgreement: linkData.enableAgreement,
            agreementId: linkData.agreementId,
          }),
          ...(linkData.enableSignSuiteNda && {
            enableSignSuiteNda: linkData.enableSignSuiteNda,
            signSuiteNdaDocumentId: linkData.signSuiteNdaDocumentId,
          }),
          ...(linkData.enableWatermark && {
            enableWatermark: linkData.enableWatermark,
            watermarkConfig: linkData.watermarkConfig,
          }),
          ...(linkData.enableUpload && {
            enableUpload: linkData.enableUpload,
            isFileRequestOnly: linkData.isFileRequestOnly,
            uploadFolderId: linkData.uploadFolderId,
          }),
          enableAIAgents: linkData.enableAIAgents || false,
          enableConversation: linkData.enableConversation || false,
          showBanner: linkData.showBanner,
          ...(linkData.customFields && {
            customFields: {
              createMany: {
                data: linkData.customFields.map(
                  (
                    field: {
                      type: string;
                      identifier: string;
                      label: string;
                      placeholder?: string;
                      required?: boolean;
                      disabled?: boolean;
                    },
                    index: number,
                  ) => ({
                    type: field.type,
                    identifier: field.identifier,
                    label: field.label,
                    placeholder: field.placeholder,
                    required: field.required,
                    disabled: field.disabled,
                    orderIndex: index,
                  }),
                ),
              },
            },
          }),
        },
        include: {
          customFields: true,
        },
      });

      let tags: Partial<Tag>[] = [];
      if (linkData.tags?.length) {
        await tx.tagItem.createMany({
          data: linkData.tags.map((tagId: string) => ({
            tagId,
            itemType: "LINK_TAG",
            linkId: link.id,
            taggedBy: userId,
          })),
          skipDuplicates: true,
        });

        tags = await tx.tag.findMany({
          where: { id: { in: linkData.tags } },
          select: { id: true, name: true, color: true, description: true },
        });
      }

      return { ...link, tags };
    });

    const linkWithView = {
      ...updatedLink,
      _count: { views: 0 },
      views: [],
    };

    waitUntil(
      sendLinkCreatedWebhook({
        teamId,
        data: {
          link_id: linkWithView.id,
          document_id: linkWithView.documentId,
          dataroom_id: linkWithView.dataroomId,
        },
      }),
    );

    // Decrypt the password for the new link
    if (linkWithView.password !== null) {
      linkWithView.password = decryptEncrpytedPassword(linkWithView.password);
    }

    return NextResponse.json(linkWithView);
  } catch (error) {
    return errorResponse(error);
  }
}
