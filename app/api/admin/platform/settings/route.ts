import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth-options";
import { isPaywallBypassed } from "@/lib/feature-flags";
import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { errorResponse } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { clearPlatformSettingsCache } from "@/lib/auth/paywall";
import { isAdminEmail } from "@/lib/constants/admins";
import { validateBody } from "@/lib/middleware/validate";
import { PlatformSettingsUpdateSchema } from "@/lib/validations/teams";
import { appRouterStrictRateLimit } from "@/lib/security/rate-limiter";
import { requireAdminAppRouter } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/platform/settings
 * Returns platform-level settings. Only accessible to platform owner.
 *
 * PATCH /api/admin/platform/settings
 * Updates platform-level settings. Only accessible to platform owner.
 * Body: { paywallEnforced?, paywallBypassUntil?, registrationOpen?, maintenanceMode?, maintenanceMessage? }
 */

async function requirePlatformOwner(req: NextRequest): Promise<{ userId: string; email: string } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  // Platform owner is anyone in the ADMIN_EMAILS list (from lib/constants/admins.ts)
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
    const blocked = await appRouterStrictRateLimit(req);
    if (blocked) return blocked;

    const owner = await requirePlatformOwner(req);
    if (!owner) {
      return NextResponse.json({ error: "Unauthorized. Platform owner access required." }, { status: 403 });
    }

    const settings = await prisma.platformSettings.findUnique({
      where: { key: "default" },
    });

    if (!settings) {
      // Return defaults if no record exists yet
      return NextResponse.json({
        paywallEnforced: true,
        paywallBypassUntil: null,
        registrationOpen: true,
        maintenanceMode: false,
        maintenanceMessage: null,
        envPaywallBypass: isPaywallBypassed(),
        updatedAt: null,
        updatedBy: null,
      });
    }

    return NextResponse.json({
      paywallEnforced: settings.paywallEnforced,
      paywallBypassUntil: settings.paywallBypassUntil,
      registrationOpen: settings.registrationOpen,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
      envPaywallBypass: isPaywallBypassed(),
      updatedAt: settings.updatedAt,
      updatedBy: settings.updatedBy,
    });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  // Defense-in-depth: admin auth check (additive to edge middleware)
  const adminAuth = await requireAdminAppRouter();
  if (adminAuth instanceof NextResponse) return adminAuth;

  try {
    const blocked = await appRouterStrictRateLimit(req);
    if (blocked) return blocked;

    const owner = await requirePlatformOwner(req);
    if (!owner) {
      return NextResponse.json({ error: "Unauthorized. Platform owner access required." }, { status: 403 });
    }

    // Validate body with Zod schema
    const parsed = await validateBody(req, PlatformSettingsUpdateSchema);
    if (parsed.error) return parsed.error;
    const { paywallEnforced, paywallBypassUntil, registrationOpen, maintenanceMode, maintenanceMessage } = parsed.data;

    // Build update data
    const updateData: Record<string, unknown> = { updatedBy: owner.userId };
    if (paywallEnforced !== undefined) updateData.paywallEnforced = paywallEnforced;
    if (paywallBypassUntil !== undefined) updateData.paywallBypassUntil = paywallBypassUntil ? new Date(paywallBypassUntil) : null;
    if (registrationOpen !== undefined) updateData.registrationOpen = registrationOpen;
    if (maintenanceMode !== undefined) updateData.maintenanceMode = maintenanceMode;
    if (maintenanceMessage !== undefined) updateData.maintenanceMessage = maintenanceMessage || null;

    const settings = await prisma.platformSettings.upsert({
      where: { key: "default" },
      create: {
        key: "default",
        ...updateData,
      },
      update: updateData,
    });

    // Clear the paywall cache so changes take effect immediately
    clearPlatformSettingsCache();

    // Audit log
    await logAuditEvent({
      userId: owner.userId,
      eventType: "SETTINGS_UPDATED",
      resourceType: "PlatformSettings",
      resourceId: settings.id,
      metadata: { changes: updateData },
    }).catch((e) => reportError(e as Error)); // Fire-and-forget

    return NextResponse.json({
      success: true,
      paywallEnforced: settings.paywallEnforced,
      paywallBypassUntil: settings.paywallBypassUntil,
      registrationOpen: settings.registrationOpen,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
    });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
