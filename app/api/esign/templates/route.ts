/**
 * GET  /api/esign/templates — List signature templates for the team
 * POST /api/esign/templates — Create a new signature template
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { reportError } from "@/lib/error";
import { checkModuleAccess, resolveOrgIdFromTeam } from "@/lib/middleware/module-access";
import { checkSignatureTemplateLimit, getSignatureTemplateUsage } from "@/lib/tier/gates";

export const dynamic = "force-dynamic";

// ============================================================================
// GET — List templates
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const auth = await requireAdminAppRouter();
    if (auth instanceof NextResponse) return auth;

    const userTeam = await prisma.userTeam.findFirst({
      where: { user: { email: auth.email }, status: "ACTIVE" },
      select: { teamId: true },
    });

    if (!userTeam) {
      return NextResponse.json({ error: "No active team" }, { status: 403 });
    }

    const orgId = await resolveOrgIdFromTeam(userTeam.teamId);
    if (orgId) {
      const moduleBlocked = await checkModuleAccess(orgId, "SIGNSUITE");
      if (moduleBlocked) return moduleBlocked;
    }

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim();

    const where: Record<string, unknown> = { teamId: userTeam.teamId };
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const templates = await prisma.signatureTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        file: true,
        numPages: true,
        usageCount: true,
        defaultRecipients: true,
        fields: true,
        defaultEmailSubject: true,
        defaultEmailMessage: true,
        defaultExpirationDays: true,
        createdAt: true,
        isPublic: true,
        createdByUser: { select: { name: true, email: true } },
      },
    });

    // Include template usage info for tier UI
    let templateUsage: { limit: number | null; used: number; canCreate: boolean } | undefined;
    if (orgId) {
      templateUsage = await getSignatureTemplateUsage(orgId);
    }

    return NextResponse.json({ templates, templateUsage });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST — Create template
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const auth = await requireAdminAppRouter();
    if (auth instanceof NextResponse) return auth;

    const user = await prisma.user.findUnique({
      where: { email: auth.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userTeam = await prisma.userTeam.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
      select: { teamId: true },
    });
    if (!userTeam) {
      return NextResponse.json({ error: "No active team" }, { status: 403 });
    }

    const orgId = await resolveOrgIdFromTeam(userTeam.teamId);
    if (orgId) {
      const moduleBlocked = await checkModuleAccess(orgId, "SIGNSUITE");
      if (moduleBlocked) return moduleBlocked;
    }

    // Enforce tier-based template limit
    if (orgId) {
      const gate = await checkSignatureTemplateLimit(orgId);
      if (!gate.allowed) {
        return NextResponse.json(
          { error: gate.error, meta: gate.meta },
          { status: 403 },
        );
      }
    }

    const body = await req.json();

    const { name, description, file, numPages, defaultRecipients, fields,
            defaultEmailSubject, defaultEmailMessage, defaultExpirationDays,
            isPublic } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: "Template name must be 100 characters or less" }, { status: 400 });
    }
    if (!file || typeof file !== "string") {
      return NextResponse.json({ error: "Template file URL is required" }, { status: 400 });
    }

    const template = await prisma.signatureTemplate.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        file,
        numPages: numPages ?? null,
        defaultRecipients: defaultRecipients ?? null,
        fields: fields ?? null,
        defaultEmailSubject: defaultEmailSubject?.trim() || null,
        defaultEmailMessage: defaultEmailMessage?.trim() || null,
        defaultExpirationDays: defaultExpirationDays ?? null,
        isPublic: isPublic ?? false,
        teamId: userTeam.teamId,
        createdById: user.id,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
