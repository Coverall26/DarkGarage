// MIGRATION STATUS: DEPRECATED
// App Router equivalent: app/api/signatures/capture/route.ts
// See docs/PAGES-ROUTER-MIGRATION.md
// DEPRECATED: Migrate to App Router /api/esign/* routes. See docs/SIGNATURE-API-MAP.md
// Canonical equivalent: POST /api/esign/capture (Phase 2 migration candidate)
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/lib/auth/auth-options";
import { reportError } from "@/lib/error";
import prisma from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { logger } from "@/lib/logger";

const SignatureCaptureSchema = z.object({
  signatureImage: z
    .string()
    .min(1, "signatureImage is required")
    .refine((val) => val.startsWith("data:image/"), "Invalid image format")
    .refine((val) => val.length <= 500 * 1024, "Signature image too large (max 500KB)"),
  signatureType: z.enum(["draw", "type", "upload"]).optional(),
  initialsImage: z.string().nullable().optional(),
});

/**
 * POST /api/signatures/capture
 *
 * Store a signature image (base64 PNG) for reuse.
 * Associates with the current user's investor profile.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const parsed = SignatureCaptureSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "Invalid request body",
    });
  }

  const { signatureImage, signatureType, initialsImage } = parsed.data;

  try {
    // Find or create investor profile
    const investor = await prisma.investor.findFirst({
      where: { userId: session.user.id },
    });

    // Store signature data in metadata (no external storage needed for base64)
    const signatureData = {
      signatureImage,
      signatureType: signatureType || "draw",
      initialsImage: initialsImage || null,
      capturedAt: new Date().toISOString(),
      capturedBy: session.user.id,
    };

    // If investor exists, store in their fundData for reuse
    if (investor) {
      const existingFundData = (investor.fundData as Record<string, unknown>) || {};
      await prisma.investor.update({
        where: { id: investor.id },
        data: {
          fundData: {
            ...existingFundData,
            savedSignature: signatureData,
          },
        },
      });
    }

    await logAuditEvent({
      eventType: "DOCUMENT_SIGNED",
      userId: session.user.id,
      resourceType: "SignatureDocument",
      metadata: {
        action: "signature-captured",
        signatureType: signatureType || "draw",
        hasInitials: !!initialsImage,
      },
      ipAddress: req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    return res.status(200).json({
      message: "Signature captured",
      signatureType: signatureType || "draw",
      investorId: investor?.id,
    });
  } catch (error) {
    reportError(error as Error);
    logger.error("[SIGNATURE_CAPTURE] Error", { module: "signatures", metadata: { error: (error as Error).message } });
    return res.status(500).json({ error: "Internal server error" });
  }
}
