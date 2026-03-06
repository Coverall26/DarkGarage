import { NextRequest, NextResponse } from "next/server";

import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth/auth-options";
import { getFeatureFlags } from "@/lib/featureFlags";
import { deleteFile } from "@/lib/files/delete-file-server";
import prisma from "@/lib/prisma";
import { ratelimit } from "@/lib/redis";
import { CustomUser } from "@/lib/types";
import { serializeFileSize } from "@/lib/utils";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string; id: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId, id: docId } = await params;
  const userId = (session.user as CustomUser).id;

  try {
    // Per-user, per-document rate limit to prevent abuse
    // Default: 120 requests per minute per user per document
    const { success, limit, remaining, reset } = await ratelimit(
      120,
      "1 m",
    ).limit(`doc:${docId}:team:${teamId}:user:${userId}`);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        },
      );
    }

    // First verify user has access to the team (lightweight query)
    const teamAccess = await prisma.userTeam.findUnique({
      where: {
        userId_teamId: {
          userId: userId,
          teamId: teamId,
        },
      },
      select: { teamId: true },
    });

    if (!teamAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Then fetch the specific document with its relationships (targeted query)
    const document = await prisma.document.findUnique({
      where: {
        id: docId,
        teamId,
      },
      include: {
        // Get the latest primary version of the document
        versions: {
          where: { isPrimary: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        folder: {
          select: {
            name: true,
            path: true,
          },
        },
        datarooms: {
          select: {
            dataroom: {
              select: {
                id: true,
                name: true,
              },
            },
            folder: {
              select: {
                id: true,
                name: true,
                path: true,
              },
            },
          },
        },
      },
    });

    if (!document || !document.versions || document.versions.length === 0) {
      return NextResponse.json(
        { error: "The requested document does not exist" },
        { status: 404 },
      );
    }

    const pages = await prisma.documentPage.findMany({
      where: {
        versionId: document.versions[0].id,
      },
      select: {
        pageLinks: true,
      },
    });

    const hasPageLinks = pages.some(
      (page) =>
        page.pageLinks &&
        Array.isArray(page.pageLinks) &&
        (page.pageLinks as unknown[]).length > 0, // Prisma JSON field
    );

    const response = NextResponse.json(
      serializeFileSize({ ...document, hasPageLinks }),
    );
    response.headers.set("X-RateLimit-Limit", limit.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-RateLimit-Reset", reset.toString());
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string; id: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as CustomUser).id;
  const { teamId, id: docId } = await params;

  try {
    const body = await req.json();
    const { folderId, currentPathName } = body as {
      folderId: string;
      currentPathName: string;
    };

    const document = await prisma.document.update({
      where: {
        id: docId,
        teamId: teamId,
        team: {
          users: {
            some: {
              role: "ADMIN",
              userId: userId,
            },
          },
        },
      },
      data: {
        folderId: folderId,
      },
      select: {
        folder: {
          select: {
            path: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Document moved successfully",
      newPath: document.folder?.path,
      oldPath: currentPathName,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string; id: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId, id: docId } = await params;
  const userId = (session.user as CustomUser).id;

  try {
    // Verify user has access to the team
    const teamAccess = await prisma.userTeam.findUnique({
      where: {
        userId_teamId: {
          userId: userId,
          teamId: teamId,
        },
      },
      select: { role: true },
    });

    if (!teamAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Extract allowed fields from request body
    const { agentsEnabled, description } = body as {
      agentsEnabled?: boolean;
      description?: string | null;
    };

    if (agentsEnabled !== undefined) {
      const features = await getFeatureFlags({ teamId });
      if (!features.ai) {
        return NextResponse.json(
          { error: "AI feature is not available" },
          { status: 403 },
        );
      }
    }

    // Build update data object with only provided fields
    const updateData: { agentsEnabled?: boolean; description?: string | null } =
      {};

    if (typeof agentsEnabled === "boolean") {
      updateData.agentsEnabled = agentsEnabled;
    }

    if (description !== undefined) {
      if (description !== null && description.length > 500) {
        return NextResponse.json(
          { error: "Description must be 500 characters or less" },
          { status: 400 },
        );
      }
      updateData.description = description;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    // Update the document
    const document = await prisma.document.update({
      where: {
        id: docId,
        teamId: teamId,
      },
      data: updateData,
      select: {
        id: true,
        agentsEnabled: true,
        description: true,
      },
    });

    return NextResponse.json(document);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string; id: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId, id: docId } = await params;
  const userId = (session.user as CustomUser).id;

  try {
    const teamAccess = await prisma.userTeam.findUnique({
      where: {
        userId_teamId: {
          userId: userId,
          teamId: teamId,
        },
      },
      select: {
        role: true,
      },
    });

    if (!teamAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (teamAccess.role !== "ADMIN" && teamAccess.role !== "MANAGER") {
      return NextResponse.json(
        {
          error:
            "You are not permitted to perform this action. Only admin and managers can delete documents.",
        },
        { status: 403 },
      );
    }

    const documentVersions = await prisma.document.findUnique({
      where: {
        id: docId,
        teamId: teamId,
      },
      include: {
        versions: {
          select: {
            id: true,
            file: true,
            type: true,
            storageType: true,
          },
        },
      },
    });

    if (!documentVersions) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    // If it is not a notion document then delete the files from storage
    if (documentVersions.type !== "notion") {
      for (const version of documentVersions.versions) {
        await deleteFile({
          type: version.storageType,
          data: version.file,
          teamId,
        });
      }
    }

    // Delete the document from database
    await prisma.document.delete({
      where: {
        id: docId,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
