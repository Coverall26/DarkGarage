export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth/auth-options";
import { LIMITS } from "@/lib/constants";
import { reportError } from "@/lib/error";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { getDocumentWithTeamAndUser } from "@/lib/team/helper";
import { getViewDurationStatsPg } from "@/lib/tracking/postgres-stats";
import { CustomUser } from "@/lib/types";
import { log } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userId = (session.user as CustomUser).id;

  try {
    // get the numPages from document
    const result = await prisma.link.findUnique({
      where: {
        id: id,
      },
      select: {
        deletedAt: true,
        document: {
          select: {
            id: true,
            numPages: true,
            versions: {
              where: { isPrimary: true },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { numPages: true },
            },
            team: {
              select: {
                id: true,
                plan: true,
              },
            },
          },
        },
      },
    });

    // If link doesn't exist (deleted), return empty array
    if (!result || !result.document || result.deletedAt) {
      return NextResponse.json([]);
    }

    const docId = result.document.id;

    // check if the the team that own the document has the current user
    await getDocumentWithTeamAndUser({
      docId,
      userId,
      options: {
        team: {
          select: {
            users: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    const numPages =
      result?.document?.versions[0]?.numPages ||
      result?.document?.numPages ||
      0;

    const views = await prisma.view.findMany({
      where: {
        linkId: id,
      },
      orderBy: {
        viewedAt: "desc",
      },
    });

    // limit the number of views to 20 on free plan
    const limitedViews =
      result?.document?.team?.plan === "free"
        ? views.slice(0, LIMITS.views)
        : views;

    const durationsPromises = limitedViews.map((view) => {
      return getViewDurationStatsPg({
        documentId: view.documentId!,
        viewId: view.id,
      });
    });

    const durations = await Promise.all(durationsPromises);

    // Sum up durations for each view
    const summedDurations = durations.map((duration) => {
      return duration.data.reduce(
        (totalDuration, data) => totalDuration + data.sum_duration,
        0,
      );
    });

    // Construct the response combining views and their respective durations
    const viewsWithDuration = limitedViews.map((view, index) => {
      // calculate the completion rate
      const completionRate = numPages
        ? (durations[index].data.length / numPages) * 100
        : 0;

      return {
        ...view,
        duration: durations[index],
        totalDuration: summedDurations[index],
        completionRate: completionRate.toFixed(),
      };
    });

    return NextResponse.json(viewsWithDuration);
  } catch (error) {
    log({
      message: `Failed to get views for link: _${id}_. \n\n ${error} \n\n*Metadata*: \`{userId: ${userId}}\``,
      type: "error",
    });
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
