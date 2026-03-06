/**
 * POST /api/cron/sequences — Process due sequence enrollments.
 *
 * Called by Vercel Cron or external scheduler.
 * Executes outreach steps for enrollments where nextStepAt <= now.
 * Protected by CRON_SECRET header check.
 */

import { NextRequest, NextResponse } from "next/server";
import { reportError } from "@/lib/error";
import { processDueEnrollments } from "@/lib/outreach/sequence-engine";
import { receiver } from "@/lib/cron";
import { requireCronAuth } from "@/lib/middleware/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for batch processing

export async function POST(req: NextRequest) {
  try {
    // Verify cron authentication
    if (process.env.VERCEL === "1") {
      // Production: Upstash QStash signature verification
      if (receiver) {
        const body = await req.clone().text();
        const isValid = await receiver.verify({
          signature: req.headers.get("Upstash-Signature") || "",
          body,
        });
        if (!isValid) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
      }
    } else {
      // Defense-in-depth: verify CRON_SECRET in non-Vercel environments
      const cronAuth = requireCronAuth(req);
      if (cronAuth) return cronAuth;
    }

    const result = await processDueEnrollments(50);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Also support GET for Vercel Cron (which sends GET requests)
export async function GET(req: NextRequest) {
  return POST(req);
}
