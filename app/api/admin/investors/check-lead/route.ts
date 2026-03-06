import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth/auth-options";
import { errorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { requireAdminAppRouter } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/investors/check-lead?email=xxx
 *
 * Lead matching: check if an email exists as a dataroom viewer.
 * Returns view data if found (date, document name, link ID).
 * Used by Manual Investor Entry wizard Step 1 on email blur.
 */
export async function GET(req: NextRequest) {
  // Defense-in-depth: admin auth check (additive to edge middleware)
  const adminAuth = await requireAdminAppRouter();
  if (adminAuth instanceof NextResponse) return adminAuth;

  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  if (!email) {
    return NextResponse.json(
      { error: "email query param is required" },
      { status: 400 },
    );
  }

  try {
    // Verify user has at least one admin team membership
    const userTeam = await prisma.userTeam.findFirst({
      where: {
        userId: session.user.id,
        role: { in: ["OWNER", "ADMIN", "SUPER_ADMIN"] },
        status: "ACTIVE",
      },
    });

    if (!userTeam) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check views table for this email in teams the user manages
    const view = await prisma.view.findFirst({
      where: {
        viewerEmail: email.toLowerCase(),
        link: {
          document: {
            teamId: userTeam.teamId,
          },
        },
      },
      include: {
        link: {
          select: {
            id: true,
            name: true,
            document: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { viewedAt: "desc" },
    });

    if (!view) {
      // Also check marketplace waitlist
      const waitlistEntry = await prisma.marketplaceWaitlist.findFirst({
        where: { email: email.toLowerCase() },
      });

      if (waitlistEntry) {
        return NextResponse.json({
          match: {
            email: email.toLowerCase(),
            viewedAt: waitlistEntry.createdAt.toISOString(),
            linkId: "",
            documentName: "Marketplace Waitlist",
            source: "waitlist",
          },
        });
      }

      return NextResponse.json({ match: null });
    }

    return NextResponse.json({
      match: {
        email: email.toLowerCase(),
        viewedAt: view.viewedAt.toISOString(),
        linkId: view.link?.id || "",
        documentName:
          view.link?.document?.name || view.link?.name || "Dataroom",
        source: "dataroom_view",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
