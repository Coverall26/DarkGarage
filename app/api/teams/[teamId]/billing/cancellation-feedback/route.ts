import { NextRequest, NextResponse } from "next/server";

import { CancellationReason } from "@/ee/features/billing/cancellation/lib/constants";
import { stripeInstance } from "@/ee/stripe";
import { isOldAccount } from "@/ee/stripe/utils";
import { waitUntil } from "@vercel/functions";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth/auth-options";
import { reportError } from "@/lib/error";
import { validateBody } from "@/lib/middleware/validate";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { CustomUser } from "@/lib/types";
import { log } from "@/lib/utils";
import { CancellationFeedbackSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId } = await params;
  const userId = (session.user as CustomUser).id;

  const { data: body, error: validationError } = await validateBody(req, CancellationFeedbackSchema);
  if (validationError) return validationError;

  const { reason, feedback } = body as unknown as { reason: CancellationReason; feedback?: string | null };

  try {
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
        users: {
          some: {
            userId: userId,
            role: {
              in: ["ADMIN", "MANAGER"],
            },
          },
        },
      },
      select: {
        id: true,
        stripeId: true,
        subscriptionId: true,
        plan: true,
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team does not exist" },
        { status: 400 },
      );
    }

    const reasonLabels: Record<CancellationReason, string> = {
      too_expensive: "Too expensive",
      unused: "Not used enough",
      missing_features: "Missing features",
      switched_service: "Switched to another service",
      other: "Other reason",
    };

    const feedbackData = {
      reason,
      reasonLabel: reasonLabels[reason],
      feedback: feedback || "",
      timestamp: new Date().toISOString(),
    };

    if (team.stripeId && team.subscriptionId) {
      const stripe = stripeInstance(isOldAccount(team.plan));

      waitUntil(
        stripe.subscriptions.update(team.subscriptionId, {
          cancellation_details: {
            feedback: reason,
            comment: feedback || "",
          },
        }),
      );
    }

    waitUntil(
      log({
        message: `Cancellation Feedback Received\n\nTeam: ${teamId} (${team.plan})\nReason: ${reasonLabels[reason]}\nFeedback: ${feedback || "No additional feedback provided"}\n\nTime: ${new Date().toLocaleString()}`,
        type: "info",
      }),
    );

    return NextResponse.json({
      success: true,
      feedbackData,
    });
  } catch (error) {
    reportError(error as Error);
    await log({
      message: `Error submitting cancellation feedback for team ${teamId}: ${error}`,
      type: "error",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
