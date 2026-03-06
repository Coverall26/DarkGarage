/**
 * Persona KYC Hooks
 * 
 * Post-document completion hooks for triggering Persona verification.
 */

import prisma from "@/lib/prisma";
import { createInquiry, isPersonaConfigured, mapPersonaStatus } from "@/lib/persona";
import { logger } from "@/lib/logger";

interface TriggerVerificationParams {
  email: string;
  name: string;
  documentId: string;
  teamId: string;
}

/**
 * Trigger Persona KYC verification for an investor after document signing
 * Called post-subscription document completion
 */
export async function triggerPersonaVerification({
  email,
  name,
  documentId,
  teamId,
}: TriggerVerificationParams): Promise<void> {
  if (!isPersonaConfigured()) {
    logger.warn("Persona not configured (PERSONA_API_KEY or PERSONA_TEMPLATE_ID missing), skipping KYC verification", { module: "persona-hooks" });
    return;
  }
  
  // Verify the Persona columns exist by checking if we can query them
  try {
    await prisma.$queryRaw`SELECT "personaStatus" FROM "Investor" LIMIT 1`;
  } catch (err) {
    logger.error("Persona columns not found in database, run migrations first", { module: "persona-hooks" });
    return;
  }

  try {
    const investor = await prisma.investor.findFirst({
      where: {
        user: { email },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!investor) {
      return;
    }

    // Persona fields are added via raw SQL migration and may not be in Prisma types yet
    const investorData = investor as typeof investor & {
      personaStatus?: string;
      personaInquiryId?: string;
    };

    if (investorData.personaStatus === "APPROVED") {
      return;
    }

    if (investorData.personaInquiryId && investorData.personaStatus === "PENDING") {
      return;
    }

    // Parse name into first/last
    const nameParts = name.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Create reference ID for tracking
    const referenceId = `inv_${investor.id}_${Date.now()}`;

    // Create Persona inquiry
    const inquiry = await createInquiry({
      referenceId,
      email,
      firstName,
      lastName,
    });

    // Update investor with Persona inquiry details (raw SQL for Persona-specific columns)
    await prisma.$executeRaw`
      UPDATE "Investor" 
      SET "personaInquiryId" = ${inquiry.id},
          "personaReferenceId" = ${referenceId},
          "personaStatus" = ${mapPersonaStatus(inquiry.attributes.status)},
          "personaData" = ${JSON.stringify({
            createdAt: inquiry.attributes["created-at"],
            documentId,
            teamId,
          })}::jsonb,
          "updatedAt" = NOW()
      WHERE id = ${investor.id}
    `;

    // Inquiry created successfully — verification link provided via LP portal

    // Note: The actual verification link will be provided to the investor
    // via the LP portal embedded flow, not via email redirect
  } catch (error) {
    logger.error("Error triggering Persona verification", { module: "persona-hooks", email, error: String(error) });
    throw error;
  }
}

/**
 * Update investor KYC status from Persona webhook
 */
export async function updateInvestorKycStatus({
  inquiryId,
  status,
  referenceId,
  data,
}: {
  inquiryId: string;
  status: string;
  referenceId: string;
  data: Record<string, any>;
}): Promise<void> {
  try {
    // Find investor by Persona inquiry ID or reference ID using raw query
    const investors = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Investor" 
      WHERE "personaInquiryId" = ${inquiryId} 
         OR "personaReferenceId" = ${referenceId}
      LIMIT 1
    `;

    if (!investors || investors.length === 0) {
      logger.error("No investor found for Persona inquiry", { module: "persona-hooks", inquiryId });
      return;
    }

    const investorId = investors[0].id;
    const mappedStatus = mapPersonaStatus(status);
    const isApproved = mappedStatus === "APPROVED";

    // Update using raw SQL to avoid TS issues with new fields
    if (isApproved) {
      await prisma.$executeRaw`
        UPDATE "Investor" 
        SET "personaInquiryId" = ${inquiryId},
            "personaStatus" = ${mappedStatus},
            "personaVerifiedAt" = NOW(),
            "personaData" = ${JSON.stringify(data)}::jsonb,
            "accreditationStatus" = 'KYC_VERIFIED',
            "accreditationExpiresAt" = ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)},
            "updatedAt" = NOW()
        WHERE id = ${investorId}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE "Investor" 
        SET "personaInquiryId" = ${inquiryId},
            "personaStatus" = ${mappedStatus},
            "personaData" = ${JSON.stringify(data)}::jsonb,
            "updatedAt" = NOW()
        WHERE id = ${investorId}
      `;
    }

    // KYC status updated successfully
  } catch (error) {
    logger.error("Error updating KYC status", { module: "persona-hooks", inquiryId, error: String(error) });
    throw error;
  }
}
