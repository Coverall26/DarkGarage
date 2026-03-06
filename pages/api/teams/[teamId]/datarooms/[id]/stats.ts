// MIGRATION STATUS: CRITICAL
// App Router equivalent: none — Phase 2 priority
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";

import { View } from "@prisma/client";
import { getServerSession } from "next-auth/next";

import { errorhandler } from "@/lib/errorHandler";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";

import { authOptions } from "@/lib/auth/auth-options";

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "GET") {
    // GET /api/teams/:teamId/documents/:id/stats
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      return res.status(401).end("Unauthorized");
    }

    const {
      teamId,
      id: dataroomId,
      excludeTeamMembers,
    } = req.query as {
      teamId: string;
      id: string;
      excludeTeamMembers?: string;
    };

    const userId = (session.user as CustomUser).id;

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

      const dataroom = await prisma.dataroom.findUnique({
        where: {
          id: dataroomId,
        },
        include: {
          views: true,
        },
      });

      const users = await prisma.user.findMany({
        where: {
          teams: {
            some: {
              teamId: teamId,
            },
          },
        },
        select: {
          email: true,
        },
      });

      const views = dataroom?.views;

      // if there are no views, return an empty array
      if (!views) {
        return res.status(200).json({
          views: [],
          duration: { data: [] },
          total_duration: 0,
          avgCompletionRate: 0,
        });
      }

      const dataroomViews = views.filter(
        (view) => view.viewType === "DATAROOM_VIEW",
      );
      const documentViews = views.filter(
        (view) => view.viewType === "DOCUMENT_VIEW",
      );

      // exclude views from the team's members
      let excludedViews: View[] = [];
      if (excludeTeamMembers) {
        excludedViews = documentViews.filter((view) => {
          return users.some((user) => user.email === view.viewerEmail);
        });
      }

      const filteredViews = documentViews.filter(
        (view) => !excludedViews.map((view) => view.id).includes(view.id),
      );

      // Query PageView for dataroom duration
      const excludedViewIds = excludedViews.map((view) => view.id);
      const durationResult = await prisma.pageView.groupBy({
        by: ["viewId"],
        where: {
          dataroomId: dataroomId,
          viewId: excludedViewIds.length > 0 ? { notIn: excludedViewIds } : undefined,
        },
        _sum: {
          duration: true,
        },
      });

      const duration = {
        data: durationResult.map((row) => ({
          viewId: row.viewId,
          sum_duration: Math.round((row._sum.duration || 0) / 1000),
        })),
      };

      const total_duration = duration.data.reduce(
        (totalDuration, data) => totalDuration + data.sum_duration,
        0,
      );

      const stats = {
        dataroomViews: dataroomViews,
        documentViews: documentViews,
        duration: duration.data,
        total_duration,
      };

      return res.status(200).json(stats);
    } catch (error) {
      errorhandler(error, res);
    }
  } else {
    // We only allow GET requests
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
