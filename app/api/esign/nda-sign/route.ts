/**
 * NDA Signing via SignSuite — Dataroom / Document Link Integration
 *
 * POST /api/esign/nda-sign — Initiate NDA signing for a dataroom/document link visitor.
 *   Creates a single-signer envelope from the link's signSuiteNdaDocumentId,
 *   tracks e-sig usage, and returns the signing token for the visitor.
 *
 * GET /api/esign/nda-sign?linkId=xxx&email=xxx — Check if signer has already signed NDA for this link.
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { createEnvelope } from "@/lib/esign/envelope-service";
import { recordDocumentCreated, recordDocumentSent } from "@/lib/esig/usage-service";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";

// ============================================================================
// GET — Check existing NDA signing status
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const { searchParams } = req.nextUrl;
    const linkId = searchParams.get("linkId");
    const email = searchParams.get("email");

    if (!linkId || !email) {
      return NextResponse.json(
        { error: "linkId and email are required" },
        { status: 400 },
      );
    }

    // Check if this signer has already completed NDA signing for this link
    const existing = await prisma.ndaSigningRecord.findFirst({
      where: {
        linkId,
        signerEmail: email.toLowerCase().trim(),
        signedAt: { not: null },
      },
      select: {
        id: true,
        signedAt: true,
        envelopeId: true,
      },
    });

    if (existing) {
      return NextResponse.json({
        signed: true,
        signedAt: existing.signedAt,
        recordId: existing.id,
      });
    }

    // Check if there's a pending (unsigned) record — signer started but didn't finish
    const pending = await prisma.ndaSigningRecord.findFirst({
      where: {
        linkId,
        signerEmail: email.toLowerCase().trim(),
        signedAt: null,
      },
      select: {
        id: true,
        envelopeId: true,
      },
    });

    if (pending && pending.envelopeId) {
      // Return the existing signing token so signer can resume
      const recipient = await prisma.envelopeRecipient.findFirst({
        where: {
          envelopeId: pending.envelopeId,
          email: email.toLowerCase().trim(),
        },
        select: { signingToken: true },
      });

      return NextResponse.json({
        signed: false,
        pending: true,
        recordId: pending.id,
        signingToken: recipient?.signingToken ?? null,
      });
    }

    return NextResponse.json({ signed: false, pending: false });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST — Initiate NDA signing for a link visitor
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const body = await req.json();
    const { linkId, email, name } = body as {
      linkId?: string;
      email?: string;
      name?: string;
    };

    if (!linkId || !email) {
      return NextResponse.json(
        { error: "linkId and email are required" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Fetch the link with SignSuite NDA config
    const link = await prisma.link.findUnique({
      where: { id: linkId },
      select: {
        id: true,
        enableSignSuiteNda: true,
        signSuiteNdaDocumentId: true,
        teamId: true,
      },
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (!link.enableSignSuiteNda || !link.signSuiteNdaDocumentId) {
      return NextResponse.json(
        { error: "SignSuite NDA is not enabled on this link" },
        { status: 400 },
      );
    }

    // 2. Check if already signed
    const existing = await prisma.ndaSigningRecord.findFirst({
      where: {
        linkId,
        signerEmail: normalizedEmail,
        signedAt: { not: null },
      },
    });

    if (existing) {
      return NextResponse.json({
        alreadySigned: true,
        signedAt: existing.signedAt,
        recordId: existing.id,
      });
    }

    // 3. Check for pending envelope — reuse if exists
    const pendingRecord = await prisma.ndaSigningRecord.findFirst({
      where: {
        linkId,
        signerEmail: normalizedEmail,
        signedAt: null,
        envelopeId: { not: null },
      },
    });

    if (pendingRecord && pendingRecord.envelopeId) {
      const recipient = await prisma.envelopeRecipient.findFirst({
        where: {
          envelopeId: pendingRecord.envelopeId,
          email: normalizedEmail,
        },
        select: { signingToken: true },
      });

      return NextResponse.json({
        recordId: pendingRecord.id,
        envelopeId: pendingRecord.envelopeId,
        signingToken: recipient?.signingToken ?? null,
        resumed: true,
      });
    }

    // 4. Fetch the NDA SignatureDocument to get source file info
    const ndaDoc = await prisma.signatureDocument.findUnique({
      where: { id: link.signSuiteNdaDocumentId },
      select: {
        id: true,
        title: true,
        file: true,
        storageType: true,
        numPages: true,
      },
    });

    if (!ndaDoc) {
      return NextResponse.json(
        { error: "NDA document template not found" },
        { status: 404 },
      );
    }

    if (!link.teamId) {
      return NextResponse.json(
        { error: "Link is not associated with a team" },
        { status: 400 },
      );
    }

    // 5. Track e-sig usage
    await recordDocumentCreated(link.teamId, "NDA_AGREEMENT");

    // 6. Create envelope with the visitor as sole signer
    const envelope = await createEnvelope({
      teamId: link.teamId,
      createdById: "system", // Auto-created by NDA gate
      title: `NDA — ${ndaDoc.title || "Non-Disclosure Agreement"}`,
      description: `Auto-generated NDA signing for link access`,
      signingMode: "SEQUENTIAL",
      emailSubject: `Please sign the NDA to access documents`,
      recipients: [
        {
          name: name || normalizedEmail,
          email: normalizedEmail,
          role: "SIGNER",
          order: 1,
        },
      ],
      sourceFile: ndaDoc.file,
      sourceStorageType: ndaDoc.storageType,
      sourceFileName: "NDA.pdf",
      sourceMimeType: "application/pdf",
      sourceNumPages: ndaDoc.numPages ?? undefined,
    });

    // 7. Track send usage
    await recordDocumentSent(link.teamId);

    // 8. Get the signing token for the recipient
    const recipient = envelope.recipients[0];
    const signingToken = recipient?.signingToken;

    // 9. Create NdaSigningRecord
    const record = await prisma.ndaSigningRecord.create({
      data: {
        linkId,
        envelopeId: envelope.id,
        signerEmail: normalizedEmail,
        signerName: name || null,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    // 10. Audit log
    await logAuditEvent({
      eventType: "NDA_SIGNING_INITIATED",
      teamId: link.teamId,
      resourceType: "NdaSigningRecord",
      resourceId: record.id,
      metadata: {
        linkId,
        signerEmail: normalizedEmail,
        envelopeId: envelope.id,
        documentId: link.signSuiteNdaDocumentId,
      },
    }).catch((e) => reportError(e as Error));

    return NextResponse.json({
      recordId: record.id,
      envelopeId: envelope.id,
      signingToken,
    });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
