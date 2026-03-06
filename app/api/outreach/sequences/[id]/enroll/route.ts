/**
 * POST/DELETE /api/outreach/sequences/[id]/enroll — Manage enrollment.
 *
 * POST: Enroll a contact (or multiple) in a sequence.
 *       Body: { contactId } or { contactIds: string[] }
 * DELETE: Unenroll a contact.
 *         Body: { contactId }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { resolveOrgTier } from "@/lib/tier/crm-tier";
import { resolveCrmRole, hasCrmPermission } from "@/lib/auth/crm-roles";
import {
  enrollContact,
  unenrollContact,
} from "@/lib/outreach/sequence-engine";
import { validateBody } from "@/lib/middleware/validate";
import { SequenceEnrollSchema, SequenceUnenrollSchema } from "@/lib/validations/esign-outreach";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// POST — Enroll contact(s)
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    if (!userTeam?.team?.organizationId) {
      return NextResponse.json({ error: "No team found" }, { status: 403 });
    }

    // CRM role check: MANAGER required to enroll contacts in sequences
    const crmRole = resolveCrmRole(userTeam.role, userTeam.crmRole);
    if (!hasCrmPermission(crmRole, "MANAGER")) {
      return NextResponse.json(
        { error: "Forbidden: CRM MANAGER role required to enroll contacts in sequences" },
        { status: 403 },
      );
    }

    const orgId = userTeam.team.organizationId;
    const teamId = userTeam.team.id;

    // Check AI CRM
    const tier = await resolveOrgTier(orgId);
    if (!tier.hasAiFeatures) {
      return NextResponse.json(
        {
          error: "Sequences require the AI CRM add-on",
          upgradeUrl: "/admin/settings?tab=billing",
        },
        { status: 403 },
      );
    }

    const { id: sequenceId } = await params;
    const parsed = await validateBody(req, SequenceEnrollSchema);
    if (parsed.error) return parsed.error;

    // Support single or bulk enrollment
    const contactIds: string[] = parsed.data.contactIds
      ? parsed.data.contactIds
      : parsed.data.contactId
        ? [parsed.data.contactId]
        : [];

    // Verify contacts belong to team
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds }, teamId },
      select: { id: true, unsubscribedAt: true, emailBounced: true },
    });

    const validContactIds = contacts
      .filter((c) => !c.unsubscribedAt && !c.emailBounced)
      .map((c) => c.id);

    const results = [];
    for (const cid of validContactIds) {
      try {
        const result = await enrollContact({
          contactId: cid,
          sequenceId,
          orgId,
        });
        results.push({ contactId: cid, ...result, status: "enrolled" });
      } catch (err) {
        results.push({
          contactId: cid,
          status: "failed",
          error: (err as Error).message,
        });
      }
    }

    // Report skipped contacts
    const skipped = contactIds.filter((id) => !validContactIds.includes(id));

    return NextResponse.json({
      enrolled: results.filter((r) => r.status === "enrolled").length,
      failed: results.filter((r) => r.status === "failed").length,
      skipped: skipped.length,
      results,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE — Unenroll contact
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
    if (!userTeam?.team?.organizationId) {
      return NextResponse.json({ error: "No team found" }, { status: 403 });
    }

    // CRM role check: MANAGER required to unenroll contacts from sequences
    const crmRole = resolveCrmRole(userTeam.role, userTeam.crmRole);
    if (!hasCrmPermission(crmRole, "MANAGER")) {
      return NextResponse.json(
        { error: "Forbidden: CRM MANAGER role required to unenroll contacts from sequences" },
        { status: 403 },
      );
    }

    const teamId = userTeam.team.id;
    const { id: sequenceId } = await params;
    const parsed = await validateBody(req, SequenceUnenrollSchema);
    if (parsed.error) return parsed.error;
    const { contactId } = parsed.data;

    // Verify contact belongs to team
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, teamId },
      select: { id: true },
    });

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 },
      );
    }

    await unenrollContact(contactId, sequenceId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
