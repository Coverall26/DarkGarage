/**
 * GET    /api/esign/templates/[id] — Get template detail
 * PATCH  /api/esign/templates/[id] — Update template
 * DELETE /api/esign/templates/[id] — Delete template
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { reportError } from "@/lib/error";
import { checkModuleAccess, resolveOrgIdFromTeam } from "@/lib/middleware/module-access";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ============================================================================
// GET — Template detail
// ============================================================================

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const auth = await requireAdminAppRouter();
    if (auth instanceof NextResponse) return auth;

    const { id } = await ctx.params;

    const userTeam = await prisma.userTeam.findFirst({
      where: { user: { email: auth.email }, status: "ACTIVE" },
      select: { teamId: true },
    });
    if (!userTeam) {
      return NextResponse.json({ error: "No active team" }, { status: 403 });
    }

    // Module access check — SIGNSUITE required
    const orgId = await resolveOrgIdFromTeam(userTeam.teamId);
    if (orgId) {
      const moduleBlocked = await checkModuleAccess(orgId, "SIGNSUITE");
      if (moduleBlocked) return moduleBlocked;
    }

    const template = await prisma.signatureTemplate.findFirst({
      where: { id, teamId: userTeam.teamId },
      include: {
        createdByUser: { select: { name: true, email: true } },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ============================================================================
// PATCH — Update template
// ============================================================================

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const auth = await requireAdminAppRouter();
    if (auth instanceof NextResponse) return auth;

    const { id } = await ctx.params;

    const userTeam = await prisma.userTeam.findFirst({
      where: { user: { email: auth.email }, status: "ACTIVE" },
      select: { teamId: true },
    });
    if (!userTeam) {
      return NextResponse.json({ error: "No active team" }, { status: 403 });
    }

    // Module access check — SIGNSUITE required
    const patchOrgId = await resolveOrgIdFromTeam(userTeam.teamId);
    if (patchOrgId) {
      const moduleBlocked = await checkModuleAccess(patchOrgId, "SIGNSUITE");
      if (moduleBlocked) return moduleBlocked;
    }

    const existing = await prisma.signatureTemplate.findFirst({
      where: { id, teamId: userTeam.teamId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = body.name.trim();
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.file !== undefined) data.file = body.file;
    if (body.numPages !== undefined) data.numPages = body.numPages;
    if (body.defaultRecipients !== undefined) data.defaultRecipients = body.defaultRecipients;
    if (body.fields !== undefined) data.fields = body.fields;
    if (body.defaultEmailSubject !== undefined) data.defaultEmailSubject = body.defaultEmailSubject?.trim() || null;
    if (body.defaultEmailMessage !== undefined) data.defaultEmailMessage = body.defaultEmailMessage?.trim() || null;
    if (body.defaultExpirationDays !== undefined) data.defaultExpirationDays = body.defaultExpirationDays;
    if (body.isPublic !== undefined) data.isPublic = body.isPublic;

    const template = await prisma.signatureTemplate.update({
      where: { id },
      data,
    });

    return NextResponse.json(template);
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ============================================================================
// DELETE — Delete template
// ============================================================================

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const auth = await requireAdminAppRouter();
    if (auth instanceof NextResponse) return auth;

    const { id } = await ctx.params;

    const userTeam = await prisma.userTeam.findFirst({
      where: { user: { email: auth.email }, status: "ACTIVE" },
      select: { teamId: true },
    });
    if (!userTeam) {
      return NextResponse.json({ error: "No active team" }, { status: 403 });
    }

    // Module access check — SIGNSUITE required
    const delOrgId = await resolveOrgIdFromTeam(userTeam.teamId);
    if (delOrgId) {
      const moduleBlocked = await checkModuleAccess(delOrgId, "SIGNSUITE");
      if (moduleBlocked) return moduleBlocked;
    }

    const existing = await prisma.signatureTemplate.findFirst({
      where: { id, teamId: userTeam.teamId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await prisma.signatureTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
