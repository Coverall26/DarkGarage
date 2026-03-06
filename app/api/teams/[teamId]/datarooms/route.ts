import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@prisma/client";

import { newId } from "@/lib/id-helper";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { enforceRBACAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { validateBody } from "@/lib/middleware/validate";
import { DataroomCreateSchema } from "@/lib/validations/teams";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const { teamId } = await params;

  const auth = await enforceRBACAppRouter({
    roles: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],
    teamId,
  });
  if (auth instanceof NextResponse) return auth;

  const search = req.nextUrl.searchParams.get("search") || undefined;
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const tags = req.nextUrl.searchParams.get("tags") || undefined;

  try {

    // Get total unfiltered count first
    const totalCount = await prisma.dataroom.count({
      where: {
        teamId: teamId,
      },
    });

    // Build where clause based on filters
    const whereClause: Prisma.DataroomWhereInput = {
      teamId: teamId,
    };

    // Search filter
    if (search) {
      whereClause.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    // Tags filter
    if (tags) {
      const tagNames = tags.split(",").filter(Boolean);
      if (tagNames.length > 0) {
        whereClause.tags = {
          some: {
            tag: {
              name: {
                in: tagNames,
              },
            },
          },
        };
      }
    }

    const datarooms = await prisma.dataroom.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { documents: true, views: true },
        },
        links: {
          where: {
            linkType: "DATAROOM_LINK",
            deletedAt: null,
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            isArchived: true,
            expiresAt: true,
            createdAt: true,
          },
        },
        views: {
          orderBy: {
            viewedAt: "desc",
          },
          take: 1,
          select: {
            viewedAt: true,
          },
        },
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
      orderBy: {
        createdAt: "desc",
      },
    });

    // Status filter (applied after fetching since it's computed)
    let filteredDatarooms = datarooms;
    if (status) {
      filteredDatarooms = datarooms.filter((dataroom) => {
        const activeLinks = dataroom.links.filter((link) => {
          if (link.isArchived) return false;
          if (link.expiresAt && new Date(link.expiresAt) < new Date())
            return false;
          return true;
        });
        const isActive = activeLinks.length > 0;

        if (status === "active") {
          return isActive;
        } else if (status === "inactive") {
          return !isActive;
        }
        return true;
      });
    }

    return NextResponse.json({
      datarooms: filteredDatarooms,
      totalCount,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const { teamId } = await params;

  const auth = await enforceRBACAppRouter({
    roles: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
    teamId,
  });
  if (auth instanceof NextResponse) return auth;

  try {
    const parsed = await validateBody(req, DataroomCreateSchema);
    if (parsed.error) return parsed.error;
    const { name } = parsed.data;

    const pId = newId("dataroom");

    // Create dataroom with Quick Add group and default link in a transaction
    const result = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      // 1. Create the dataroom
      const dataroom = await tx.dataroom.create({
        data: {
          name: name,
          teamId: teamId,
          pId: pId,
        },
      });

      // 2. Create the Quick Add group with allowAll=true for full access
      const quickAddGroup = await tx.viewerGroup.create({
        data: {
          name: "Quick Add",
          dataroomId: dataroom.id,
          teamId: teamId,
          isQuickAdd: true,
          allowAll: true,
        },
      });

      // 3. Create default link for the Quick Add group
      await tx.link.create({
        data: {
          name: "Quick Add Link",
          linkType: "DATAROOM_LINK",
          dataroomId: dataroom.id,
          groupId: quickAddGroup.id,
          audienceType: "GROUP",
          teamId: teamId,
          emailProtected: true,
          emailAuthenticated: false,
          allowDownload: false,
          enableNotification: true,
        },
      });

      return dataroom;
    });

    const dataroomWithCount = {
      ...result,
      _count: { documents: 0 },
    };

    return NextResponse.json({ dataroom: dataroomWithCount }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
