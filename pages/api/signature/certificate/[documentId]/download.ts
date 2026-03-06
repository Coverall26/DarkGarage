// MIGRATION STATUS: CRITICAL
// App Router equivalent: none — unique PDF certificate gen
// See docs/PAGES-ROUTER-MIGRATION.md
// ACTIVE: Certificate download with server-side session auth. See docs/SIGNATURE-API-MAP.md
// No App Router equivalent yet — unique functionality (server-side PDF generation + download)
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth/auth-options";
import { getFile } from "@/lib/files/get-file";
import { logCertificateEvent } from "@/lib/audit/audit-logger";
import { DocumentStorageType } from "@prisma/client";
import { reportError } from "@/lib/error";
import { logger } from "@/lib/logger";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { documentId } = req.query;

    if (!documentId || typeof documentId !== "string") {
      return res.status(400).json({ error: "Document ID is required" });
    }

    const document = await prisma.signatureDocument.findUnique({
      where: { id: documentId },
      include: {
        team: {
          include: {
            users: {
              where: { userId: session.user.id as string },
            },
          },
        },
        recipients: true,
      },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (!document.certificateFile) {
      return res.status(404).json({ error: "Certificate not yet generated" });
    }

    // Check access: must be team member OR document recipient
    const userEmail = session.user?.email?.toLowerCase();
    const isTeamMember = document.team?.users && document.team.users.length > 0;
    const isRecipient = userEmail && document.recipients.some(
      (r) => r.email.toLowerCase() === userEmail
    );

    if (!isTeamMember && !isRecipient) {
      return res.status(403).json({ error: "Access denied" });
    }

    const certificatePath = document.certificateFile as string;
    
    const fileUrl = await getFile({ 
      type: DocumentStorageType.S3_PATH, 
      data: certificatePath 
    });

    if (!fileUrl) {
      return res.status(404).json({ error: "Certificate file not found" });
    }

    const certificateId = document.certificateId || documentId;
    const filename = `completion-certificate-${certificateId}.pdf`;

    await logCertificateEvent(req, {
      eventType: "CERTIFICATE_DOWNLOADED",
      userId: session.user.id as string | undefined,
      teamId: document.teamId,
      documentId: documentId,
      certificateId,
    });

    // Fetch the file from the URL and stream to client
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      return res.status(404).json({ error: "Certificate file not found" });
    }
    
    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, max-age=3600");

    return res.send(fileBuffer);
  } catch (error) {
    reportError(error as Error);
    logger.error("[CERTIFICATE_DOWNLOAD] Error", { module: "signature", metadata: { error: (error as Error).message } });
    return res.status(500).json({ error: "Internal server error" });
  }
}
