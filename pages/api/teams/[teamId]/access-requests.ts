// MIGRATION STATUS: LEGACY
// App Router equivalent: none
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";
import { isAdminEmail } from "@/lib/constants/admins";
import { reportError } from "@/lib/error";
import { AccessRequestStatus } from "@prisma/client";
import { logger } from "@/lib/logger";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = session.user as CustomUser;
  const userEmail = user.email!.toLowerCase();
  const { teamId } = req.query as { teamId: string };

  if (!isAdminEmail(userEmail)) {
    const userTeam = await prisma.userTeam.findFirst({
      where: { teamId, userId: user.id },
    });
    if (!userTeam) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  if (req.method === "GET") {
    try {
      const { status = "PENDING" } = req.query as { status?: string };
      const validStatuses: string[] = Object.values(AccessRequestStatus);
      const statusValue = validStatuses.includes(status) ? (status as AccessRequestStatus) : AccessRequestStatus.PENDING;

      const accessRequests = await prisma.accessRequest.findMany({
        where: {
          teamId,
          status: statusValue,
        },
        include: {
          link: {
            select: {
              id: true,
              name: true,
              dataroom: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(accessRequests);
    } catch (error) {
      reportError(error as Error);
      logger.error("Failed to fetch access requests", { module: "teams", metadata: { error: (error as Error).message } });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
