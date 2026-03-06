// MIGRATION STATUS: LEGACY
// App Router equivalent: none
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";

import { z } from "zod";

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
  pageNumber: z.string(),
  href: z.string(),
  versionNumber: z.number().optional(),
  dataroomId: z.string().nullable().optional(),
  sessionId: z.string().optional(),
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

  const { linkId, documentId, viewId, pageNumber, href, versionNumber, dataroomId, sessionId } =
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

  const clickEventId = newId("clickEvent");

  try {
    // Track click event via PostHog (fire-and-forget)
    publishServerEvent("click_event", {
      clickEventId,
      linkId,
      documentId,
      viewId,
      dataroomId: dataroomId || undefined,
      pageNumber,
      href,
      versionNumber: versionNumber || 1,
      sessionId: sessionId || undefined,
    }).catch((e) => reportError(e as Error));

    res.status(200).json({ message: "Click event recorded" });
  } catch (error) {
    log({
      message: `Failed to record click event for ${linkId}. \n\n ${error}`,
      type: "error",
      mention: true,
    });
    reportError(error as Error);
    res.status(500).json({ error: "Internal server error" });
  }
}
