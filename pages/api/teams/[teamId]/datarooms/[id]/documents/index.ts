// MIGRATION STATUS: CRITICAL
// App Router equivalent: none (Phase 2 migration target)
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";

import { authOptions } from "@/lib/auth/auth-options";
import { runs } from "@/lib/jobs";
import { waitUntil } from "@vercel/functions";
import { getServerSession } from "next-auth/next";

import { errorhandler } from "@/lib/errorHandler";
import { validateBodyPagesRouter } from "@/lib/middleware/validate";
import prisma from "@/lib/prisma";
import { sendDataroomChangeNotificationTask } from "@/lib/trigger/dataroom-change-notification";
import { CustomUser } from "@/lib/types";
import { log } from "@/lib/utils";
import { sortItemsByIndexAndName } from "@/lib/utils/sort-items-by-index-name";
import { DataroomDocumentAddSchema } from "@/lib/validations/teams";
import { logger } from "@/lib/logger";


export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "GET") {
    // GET /api/teams/:teamId/datarooms/:id/documents
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).end("Unauthorized");
    }

    const userId = (session.user as CustomUser).id;
    const { teamId, id: dataroomId } = req.query as {
      teamId: string;
      id: string;
    };

    try {
      // Check if the user is part of the team
      const team = await prisma.team.findUnique({
        where: {
          id: teamId,
          users: {
            some: {
              userId: userId,
            },
          },
        },
      });

      if (!team) {
        return res.status(401).end("Unauthorized");
      }

      const documents = await prisma.dataroomDocument.findMany({
        where: {
          dataroomId: dataroomId,
          folderId: null,
        },
        orderBy: [
          { orderIndex: "asc" },
          {
            document: {
              name: "asc",
            },
          },
        ],
        select: {
          id: true,
          dataroomId: true,
          folderId: true,
          orderIndex: true,
          hierarchicalIndex: true,
          createdAt: true,
          updatedAt: true,
          document: {
            select: {
              id: true,
              name: true,
              type: true,
              versions: {
                select: { id: true, hasPages: true },
              },
              isExternalUpload: true,
              _count: {
                select: {
                  views: { where: { dataroomId } },
                  versions: true,
                },
              },
            },
          },
        },
      });

      const sortedDocuments = sortItemsByIndexAndName(documents);

      return res.status(200).json(sortedDocuments);
    } catch (error) {
      logger.error("Request error", { module: "teams", metadata: { error: (error as Error).message } });
      return res
        .status(500)
        .json({ error: "Internal server error" });
    }
  } else if (req.method === "POST") {
    // POST /api/teams/:teamId/datarooms/:id/documents
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      res.status(401).end("Unauthorized");
      return;
    }

    const { teamId, id: dataroomId } = req.query as {
      teamId: string;
      id: string;
    };

    const userId = (session.user as CustomUser).id;

    const parsed = validateBodyPagesRouter(req.body, DataroomDocumentAddSchema);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Validation failed", issues: parsed.issues });
    }
    const { documentId, folderPathName } = parsed.data;

    try {
      // Check if the user is part of the team
      const team = await prisma.team.findUnique({
        where: {
          id: teamId,
          users: {
            some: {
              userId: userId,
            },
          },
        },
      });

      if (!team) {
        return res.status(401).end("Unauthorized");
      }

      const folder = await prisma.dataroomFolder.findUnique({
        where: {
          dataroomId_path: {
            dataroomId,
            path: "/" + folderPathName,
          },
        },
        select: {
          id: true,
        },
      });

      const document = await prisma.dataroomDocument.create({
        data: {
          documentId,
          dataroomId,
          folderId: folder?.id,
        },
        include: {
          dataroom: {
            select: {
              enableChangeNotifications: true,
              links: {
                select: { id: true },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
              _count: {
                select: { viewerGroups: true, permissionGroups: true },
              },
            },
          },
        },
      });

      // Check if the team has the dataroom change notification enabled
      if (document.dataroom.enableChangeNotifications) {
        try {
          // Get all delayed and queued runs for this dataroom
          const allRuns = await runs.list({
            taskIdentifier: ["send-dataroom-change-notification"],
            tag: [`dataroom_${dataroomId}`],
            status: ["DELAYED", "QUEUED"],
            period: "10m",
          });

          // Cancel any existing unsent notification runs for this dataroom
          await Promise.all(allRuns.data.map((run) => runs.cancel(run.id)));

          waitUntil(
            sendDataroomChangeNotificationTask.trigger(
              {
                dataroomId,
                dataroomDocumentId: document.id,
                senderUserId: userId,
                teamId,
              },
              {
                idempotencyKey: `dataroom-notification-${teamId}-${dataroomId}-${document.id}`,
                tags: [
                  `team_${teamId}`,
                  `dataroom_${dataroomId}`,
                  `document_${document.id}`,
                ],
                delay: { until: new Date(Date.now() + 10 * 60 * 1000) }, // 10 minute delay
              },
            ),
          );
        } catch (notificationError) {
          logger.error("Failed to send dataroom change notification", { module: "teams", metadata: { error: (notificationError as Error).message } });
        }
      }

      return res.status(201).json(document);
    } catch (error) {
      log({
        message: `Failed to create dataroom document. \n\n*teamId*: _${teamId}_, \n\n*dataroomId*: ${dataroomId} \n\n ${error}`,
        type: "error",
      });
      errorhandler(error, res);
    }
  } else {
    // We only allow GET requests
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
