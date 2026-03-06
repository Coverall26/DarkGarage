/**
 * POST /api/outreach/send — Send a single outreach email to a contact.
 *
 * Body: { contactId, subject, body, trackOpens?, templateId? }
 * Requires CRM_PRO+ tier with email tracking.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import {
  sendOutreachEmail,
  interpolateMergeVars,
  MergeContext,
} from "@/lib/outreach/send-email";
import { resolveCrmRole, hasCrmPermission } from "@/lib/auth/crm-roles";
import { validateBody } from "@/lib/middleware/validate";
import { OutreachSendSchema } from "@/lib/validations/esign-outreach";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = await validateBody(req, OutreachSendSchema);
    if (parsed.error) return parsed.error;
    const { contactId, subject, body: emailBody, trackOpens, templateId } = parsed.data;

    // Resolve user's team
    const userTeam = await prisma.userTeam.findFirst({
      where: { userId: session.user.id },
      select: {
        role: true,
        crmRole: true,
        team: { select: { id: true, name: true, organizationId: true } },
        user: { select: { name: true, email: true } },
      },
    });
    if (!userTeam?.team) {
      return NextResponse.json({ error: "No team found" }, { status: 403 });
    }

    // CRM role check: MANAGER required to send outreach emails
    const crmRole = resolveCrmRole(userTeam.role, userTeam.crmRole);
    if (!hasCrmPermission(crmRole, "MANAGER")) {
      return NextResponse.json(
        { error: "Forbidden: CRM MANAGER role required to send emails" },
        { status: 403 },
      );
    }

    const teamId = userTeam.team.id;

    // Load contact for merge vars
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, teamId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        title: true,
      },
    });
    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 },
      );
    }

    // Interpolate merge variables
    const ctx: MergeContext = {
      contact: {
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        company: contact.company,
        title: contact.title,
      },
      sender: {
        name: userTeam.user?.name ?? null,
        email: userTeam.user?.email ?? null,
        company: userTeam.team.name ?? null,
      },
    };

    const interpolatedSubject = interpolateMergeVars(subject.trim(), ctx);
    const interpolatedBody = interpolateMergeVars(emailBody.trim(), ctx);

    // Send
    const result = await sendOutreachEmail({
      contactId: contact.id,
      teamId,
      subject: interpolatedSubject,
      body: interpolatedBody,
      actorId: session.user.id,
      trackOpens: trackOpens === true,
      templateId: templateId ?? undefined,
    });

    if (!result.success) {
      const statusMap: Record<string, number> = {
        CONTACT_NOT_FOUND: 404,
        TEAM_MISMATCH: 403,
        UNSUBSCRIBED: 422,
        BOUNCED: 422,
      };
      const status = statusMap[result.error ?? ""] ?? 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json(
      { success: true, emailId: result.emailId },
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
