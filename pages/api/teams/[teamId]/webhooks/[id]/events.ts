// MIGRATION STATUS: LEGACY
// App Router equivalent: none
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
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { teamId, id: webhookId } = req.query as { teamId: string; id: string };
  const userId = (session.user as CustomUser).id;

  const userTeam = await prisma.userTeam.findFirst({
    where: {
      userId,
      teamId,
    },
  });

  if (!userTeam) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method === "GET") {
    try {
      // Verify webhook exists and belongs to team
      await prisma.webhook.findUniqueOrThrow({
        where: {
          id: webhookId,
          teamId,
        },
        select: {
          pId: true,
        },
      });

      // Webhook events have no Prisma model - return empty data
      return res.status(200).json([]);
    } catch (error) {
      reportError(error as Error);
      logger.error("Error occurred", { module: "teams", metadata: { error: (error as Error).message } });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
