// MIGRATION STATUS: LEGACY
// App Router equivalent: none
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";
import { reportError } from "@/lib/error";
import { validateBodyPagesRouter } from "@/lib/middleware/validate";
import { QAStatusSchema } from "@/lib/validations/teams";
import { logger } from "@/lib/logger";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { teamId, questionId } = req.query as { teamId: string; questionId: string };
  const userId = (session.user as CustomUser).id;

  const userTeam = await prisma.userTeam.findFirst({
    where: {
      userId,
      teamId,
    },
  });

  if (!userTeam) {
    return res.status(403).json({ error: "Not authorized for this team" });
  }

  if (req.method === "PATCH") {
    const parsed = validateBodyPagesRouter(req.body, QAStatusSchema);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", issues: parsed.issues });
    }
    const { status } = parsed.data;

    try {
      const question = await prisma.dataroomQuestion.update({
        where: {
          id: questionId,
          teamId,
        },
        data: {
          status,
          resolvedAt: status === "CLOSED" ? new Date() : null,
        },
      });

      return res.status(200).json(question);
    } catch (error) {
      reportError(error as Error);
      logger.error("Error updating question status", { module: "teams", metadata: { error: (error as Error).message } });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
