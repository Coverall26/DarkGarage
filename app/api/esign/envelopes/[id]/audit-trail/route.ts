/**
 * GET /api/esign/envelopes/[id]/audit-trail — Download audit trail PDF
 *
 * Generates and returns a comprehensive audit trail PDF for the envelope.
 * Includes event timeline, signer details, consent records, and hash chain verification.
 */
import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { requireAuthAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { checkModuleAccess, resolveOrgIdFromTeam } from "@/lib/middleware/module-access";
import { generateAuditTrailPdf } from "@/lib/esign/audit-trail-pdf";
import { reportError } from "@/lib/error";
import { logAuditEvent } from "@/lib/audit/audit-logger";

export const dynamic = "force-dynamic";

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

    // Verify envelope belongs to user's team
    const envelope = await prisma.envelope.findUnique({
      where: { id },
      select: { teamId: true, title: true, status: true },
    });

    if (!envelope) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
    }

    if (envelope.teamId !== auth.teamId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Generate audit trail PDF
    const result = await generateAuditTrailPdf({
      envelopeId: id,
      teamId: auth.teamId,
      includeChainVerification: true,
    });

    if (!result.success || !result.pdfBytes) {
      return NextResponse.json(
        { error: result.error || "Failed to generate audit trail" },
        { status: 500 }
      );
    }

    // Fire-and-forget: audit log
    logAuditEvent({
      teamId: auth.teamId,
      userId: auth.userId,
      eventType: "CERTIFICATE_DOWNLOADED",
      resourceType: "Envelope",
      resourceId: id,
      metadata: { envelopeTitle: envelope.title },
    }).catch((e) => reportError(e as Error));

    // Return PDF with proper headers
    const sanitizedTitle = (envelope.title || "envelope")
      .replace(/[^a-zA-Z0-9-_\s]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 60);

    return new NextResponse(Buffer.from(result.pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="audit-trail-${sanitizedTitle}-${id.substring(0, 8)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    reportError(error as Error);
    return errorResponse(error);
  }
}
