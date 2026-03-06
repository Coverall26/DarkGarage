/**
 * GET    /api/esign/envelopes/[id] — Get envelope details
 * PATCH  /api/esign/envelopes/[id] — Update envelope (title, message, recipients while DRAFT)
 * DELETE /api/esign/envelopes/[id] — Delete envelope (DRAFT only) or void (sent)
 */
import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { requireAuthAppRouter } from "@/lib/auth/rbac";
import { voidEnvelope } from "@/lib/esign/envelope-service";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { validateBody } from "@/lib/middleware/validate";
import { EnvelopeUpdateSchema } from "@/lib/validations/esign-outreach";
import { checkModuleAccess, resolveOrgIdFromTeam } from "@/lib/middleware/module-access";
import { SignatureFieldType } from "@prisma/client";

export const dynamic = "force-dynamic";

// ============================================================================
// GET — Get envelope details
// ============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const auth = await requireAuthAppRouter();
    if (auth instanceof NextResponse) return auth;

    // Module access check — SIGNSUITE required
    const orgId = await resolveOrgIdFromTeam(auth.teamId);
    if (orgId) {
      const moduleBlocked = await checkModuleAccess(orgId, "SIGNSUITE");
      if (moduleBlocked) return moduleBlocked;
    }

    const { id } = await params;

    const envelope = await prisma.envelope.findUnique({
      where: { id },
      include: {
        recipients: {
          orderBy: { order: "asc" },
        },
        filings: true,
        createdBy: {
          select: { name: true, email: true },
        },
      },
    });

    if (!envelope) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
    }

    if (envelope.teamId !== auth.teamId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Include fields from linked SignatureDocument if present
    let fields: unknown[] = [];
    if (envelope.signatureDocId) {
      const docFields = await prisma.signatureField.findMany({
        where: { documentId: envelope.signatureDocId },
        orderBy: [{ pageNumber: "asc" }, { y: "asc" }],
      });
      // Map to field-placement format (pageNumber → page, recipientId → recipientIndex)
      const recipients = envelope.recipients || [];
      fields = docFields.map((f) => ({
        id: f.id,
        type: f.type,
        label: f.type,
        page: f.pageNumber,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        required: f.required,
        recipientIndex: recipients.findIndex((r) => r.id === f.recipientId),
        options: f.options ?? undefined,
        fieldFormat: f.fieldFormat ?? undefined,
        groupId: f.groupId ?? undefined,
        minValue: f.minValue ?? undefined,
        maxValue: f.maxValue ?? undefined,
      }));
    }

    return NextResponse.json({ ...envelope, fields });
  } catch (error) {
    return errorResponse(error);
  }
}

// ============================================================================
// PATCH — Update envelope (DRAFT only)
// ============================================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const auth = await requireAuthAppRouter();
    if (auth instanceof NextResponse) return auth;

    // Module access check — SIGNSUITE required
    const patchOrgId = await resolveOrgIdFromTeam(auth.teamId);
    if (patchOrgId) {
      const moduleBlocked = await checkModuleAccess(patchOrgId, "SIGNSUITE");
      if (moduleBlocked) return moduleBlocked;
    }

    const { id } = await params;

    const envelope = await prisma.envelope.findUnique({
      where: { id },
    });

    if (!envelope) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
    }

    if (envelope.teamId !== auth.teamId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (envelope.status !== "DRAFT" && envelope.status !== "PREPARING") {
      return NextResponse.json(
        { error: "Can only edit envelopes in DRAFT or PREPARING status" },
        { status: 400 }
      );
    }

    // Validate body with Zod schema
    const parsed = await validateBody(req, EnvelopeUpdateSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    // Build update data — only allow safe fields
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.emailSubject !== undefined) updateData.emailSubject = body.emailSubject?.trim() || null;
    if (body.message !== undefined) updateData.emailMessage = body.message?.trim() || null;
    if (body.signingMode !== undefined) updateData.signingMode = body.signingMode;
    if (body.expiresAt !== undefined) {
      updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    }
    if (body.reminderEnabled !== undefined) updateData.reminderEnabled = body.reminderEnabled;
    if (body.reminderDays !== undefined) updateData.reminderDays = body.reminderDays;
    if (body.status === "PREPARING") updateData.status = "PREPARING";

    const updated = await prisma.envelope.update({
      where: { id },
      data: updateData,
      include: {
        recipients: { orderBy: { order: "asc" } },
      },
    });

    // Handle field placement persistence
    if (body.fields && Array.isArray(body.fields) && envelope.signatureDocId) {
      const docId = envelope.signatureDocId;
      const recipients = updated.recipients || [];

      // Delete existing fields and create new ones
      await prisma.signatureField.deleteMany({ where: { documentId: docId } });

      if (body.fields.length > 0) {
        await prisma.signatureField.createMany({
          data: body.fields.map((f: {
            type: string;
            label?: string;
            page?: number;
            pageNumber?: number;
            x: number;
            y: number;
            width: number;
            height: number;
            required?: boolean;
            recipientIndex?: number;
            options?: string[] | null;
            fieldFormat?: string | null;
            groupId?: string | null;
            minValue?: number | null;
            maxValue?: number | null;
          }) => ({
            documentId: docId,
            type: f.type as SignatureFieldType,
            pageNumber: f.pageNumber ?? f.page ?? 1,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            required: f.required !== false,
            recipientId: f.recipientIndex != null && recipients[f.recipientIndex]
              ? recipients[f.recipientIndex].id
              : null,
            options: f.options ?? undefined,
            fieldFormat: f.fieldFormat ?? null,
            groupId: f.groupId ?? null,
            minValue: f.minValue ?? null,
            maxValue: f.maxValue ?? null,
          })),
        });
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

// ============================================================================
// DELETE — Delete (DRAFT) or void (sent) envelope
// ============================================================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const auth = await requireAuthAppRouter();
    if (auth instanceof NextResponse) return auth;

    // Module access check — SIGNSUITE required
    const delOrgId = await resolveOrgIdFromTeam(auth.teamId);
    if (delOrgId) {
      const moduleBlocked = await checkModuleAccess(delOrgId, "SIGNSUITE");
      if (moduleBlocked) return moduleBlocked;
    }

    const { id } = await params;

    const envelope = await prisma.envelope.findUnique({
      where: { id },
    });

    if (!envelope) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
    }

    if (envelope.teamId !== auth.teamId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (envelope.status === "DRAFT" || envelope.status === "PREPARING") {
      // Hard delete draft envelopes
      await prisma.envelope.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    if (envelope.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot delete a completed envelope" },
        { status: 400 }
      );
    }

    // For sent/in-progress envelopes, void instead of delete
    // Parse optional JSON body — empty body is OK, malformed JSON is 400
    let body: Record<string, unknown> = {};
    const rawText = await req.text();
    if (rawText) {
      try {
        body = JSON.parse(rawText);
      } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
      }
    }
    const voided = await voidEnvelope(id, auth.userId, body.reason as string | undefined);
    return NextResponse.json(voided);
  } catch (error) {
    return errorResponse(error);
  }
}
