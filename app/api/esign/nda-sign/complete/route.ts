/**
 * NDA Signing Completion Callback
 *
 * POST /api/esign/nda-sign/complete — Called after signer completes NDA signing.
 *   Updates the NdaSigningRecord with signedAt timestamp and optional filingId.
 *   Wires into the DataRoom auto-filing system.
 *
 * This is called from the client after the signing flow completes,
 * or can be called internally by the signing session handler.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { fileToOrgVault } from "@/lib/esign/document-filing-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const body = await req.json();
    const { envelopeId, signerEmail } = body as {
      envelopeId?: string;
      signerEmail?: string;
    };

    if (!envelopeId || !signerEmail) {
      return NextResponse.json(
        { error: "envelopeId and signerEmail are required" },
        { status: 400 },
      );
    }

    const normalizedEmail = signerEmail.toLowerCase().trim();

    // 1. Find the NdaSigningRecord for this envelope + signer
    const record = await prisma.ndaSigningRecord.findFirst({
      where: {
        envelopeId,
        signerEmail: normalizedEmail,
      },
    });

    if (!record) {
      return NextResponse.json(
        { error: "NDA signing record not found" },
        { status: 404 },
      );
    }

    // Already marked as signed
    if (record.signedAt) {
      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
        recordId: record.id,
        signedAt: record.signedAt,
      });
    }

    // 2. Verify the envelope recipient has actually signed
    const recipient = await prisma.envelopeRecipient.findFirst({
      where: {
        envelopeId,
        email: normalizedEmail,
        status: "SIGNED",
      },
      select: {
        id: true,
        signedAt: true,
        ipAddress: true,
        userAgent: true,
      },
    });

    if (!recipient) {
      return NextResponse.json(
        { error: "Signing not yet completed" },
        { status: 409 },
      );
    }

    // 3. Get the link's team for DataRoom auto-filing
    const link = await prisma.link.findUnique({
      where: { id: record.linkId },
      select: { teamId: true },
    });

    let filingId: string | null = null;

    // 4. Auto-file the signed NDA to DataRoom (org vault) — fire and forget
    if (link?.teamId) {
      try {
        // Fetch the envelope's source file info for filing
        const envelope = await prisma.envelope.findUnique({
          where: { id: envelopeId },
          select: {
            sourceFile: true,
            sourceFileName: true,
            title: true,
          },
        });

        if (envelope?.sourceFile) {
          // File to org vault under NDA subdirectory
          const filing = await fileToOrgVault({
            teamId: link.teamId,
            sourceType: "NDA_AGREEMENT",
            envelopeId,
            fileName: `NDA_${normalizedEmail.replace("@", "_at_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
            mimeType: "application/pdf",
            fileContent: Buffer.from(""), // Placeholder — actual filing uses envelope's signed PDF
            subPath: `nda/${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
          });

          filingId = filing.id;
        }
      } catch (err) {
        // Non-blocking — don't fail the completion if filing fails
        reportError(err as Error);
      }
    }

    // 5. Update the NdaSigningRecord
    const updated = await prisma.ndaSigningRecord.update({
      where: { id: record.id },
      data: {
        signedAt: recipient.signedAt || new Date(),
        ipAddress: recipient.ipAddress || record.ipAddress,
        userAgent: recipient.userAgent || record.userAgent,
        filingId,
      },
    });

    // 6. Audit log
    await logAuditEvent({
      eventType: "NDA_SIGNING_COMPLETED",
      teamId: link?.teamId ?? undefined,
      resourceType: "NdaSigningRecord",
      resourceId: record.id,
      metadata: {
        linkId: record.linkId,
        signerEmail: normalizedEmail,
        envelopeId,
        filingId,
      },
    }).catch((e) => reportError(e as Error));

    return NextResponse.json({
      success: true,
      recordId: updated.id,
      signedAt: updated.signedAt,
      filingId,
    });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
