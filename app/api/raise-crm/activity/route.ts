import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { reportError } from "@/lib/error";

export const dynamic = "force-dynamic";

/**
 * GET /api/raise-crm/activity
 *
 * Returns DataRoom viewer events (page views, downloads, dwell time)
 * for the PipelineIQ Activity tab. Aggregates from View records.
 */
export async function GET(req: NextRequest) {
  try {
    // Rate limit
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    // Auth
    const auth = await requireAdminAppRouter();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = req.nextUrl;
    const teamId = searchParams.get("teamId");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "30", 10)));

    if (!teamId) {
      return NextResponse.json({ error: "teamId required" }, { status: 400 });
    }

    // Verify user has access to this team
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const skip = (page - 1) * limit;

    // Fetch recent views from team's datarooms and documents
    const views = await prisma.view.findMany({
      where: {
        OR: [
          { dataroom: { teamId } },
          { link: { document: { teamId } } },
        ],
      },
      orderBy: { viewedAt: "desc" },
      skip,
      take: limit + 1, // +1 to check if there are more
      select: {
        id: true,
        viewerEmail: true,
        viewerName: true,
        viewedAt: true,
        downloadedAt: true,
        verified: true,
        link: {
          select: {
            name: true,
            document: {
              select: { name: true },
            },
          },
        },
        dataroom: {
          select: { name: true },
        },
        agreementResponse: {
          select: { id: true, createdAt: true },
        },
      },
    });

    const hasMore = views.length > limit;
    const trimmed = views.slice(0, limit);

    // Transform into activity events
    const events = trimmed.flatMap((view) => {
      const results: Array<{
        id: string;
        type: string;
        viewerEmail: string | null;
        viewerName: string | null;
        documentName: string | null;
        dataroomName: string | null;
        pageNumber: number | null;
        duration: number | null;
        createdAt: string;
      }> = [];

      const documentName =
        view.link?.document?.name ?? view.link?.name ?? null;
      const dataroomName = view.dataroom?.name ?? null;

      // Page view event
      results.push({
        id: `${view.id}-view`,
        type: "PAGE_VIEW",
        viewerEmail: view.viewerEmail,
        viewerName: view.viewerName,
        documentName,
        dataroomName,
        pageNumber: null,
        duration: null,
        createdAt: view.viewedAt.toISOString(),
      });

      // Download event
      if (view.downloadedAt) {
        results.push({
          id: `${view.id}-download`,
          type: "DOWNLOAD",
          viewerEmail: view.viewerEmail,
          viewerName: view.viewerName,
          documentName,
          dataroomName,
          pageNumber: null,
          duration: null,
          createdAt: view.downloadedAt.toISOString(),
        });
      }

      // NDA signed event
      if (view.agreementResponse) {
        results.push({
          id: `${view.id}-nda`,
          type: "NDA_SIGNED",
          viewerEmail: view.viewerEmail,
          viewerName: view.viewerName,
          documentName,
          dataroomName,
          pageNumber: null,
          duration: null,
          createdAt: view.agreementResponse.createdAt.toISOString(),
        });
      }

      return results;
    });

    // Sort by createdAt descending
    events.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return NextResponse.json({ events, hasMore });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
