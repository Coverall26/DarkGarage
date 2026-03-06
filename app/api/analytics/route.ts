export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { addDays } from "date-fns";
import { getServerSession } from "next-auth";
import { z } from "zod";

import prisma from "@/lib/prisma";
import {
  getTotalDocumentDurationPg,
  getTotalLinkDurationPg,
  getViewDurationStatsPg,
  getViewTotalDurationPg,
} from "@/lib/tracking/postgres-stats";
import { CustomUser } from "@/lib/types";
import { durationFormat } from "@/lib/utils";

import { authOptions } from "@/lib/auth/auth-options";
import { reportError } from "@/lib/error";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

const analyticsQuerySchema = z.object({
  interval: z.enum(["24h", "7d", "30d", "custom"]),
  type: z.enum(["overview", "links", "documents", "visitors", "views"]),
  teamId: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const result = analyticsQuerySchema.safeParse(params);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 },
      );
    }

    const {
      interval,
      type,
      teamId,
      startDate: startStr,
      endDate: endStr,
    } = result.data;

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
        users: {
          some: {
            userId: (session.user as CustomUser).id,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if free plan user is trying to access data beyond 30 days
    if (interval === "custom" && team.plan.includes("free")) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);

      if (startStr && new Date(startStr) < thirtyDaysAgo) {
        return NextResponse.json(
          {
            error:
              "Free plan users can only access data from the last 30 days",
          },
          { status: 401 },
        );
      }
    }

    // get the start date for the interval
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (interval) {
      case "24h":
        startDate = new Date(now);
        startDate.setHours(startDate.getHours() - 23);
        startDate.setMinutes(0, 0, 0);
        break;
      case "7d":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "30d":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 29);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "custom":
        startDate = new Date(startStr || addDays(new Date(), -6));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(endStr || now);

        if (startDate > endDate) {
          return NextResponse.json(
            { error: "The 'From' date must be before the 'To' date." },
            { status: 400 },
          );
        }
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
    }

    const intervalFilter = { gte: startDate, lte: endDate };

    switch (type) {
      case "overview": {
        const [viewStats, graphData] = await Promise.all([
          prisma.view.findMany({
            where: {
              teamId,
              viewedAt: intervalFilter,
              isArchived: false,
              viewType: "DOCUMENT_VIEW",
            },
            select: {
              id: true,
              viewerEmail: true,
              linkId: true,
              documentId: true,
              viewerId: true,
            },
          }),
          interval === "24h"
            ? prisma.$queryRaw`
                SELECT
                  DATE_TRUNC('hour', "viewedAt") as date,
                  COUNT(*) as views
                FROM "View"
                WHERE
                  "teamId" = ${teamId}
                  AND "viewedAt" >= ${startDate}
                  AND "isArchived" = false
                  AND "viewType" = 'DOCUMENT_VIEW'
                GROUP BY DATE_TRUNC('hour', "viewedAt")
                ORDER BY date ASC
              `
            : interval === "custom"
              ? prisma.$queryRaw`
                SELECT
                  DATE_TRUNC('day', "viewedAt") as date,
                  COUNT(*) as views
                FROM "View"
                WHERE
                  "teamId" = ${teamId}
                  AND "viewedAt" >= ${startDate}
                  AND "viewedAt" <= ${endDate}
                  AND "isArchived" = false
                  AND "viewType" = 'DOCUMENT_VIEW'
                GROUP BY DATE_TRUNC('day', "viewedAt")
                ORDER BY date ASC
              `
              : prisma.$queryRaw`
                SELECT
                  DATE_TRUNC('day', "viewedAt") as date,
                  COUNT(*) as views
                FROM "View"
                WHERE
                  "teamId" = ${teamId}
                  AND "viewedAt" >= ${startDate}
                  AND "isArchived" = false
                  AND "viewType" = 'DOCUMENT_VIEW'
                GROUP BY DATE_TRUNC('day', "viewedAt")
                ORDER BY date ASC
              `,
        ]);

        const uniqueLinks = new Set(viewStats.map((view) => view.linkId));
        const uniqueDocuments = new Set(
          viewStats.map((view) => view.documentId),
        );
        const uniqueVisitors = new Set(viewStats.map((view) => view.viewerId));

        return NextResponse.json({
          counts: {
            links: uniqueLinks.size,
            documents: uniqueDocuments.size,
            visitors: uniqueVisitors.size,
            views: viewStats.length,
          },
          graph: (graphData as { date: Date; views: bigint }[]).map(
            (point) => ({
              date: point.date,
              views: Number(point.views),
            }),
          ),
        });
      }

      case "links": {
        const links = await prisma.link.findMany({
          where: {
            teamId,
            views: {
              some: {
                viewedAt: intervalFilter,
                viewType: "DOCUMENT_VIEW",
                isArchived: false,
              },
            },
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            domainSlug: true,
            domainId: true,
            documentId: true,
            _count: {
              select: {
                views: {
                  where: {
                    viewedAt: intervalFilter,
                    viewType: "DOCUMENT_VIEW",
                    isArchived: false,
                  },
                },
              },
            },
            views: {
              where: {
                viewedAt: intervalFilter,
                viewType: "DOCUMENT_VIEW",
                isArchived: false,
              },
              orderBy: {
                viewedAt: "desc",
              },
              take: 1,
              select: {
                viewedAt: true,
              },
            },
            document: {
              select: {
                name: true,
                versions: {
                  orderBy: {
                    createdAt: "desc",
                  },
                  take: 1,
                  select: {
                    numPages: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        const transformedLinks = await Promise.all(
          links.map(async (link) => {
            let totalDurationSeconds = 0;

            try {
              const durationData = await getTotalLinkDurationPg({
                linkId: link.id,
              });
              totalDurationSeconds = durationData.sum_duration;
            } catch (error) {
              reportError(error as Error);
            }

            return {
              id: link.id,
              name: link.name || `Link #${link.id.slice(-5)}`,
              url: link.domainId
                ? `https://${link.domainSlug}/${link.slug}`
                : `${process.env.NEXT_PUBLIC_MARKETING_URL}/view/${link.id}`,
              documentName: link.document?.name || "Unknown",
              documentId: link.documentId,
              views: link._count.views,
              totalDuration: durationFormat(totalDurationSeconds),
              lastViewed: link.views[0]?.viewedAt || null,
            };
          }),
        );

        return NextResponse.json(transformedLinks);
      }

      case "documents": {
        const documents = await prisma.document.findMany({
          where: {
            teamId,
            views: {
              some: {
                viewedAt: intervalFilter,
                viewType: "DOCUMENT_VIEW",
                isArchived: false,
              },
            },
          },
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                views: {
                  where: {
                    viewedAt: intervalFilter,
                    viewType: "DOCUMENT_VIEW",
                    isArchived: false,
                  },
                },
              },
            },
            views: {
              where: {
                viewedAt: intervalFilter,
                viewType: "DOCUMENT_VIEW",
                isArchived: false,
              },
              orderBy: {
                viewedAt: "desc",
              },
              take: 1,
              select: {
                viewedAt: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        const transformedDocuments = await Promise.all(
          documents.map(async (doc) => {
            let totalDurationSeconds = 0;
            try {
              const durationData = await getTotalDocumentDurationPg({
                documentId: doc.id,
                excludedViewIds: [],
              });

              if (durationData.data && durationData.data[0]) {
                totalDurationSeconds = durationData.data[0].sum_duration;
              }
            } catch (error) {
              reportError(error as Error);
            }

            return {
              id: doc.id,
              name: doc.name,
              views: doc._count.views,
              totalDuration: durationFormat(totalDurationSeconds),
              lastViewed: doc.views[0]?.viewedAt || null,
            };
          }),
        );

        return NextResponse.json(transformedDocuments);
      }

      case "visitors": {
        const viewers = await prisma.viewer.findMany({
          where: {
            teamId,
            views: {
              some: {
                viewedAt: intervalFilter,
                isArchived: false,
                viewType: "DOCUMENT_VIEW",
              },
            },
          },
          include: {
            views: {
              orderBy: {
                viewedAt: "desc",
              },
              where: {
                viewType: "DOCUMENT_VIEW",
                viewedAt: intervalFilter,
                isArchived: false,
              },
            },
          },
        });

        const transformedVisitors = await Promise.all(
          viewers.map(async (viewer) => {
            const uniqueDocuments = new Set(
              viewer.views.map((view) => view.documentId),
            );

            let totalDuration = 0;
            try {
              const durations = await Promise.all(
                viewer.views.map((view) =>
                  getViewTotalDurationPg({ viewId: view.id }),
                ),
              );
              totalDuration = durations.reduce((sum, d) => sum + d, 0);
            } catch (error) {
              reportError(error as Error);
            }

            const viewerName = viewer.views.find(
              (v) => v.viewerName,
            )?.viewerName;

            return {
              email: viewer.email,
              viewerId: viewer.id,
              totalViews: viewer.views.length,
              lastActive: viewer.views[0]?.viewedAt || new Date(),
              uniqueDocuments: uniqueDocuments.size,
              verified: viewer.verified,
              totalDuration,
              viewerName: viewerName || null,
            };
          }),
        );

        return NextResponse.json(transformedVisitors);
      }

      case "views": {
        const views = await prisma.view.findMany({
          where: {
            teamId,
            viewedAt: intervalFilter,
            isArchived: false,
            viewType: "DOCUMENT_VIEW",
          },
          include: {
            document: {
              select: {
                id: true,
                name: true,
                versions: {
                  orderBy: {
                    createdAt: "desc",
                  },
                  take: 1,
                  select: {
                    createdAt: true,
                    numPages: true,
                  },
                },
              },
            },
            link: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            viewedAt: "desc",
          },
        });

        const transformedViews = await Promise.all(
          views.map(async (view) => {
            let totalDuration = 0;
            let completionRate = 0;

            if (view.document?.id) {
              try {
                const pageData = await getViewDurationStatsPg({
                  documentId: view.document.id,
                  viewId: view.id,
                });

                if (pageData.data && pageData.data.length > 0) {
                  totalDuration = pageData.data.reduce(
                    (sum, page) => sum + page.sum_duration,
                    0,
                  );

                  const numPages =
                    view.document.versions[0]?.numPages || 0;
                  completionRate = numPages
                    ? (pageData.data.length / numPages) * 100
                    : 0;
                }
              } catch (error) {
                reportError(error as Error);
              }
            }

            return {
              id: view.id,
              viewerEmail: view.viewerEmail,
              documentName:
                view.document?.name ||
                `Document #${view.document?.id.slice(-5)}`,
              linkName:
                view.link?.name || `Link #${view.link?.id.slice(-5)}`,
              viewedAt: view.viewedAt,
              totalDuration,
              completionRate: Math.round(completionRate),
              verified: view.verified || false,
              documentId: view.document?.id,
              teamId,
            };
          }),
        );

        return NextResponse.json(transformedViews);
      }

      default: {
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
      }
    }
  } catch (error) {
    reportError(error as Error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request parameters" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
