/**
 * POST /api/outreach/bulk — Send outreach emails to multiple contacts.
 *
 * Body: { contactIds, subject, body, trackOpens?, templateId? }
 * Max 50 recipients per request.
 * Requires CRM_PRO+ tier with email tracking.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { sendBulkOutreachEmail } from "@/lib/outreach/send-email";
import { resolveOrgTier } from "@/lib/tier/crm-tier";
import { resolveCrmRole, hasCrmPermission } from "@/lib/auth/crm-roles";
import { validateBody } from "@/lib/middleware/validate";
import { OutreachBulkSchema } from "@/lib/validations/esign-outreach";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userTeam = await prisma.userTeam.findFirst({
      where: { userId: session.user.id },
      select: {
        role: true,
        crmRole: true,
        team: { select: { id: true, organizationId: true } },
      },
    });
    if (!userTeam?.team) {
      return NextResponse.json({ error: "No team found" }, { status: 403 });
    }

    const teamId = userTeam.team.id;
    const orgId = userTeam.team.organizationId;

    // CRM role check: MANAGER required to send bulk emails
    const crmRole = resolveCrmRole(userTeam.role, userTeam.crmRole);
    if (!hasCrmPermission(crmRole, "MANAGER")) {
      return NextResponse.json(
        { error: "Forbidden: CRM MANAGER role required to send bulk emails" },
        { status: 403 },
      );
    }

    // Check tier — bulk email requires CRM_PRO+
    if (orgId) {
      const tier = await resolveOrgTier(orgId);
      if (!tier.hasEmailTracking) {
        return NextResponse.json(
          {
            error: "Bulk email requires CRM Pro or FundRoom plan",
            upgradeUrl: "/admin/settings?tab=billing",
          },
          { status: 403 },
        );
      }
    }

    const parsed = await validateBody(req, OutreachBulkSchema);
    if (parsed.error) return parsed.error;
    const { contactIds, subject, body: emailBody, trackOpens, templateId } = parsed.data;

    const result = await sendBulkOutreachEmail({
      contactIds,
      teamId,
      subject: subject.trim(),
      bodyTemplate: emailBody.trim(),
      actorId: session.user.id,
      trackOpens: trackOpens === true,
      templateId: templateId ?? undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
