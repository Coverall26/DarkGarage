// MIGRATION STATUS: DEPRECATED
// App Router equivalent: none
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { validateBodyPagesRouter } from "@/lib/middleware/validate";
import { ViewerNoteSchema } from "@/lib/validations/teams";
import { logger } from "@/lib/logger";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    const parsed = validateBodyPagesRouter(req.body, ViewerNoteSchema);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.issues });
    }
    const { viewId, content, documentId, dataroomId, linkId, pageNumber, viewerEmail, viewerName } = parsed.data;

    try {
      const view = await prisma.view.findUnique({
        where: { id: viewId },
        include: { link: true },
      });

      if (!view) {
        return res.status(404).json({ error: "View not found" });
      }

      if (documentId && view.documentId && documentId !== view.documentId) {
        return res.status(400).json({ error: "Document ID does not match the view" });
      }
      if (dataroomId && view.dataroomId && dataroomId !== view.dataroomId) {
        return res.status(400).json({ error: "Dataroom ID does not match the view" });
      }
      if (linkId && view.linkId && linkId !== view.linkId) {
        return res.status(400).json({ error: "Link ID does not match the view" });
      }

      const note = await prisma.viewerNote.create({
        data: {
          content,
          viewId,
          viewerEmail: viewerEmail || view.viewerEmail,
          viewerName: viewerName || view.viewerName,
          documentId,
          dataroomId,
          linkId: linkId || view.linkId!,
          pageNumber,
          teamId: view.teamId!,
        },
      });

      return res.status(201).json(note);
    } catch (error) {
      reportError(error as Error);
      logger.error("Error creating viewer note", { module: "viewer", metadata: { error: (error as Error).message } });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
