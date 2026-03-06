import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Resend } from "resend";
import { Role } from "@prisma/client";
import { reportError } from "@/lib/error";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { requireLPAuthAppRouter } from "@/lib/auth/rbac";
import { validateBody } from "@/lib/middleware/validate";
import { LpNoteSchema } from "@/lib/validations/lp";

export const dynamic = "force-dynamic";

/**
 * POST /api/lp/notes
 * Creates a new investor note/message to the GP team.
 */
export async function POST(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const auth = await requireLPAuthAppRouter();
    if (auth instanceof NextResponse) return auth;

    const parsed = await validateBody(req, LpNoteSchema);
    if (parsed.error) return parsed.error;
    const { content } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      include: { investorProfile: true },
    });

    if (!user?.investorProfile) {
      return NextResponse.json(
        { error: "Investor profile not found" },
        { status: 404 },
      );
    }

    const defaultTeam = await prisma.team.findFirst({
      orderBy: { createdAt: "asc" },
    });

    if (!defaultTeam) {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    const note = await prisma.investorNote.create({
      data: {
        investorId: user.investorProfile.id,
        teamId: defaultTeam.id,
        content: content.trim(),
        isFromInvestor: true,
      },
    });

    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);

        const teamOwner = await prisma.userTeam.findFirst({
          where: { teamId: defaultTeam.id, role: "OWNER" as Role },
          include: { user: true },
        });

        const gpEmail =
          teamOwner?.user?.email || process.env.DEFAULT_GP_EMAIL;

        if (gpEmail) {
          await resend.emails.send({
            from:
              process.env.RESEND_FROM_EMAIL ||
              "FundRoom <noreply@fundroom.ai>",
            to: gpEmail,
            subject: `New Message from Investor: ${user.investorProfile.entityName || auth.email}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a1a1a;">New Investor Message</h2>
                <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <p style="margin: 0; color: #333;"><strong>From:</strong> ${user.investorProfile.entityName || "Investor"}</p>
                  <p style="margin: 8px 0 0 0; color: #333;"><strong>Email:</strong> ${auth.email}</p>
                </div>
                <div style="background: #fff; border: 1px solid #e0e0e0; padding: 16px; border-radius: 8px;">
                  <p style="margin: 0; color: #333; white-space: pre-wrap;">${content.trim()}</p>
                </div>
                <p style="color: #666; font-size: 12px; margin-top: 24px;">
                  This message was sent via the Investor Portal. Log in to respond.
                </p>
              </div>
            `,
          });
        }
      } catch (emailErr) {
        reportError(emailErr as Error);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Note sent successfully",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
