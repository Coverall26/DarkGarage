import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { type Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth/auth-options";
import { CustomUser } from "@/lib/types";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { validateBody } from "@/lib/middleware/validate";
import { EntityConfigSchema } from "@/lib/validations/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/entities/[id]/config
 *
 * Get entity fee and tier configuration.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Defense-in-depth: admin auth check (additive to edge middleware)
  const adminAuth = await requireAdminAppRouter();
  if (adminAuth instanceof NextResponse) return adminAuth;

  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as CustomUser;

  // Inline GP role check (equivalent to getUserWithRole + requireRole(["GP"]))
  const userTeam = await prisma.userTeam.findFirst({
    where: {
      userId: user.id,
      role: { in: ["OWNER", "ADMIN", "SUPER_ADMIN"] },
      status: "ACTIVE",
    },
  });

  if (!userTeam) {
    return NextResponse.json({ error: "GP access required" }, { status: 403 });
  }

  // Get all team IDs for this user
  const allTeams = await prisma.userTeam.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    select: { teamId: true },
  });
  const teamIds = allTeams.map((t: { teamId: string }) => t.teamId);

  const entity = await prisma.entity.findUnique({
    where: { id },
    include: { team: true },
  });

  if (!entity || !teamIds.includes(entity.teamId)) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: entity.id,
    name: entity.name,
    mode: entity.mode,
    feeConfig: entity.feeConfig,
    tierConfig: entity.tierConfig,
    customSettings: entity.customSettings,
  });
}

/**
 * PUT /api/admin/entities/[id]/config
 *
 * Update entity fee and tier configuration.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Defense-in-depth: admin auth check (additive to edge middleware)
  const adminAuth = await requireAdminAppRouter();
  if (adminAuth instanceof NextResponse) return adminAuth;

  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as CustomUser;

  // Inline GP role check
  const userTeam = await prisma.userTeam.findFirst({
    where: {
      userId: user.id,
      role: { in: ["OWNER", "ADMIN", "SUPER_ADMIN"] },
      status: "ACTIVE",
    },
  });

  if (!userTeam) {
    return NextResponse.json({ error: "GP access required" }, { status: 403 });
  }

  // Get all team IDs for this user
  const allTeams = await prisma.userTeam.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    select: { teamId: true },
  });
  const teamIds = allTeams.map((t: { teamId: string }) => t.teamId);

  const entity = await prisma.entity.findUnique({
    where: { id },
    include: { team: true },
  });

  if (!entity || !teamIds.includes(entity.teamId)) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  try {
    const parsed = await validateBody(req, EntityConfigSchema);
    if (parsed.error) return parsed.error;
    const { feeConfig, tierConfig, customSettings } = parsed.data;

    const updated = await prisma.entity.update({
      where: { id },
      data: {
        feeConfig: (feeConfig !== undefined ? feeConfig : entity.feeConfig) as Prisma.InputJsonValue,
        tierConfig: (tierConfig !== undefined ? tierConfig : entity.tierConfig) as Prisma.InputJsonValue,
        customSettings: (customSettings !== undefined ? customSettings : entity.customSettings) as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      entity: {
        id: updated.id,
        feeConfig: updated.feeConfig,
        tierConfig: updated.tierConfig,
        customSettings: updated.customSettings,
      },
    });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

