// MIGRATION STATUS: CRITICAL
// App Router equivalent: none (Phase 2 migration target)
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";

import { authOptions } from "@/lib/auth/auth-options";
import { getServerSession } from "next-auth/next";

import { validateBodyPagesRouter } from "@/lib/middleware/validate";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";
import { reportError } from "@/lib/error";
import { DataroomGroupMembersBulkAddSchema } from "@/lib/validations/teams";
import { logger } from "@/lib/logger";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "POST") {
    // POST /api/teams/:teamId/datarooms/:id/groups/:groupId/members
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      res.status(401).end("Unauthorized");
      return;
    }

    const userId = (session.user as CustomUser).id;
    const {
      teamId,
      id: dataroomId,
      groupId,
    } = req.query as {
      teamId: string;
      id: string;
      groupId: string;
    };

    const parsed = validateBodyPagesRouter(req.body, DataroomGroupMembersBulkAddSchema);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Validation failed", issues: parsed.issues });
    }
    const { emails, domains, allowAll } = parsed.data;

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

      // Check if the group belongs to the dataroom
      const group = await prisma.viewerGroup.findUnique({
        where: {
          id: groupId,
          dataroomId: dataroomId,
        },
      });

      if (!group) {
        return res.status(404).end("Group not found");
      }

      // First, create or connect viewers
      await prisma.viewer.createMany({
        data: emails.map((email) => ({
          email,
          teamId,
        })),
        skipDuplicates: true,
      });

      const viewers = await prisma.viewer.findMany({
        where: {
          teamId: teamId,
          email: {
            in: emails,
          },
        },
        select: { id: true },
      });

      // Then, create the membership
      const members = await prisma.viewerGroupMembership.createMany({
        data: viewers.map((viewer) => ({
          groupId: groupId,
          viewerId: viewer.id,
        })),
      });

      // Update the group with the new domains and allowAll setting
      await prisma.viewerGroup.update({
        where: { id: groupId },
        data: { domains, allowAll },
      });

      res.status(201).json(members);
    } catch (error) {
      reportError(error as Error);
      logger.error("Request error", { module: "teams", metadata: { error: (error as Error).message } });
      res.status(500).json({ error: "Internal server error" });
    }
  } else {
    // We only allow POST requests
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
