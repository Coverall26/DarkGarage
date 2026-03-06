export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { getTeamStorageConfigById } from "@/ee/features/storage/config";
import { InvocationType, InvokeCommand } from "@aws-sdk/client-lambda";
import { ItemType, ViewType } from "@prisma/client";

import { reportError } from "@/lib/error";
import { getLambdaClientForTeam } from "@/lib/files/aws-client";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { getIpAddress } from "@/lib/utils/ip";

export async function POST(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const { linkId, viewId } = (await req.json()) as {
    linkId: string;
    viewId: string;
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
          },
        },
        groupId: true,
        dataroom: {
          select: {
            id: true,
            name: true,
            teamId: true,
            allowBulkDownload: true,
            folders: {
              select: {
                id: true,
                name: true,
                path: true,
              },
            },
            documents: {
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
                        contentType: true,
                        numPages: true,
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

    // if dataroom does not allow bulk download, we should not allow the download
    if (!view.dataroom.allowBulkDownload) {
      return NextResponse.json(
        { error: "Bulk download is disabled for this dataroom" },
        { status: 403 },
      );
    }

    // if viewedAt is longer than 23 hours ago, we should not allow the download
    if (
      view.viewedAt &&
      view.viewedAt < new Date(Date.now() - 23 * 60 * 60 * 1000)
    ) {
      return NextResponse.json({ error: "Error downloading" }, { status: 403 });
    }

    let downloadFolders = view.dataroom.folders;
    let downloadDocuments = view.dataroom.documents;

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

      downloadFolders = downloadFolders.filter((folder) =>
        permittedFolderIds.includes(folder.id),
      );
      downloadDocuments = downloadDocuments.filter((doc) =>
        permittedDocumentIds.includes(doc.id),
      );
    }

    // Create individual document views for each document being downloaded
    const downloadableDocuments = downloadDocuments.filter(
      (doc) =>
        doc.document.versions[0] &&
        doc.document.versions[0].type !== "notion" &&
        doc.document.versions[0].storageType !== "VERCEL_BLOB",
    );

    const downloadMetadata =
      downloadableDocuments.length < 100
        ? {
            dataroomName: view.dataroom!.name,
            documentCount: downloadableDocuments.length,
            documents: downloadableDocuments.map((doc) => ({
              id: doc.document.id,
              name: doc.document.name,
            })),
          }
        : {
            dataroomName: view.dataroom!.name,
            documentCount: downloadableDocuments.length,
          };

    await prisma.view.createMany({
      data: downloadableDocuments.map((doc) => ({
        viewType: "DOCUMENT_VIEW" as const,
        documentId: doc.document.id,
        linkId: linkId,
        dataroomId: view.dataroom!.id,
        groupId: view.groupId,
        dataroomViewId: view.id,
        viewerEmail: view.viewerEmail,
        downloadedAt: new Date(),
        downloadType: "BULK" as const,
        downloadMetadata: downloadMetadata,
        viewerId: view.viewerId,
        verified: view.verified,
      })),
      skipDuplicates: true,
    });

    // Construct folderStructure and fileKeys
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

    // Create a map of folder IDs to folder names
    const folderMap = new Map(
      downloadFolders.map((folder) => [
        folder.path,
        { name: folder.name, id: folder.id },
      ]),
    );

    const addFileToStructure = (
      path: string,
      fileName: string,
      fileKey: string,
      fileType?: string,
      numPages?: number,
    ) => {
      const pathParts = path.split("/").filter(Boolean);
      let currentPath = "";

      pathParts.forEach((part) => {
        currentPath += "/" + part;
        const folderInfo = folderMap.get(currentPath);
        if (!folderStructure[currentPath]) {
          folderStructure[currentPath] = {
            name: folderInfo ? folderInfo.name : part,
            path: currentPath,
            files: [],
          };
        }
      });

      if (!folderStructure[path]) {
        const folderInfo = folderMap.get(path) || { name: "Root", id: null };
        folderStructure[path] = {
          name: folderInfo.name,
          path: path,
          files: [],
        };
      }

      const needsWatermark =
        view.link.enableWatermark &&
        (fileType === "pdf" || fileType === "image");

      folderStructure[path].files.push({
        name: fileName,
        key: fileKey,
        type: fileType,
        numPages: numPages,
        needsWatermark: needsWatermark ?? undefined,
      });
      fileKeys.push(fileKey);
    };

    // Add root level documents
    downloadDocuments
      .filter((doc) => !doc.folderId)
      .filter((doc) => doc.document.versions[0].type !== "notion")
      .filter((doc) => doc.document.versions[0].storageType !== "VERCEL_BLOB")
      .forEach((doc) => {
        const fileKey =
          view.link.enableWatermark && doc.document.versions[0].type === "pdf"
            ? doc.document.versions[0].file
            : (doc.document.versions[0].originalFile ??
              doc.document.versions[0].file);

        addFileToStructure(
          "/",
          doc.document.name,
          fileKey,
          doc.document.versions[0].type ?? undefined,
          doc.document.versions[0].numPages ?? undefined,
        );
      });

    // Add documents in folders
    downloadFolders.forEach((folder) => {
      const folderDocs = downloadDocuments
        .filter((doc) => doc.folderId === folder.id)
        .filter((doc) => doc.document.versions[0].type !== "notion")
        .filter(
          (doc) => doc.document.versions[0].storageType !== "VERCEL_BLOB",
        );

      folderDocs &&
        folderDocs.forEach((doc) => {
          const fileKey =
            view.link.enableWatermark &&
            doc.document.versions[0].type === "pdf"
              ? doc.document.versions[0].file
              : (doc.document.versions[0].originalFile ??
                doc.document.versions[0].file);

          addFileToStructure(
            folder.path,
            doc.document.name,
            fileKey,
            doc.document.versions[0].type ?? undefined,
            doc.document.versions[0].numPages ?? undefined,
          );
        });

      if (folderDocs && folderDocs.length === 0) {
        addFileToStructure(folder.path, "", "");
      }
    });

    if (fileKeys.length === 0) {
      return NextResponse.json(
        { error: "No files to download" },
        { status: 404 },
      );
    }

    // Convert NextRequest headers to plain object for getIpAddress
    const headersObj: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    // Get team-specific storage configuration
    const teamId = view.dataroom!.teamId;
    const [client, storageConfig] = await Promise.all([
      getLambdaClientForTeam(teamId),
      getTeamStorageConfigById(teamId),
    ]);

    const lambdaParams = {
      FunctionName: storageConfig.lambdaFunctionName,
      InvocationType: InvocationType.RequestResponse,
      Payload: JSON.stringify({
        sourceBucket: storageConfig.bucket,
        fileKeys: fileKeys,
        folderStructure: folderStructure,
        watermarkConfig: view.link.enableWatermark
          ? {
              enabled: true,
              config: view.link.watermarkConfig,
              viewerData: {
                email: view.viewerEmail,
                date: (view.viewedAt
                  ? new Date(view.viewedAt)
                  : new Date()
                ).toLocaleDateString(),
                time: (view.viewedAt
                  ? new Date(view.viewedAt)
                  : new Date()
                ).toLocaleTimeString(),
                link: view.link.name,
                ipAddress: getIpAddress(headersObj),
              },
            }
          : { enabled: false },
      }),
    };

    try {
      const command = new InvokeCommand(lambdaParams);
      const response = await client.send(command);

      if (response.Payload) {
        const decodedPayload = new TextDecoder().decode(response.Payload);
        const payload = JSON.parse(decodedPayload);
        const { downloadUrl } = JSON.parse(payload.body);

        return NextResponse.json({ downloadUrl });
      } else {
        throw new Error("Payload is undefined or empty");
      }
    } catch (lambdaError) {
      reportError(lambdaError as Error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
