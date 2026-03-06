import { NextRequest, NextResponse } from "next/server";

import { DefaultPermissionStrategy } from "@prisma/client";

import { getFeatureFlags } from "@/lib/featureFlags";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { enforceRBACAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { validateBody } from "@/lib/middleware/validate";
import { DataroomUpdateSchema } from "@/lib/validations/teams";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string; id: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const { teamId, id: dataroomId } = await params;

  const auth = await enforceRBACAppRouter({
    roles: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],
    teamId,
  });
  if (auth instanceof NextResponse) return auth;

  try {
    const dataroom = await prisma.dataroom.findUnique({
      where: {
        id: dataroomId,
        teamId,
      },
      include: {
        _count: { select: { viewerGroups: true, permissionGroups: true } },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!dataroom) {
      return NextResponse.json(
        { error: "The requested dataroom does not exist" },
        { status: 404 },
      );
    }

    return NextResponse.json(dataroom);
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

  const { teamId, id: dataroomId } = await params;

  const auth = await enforceRBACAppRouter({
    roles: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
    teamId,
  });
  if (auth instanceof NextResponse) return auth;

  try {
    const parsed = await validateBody(req, DataroomUpdateSchema);
    if (parsed.error) return parsed.error;
    const {
      name,
      enableChangeNotifications,
      defaultPermissionStrategy: defaultPermissionStrategyRaw,
      allowBulkDownload,
      showLastUpdated,
      tags,
      agentsEnabled,
    } = parsed.data;
    const defaultPermissionStrategy = defaultPermissionStrategyRaw as DefaultPermissionStrategy | undefined;

    const featureFlags = await getFeatureFlags({ teamId });

    const updatedDataroom = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const dataroom = await tx.dataroom.update({
        where: {
          id: dataroomId,
        },
        data: {
          ...(name && { name }),
          ...(typeof enableChangeNotifications === "boolean" && {
            enableChangeNotifications,
          }),
          ...(defaultPermissionStrategy && { defaultPermissionStrategy }),
          ...(typeof allowBulkDownload === "boolean" && {
            allowBulkDownload,
          }),
          ...(typeof showLastUpdated === "boolean" && {
            showLastUpdated,
          }),
          ...(typeof agentsEnabled === "boolean" && {
            agentsEnabled,
          }),
        },
      });

      // Handle tags if provided
      if (tags !== undefined) {
        // Validate that all tags exist and belong to the same team
        if (tags.length > 0) {
          const validTags = await tx.tag.findMany({
            where: {
              id: { in: tags },
              teamId: teamId,
            },
            select: { id: true },
          });
          const validTagIds = new Set(validTags.map((t) => t.id));
          const invalidTags = tags.filter((id) => !validTagIds.has(id));
          if (invalidTags.length > 0) {
            throw new Error(`Invalid tag IDs: ${invalidTags.join(", ")}`);
          }
        }

        // First, delete all existing tags for this dataroom
        await tx.tagItem.deleteMany({
          where: {
            dataroomId: dataroomId,
            itemType: "DATAROOM_TAG",
          },
        });

        // Then create the new tags (if any)
        if (tags.length > 0) {
          await tx.tagItem.createMany({
            data: tags.map((tagId: string) => ({
              tagId,
              itemType: "DATAROOM_TAG",
              dataroomId: dataroomId,
              taggedBy: auth.userId,
            })),
          });
        }
      }

      // Fetch the updated dataroom with tags
      const dataroomTags = await tx.tag.findMany({
        where: {
          items: {
            some: { dataroomId: dataroom.id },
          },
        },
        select: {
          id: true,
          name: true,
          color: true,
          description: true,
        },
      });

      return { ...dataroom, tags: dataroomTags };
    });

    return NextResponse.json(updatedDataroom);
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

  const { teamId, id: dataroomId } = await params;

  const auth = await enforceRBACAppRouter({
    roles: ["OWNER", "SUPER_ADMIN", "ADMIN"],
    teamId,
  });
  if (auth instanceof NextResponse) return auth;

  try {
    await prisma.dataroom.delete({
      where: {
        id: dataroomId,
        teamId,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
