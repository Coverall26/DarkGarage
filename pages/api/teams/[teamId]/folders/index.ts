// MIGRATION STATUS: LEGACY
// App Router equivalent: none
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";

import { authOptions } from "@/lib/auth/auth-options";
import slugify from "@sindresorhus/slugify";
import { getServerSession } from "next-auth/next";

import { validateBodyPagesRouter } from "@/lib/middleware/validate";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";
import { reportError } from "@/lib/error";
import { FolderCreateSchema } from "@/lib/validations/teams";
import { logger } from "@/lib/logger";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "GET") {
    // GET /api/teams/:teamId/folders
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).end("Unauthorized");
    }

    const userId = (session.user as CustomUser).id;
    const { teamId, root } = req.query as { teamId: string; root?: string };

    try {
      // Check if the user is part of the team
      const teamAccess = await prisma.userTeam.findUnique({
        where: {
          userId_teamId: {
            userId: userId,
            teamId: teamId,
          },
        },
      });

      if (!teamAccess) {
        return res.status(401).end("Unauthorized");
      }

      /** if root is present then only get root folders */
      if (root === "true") {
        const folders = await prisma.folder.findMany({
          where: {
            teamId: teamId,
            parentId: null,
          },
          orderBy: {
            name: "asc",
          },
          include: {
            _count: {
              select: { documents: true, childFolders: true },
            },
          },
        });

        return res.status(200).json(folders);
      }

      const folders = await prisma.folder.findMany({
        where: {
          teamId: teamId,
        },
        orderBy: {
          name: "asc",
        },
        include: {
          documents: {
            select: {
              id: true,
              name: true,
              folderId: true,
            },
          },
          childFolders: {
            include: {
              documents: {
                select: {
                  id: true,
                  name: true,
                  folderId: true,
                },
              },
            },
          },
        },
      });

      return res.status(200).json(folders);
    } catch (error) {
      reportError(error as Error);
      logger.error("Request error", { module: "teams", metadata: { error: (error as Error).message } });
      return res.status(500).json({ error: "Internal server error" });
    }
  } else if (req.method === "POST") {
    // POST /api/teams/:teamId/folders
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      res.status(401).end("Unauthorized");
      return;
    }

    const userId = (session.user as CustomUser).id;

    const { teamId } = req.query as { teamId: string };
    const parsed = validateBodyPagesRouter(req.body, FolderCreateSchema);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Validation failed", issues: parsed.issues });
    }
    const { name, path } = parsed.data;

    const parentFolderPath = path ? "/" + path : "/";

    try {
      // Check if the user is part of the team
      const teamAccess = await prisma.userTeam.findUnique({
        where: {
          userId_teamId: {
            userId: userId,
            teamId: teamId,
          },
        },
      });

      if (!teamAccess) {
        return res.status(401).end("Unauthorized");
      }

      const parentFolder = await prisma.folder.findUnique({
        where: {
          teamId_path: {
            teamId: teamId,
            path: parentFolderPath,
          },
        },
        select: {
          id: true,
          name: true,
          path: true,
        },
      });

      let folderName = name;
      let counter = 1;
      const MAX_RETRIES = 50;

      let childFolderPath = path
        ? "/" + path + "/" + slugify(folderName)
        : "/" + slugify(folderName);

      while (counter <= MAX_RETRIES) {
        const existingFolder = await prisma.folder.findUnique({
          where: {
            teamId_path: {
              teamId: teamId,
              path: childFolderPath,
            },
          },
        });

        if (!existingFolder) break;

        folderName = `${name} (${counter})`;
        childFolderPath = path
          ? "/" + path + "/" + slugify(folderName)
          : "/" + slugify(folderName);
        counter++;
      }

      if (counter > MAX_RETRIES) {
        return res.status(400).json({
          error: "Too many folders with similar names",
        });
      }

      const folder = await prisma.folder.create({
        data: {
          name: folderName,
          path: childFolderPath,
          parentId: parentFolder?.id ?? null,
          teamId: teamId,
        },
      });

      const folderWithDocs = {
        ...folder,
        documents: [],
        childFolders: [],
        parentFolderPath: parentFolderPath,
      };

      res.status(201).json(folderWithDocs);
    } catch (error) {
      reportError(error as Error);
      logger.error("Request error", { module: "teams", metadata: { error: (error as Error).message } });
      res.status(500).json({ error: "Internal server error" });
    }
  } else {
    // We only allow POST requests
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
