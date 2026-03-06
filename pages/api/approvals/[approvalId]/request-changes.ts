// MIGRATION STATUS: LEGACY
// App Router equivalent: none
// See docs/PAGES-ROUTER-MIGRATION.md
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { authOptions } from "@/lib/auth/auth-options";
import { reportError } from "@/lib/error";
import prisma from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { ChangeRequestType } from "@prisma/client";

const ALLOWED_FIELD_NAMES = [
  "entityName",
  "firstName",
  "lastName",
  "email",
  "entityType",
  "accreditationStatus",
  "accreditationCategory",
  "addressLine1",
  "addressLine2",
  "addressCity",
  "addressState",
  "addressPostalCode",
  "addressCountry",
  "phone",
  "taxIdEncrypted",
  "sourceOfFunds",
  "occupation",
] as const;

const RequestChangesSchema = z.object({
  fundId: z.string().min(1, "fundId is required"),
  teamId: z.string().min(1, "teamId is required"),
  requestedChanges: z
    .array(
      z.object({
        changeType: z.enum(
          ["ENTITY_INFO", "ACCREDITATION", "DOCUMENT", "ADDRESS", "TAX_ID", "BANK_INFO"],
          { errorMap: () => ({ message: "Invalid changeType" }) },
        ),
        fieldName: z.enum(ALLOWED_FIELD_NAMES, {
          errorMap: () => ({
            message: `fieldName must be one of: ${ALLOWED_FIELD_NAMES.join(", ")}`,
          }),
        }),
        reason: z.string().min(1, "reason is required").max(2000),
        currentValue: z.string().max(1000).optional(),
        requestedValue: z.string().max(1000).optional(),
      }),
    )
    .min(1, "At least one change request is required")
    .max(20, "Maximum 20 change requests allowed"),
  notes: z.string().max(2000).optional(),
});

/**
 * POST /api/approvals/[approvalId]/request-changes
 *
 * Request changes from LP on flagged fields.
 * Creates ProfileChangeRequest records.
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

  const { approvalId } = req.query as { approvalId: string };

  const parsed = RequestChangesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "Invalid request body",
    });
  }

  const { fundId, teamId, requestedChanges, notes } = parsed.data;

  try {
    // Verify GP admin access
    const userTeam = await prisma.userTeam.findFirst({
      where: {
        userId: session.user.id,
        teamId,
        role: { in: ["OWNER", "ADMIN", "SUPER_ADMIN"] },
        status: "ACTIVE",
      },
    });

    if (!userTeam) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Extract investor ID
    const parts = approvalId.split("-");
    const entityId = parts.slice(1).join("-");

    const investor = await prisma.investor.findUnique({
      where: { id: entityId },
    });

    if (!investor) {
      return res.status(404).json({ error: "Investor not found" });
    }

    // Create ProfileChangeRequest records
    const changeRequests = await Promise.all(
      requestedChanges.map((change) =>
        prisma.profileChangeRequest.create({
          data: {
            investorId: entityId,
            fundId,
            requestedBy: session.user.id,
            status: "PENDING",
            changeType: change.changeType,
            fieldName: change.fieldName,
            reason: change.reason,
            currentValue: change.currentValue,
            requestedValue: change.requestedValue,
            gpNote: notes,
          },
        }),
      ),
    );

    // Update investor stage
    await prisma.investor.update({
      where: { id: entityId },
      data: {
        fundData: {
          ...((investor.fundData as Record<string, unknown>) || {}),
          stage: "UNDER_REVIEW",
          changesRequested: true,
          changesRequestedBy: session.user.id,
          changesRequestedAt: new Date().toISOString(),
        },
      },
    });

    await logAuditEvent({
      eventType: "INVESTOR_CHANGES_REQUESTED",
      userId: session.user.id,
      teamId,
      resourceType: "Investor",
      resourceId: entityId,
      metadata: {
        action: "request-changes",
        fundId,
        notes,
        changeRequestIds: changeRequests.map((cr) => cr.id),
        fieldsRequested: requestedChanges.map((c) => c.fieldName),
      },
      ipAddress: req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    });

    return res.status(200).json({
      message: "Changes requested from investor",
      stage: "UNDER_REVIEW",
      changeRequestCount: changeRequests.length,
    });
  } catch (error) {
    reportError(error as Error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
