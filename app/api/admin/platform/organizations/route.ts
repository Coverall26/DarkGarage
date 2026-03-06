import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { errorResponse } from "@/lib/errors";
import { isAdminEmail } from "@/lib/constants/admins";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { clearPlatformSettingsCache } from "@/lib/auth/paywall";
import { clearTierCache } from "@/lib/tier";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { validateBody } from "@/lib/middleware/validate";
import { PlatformOrgActionSchema } from "@/lib/validations/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/platform/organizations
 * Lists all teams (organizations) with their FundRoom activation status.
 * Platform owner only (isAdminEmail check).
 *
 * PATCH /api/admin/platform/organizations
 * Platform owner activates/deactivates/suspends FundRoom for a specific team.
 * Body: { teamId, action: "activate" | "suspend" | "deactivate" | "reactivate", reason? }
 */

async function requirePlatformOwner(): Promise<{ userId: string; email: string } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  if (!isAdminEmail(session.user.email)) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true },
  });

  if (!user?.email) return null;
  return { userId: user.id, email: user.email };
}

export async function GET(req: NextRequest) {
  // Defense-in-depth: admin auth check (additive to edge middleware)
  const adminAuth = await requireAdminAppRouter();
  if (adminAuth instanceof NextResponse) return adminAuth;

  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const owner = await requirePlatformOwner();
    if (!owner) {
      return NextResponse.json({ error: "Unauthorized. Platform owner access required." }, { status: 403 });
    }

    // Get all teams with their org info, owner, and activation status
    const teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        users: {
          where: { role: "OWNER", status: "ACTIVE" },
          take: 1,
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            productMode: true,
            subscriptionTier: true,
          },
        },
        _count: {
          select: {
            funds: true,
            users: { where: { status: "ACTIVE" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all activations
    const activations = await prisma.fundroomActivation.findMany({
      where: { fundId: null },
      select: {
        id: true,
        teamId: true,
        status: true,
        mode: true,
        activatedAt: true,
        activatedBy: true,
        deactivatedAt: true,
        deactivationReason: true,
        setupProgress: true,
        setupCompletedAt: true,
      },
    });

    const activationMap = new Map(activations.map((a) => [a.teamId, a]));

    const organizations = teams.map((team) => {
      const activation = activationMap.get(team.id);
      const owner = team.users[0]?.user;
      return {
        teamId: team.id,
        teamName: team.name,
        orgName: team.organization?.name || team.name,
        orgId: team.organization?.id || null,
        productMode: team.organization?.productMode || null,
        subscriptionTier: team.organization?.subscriptionTier || "FREE",
        ownerName: owner?.name || null,
        ownerEmail: owner?.email || null,
        fundCount: team._count.funds,
        memberCount: team._count.users,
        createdAt: team.createdAt,
        activation: activation
          ? {
              id: activation.id,
              status: activation.status,
              mode: activation.mode,
              activatedAt: activation.activatedAt,
              deactivatedAt: activation.deactivatedAt,
              deactivationReason: activation.deactivationReason,
              setupCompletedAt: activation.setupCompletedAt,
            }
          : null,
      };
    });

    return NextResponse.json({ organizations });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  // Defense-in-depth: admin auth check (additive to edge middleware)
  const adminAuth = await requireAdminAppRouter();
  if (adminAuth instanceof NextResponse) return adminAuth;

  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const owner = await requirePlatformOwner();
    if (!owner) {
      return NextResponse.json({ error: "Unauthorized. Platform owner access required." }, { status: 403 });
    }

    const parsed = await validateBody(req, PlatformOrgActionSchema);
    if (parsed.error) return parsed.error;
    const { teamId, action, reason } = parsed.data;

    // Verify team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Find existing activation (team-level, no fundId)
    const existing = await prisma.fundroomActivation.findFirst({
      where: { teamId, fundId: null },
      orderBy: { updatedAt: "desc" },
    });

    let activation;

    switch (action) {
      case "activate": {
        if (existing?.status === "ACTIVE") {
          return NextResponse.json({ success: true, message: "Already active.", activation: existing });
        }
        activation = existing
          ? await prisma.fundroomActivation.update({
              where: { id: existing.id },
              data: {
                status: "ACTIVE",
                activatedBy: owner.userId,
                activatedAt: new Date(),
                deactivatedAt: null,
                deactivatedBy: null,
                deactivationReason: null,
              },
            })
          : await prisma.fundroomActivation.create({
              data: {
                teamId,
                fundId: null,
                status: "ACTIVE",
                activatedBy: owner.userId,
                activatedAt: new Date(),
                mode: "GP_FUND",
              },
            });
        break;
      }
      case "suspend": {
        if (!existing) {
          return NextResponse.json({ error: "No activation record found to suspend" }, { status: 404 });
        }
        if (existing.status !== "ACTIVE") {
          return NextResponse.json({ error: `Cannot suspend from status: ${existing.status}` }, { status: 400 });
        }
        activation = await prisma.fundroomActivation.update({
          where: { id: existing.id },
          data: {
            status: "SUSPENDED",
            deactivatedAt: new Date(),
            deactivatedBy: owner.userId,
            deactivationReason: reason || "Suspended by platform admin",
          },
        });
        break;
      }
      case "deactivate": {
        if (!existing) {
          return NextResponse.json({ error: "No activation record found to deactivate" }, { status: 404 });
        }
        activation = await prisma.fundroomActivation.update({
          where: { id: existing.id },
          data: {
            status: "DEACTIVATED",
            deactivatedAt: new Date(),
            deactivatedBy: owner.userId,
            deactivationReason: reason || "Deactivated by platform admin",
          },
        });
        break;
      }
      case "reactivate": {
        if (!existing) {
          return NextResponse.json({ error: "No activation record found to reactivate" }, { status: 404 });
        }
        if (existing.status !== "SUSPENDED" && existing.status !== "DEACTIVATED") {
          return NextResponse.json({ error: `Cannot reactivate from status: ${existing.status}` }, { status: 400 });
        }
        activation = await prisma.fundroomActivation.update({
          where: { id: existing.id },
          data: {
            status: "ACTIVE",
            activatedBy: owner.userId,
            activatedAt: new Date(),
            deactivatedAt: null,
            deactivatedBy: null,
            deactivationReason: null,
          },
        });
        break;
      }
    }

    // Clear caches
    clearPlatformSettingsCache();
    clearTierCache(teamId);

    await logAuditEvent({
      userId: owner.userId,
      teamId,
      eventType: action === "activate" || action === "reactivate" ? "FUNDROOM_ACTIVATED" : "FUNDROOM_DEACTIVATED",
      resourceType: "FundroomActivation",
      resourceId: activation?.id || "new",
      metadata: { action, reason, previousStatus: existing?.status || "NONE" },
    }).catch((e) => reportError(e as Error));

    return NextResponse.json({ success: true, activation });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
