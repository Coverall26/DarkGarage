// MIGRATION STATUS: LEGACY
// App Router equivalent: none
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";

import { z } from "zod";

import { VIDEO_EVENT_TYPES } from "@/lib/constants";
import { reportError } from "@/lib/error";
import { newId } from "@/lib/id-helper";
import prisma from "@/lib/prisma";
import { log } from "@/lib/utils";
import { apiRateLimiter } from "@/lib/security/rate-limiter";
import { publishServerEvent } from "@/lib/tracking/server-events";

const bodyValidation = z.object({
  linkId: z.string(),
  documentId: z.string(),
  viewId: z.string(),
  dataroomId: z.string().nullable().optional(),
  versionNumber: z.number().optional(),
  eventType: z.enum(VIDEO_EVENT_TYPES),
  startTime: z.number(),
  endTime: z.number().optional(),
  playbackRate: z.number().optional(),
  volume: z.number().optional(),
  isMuted: z.boolean().or(z.number()).optional(),
  isFocused: z.boolean().or(z.number()).optional(),
  isFullscreen: z.boolean().or(z.number()).optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const allowed = await apiRateLimiter(req, res);
  if (!allowed) return;

  const result = bodyValidation.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { linkId, documentId, viewId, dataroomId, versionNumber, eventType, startTime, endTime, playbackRate, volume, isMuted, isFocused, isFullscreen } =
    result.data;

  // Validate that the view exists and belongs to the specified link
  try {
    const view = await prisma.view.findUnique({
      where: { id: viewId, linkId },
      select: { id: true },
    });

    if (!view) {
      return res.status(400).json({ error: "Invalid view" });
    }
  } catch {
    return res.status(400).json({ error: "Invalid view" });
  }

  const videoViewId = newId("videoView");

  try {
    // Track video view event via PostHog (fire-and-forget)
    publishServerEvent("video_view_event", {
      videoViewId,
      linkId,
      documentId,
      viewId,
      dataroomId: dataroomId || undefined,
      versionNumber: versionNumber || 1,
      eventType,
      startTime,
      endTime: endTime || 0,
      playbackRate: playbackRate || 1,
      volume: volume || 1,
      isMuted: isMuted ? 1 : 0,
      isFocused: isFocused ? 1 : 0,
      isFullscreen: isFullscreen ? 1 : 0,
    }).catch((e) => reportError(e as Error));

    res.status(200).json({ message: "Video view recorded" });
  } catch (error) {
    log({
      message: `Failed to record video view for ${linkId}. \n\n ${error}`,
      type: "error",
      mention: true,
    });
    reportError(error as Error);
    res.status(500).json({ error: "Internal server error" });
  }
}
