// MIGRATION STATUS: CRITICAL
// App Router equivalent: none (unique PDF generation)
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth/auth-options";
import { getFile } from "@/lib/files/get-file";
import { CustomUser } from "@/lib/types";
import { ratelimit } from "@/lib/redis";
import {
  generateCompletionCertificate,
  CertificateData,
  CertificateRecipient,
  CertificateAuditEvent,
  generateCertificateId,
} from "@/lib/signature/completion-certificate";
import { generateDocumentHash, SignatureChecksum } from "@/lib/signature/checksum";
import { reportError } from "@/lib/error";
import { logger } from "@/lib/logger";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { documentId, token } = req.query;

  if (!documentId || typeof documentId !== "string") {
    return res.status(400).json({ error: "Document ID required" });
  }

  const ipAddress =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    req.socket.remoteAddress ||
    "unknown";

  const limiter = ratelimit(10, "1 m");
  const { success } = await limiter.limit(`certificate:${ipAddress}`);

  if (!success) {
    return res.status(429).json({
      error: "Too many requests. Please try again later.",
    });
  }

  try {
    let hasAccess = false;
    let userEmail: string | null = null;

    if (token && typeof token === "string") {
      const recipient = await prisma.signatureRecipient.findFirst({
        where: {
          documentId,
          OR: [
            { signingToken: token },
            {
              signatureChecksum: {
                path: ["verificationToken"],
                equals: token,
              },
            },
          ],
        },
      });

      if (recipient) {
        hasAccess = true;
        userEmail = recipient.email;
      }
    }

    if (!hasAccess) {
      const session = await getServerSession(req, res, authOptions);
      const user = session?.user as CustomUser;

      if (user) {
        const team = await prisma.team.findFirst({
          where: {
            users: { some: { userId: user.id } },
            signatureDocuments: { some: { id: documentId } },
          },
        });

        if (team) {
          hasAccess = true;
          userEmail = user.email || null;
        }
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    const document = await prisma.signatureDocument.findUnique({
      where: { id: documentId },
      include: {
        recipients: {
          orderBy: { signingOrder: "asc" },
        },
        team: {
          select: { name: true },
        },
      },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (document.status !== "COMPLETED") {
      return res.status(400).json({
        error: "Certificate only available for completed documents",
      });
    }

    if (!document.completedAt) {
      return res.status(400).json({
        error: "Document completion date not recorded",
      });
    }

    const auditLogs = await prisma.signatureAuditLog.findMany({
      where: { documentId },
      orderBy: { createdAt: "asc" },
    });

    let documentHash = "";
    try {
      const fileUrl = await getFile({
        type: document.storageType,
        data: document.file,
      });
      const response = await fetch(fileUrl);
      const buffer = await response.arrayBuffer();
      documentHash = generateDocumentHash(Buffer.from(buffer));
    } catch (error) {
      reportError(error as Error);
      logger.error("Error getting document hash", { module: "sign", metadata: { error: (error as Error).message } });
      documentHash = "Unable to retrieve document hash";
    }

    const certificateRecipients: CertificateRecipient[] = document.recipients.map(
      (r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        status: r.status,
        signedAt: r.signedAt,
        ipAddress: r.ipAddress,
        signatureChecksum: r.signatureChecksum as SignatureChecksum | null,
      })
    );

    const certificateEvents: CertificateAuditEvent[] = auditLogs.map((log) => ({
      event: log.event,
      timestamp: log.createdAt,
      recipientEmail: log.recipientEmail,
      ipAddress: log.ipAddress,
      metadata: log.metadata as Record<string, unknown> | undefined,
    }));

    const certificateData: CertificateData = {
      documentId: document.id,
      documentTitle: document.title,
      organizationName: document.team.name,
      createdAt: document.createdAt,
      sentAt: document.sentAt,
      completedAt: document.completedAt,
      recipients: certificateRecipients,
      auditEvents: certificateEvents,
      documentHash,
    };

    const certificate = await generateCompletionCertificate(certificateData);

    const sanitizedTitle = document.title
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 50);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitizedTitle}_completion_certificate.pdf"`
    );
    res.setHeader("X-Certificate-Id", certificate.certificateId);
    res.setHeader("X-Certificate-Hash", certificate.certificateHash);

    return res.send(Buffer.from(certificate.pdfBytes));
  } catch (error) {
    reportError(error as Error);
    logger.error("Certificate generation error", { module: "sign", metadata: { error: (error as Error).message } });
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getCertificateInfo(documentId: string) {
  const document = await prisma.signatureDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      status: true,
      completedAt: true,
    },
  });

  if (!document || document.status !== "COMPLETED" || !document.completedAt) {
    return null;
  }

  return {
    certificateId: generateCertificateId(document.id, document.completedAt),
    completedAt: document.completedAt,
    available: true,
  };
}
