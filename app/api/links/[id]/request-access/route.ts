export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { createAdminMagicLink } from "@/lib/auth/admin-magic-link";
import { getTeamAdminEmails } from "@/lib/constants/admins";
import { reportError } from "@/lib/error";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/resend";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

import AccessRequestNotificationEmail from "@/components/emails/access-request-notification";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const { id: linkId } = await params;
  const { email, name, message } = (await req.json()) as {
    email: string;
    name?: string;
    message?: string;
  };

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const link = await prisma.link.findUnique({
      where: { id: linkId },
      include: {
        dataroom: {
          select: {
            id: true,
            name: true,
            teamId: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        group: {
          select: {
            id: true,
            members: {
              include: {
                viewer: true,
              },
            },
          },
        },
      },
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (!link.teamId || !link.team) {
      return NextResponse.json(
        { error: "Invalid link configuration" },
        { status: 400 },
      );
    }

    const normalizedAllowList = (link.allowList || []).map((e: string) =>
      e.toLowerCase().trim(),
    );
    if (normalizedAllowList.includes(normalizedEmail)) {
      return NextResponse.json({
        message:
          "You already have access to this dataroom. Please enter your email to continue.",
        status: "HAS_ACCESS",
        hasAccess: true,
      });
    }

    if (link.group?.members) {
      const isGroupMember = link.group.members.some(
        (m) => m.viewer.email.toLowerCase().trim() === normalizedEmail,
      );
      if (isGroupMember) {
        return NextResponse.json({
          message:
            "You already have access to this dataroom. Please enter your email to continue.",
          status: "HAS_ACCESS",
          hasAccess: true,
        });
      }
    }

    const existingRequest = await prisma.accessRequest.findUnique({
      where: {
        linkId_email: {
          linkId,
          email: normalizedEmail,
        },
      },
    });

    if (existingRequest) {
      if (existingRequest.status === "PENDING") {
        return NextResponse.json({
          message:
            "Your access request is pending review. You will receive an email once approved.",
          status: "PENDING",
        });
      }
      if (existingRequest.status === "APPROVED") {
        return NextResponse.json({
          message:
            "Your access has been approved. Please enter your email to continue.",
          status: "APPROVED",
          hasAccess: true,
        });
      }
      if (existingRequest.status === "DENIED") {
        return NextResponse.json(
          {
            error: "Your access request was previously denied.",
            status: "DENIED",
          },
          { status: 403 },
        );
      }
    }

    const accessRequest = await prisma.accessRequest.create({
      data: {
        email: normalizedEmail,
        name: name || null,
        message: message || null,
        linkId,
        dataroomId: link.dataroomId,
        teamId: link.teamId,
      },
    });

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      `https://${req.headers.get("host") || "app.fundroom.ai"}`;
    const dataroomPath = link.dataroomId
      ? `/datarooms/${link.dataroomId}`
      : "/datarooms";
    const redirectPath = `${dataroomPath}?accessRequest=${accessRequest.id}&linkId=${linkId}`;

    // Get admin emails dynamically from the team
    const adminEmails = await getTeamAdminEmails(link.teamId);

    for (const adminEmail of adminEmails) {
      try {
        // Create admin magic link for the approval URL
        const magicLinkResult = await createAdminMagicLink({
          email: adminEmail,
          redirectPath,
          baseUrl,
        });

        // Use magic link or fallback to admin login (not visitor login)
        const approvalUrl =
          magicLinkResult?.magicLink ||
          `${baseUrl}/admin/login?next=${encodeURIComponent(redirectPath)}`;

        await sendEmail({
          to: adminEmail,
          subject: `Access Request: ${link.dataroom?.name || "Dataroom"}`,
          react: AccessRequestNotificationEmail({
            requesterEmail: normalizedEmail,
            requesterName: name,
            requesterMessage: message,
            dataroomName: link.dataroom?.name || "Dataroom",
            teamName: link.team.name,
            approvalUrl,
          }),
        });
      } catch (emailError) {
        reportError(emailError as Error);
      }
    }

    return NextResponse.json({
      message:
        "Access request submitted successfully. You will receive an email once approved.",
      status: "PENDING",
      requestId: accessRequest.id,
    });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
