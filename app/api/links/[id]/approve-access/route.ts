export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth/auth-options";
import { isUserAdminAsync } from "@/lib/constants/admins";
import { reportError } from "@/lib/error";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/resend";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { CustomUser } from "@/lib/types";
import { constructLinkUrl } from "@/lib/utils/link-url";

import AccessApprovedEmail from "@/components/emails/access-approved";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as CustomUser;
  const userEmail = user.email!.toLowerCase();

  const { id: linkId } = await params;
  const { requestId, action, denyReason } = (await req.json()) as {
    requestId: string;
    action: "approve" | "deny";
    denyReason?: string;
  };

  if (!requestId || !action) {
    return NextResponse.json(
      { error: "Request ID and action are required" },
      { status: 400 },
    );
  }

  try {
    const accessRequest = await prisma.accessRequest.findUnique({
      where: { id: requestId },
      include: {
        link: {
          include: {
            dataroom: {
              select: {
                id: true,
                name: true,
              },
            },
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!accessRequest) {
      return NextResponse.json(
        { error: "Access request not found" },
        { status: 404 },
      );
    }

    if (accessRequest.linkId !== linkId) {
      return NextResponse.json(
        { error: "Request does not match link" },
        { status: 400 },
      );
    }

    if (!(await isUserAdminAsync(userEmail))) {
      const userTeam = await prisma.userTeam.findFirst({
        where: {
          userId: user.id,
          teamId: accessRequest.teamId,
          role: { in: ["OWNER", "ADMIN", "SUPER_ADMIN"] },
        },
      });
      if (!userTeam) {
        return NextResponse.json(
          { error: "You don't have permission to manage this request" },
          { status: 403 },
        );
      }
    }

    if (accessRequest.status !== "PENDING") {
      return NextResponse.json(
        {
          error: `Request has already been ${accessRequest.status.toLowerCase()}`,
        },
        { status: 400 },
      );
    }

    if (action === "approve") {
      const link = accessRequest.link;

      await prisma.$transaction(async (tx) => {
        await tx.accessRequest.update({
          where: { id: requestId },
          data: {
            status: "APPROVED",
            reviewedBy: user.id,
            reviewedAt: new Date(),
          },
        });

        const currentLink = await tx.link.findUnique({
          where: { id: linkId },
          select: { allowList: true },
        });

        const updatedAllowList = [...(currentLink?.allowList || [])];
        const normalizedEmail = accessRequest.email.toLowerCase().trim();
        const normalizedAllowList = updatedAllowList.map((e) =>
          e.toLowerCase().trim(),
        );

        if (!normalizedAllowList.includes(normalizedEmail)) {
          updatedAllowList.push(accessRequest.email);
          await tx.link.update({
            where: { id: linkId },
            data: { allowList: updatedAllowList },
          });
        }
      });

      const accessUrl = constructLinkUrl({
        id: linkId,
        domainSlug: link.domainSlug,
        slug: link.slug,
      });

      try {
        await sendEmail({
          to: accessRequest.email,
          subject: `Access Approved: ${link.dataroom?.name || "Dataroom"}`,
          react: AccessApprovedEmail({
            recipientName: accessRequest.name,
            dataroomName: link.dataroom?.name || "Dataroom",
            teamName: link.team?.name || "FundRoom",
            accessUrl,
          }),
        });
      } catch (emailError) {
        reportError(emailError as Error);
      }

      return NextResponse.json({
        message: "Access approved successfully",
        email: accessRequest.email,
      });
    } else if (action === "deny") {
      await prisma.accessRequest.update({
        where: { id: requestId },
        data: {
          status: "DENIED",
          reviewedBy: user.id,
          reviewedAt: new Date(),
          denyReason: denyReason || null,
        },
      });

      return NextResponse.json({
        message: "Access denied",
        email: accessRequest.email,
      });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
