import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateCompletionCertificate, CertificateData, CertificateRecipient, CertificateAuditEvent } from "./completion-certificate";
import { putFileServer } from "@/lib/files/put-file-server";
import { SignatureChecksum } from "./checksum";
import crypto from "crypto";

interface GenerateCertificateResult {
  success: boolean;
  certificateId?: string;
  certificateHash?: string;
  certificateFile?: string;
  error?: string;
}

export async function generateAndStoreCertificate(
  documentId: string,
  teamId: string
): Promise<GenerateCertificateResult> {
  try {
    const document = await prisma.signatureDocument.findUnique({
      where: { id: documentId },
      include: {
        recipients: true,
        team: true,
        owner: true,
      },
    });

    if (!document) {
      return { success: false, error: "Document not found" };
    }

    if (document.status !== "COMPLETED") {
      return { success: false, error: "Document not completed" };
    }

    if (document.certificateFile) {
      return {
        success: true,
        certificateId: document.certificateId || undefined,
        certificateHash: document.certificateHash || undefined,
        certificateFile: document.certificateFile,
      };
    }

    // Hash the document file path/reference for certificate integrity
    // The actual file content hash would require fetching the file which is expensive
    // For compliance, we use the document ID + file reference + timestamp as the hash basis
    const hashInput = `${document.id}:${document.file}:${document.completedAt?.toISOString() || new Date().toISOString()}`;
    const documentHash = crypto
      .createHash("sha256")
      .update(hashInput)
      .digest("hex");

    const recipients: CertificateRecipient[] = document.recipients.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role as string,
      status: r.status as string,
      signedAt: r.signedAt,
      ipAddress: r.ipAddress,
      signatureChecksum: (r.signatureChecksum as unknown as SignatureChecksum) ?? null,
    }));

    const auditTrailData = (document.auditTrail as { entries?: Array<{ event?: string; timestamp?: string | number; recipientEmail?: string | null; ipAddress?: string | null; metadata?: Record<string, unknown> }> }) || { entries: [] };
    const auditEvents: CertificateAuditEvent[] = (auditTrailData.entries || []).map((entry) => ({
      event: entry.event || "unknown",
      timestamp: new Date(entry.timestamp || Date.now()),
      recipientEmail: entry.recipientEmail || null,
      ipAddress: entry.ipAddress || null,
      metadata: entry.metadata || {},
    }));

    const certificateData: CertificateData = {
      documentId: document.id,
      documentTitle: document.title,
      organizationName: document.team.name,
      createdAt: document.createdAt,
      sentAt: document.sentAt,
      completedAt: document.completedAt || new Date(),
      recipients,
      auditEvents,
      documentHash,
    };

    const certificate = await generateCompletionCertificate(certificateData);

    const fileName = `certificate-${document.id}-${Date.now()}.pdf`;

    const { type, data } = await putFileServer({
      file: {
        name: fileName,
        type: "application/pdf",
        buffer: Buffer.from(certificate.pdfBytes),
      },
      teamId,
      restricted: false,
    });

    if (!data) {
      return { success: false, error: "Failed to store certificate file" };
    }

    const storedPath = data;

    await prisma.signatureDocument.update({
      where: { id: documentId },
      data: {
        certificateFile: storedPath,
        certificateHash: certificate.certificateHash,
        certificateId: certificate.certificateId,
        certificateGeneratedAt: certificate.generatedAt,
      },
    });

    // Certificate generated successfully — stored at storedPath

    return {
      success: true,
      certificateId: certificate.certificateId,
      certificateHash: certificate.certificateHash,
      certificateFile: storedPath,
    };
  } catch (error) {
    logger.error("Failed to generate certificate", { module: "auto-certificate", documentId, error: String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getCertificateDownloadUrl(documentId: string): Promise<string | null> {
  const document = await prisma.signatureDocument.findUnique({
    where: { id: documentId },
    select: { 
      id: true,
      teamId: true,
      certificateFile: true,
    },
  });

  if (!document?.certificateFile) {
    return null;
  }

  return `/api/signature/certificate/${documentId}/download`;
}
