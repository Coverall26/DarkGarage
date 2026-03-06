// MIGRATION STATUS: CRITICAL
// App Router equivalent: none (Phase 2 migration target)
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";

import { authOptions } from "@/lib/auth/auth-options";
import { getServerSession } from "next-auth/next";

import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";
import { reportError } from "@/lib/error";
import { logger } from "@/lib/logger";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      teamId,
      id: documentId,
      viewId,
    } = req.query as {
      teamId: string;
      id: string;
      viewId: string;
    };
    const userId = (session.user as CustomUser).id;

    // Check document access
    const doc = await prisma.document.findFirst({
      where: {
        id: documentId,
        teamId,
        team: {
          users: {
            some: {
              userId,
            },
          },
        },
      },
      include: {
        versions: {
          where: {
            isPrimary: true,
          },
          select: {
            length: true,
          },
        },
      },
    });

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Video events have no Prisma model - return empty data
    return res.status(200).json({ data: [] });
  } catch (error) {
    reportError(error as Error);
    logger.error("Error fetching video stats", { module: "teams", metadata: { error: (error as Error).message } });
    return res.status(500).json({ error: "Internal server error" });
  }
}
