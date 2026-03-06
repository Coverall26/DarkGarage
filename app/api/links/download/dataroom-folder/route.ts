export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { getTeamStorageConfigById } from "@/ee/features/storage/config";
import { InvocationType, InvokeCommand } from "@aws-sdk/client-lambda";
import { ItemType, ViewType } from "@prisma/client";
import slugify from "@sindresorhus/slugify";

import { reportError } from "@/lib/error";
import { getLambdaClientForTeam } from "@/lib/files/aws-client";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { getIpAddress } from "@/lib/utils/ip";

export async function POST(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const { folderId, dataroomId, viewId, linkId } = (await req.json()) as {
      folderId: string;
      dataroomId: string;
      viewId: string;
      linkId: string;
    };
    if (!folderId) {
      return NextResponse.json(
        { error: "folderId is required in request body" },
        { status: 400 },
      );
    }

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
            teamId: true,
            allowDownload: true,
            expiresAt: true,
            isArchived: true,
            deletedAt: true,
            enableWatermark: true,
            watermarkConfig: true,
            name: true,
            permissionGroupId: true,
          },
        },
        groupId: true,
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

    // if viewedAt is longer than 23 hours ago, we should not allow the download
    if (
      view.viewedAt &&
      view.viewedAt < new Date(Date.now() - 23 * 60 * 60 * 1000)
    ) {
      return NextResponse.json({ error: "Error downloading" }, { status: 403 });
    }

    const rootFolder = await prisma.dataroomFolder.findUnique({
      where: {
        id: folderId,
        dataroomId,
      },
      select: { id: true, name: true, path: true },
    });

    if (!rootFolder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 },
      );
    }

    const subfolders = await prisma.dataroomFolder.findMany({
      where: {
        dataroomId,
        path: { startsWith: rootFolder.path + "/" },
      },
      select: { id: true, name: true, path: true },
    });

    let allFolders = [rootFolder, ...subfolders];
    let allDocuments = await prisma.dataroomDocument.findMany({
      where: {
        dataroomId,
        folderId: {
          in: allFolders.map((f) => f.id),
        },
      },
      select: {
        id: true,
        folderId: true,
        document: {
          select: {
            id: true,
            name: true,
            versions: {
              where: { isPrimary: true },
              select: {
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
    });

    // Check permissions based on groupId (ViewerGroup) or permissionGroupId (PermissionGroup)
    const effectiveGroupId = view.groupId || view.link.permissionGroupId;

    if (effectiveGroupId) {
      let groupPermissions: { itemType: ItemType; itemId: string }[] = [];

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

      const permittedFolderIds = groupPermissions
        .filter(
          (permission) => permission.itemType === ItemType.DATAROOM_FOLDER,
        )
        .map((permission) => permission.itemId);
      const permittedDocumentIds = groupPermissions
        .filter(
          (permission) => permission.itemType === ItemType.DATAROOM_DOCUMENT,
        )
        .map((permission) => permission.itemId);

      allFolders = allFolders.filter((folder) =>
        permittedFolderIds.includes(folder.id),
      );
      allDocuments = allDocuments.filter((doc) =>
        permittedDocumentIds.includes(doc.id),
      );
    }

    const folderStructure: {
      [key: string]: {
        name: string;
        path: string;
        files: {
          name: string;
          key: string;
          type?: string;
          numPages?: number;
          needsWatermark?: boolean;
        }[];
      };
    } = {};

    const fileKeys: string[] = [];

    const addFileToStructure = (
      fullPath: string,
      rootFolderParam: { name: string; path: string },
      fileName: string,
      fileKey: string,
      fileType?: string,
      numPages?: number,
    ) => {
      let relativePath = "";
      if (fullPath !== rootFolderParam.path) {
        const pathRegex = new RegExp(`^${rootFolderParam.path}/(.*)$`);
        const match = fullPath.match(pathRegex);
        relativePath = match ? match[1] : "";
      }

      const pathParts = [slugify(rootFolderParam.name)];
      if (relativePath) {
        pathParts.push(
          ...relativePath
            .split("/")
            .filter(Boolean)
            .map((part) => slugify(part)),
        );
      }

      let currentPath = "";
      for (const part of pathParts) {
        currentPath += "/" + part;
        if (!folderStructure[currentPath]) {
          folderStructure[currentPath] = {
            name: part,
            path: currentPath,
            files: [],
          };
        }
      }

      if (fileName && fileKey) {
        const needsWatermark =
          view.link.enableWatermark &&
          (fileType === "pdf" || fileType === "image");

        folderStructure[currentPath].files.push({
          name: fileName,
          key: fileKey,
          type: fileType,
          numPages: numPages,
          needsWatermark: needsWatermark ?? undefined,
        });
        fileKeys.push(fileKey);
      }
    };

    for (const folder of allFolders) {
      const docs = allDocuments.filter((doc) => doc.folderId === folder.id);

      if (docs.length === 0) {
        addFileToStructure(
          folder.path,
          rootFolder,
          "",
          "",
          undefined,
          undefined,
        );
        continue;
      }

      for (const doc of docs) {
        const version = doc.document.versions[0];
        if (
          !version ||
          version.type === "notion" ||
          version.storageType === "VERCEL_BLOB"
        )
          continue;

        const fileKey =
          view.link.enableWatermark && version.type === "pdf"
            ? version.file
            : (version.originalFile ?? version.file);
        addFileToStructure(
          folder.path,
          rootFolder,
          doc.document.name,
          fileKey,
          version.type ?? undefined,
          version.numPages ?? undefined,
        );
      }
    }

    const rootPath = "/" + slugify(rootFolder.name);
    if (!folderStructure[rootPath]) {
      folderStructure[rootPath] = {
        name: slugify(rootFolder.name),
        path: rootPath,
        files: [],
      };
    }

    // Create individual document views for each document in the folder
    const downloadableDocuments = allDocuments.filter(
      (doc) =>
        doc.document.versions[0] &&
        doc.document.versions[0].type !== "notion" &&
        doc.document.versions[0].storageType !== "VERCEL_BLOB",
    );

    // Prepare metadata with folder name and document list
    const downloadMetadata = {
      folderName: rootFolder.name,
      folderPath: rootFolder.path,
      documents: downloadableDocuments.map((doc) => ({
        id: doc.document.id,
        name: doc.document.name,
      })),
    };

    await prisma.view.createMany({
      data: downloadableDocuments.map((doc) => ({
        viewType: "DOCUMENT_VIEW" as const,
        documentId: doc.document.id,
        linkId: linkId,
        dataroomId: dataroomId,
        groupId: view.groupId,
        dataroomViewId: view.id,
        viewerEmail: view.viewerEmail,
        downloadedAt: new Date(),
        downloadType: "FOLDER" as const,
        downloadMetadata: downloadMetadata,
        viewerId: view.viewerId,
        verified: view.verified,
      })),
      skipDuplicates: true,
    });

    // Convert NextRequest headers to plain object for getIpAddress
    const headersObj: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    // Get team-specific storage configuration
    const [client, storageConfig] = await Promise.all([
      getLambdaClientForTeam(view.link.teamId!),
      getTeamStorageConfigById(view.link.teamId!),
    ]);

    const lambdaParams = {
      FunctionName: `bulk-download-zip-creator-${process.env.NODE_ENV === "development" ? "dev" : "prod"}`,
      InvocationType: InvocationType.RequestResponse,
      Payload: JSON.stringify({
        sourceBucket: storageConfig.bucket,
        fileKeys,
        folderStructure,
        watermarkConfig: view.link.enableWatermark
          ? {
              enabled: true,
              config: view.link.watermarkConfig,
              viewerData: {
                email: view.viewerEmail,
                date: new Date(
                  view.viewedAt ? view.viewedAt : new Date(),
                ).toLocaleDateString(),
                time: new Date(
                  view.viewedAt ? view.viewedAt : new Date(),
                ).toLocaleTimeString(),
                link: view.link.name,
                ipAddress: getIpAddress(headersObj),
              },
            }
          : { enabled: false },
      }),
    };

    const command = new InvokeCommand(lambdaParams);
    const response = await client.send(command);

    if (!response.Payload) throw new Error("Lambda returned empty payload");

    const parsed = JSON.parse(new TextDecoder().decode(response.Payload));
    const { downloadUrl } = JSON.parse(parsed.body);

    return NextResponse.json({ downloadUrl });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
