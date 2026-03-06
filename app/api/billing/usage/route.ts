/**
 * GET /api/billing/usage — Returns current billing-period usage for the org.
 *
 * Used by the Settings → Billing section to render usage meters
 * (contacts, e-signatures, email templates).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import prisma from "@/lib/prisma";
import { resolveOrgTier } from "@/lib/tier/crm-tier";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const auth = await requireAuthAppRouter();
  if (auth instanceof NextResponse) return auth;

  try {
    const userTeam = await prisma.userTeam.findFirst({
      where: { userId: auth.userId },
      select: { team: { select: { id: true, organizationId: true } } },
    });

    const orgId = userTeam?.team?.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 404 },
      );
    }

    const teamId = userTeam.team.id;
    const tier = await resolveOrgTier(orgId);

    // Current billing month key
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Parallel usage queries
    const [contactCount, esigUsage, templateCount] = await Promise.all([
      prisma.contact.count({ where: { teamId } }),
      prisma.esigUsage.findUnique({
        where: { orgId_month: { orgId, month } },
        select: { signaturesUsed: true },
      }),
      prisma.outreachSequence.count({ where: { orgId } }),
    ]);

    return NextResponse.json({
      contacts: {
        used: contactCount,
        limit: tier.maxContacts,
      },
      esigs: {
        used: esigUsage?.signaturesUsed ?? 0,
        limit: tier.maxEsigsPerMonth,
      },
      templates: {
        used: templateCount,
        limit: tier.emailTemplateLimit,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
