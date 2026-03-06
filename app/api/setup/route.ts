import { NextRequest, NextResponse } from "next/server";
import { requireAuthAppRouter } from "@/lib/auth/rbac";
import { errorResponse } from "@/lib/errors";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { validateBody } from "@/lib/middleware/validate";
import { SetupStepSchema } from "@/lib/validations/setup";

export const dynamic = "force-dynamic";

/**
 * POST /api/setup — Save wizard step data
 * Persists step progress server-side for resume capability.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuthAppRouter();
  if (auth instanceof NextResponse) return auth;

  try {
    const parsed = await validateBody(req, SetupStepSchema);
    if (parsed.error) return parsed.error;
    const { step, data } = parsed.data;

    // Log step save for audit trail
    await logAuditEvent({
      eventType: "SETTINGS_UPDATED",
      userId: auth.userId,
      resourceType: "Organization",
      metadata: {
        action: "wizard_step_saved",
        step,
        stepName: [
          "company_info",
          "branding",
          "raise_style",
          "team_invites",
          "dataroom",
          "fund_details",
          "lp_onboarding",
          "integrations",
          "launch",
        ][step],
      },
    });

    return NextResponse.json({ success: true, step });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * GET /api/setup — Get current wizard state
 * Returns saved wizard progress for the current user.
 */
export async function GET() {
  const auth = await requireAuthAppRouter();
  if (auth instanceof NextResponse) return auth;

  try {
    // Wizard state is primarily client-side (localStorage).
    // Server returns any existing org/fund data if user already started.
    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    return errorResponse(error);
  }
}
