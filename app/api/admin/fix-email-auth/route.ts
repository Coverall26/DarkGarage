import { NextRequest, NextResponse } from "next/server";
import { requireAuthAppRouter, requireAdminAppRouter} from "@/lib/auth/rbac";
import { isUserAdminAsync } from "@/lib/constants/admins";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { appRouterStrictRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/fix-email-auth
 *
 * Bulk-updates all links and link presets to enable email authentication.
 * Platform admin only (via isUserAdminAsync).
 */
export async function POST(req: NextRequest) {
  // Defense-in-depth: admin auth check (additive to edge middleware)
  const adminAuth = await requireAdminAppRouter();
  if (adminAuth instanceof NextResponse) return adminAuth;

  const blocked = await appRouterStrictRateLimit(req);
  if (blocked) return blocked;

  const auth = await requireAuthAppRouter();
  if (auth instanceof NextResponse) return auth;

  if (!(await isUserAdminAsync(auth.email))) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  }

  try {
    const result = await prisma.link.updateMany({
      where: {
        emailAuthenticated: false,
      },
      data: {
        emailAuthenticated: true,
      },
    });

    const presetResult = await prisma.linkPreset.updateMany({
      where: {
        emailAuthenticated: false,
      },
      data: {
        emailAuthenticated: true,
      },
    });

    return NextResponse.json({
      message: "Successfully updated email authentication settings",
      linksUpdated: result.count,
      presetsUpdated: presetResult.count,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
