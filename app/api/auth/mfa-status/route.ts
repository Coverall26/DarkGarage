import { NextRequest, NextResponse } from "next/server";

import { requireAuthAppRouter } from "@/lib/auth/rbac";
import { checkMfaStatus } from "@/lib/auth/mfa";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/mfa-status
 *
 * Returns the current user's MFA status:
 * - required: Whether the user's org requires MFA
 * - enabled: Whether the user has MFA enabled
 * - verified: Whether the user has verified MFA in this session
 */
export async function GET(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const auth = await requireAuthAppRouter();
  if (auth instanceof NextResponse) return auth;

  try {
    const status = await checkMfaStatus(auth.userId);
    return NextResponse.json(status);
  } catch (error) {
    return errorResponse(error);
  }
}
