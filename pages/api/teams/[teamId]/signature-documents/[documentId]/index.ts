// MIGRATION STATUS: CRITICAL
// App Router equivalent: none — Phase 2 priority
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import { getFile } from "@/lib/files/get-file";
import { reportError } from "@/lib/error";
import { validateBodyPagesRouter } from "@/lib/middleware/validate";
import { SignatureDocumentUpdateSchema } from "@/lib/validations/teams";
import { logger } from "@/lib/logger";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { teamId, documentId } = req.query as {
    teamId: string;
    documentId: string;
  };

  const userTeam = await prisma.userTeam.findFirst({
    where: {
      teamId,
      userId: session.user.id,
    },
  });

  if (!userTeam) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    return handleGet(res, teamId, documentId);
  } else if (req.method === "PUT") {
    return handlePut(req, res, teamId, documentId);
  } else if (req.method === "DELETE") {
    return handleDelete(res, teamId, documentId);
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}

async function handleGet(
  res: NextApiResponse,
  teamId: string,
  documentId: string
) {
  try {
    const document = await prisma.signatureDocument.findFirst({
      where: {
        id: documentId,
        teamId,
      },
      include: {
        recipients: {
          orderBy: { signingOrder: "asc" },
        },
        fields: {
          orderBy: [{ pageNumber: "asc" }, { y: "asc" }],
        },
      },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    let fileUrl = null;
    if (document.file) {
      try {
        fileUrl = await getFile({ 
          type: document.storageType, 
          data: document.file 
        });
      } catch (err) {
        reportError(err as Error);
        logger.error("Error getting file URL", { module: "teams", metadata: { error: (err as Error).message } });
      }
    }

    return res.status(200).json({ ...document, fileUrl });
  } catch (error) {
    reportError(error as Error);
    logger.error("Error fetching signature document", { module: "teams", metadata: { error: (error as Error).message } });
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handlePut(
  req: NextApiRequest,
  res: NextApiResponse,
  teamId: string,
  documentId: string
) {
  try {
    const parsed = validateBodyPagesRouter(req.body, SignatureDocumentUpdateSchema);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.issues });
    }
    const {
      title,
      description,
      emailSubject,
      emailMessage,
      status,
      expirationDate,
      voidedReason,
    } = parsed.data;

    const existingDoc = await prisma.signatureDocument.findFirst({
      where: { id: documentId, teamId },
    });

    if (!existingDoc) {
      return res.status(404).json({ error: "Document not found" });
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (emailSubject !== undefined) updateData.emailSubject = emailSubject;
    if (emailMessage !== undefined) updateData.emailMessage = emailMessage;
    if (expirationDate !== undefined)
      updateData.expirationDate = expirationDate ? new Date(expirationDate) : null;

    if (status !== undefined) {
      updateData.status = status;
      if (status === "SENT" && !existingDoc.sentAt) {
        updateData.sentAt = new Date();
      }
      if (status === "COMPLETED") {
        updateData.completedAt = new Date();
      }
      if (status === "VOIDED") {
        updateData.voidedAt = new Date();
        updateData.voidedReason = voidedReason || null;
      }
      if (status === "DECLINED") {
        updateData.declinedAt = new Date();
      }
    }

    const document = await prisma.signatureDocument.update({
      where: { id: documentId },
      data: updateData,
      include: {
        recipients: {
          orderBy: { signingOrder: "asc" },
        },
        fields: true,
      },
    });

    return res.status(200).json(document);
  } catch (error) {
    reportError(error as Error);
    logger.error("Error updating signature document", { module: "teams", metadata: { error: (error as Error).message } });
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handleDelete(
  res: NextApiResponse,
  teamId: string,
  documentId: string
) {
  try {
    const document = await prisma.signatureDocument.findFirst({
      where: { id: documentId, teamId },
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (document.status !== "DRAFT") {
      return res.status(400).json({
        error: "Only draft documents can be deleted. Use void for sent documents.",
      });
    }

    await prisma.signatureDocument.delete({
      where: { id: documentId },
    });

    return res.status(200).json({ message: "Document deleted" });
  } catch (error) {
    reportError(error as Error);
    logger.error("Error deleting signature document", { module: "teams", metadata: { error: (error as Error).message } });
    return res.status(500).json({ error: "Internal server error" });
  }
}
