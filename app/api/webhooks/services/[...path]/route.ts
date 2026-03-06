export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { LinkPreset } from "@prisma/client";
import slugify from "@sindresorhus/slugify";
import { put } from "@vercel/blob";
import { waitUntil } from "@vercel/functions";
import { z } from "zod";

import { hashToken } from "@/lib/api/auth/token";
import { createDocument } from "@/lib/documents/create-document";
import { putFileServer } from "@/lib/files/put-file-server";
import { newId } from "@/lib/id-helper";
import { extractTeamId, isValidWebhookId } from "@/lib/incoming-webhooks";
import prisma from "@/lib/prisma";
import { ratelimit } from "@/lib/redis";
import {
  convertDataUrlToBuffer,
  generateEncrpytedPassword,
  isDataUrl,
} from "@/lib/utils";
import {
  getExtensionFromContentType,
  getSupportedContentType,
} from "@/lib/utils/get-content-type";
import { sendLinkCreatedWebhook } from "@/lib/webhook/triggers/link-created";
import { webhookFileUrlSchema } from "@/lib/zod/url-validation";
import { reportError } from "@/lib/error";
import { logger } from "@/lib/logger";

// Define a common link schema to reuse
const LinkSchema = z.object({
  name: z.string().optional(),
  domain: z.string().optional(),
  slug: z.string().optional(),
  password: z.string().optional(),
  expiresAt: z.string().optional(), // ISO string date
  emailProtected: z.boolean().optional(),
  emailAuthenticated: z.boolean().optional(),
  allowDownload: z.boolean().optional(),
  enableNotification: z.boolean().optional(),
  enableFeedback: z.boolean().optional(),
  enableScreenshotProtection: z.boolean().optional(),
  showBanner: z.boolean().optional(),
  audienceType: z.enum(["GENERAL", "GROUP", "TEAM"]).optional(),
  groupId: z.string().optional(),
  allowList: z.array(z.string()).optional(),
  denyList: z.array(z.string()).optional(),
  presetId: z.string().optional(),
});

// Define validation schemas for different resource types
const BaseSchema = z.object({
  resourceType: z.enum(["document.create", "link.create", "dataroom.create"]),
});

const DocumentCreateSchema = BaseSchema.extend({
  resourceType: z.literal("document.create"),
  fileUrl: webhookFileUrlSchema,
  name: z.string(),
  contentType: z.string(),
  dataroomId: z.string().optional(),
  folderId: z.string().nullable().optional(),
  dataroomFolderId: z.string().nullable().optional(),
  createLink: z.boolean().optional().default(false),
  link: LinkSchema.optional(),
});

const LinkCreateSchema = BaseSchema.extend({
  resourceType: z.literal("link.create"),
  targetId: z.string(),
  linkType: z.enum(["DOCUMENT_LINK", "DATAROOM_LINK"]),
  link: LinkSchema,
});

// Schema for dataroom folder structure
const DataroomFolderSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    name: z.string(),
    subfolders: z.array(DataroomFolderSchema).optional(),
  }),
);

const DataroomCreateSchema = BaseSchema.extend({
  resourceType: z.literal("dataroom.create"),
  name: z.string(),
  description: z.string().optional(),
  folders: z.array(DataroomFolderSchema).optional(), // Create folders with hierarchy
  createLink: z.boolean().optional().default(false),
  link: LinkSchema.optional(),
});

const RequestBodySchema = z.discriminatedUnion("resourceType", [
  DocumentCreateSchema,
  LinkCreateSchema,
  DataroomCreateSchema,
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  // Get the full webhook ID from the path
  const { path } = await params;
  const webhookId = Array.isArray(path) ? path.join("/") : path;

  if (!webhookId || !isValidWebhookId(webhookId)) {
    return NextResponse.json(
      { error: "Invalid webhook format" },
      { status: 400 },
    );
  }

  // Check for API token
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 },
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const hashedToken = hashToken(token);

  // Look up token in database
  const restrictedToken = await prisma.restrictedToken.findUnique({
    where: { hashedKey: hashedToken },
    select: { teamId: true, rateLimit: true },
  });

  if (!restrictedToken) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Rate limit checks for API tokens
  const rateLimitValue = restrictedToken.rateLimit || 60; // Default rate limit of 60 requests per minute

  const { success, limit, reset, remaining } = await ratelimit(
    rateLimitValue,
    "1 m",
  ).limit(hashedToken);

  // Build rate limit headers
  const rateLimitHeaders = {
    "Retry-After": reset.toString(),
    "X-RateLimit-Limit": limit.toString(),
    "X-RateLimit-Remaining": remaining.toString(),
    "X-RateLimit-Reset": reset.toString(),
  };

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders },
    );
  }

  // Update last used timestamp for the token
  waitUntil(
    prisma.restrictedToken.update({
      where: {
        hashedKey: hashedToken,
      },
      data: {
        lastUsed: new Date(),
      },
    }),
  );

  const teamId = extractTeamId(webhookId);
  if (!teamId) {
    return NextResponse.json(
      { error: "Invalid team ID in webhook" },
      { status: 400, headers: rateLimitHeaders },
    );
  }

  if (restrictedToken.teamId !== teamId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: rateLimitHeaders },
    );
  }

  try {
    // 1. Find the webhook integration
    const incomingWebhook = await prisma.incomingWebhook.findUnique({
      where: {
        externalId: webhookId,
        teamId: teamId,
      },
      include: { team: true },
    });

    if (!incomingWebhook) {
      return NextResponse.json(
        { error: "Webhook not found" },
        { status: 404, headers: rateLimitHeaders },
      );
    }

    // Validate request body against the schema
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400, headers: rateLimitHeaders },
      );
    }

    const validationResult = RequestBodySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validationResult.error.format(),
        },
        { status: 400, headers: rateLimitHeaders },
      );
    }

    const validatedData = validationResult.data;

    // Handle different resource types
    if (validatedData.resourceType === "document.create") {
      return await handleDocumentCreate(
        validatedData,
        incomingWebhook.teamId,
        token,
        rateLimitHeaders,
      );
    } else if (validatedData.resourceType === "link.create") {
      return await handleLinkCreate(
        validatedData,
        incomingWebhook.teamId,
        token,
        rateLimitHeaders,
      );
    } else if (validatedData.resourceType === "dataroom.create") {
      return await handleDataroomCreate(
        validatedData,
        incomingWebhook.teamId,
        token,
        rateLimitHeaders,
      );
    }

    // This shouldn't be reached due to the validation schema, but just in case
    return NextResponse.json(
      { error: "Invalid resource type" },
      { status: 400, headers: rateLimitHeaders },
    );
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: rateLimitHeaders },
    );
  }
}

/**
 * Handle document.create resource type
 */
async function handleDocumentCreate(
  data: z.infer<typeof DocumentCreateSchema>,
  teamId: string,
  token: string,
  headers: Record<string, string>,
) {
  const {
    fileUrl,
    name,
    contentType,
    dataroomId,
    createLink,
    link,
    folderId,
    dataroomFolderId,
  } = data;

  // Check if the content type is supported
  const supportedContentType = getSupportedContentType(contentType);
  if (!supportedContentType) {
    return NextResponse.json(
      { error: "Unsupported content type" },
      { status: 400, headers },
    );
  }

  if (dataroomId) {
    // Verify dataroom exists and belongs to team
    const dataroom = await prisma.dataroom.findUnique({
      where: {
        id: dataroomId,
        teamId: teamId,
      },
    });

    if (!dataroom) {
      return NextResponse.json(
        { error: "Invalid dataroom ID" },
        { status: 400, headers },
      );
    }
  }

  // If custom domain and slug are provided, validate them
  if (createLink && link?.domain && link?.slug) {
    // Check if domain exists
    const domain = await prisma.domain.findUnique({
      where: {
        slug: link.domain,
        teamId: teamId,
      },
    });

    if (!domain) {
      return NextResponse.json(
        { error: "Domain not found or not associated with this team" },
        { status: 400, headers },
      );
    }

    // Check if the slug is already in use with this domain
    const existingLink = await prisma.link.findUnique({
      where: {
        domainSlug_slug: {
          slug: link.slug,
          domainSlug: link.domain,
        },
      },
    });

    if (existingLink) {
      return NextResponse.json(
        { error: "The link with this domain and slug already exists" },
        { status: 400, headers },
      );
    }
  }

  // 4. Fetch file from URL
  const response = await fetch(fileUrl);
  if (!response.ok) {
    return NextResponse.json(
      { error: "Failed to fetch file from URL" },
      { status: 400, headers },
    );
  }

  // 5. Validate response content type matches expected
  const responseContentType = response.headers.get("content-type");
  if (!responseContentType || responseContentType.startsWith("text/html")) {
    return NextResponse.json(
      { error: "Remote resource is not a supported file type" },
      { status: 400, headers },
    );
  }
  if (!responseContentType.startsWith(contentType)) {
    logger.warn(
      `Content type mismatch: expected ${contentType}, got ${responseContentType}`,
      { module: "webhooks-services" },
    );
    // Log but don't fail - some services return generic types
  }

  // 6. Convert to buffer
  const fileBuffer = Buffer.from(await response.arrayBuffer());

  // Ensure filename has proper extension, based on the actual response content-type when available
  let fileName = name?.trim();
  const actualContentType = (
    responseContentType?.split(";")[0] ?? contentType
  ).trim();
  const expectedExtension = getExtensionFromContentType(actualContentType);
  if (expectedExtension) {
    const lower = fileName.toLowerCase();
    const dotIdx = lower.lastIndexOf(".");
    const currentExt = dotIdx !== -1 ? lower.slice(dotIdx + 1) : null;
    // Minimal alias map to avoid double extensions (e.g., jpg vs jpeg)
    const alias: Record<string, string[]> = {
      jpeg: ["jpeg", "jpg"],
      jpg: ["jpg", "jpeg"],
      tiff: ["tiff", "tif"],
    };
    const matches =
      !!currentExt &&
      (currentExt === expectedExtension ||
        (alias[expectedExtension]?.includes(currentExt) ?? false));
    if (!matches) {
      fileName = `${fileName}.${expectedExtension}`;
    }
  }

  // 7. Upload the file to storage
  const { type: storageType, data: fileData } = await putFileServer({
    file: {
      name: fileName,
      type: contentType,
      buffer: fileBuffer,
    },
    teamId: teamId,
    restricted: false, // allows all supported file types
  });

  if (!fileData || !storageType) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers },
    );
  }

  // 8. Create document using our service
  // Note: The createDocument function doesn't accept linkData in its parameters
  // so we will just pass createLink flag
  const documentCreationResponse = await createDocument({
    documentData: {
      name: fileName,
      key: fileData,
      storageType: storageType,
      contentType: contentType,
      supportedFileType: supportedContentType,
      fileSize: fileBuffer.byteLength,
    },
    teamId: teamId,
    numPages: 1,
    token: token,
    createLink: createLink, // INFO: creatLink=true will not trigger a link.created webhook
  });

  if (!documentCreationResponse.ok) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers },
    );
  }

  const document = await documentCreationResponse.json();
  let newLink: Record<string, unknown> | undefined;

  // If the document is added to a folder, update the folderId
  if (folderId) {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId, teamId: teamId },
      select: {
        id: true,
      },
    });

    if (!folder) {
      return NextResponse.json(
        { error: "Invalid folder ID" },
        { status: 400, headers },
      );
    }

    await prisma.document.update({
      where: { id: document.id, teamId: teamId },
      data: {
        folderId: folder.id,
      },
    });
  }

  // If we need to customize the link, update it after creation
  if (createLink && document.links && document.links.length > 0 && link) {
    const linkId = document.links[0].id;

    // If preset is provided, validate it
    let preset: LinkPreset | null = null;
    let metaImage: string | null = null;
    let metaFavicon: string | null = null;
    if (link?.presetId) {
      preset = await prisma.linkPreset.findUnique({
        where: { pId: link.presetId, teamId: teamId },
      });

      if (!preset) {
        return NextResponse.json(
          {
            error: "Link preset not found or not associated with this team",
          },
          { status: 400, headers },
        );
      }

      // Handle image files for custom meta tag (if enabled)
      if (preset.enableCustomMetaTag) {
        // Process meta image if present
        if (preset.metaImage && isDataUrl(preset.metaImage)) {
          const { buffer, filename } = convertDataUrlToBuffer(
            preset.metaImage,
          );
          const blob = await put(filename, buffer, {
            access: "public",
            addRandomSuffix: true,
          });
          metaImage = blob.url;
        }

        // Process favicon if present
        if (preset.metaFavicon && isDataUrl(preset.metaFavicon)) {
          const { buffer, filename } = convertDataUrlToBuffer(
            preset.metaFavicon,
          );
          const blob = await put(filename, buffer, {
            access: "public",
            addRandomSuffix: true,
          });
          metaFavicon = blob.url;
        }
      }
    }

    // Process fields for link update
    const hashedPassword = link.password
      ? await generateEncrpytedPassword(link.password)
      : preset?.password
        ? await generateEncrpytedPassword(preset.password)
        : null;

    const expiresAtDate = link.expiresAt
      ? new Date(link.expiresAt)
      : preset?.expiresAt
        ? new Date(preset.expiresAt)
        : null;

    const isGroupAudience = link.audienceType === "GROUP";

    let domainId = null;
    if (link.domain) {
      const domain = await prisma.domain.findUnique({
        where: {
          slug: link.domain,
          teamId: teamId,
        },
        select: { id: true },
      });
      domainId = domain?.id || null;
    }

    // Update the link with custom settings
    newLink = await prisma.link.update({
      where: { id: linkId, teamId: teamId },
      data: {
        name: link.name,
        password: hashedPassword,
        expiresAt: expiresAtDate,
        domainId: domainId,
        domainSlug: link.domain || null,
        slug: link.slug || null,
        emailProtected: link.emailProtected || preset?.emailProtected || false,
        emailAuthenticated:
          link.emailAuthenticated || preset?.emailAuthenticated || false,
        allowDownload: link.allowDownload || preset?.allowDownload,
        enableNotification:
          link.enableNotification ?? preset?.enableNotification ?? false,
        enableFeedback: link.enableFeedback,
        enableScreenshotProtection: link.enableScreenshotProtection,
        showBanner: link.showBanner ?? preset?.showBanner ?? false,
        audienceType: link.audienceType,
        groupId: isGroupAudience ? link.groupId : null,
        // For group links, ignore allow/deny lists from presets as access is controlled by group membership
        allowList: isGroupAudience
          ? link.allowList
          : (link.allowList ?? preset?.allowList),
        denyList: isGroupAudience
          ? link.denyList
          : (link.denyList ?? preset?.denyList),
        ...(preset?.enableCustomMetaTag && {
          enableCustomMetatag: preset?.enableCustomMetaTag,
          metaTitle: preset?.metaTitle,
          metaDescription: preset?.metaDescription,
          metaImage: metaImage,
          metaFavicon: metaFavicon,
        }),
      },
    });

    waitUntil(
      sendLinkCreatedWebhook({
        teamId,
        data: {
          document_id: document.id,
          link_id: (newLink as Record<string, unknown>).id as string,
        },
      }),
    );
  }

  // If dataroomId was provided, create the relationship
  if (dataroomId) {
    // If dataroomFolderId is provided, validate it belongs to the dataroom
    if (dataroomFolderId) {
      const dataroomFolder = await prisma.dataroomFolder.findUnique({
        where: {
          id: dataroomFolderId,
          dataroomId: dataroomId,
        },
      });

      if (!dataroomFolder) {
        return NextResponse.json(
          {
            error:
              "Invalid dataroom folder ID or folder does not belong to the specified dataroom",
          },
          { status: 400, headers },
        );
      }
    }

    await prisma.dataroomDocument.create({
      data: {
        dataroomId,
        documentId: document.id,
        folderId: dataroomFolderId || null,
      },
    });
  }

  return NextResponse.json(
    {
      message: `Document created successfully${
        dataroomId ? ` and added to dataroom` : ""
      }`,
      documentId: document.id,
      dataroomId: dataroomId ?? undefined,
      linkId: (newLink as Record<string, unknown> | undefined)?.id ?? undefined,
      linkUrl: createLink
        ? (newLink as Record<string, unknown> | undefined)?.domainSlug &&
          (newLink as Record<string, unknown> | undefined)?.slug
          ? `https://${(newLink as Record<string, unknown>).domainSlug}/${(newLink as Record<string, unknown>).slug}`
          : `${process.env.NEXT_PUBLIC_MARKETING_URL}/view/${(newLink as Record<string, unknown> | undefined)?.id}`
        : undefined,
    },
    { status: 200, headers },
  );
}

/**
 * Handle link.create resource type
 */
async function handleLinkCreate(
  data: z.infer<typeof LinkCreateSchema>,
  teamId: string,
  _token: string,
  headers: Record<string, string>,
) {
  const { targetId, linkType, link } = data;

  // Validate target exists and belongs to the team
  if (linkType === "DOCUMENT_LINK") {
    const document = await prisma.document.findUnique({
      where: {
        id: targetId,
        teamId: teamId,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found or not associated with this team" },
        { status: 400, headers },
      );
    }
  } else if (linkType === "DATAROOM_LINK") {
    const dataroom = await prisma.dataroom.findUnique({
      where: {
        id: targetId,
        teamId: teamId,
      },
    });

    if (!dataroom) {
      return NextResponse.json(
        { error: "Dataroom not found or not associated with this team" },
        { status: 400, headers },
      );
    }
  }

  // If domain and slug are provided, validate them
  let domainId = null;
  if (link.domain && link.slug) {
    // Check if domain exists
    const domain = await prisma.domain.findUnique({
      where: {
        slug: link.domain,
        teamId: teamId,
      },
      select: { id: true },
    });

    if (!domain) {
      return NextResponse.json(
        { error: "Domain not found or not associated with this team" },
        { status: 400, headers },
      );
    }

    domainId = domain.id;

    // Check if the slug is already in use with this domain
    const existingLink = await prisma.link.findUnique({
      where: {
        domainSlug_slug: {
          slug: link.slug,
          domainSlug: link.domain,
        },
      },
    });

    if (existingLink) {
      return NextResponse.json(
        { error: "The link with this domain and slug already exists" },
        { status: 400, headers },
      );
    }
  }

  // If preset is provided, validate it
  let preset: LinkPreset | null = null;
  let metaImage: string | null = null;
  let metaFavicon: string | null = null;
  if (link.presetId) {
    preset = await prisma.linkPreset.findUnique({
      where: { pId: link.presetId, teamId: teamId },
    });

    if (!preset) {
      return NextResponse.json(
        {
          error: "Link preset not found or not associated with this team",
        },
        { status: 400, headers },
      );
    }

    // 4. Handle image files for custom meta tag (if enabled)
    if (preset.enableCustomMetaTag) {
      // Process meta image if present
      if (preset.metaImage && isDataUrl(preset.metaImage)) {
        const { buffer, filename } = convertDataUrlToBuffer(preset.metaImage);
        const blob = await put(filename, buffer, {
          access: "public",
          addRandomSuffix: true,
        });
        metaImage = blob.url;
      }

      // Process favicon if present
      if (preset.metaFavicon && isDataUrl(preset.metaFavicon)) {
        const { buffer, filename } = convertDataUrlToBuffer(
          preset.metaFavicon,
        );
        const blob = await put(filename, buffer, {
          access: "public",
          addRandomSuffix: true,
        });
        metaFavicon = blob.url;
      }
    }
  }

  // Create the link
  try {
    // Hash password if provided
    const hashedPassword = link.password
      ? await generateEncrpytedPassword(link.password)
      : preset?.password
        ? await generateEncrpytedPassword(preset.password)
        : null;

    const expiresAtDate = link.expiresAt
      ? new Date(link.expiresAt)
      : preset?.expiresAt
        ? new Date(preset.expiresAt)
        : null;

    const isGroupAudience = link.audienceType === "GROUP";

    const newLink = await prisma.link.create({
      data: {
        documentId: linkType === "DOCUMENT_LINK" ? targetId : null,
        dataroomId: linkType === "DATAROOM_LINK" ? targetId : null,
        linkType,
        teamId,
        name: link.name,
        password: hashedPassword,
        domainId: domainId,
        domainSlug: link.domain || null,
        slug: link.slug || null,
        expiresAt: expiresAtDate,
        emailProtected: link.emailProtected || preset?.emailProtected || false,
        emailAuthenticated:
          link.emailAuthenticated || preset?.emailAuthenticated || false,
        allowDownload: link.allowDownload || preset?.allowDownload,
        enableNotification:
          link.enableNotification ?? preset?.enableNotification ?? false,
        enableFeedback: link.enableFeedback,
        enableScreenshotProtection: link.enableScreenshotProtection,
        showBanner: link.showBanner ?? preset?.showBanner ?? false,
        audienceType: link.audienceType,
        groupId: isGroupAudience ? link.groupId : null,
        // For group links, ignore allow/deny lists from presets as access is controlled by group membership
        allowList: isGroupAudience
          ? link.allowList
          : link.allowList || preset?.allowList,
        denyList: isGroupAudience
          ? link.denyList
          : link.denyList || preset?.denyList,
        ...(preset?.enableCustomMetaTag && {
          enableCustomMetatag: preset?.enableCustomMetaTag,
          metaTitle: preset?.metaTitle,
          metaDescription: preset?.metaDescription,
          metaImage: metaImage,
          metaFavicon: metaFavicon,
        }),
      },
    });

    waitUntil(
      sendLinkCreatedWebhook({
        teamId,
        data: {
          document_id: linkType === "DOCUMENT_LINK" ? targetId : null,
          dataroom_id: linkType === "DATAROOM_LINK" ? targetId : null,
          link_id: newLink.id,
        },
      }),
    );

    return NextResponse.json(
      {
        message: "Link created successfully",
        linkId: newLink.id,
        targetId,
        linkType,
        linkUrl:
          domainId && link.domain && link.slug
            ? `https://${newLink.domainSlug}/${newLink.slug}`
            : `${process.env.NEXT_PUBLIC_MARKETING_URL}/view/${newLink.id}`,
      },
      { status: 200, headers },
    );
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers },
    );
  }
}

/**
 * Helper function to create dataroom folders recursively
 */
async function createDataroomFoldersRecursive(
  dataroomId: string,
  folders: Array<{ name: string; subfolders?: Array<{ name: string; subfolders?: unknown[] }> }>,
  parentPath: string = "",
  parentId: string | null = null,
): Promise<void> {
  for (const folder of folders) {
    const folderPath = parentPath + "/" + slugify(folder.name);

    // Create the folder
    const createdFolder = await prisma.dataroomFolder.create({
      data: {
        name: folder.name,
        path: folderPath,
        parentId: parentId,
        dataroomId: dataroomId,
      },
    });

    // If the folder has subfolders, create them recursively
    if (folder.subfolders && folder.subfolders.length > 0) {
      await createDataroomFoldersRecursive(
        dataroomId,
        folder.subfolders as Array<{ name: string; subfolders?: Array<{ name: string; subfolders?: unknown[] }> }>,
        folderPath,
        createdFolder.id,
      );
    }
  }
}

/**
 * Handle dataroom.create resource type
 */
async function handleDataroomCreate(
  data: z.infer<typeof DataroomCreateSchema>,
  teamId: string,
  _token: string,
  headers: Record<string, string>,
) {
  const { name, description, createLink, link, folders } = data;

  // If custom domain and slug are provided for link, validate them
  let domainId = null;
  if (createLink && link?.domain && link?.slug) {
    // Check if domain exists
    const domain = await prisma.domain.findUnique({
      where: {
        slug: link.domain,
        teamId: teamId,
      },
    });

    if (!domain) {
      return NextResponse.json(
        { error: "Domain not found or not associated with this team" },
        { status: 400, headers },
      );
    }

    domainId = domain.id;

    // Check if the slug is already in use with this domain
    const existingLink = await prisma.link.findUnique({
      where: {
        domainSlug_slug: {
          slug: link.slug,
          domainSlug: link.domain,
        },
      },
    });

    if (existingLink) {
      return NextResponse.json(
        { error: "The link with this domain and slug already exists" },
        { status: 400, headers },
      );
    }
  }

  // If preset is provided, validate it
  let preset: LinkPreset | null = null;
  let metaImage: string | null = null;
  let metaFavicon: string | null = null;
  if (createLink && link?.presetId) {
    preset = await prisma.linkPreset.findUnique({
      where: { pId: link.presetId, teamId: teamId },
    });

    if (!preset) {
      return NextResponse.json(
        {
          error: "Link preset not found or not associated with this team",
        },
        { status: 400, headers },
      );
    }

    // Handle image files for custom meta tag (if enabled)
    if (preset.enableCustomMetaTag) {
      // Process meta image if present
      if (preset.metaImage && isDataUrl(preset.metaImage)) {
        const { buffer, filename } = convertDataUrlToBuffer(preset.metaImage);
        const blob = await put(filename, buffer, {
          access: "public",
          addRandomSuffix: true,
        });
        metaImage = blob.url;
      }

      // Process favicon if present
      if (preset.metaFavicon && isDataUrl(preset.metaFavicon)) {
        const { buffer, filename } = convertDataUrlToBuffer(
          preset.metaFavicon,
        );
        const blob = await put(filename, buffer, {
          access: "public",
          addRandomSuffix: true,
        });
        metaFavicon = blob.url;
      }
    }
  }

  // Create the dataroom
  try {
    // Generate unique public ID for the dataroom
    const pId = newId("dataroom");

    // Create dataroom with link if requested
    const createData: Record<string, unknown> = {
      name,
      description,
      teamId,
      pId,
    };

    if (createLink && link) {
      const isGroupAudience = link.audienceType === "GROUP";
      const hashedPassword = link.password
        ? await generateEncrpytedPassword(link.password)
        : preset?.password
          ? await generateEncrpytedPassword(preset.password)
          : null;
      const expiresAtDate = link.expiresAt
        ? new Date(link.expiresAt)
        : preset?.expiresAt
          ? new Date(preset?.expiresAt)
          : null;

      createData.links = {
        create: {
          name: link.name,
          teamId,
          linkType: "DATAROOM_LINK",
          domainId: domainId,
          domainSlug: link.domain || null,
          slug: link.slug || null,
          password: hashedPassword,
          expiresAt: expiresAtDate,
          emailProtected:
            link.emailProtected || preset?.emailProtected || false,
          emailAuthenticated:
            link.emailAuthenticated || preset?.emailAuthenticated || false,
          allowDownload: link.allowDownload || preset?.allowDownload,
          enableNotification:
            link.enableNotification ?? preset?.enableNotification ?? false,
          enableFeedback: link.enableFeedback,
          enableScreenshotProtection: link.enableScreenshotProtection,
          showBanner: link.showBanner ?? preset?.showBanner ?? false,
          audienceType: link.audienceType,
          groupId: isGroupAudience ? link.groupId : null,
          allowList: link.allowList || preset?.allowList,
          denyList: link.denyList || preset?.denyList,
          ...(preset?.enableCustomMetaTag && {
            enableCustomMetatag: preset?.enableCustomMetaTag,
            metaTitle: preset?.metaTitle,
            metaDescription: preset?.metaDescription,
            metaImage: metaImage,
            metaFavicon: metaFavicon,
          }),
        },
      };
    }

    const dataroom = await prisma.dataroom.create({
      data: createData as Parameters<typeof prisma.dataroom.create>[0]["data"],
      include: {
        links: createLink, // Only include links if we're creating one
      },
    });

    // Create folders if provided
    if (folders && folders.length > 0) {
      await createDataroomFoldersRecursive(
        dataroom.id,
        folders as Array<{ name: string; subfolders?: Array<{ name: string; subfolders?: unknown[] }> }>,
      );
    }

    const dataroomWithLinks = dataroom as typeof dataroom & {
      links?: Array<{
        id: string;
        domainSlug: string | null;
        slug: string | null;
      }>;
    };

    if (createLink) {
      waitUntil(
        sendLinkCreatedWebhook({
          teamId,
          data: {
            dataroom_id: dataroom.id,
            link_id: dataroomWithLinks.links?.[0]?.id,
          },
        }),
      );
    }

    return NextResponse.json(
      {
        message: "Dataroom created successfully",
        dataroomId: dataroom.id,
        linkId: createLink
          ? dataroomWithLinks.links?.[0]?.id
          : undefined,
        linkUrl: createLink
          ? dataroomWithLinks.links?.[0]?.domainSlug &&
            dataroomWithLinks.links?.[0]?.slug
            ? `https://${dataroomWithLinks.links[0].domainSlug}/${dataroomWithLinks.links[0].slug}`
            : `${process.env.NEXT_PUBLIC_MARKETING_URL}/view/${dataroomWithLinks.links?.[0]?.id}`
          : undefined,
      },
      { status: 200, headers },
    );
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers },
    );
  }
}
