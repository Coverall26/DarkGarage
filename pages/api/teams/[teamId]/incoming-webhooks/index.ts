// MIGRATION STATUS: LEGACY
// App Router equivalent: none
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";

import { authOptions } from "@/lib/auth/auth-options";
import { getServerSession } from "next-auth";

import { getFeatureFlags } from "@/lib/featureFlags";
import { generateWebhookId } from "@/lib/incoming-webhooks";
import { validateBodyPagesRouter } from "@/lib/middleware/validate";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";
import { TokenCreateSchema } from "@/lib/validations/teams";
import { reportError } from "@/lib/error";
import { logger } from "@/lib/logger";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { teamId } = req.query as { teamId: string };

  // Check feature flag
  const features = await getFeatureFlags({ teamId });
  if (!features.incomingWebhooks) {
    return res
      .status(403)
      .json({ error: "This feature is not available for your team" });
  }

  if (req.method === "GET") {
    try {
      const session = await getServerSession(req, res, authOptions);
      if (!session) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = (session.user as CustomUser).id;

      // Check if user is in team
      const { role } = await prisma.userTeam.findUniqueOrThrow({
        where: {
          userId_teamId: {
            userId,
            teamId,
          },
        },
        select: {
          role: true,
        },
      });

      if (!role) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Fetch webhooks
      const webhooks = await prisma.incomingWebhook.findMany({
        where: {
          teamId,
        },
        select: {
          id: true,
          name: true,
          externalId: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Transform the response to match the interface
      const transformedWebhooks = webhooks.map((webhook) => ({
        id: webhook.id,
        name: webhook.name,
        webhookId: webhook.externalId,
        createdAt: webhook.createdAt,
      }));

      return res.status(200).json(transformedWebhooks);
    } catch (error) {
      reportError(error as Error);
      logger.error("Error occurred", { module: "teams", metadata: { error: (error as Error).message } });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "POST") {
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { teamId } = req.query as { teamId: string };
    const userId = (session.user as CustomUser).id;

    try {
      // Check if user has access to team
      const userTeam = await prisma.userTeam.findFirst({
        where: {
          teamId,
          userId,
        },
      });

      if (!userTeam) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const parsed = validateBodyPagesRouter(req.body, TokenCreateSchema);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", issues: parsed.issues });
      }
      const { name } = parsed.data;

      // Generate webhook ID and secret
      const webhookId = generateWebhookId(teamId);

      // Create incoming webhook
      const incomingWebhook = await prisma.incomingWebhook.create({
        data: {
          name: "New Incoming Webhook",
          externalId: webhookId,
          teamId,
        },
      });

      return res.status(200).json({
        name: incomingWebhook.name,
        webhookId: incomingWebhook.externalId,
      });
    } catch (error) {
      reportError(error as Error);
      logger.error("Error creating webhook", { module: "teams", metadata: { error: (error as Error).message } });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const session = await getServerSession(req, res, authOptions);
      if (!session) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { teamId } = req.query as { teamId: string };
      const { webhookId } = req.body;
      const userId = (session.user as CustomUser).id;

      // Check if user is in team and has admin role
      const { role } = await prisma.userTeam.findUniqueOrThrow({
        where: {
          userId_teamId: {
            userId,
            teamId,
          },
        },
        select: {
          role: true,
        },
      });

      // Only admins can delete webhooks
      if (role !== "ADMIN") {
        return res
          .status(403)
          .json({ error: "Forbidden: Admin access required" });
      }

      // Delete the webhook
      await prisma.incomingWebhook.delete({
        where: {
          id: webhookId,
          teamId, // Ensure webhook belongs to the team
        },
      });

      return res.status(200).json({ message: "Webhook deleted successfully" });
    } catch (error) {
      reportError(error as Error);
      logger.error("Error occurred", { module: "teams", metadata: { error: (error as Error).message } });
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
