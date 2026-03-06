/**
 * POST /api/esign/templates/[id]/duplicate — Duplicate a signature template
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { reportError } from "@/lib/error";
import { checkModuleAccess, resolveOrgIdFromTeam } from "@/lib/middleware/module-access";
import { checkSignatureTemplateLimit } from "@/lib/tier/gates";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const auth = await requireAdminAppRouter();
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

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

    // Module access check — SIGNSUITE required
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

    // Find the source template
    const source = await prisma.signatureTemplate.findFirst({
      where: { id, teamId: userTeam.teamId },
    });

    if (!source) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Create duplicate with "(Copy)" suffix
    const duplicate = await prisma.signatureTemplate.create({
      data: {
        name: `${source.name} (Copy)`,
        description: source.description,
        file: source.file,
        numPages: source.numPages,
        defaultRecipients: source.defaultRecipients ?? undefined,
        fields: source.fields ?? undefined,
        defaultEmailSubject: source.defaultEmailSubject,
        defaultEmailMessage: source.defaultEmailMessage,
        defaultExpirationDays: source.defaultExpirationDays,
        isPublic: source.isPublic,
        teamId: userTeam.teamId,
        createdById: user.id,
        usageCount: 0,
      },
    });

    return NextResponse.json(duplicate, { status: 201 });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
