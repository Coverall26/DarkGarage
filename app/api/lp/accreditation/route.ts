import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logAccreditationEvent } from "@/lib/audit/audit-logger";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { requireLPAuthAppRouter } from "@/lib/auth/rbac";
import { validateBody } from "@/lib/middleware/validate";
import { AccreditationSchema } from "@/lib/validations/lp";

export const dynamic = "force-dynamic";

const HIGH_VALUE_THRESHOLD = 200000;

function shouldAutoApprove(
  commitmentAmount: number,
  fundMinimum: number,
  allCheckboxesConfirmed: boolean,
): { autoApprove: boolean; needsReview: boolean; reason: string } {
  const isHighValue = commitmentAmount >= HIGH_VALUE_THRESHOLD;
  const meetsMinimum =
    fundMinimum > 0 ? commitmentAmount >= fundMinimum : isHighValue;

  if (!allCheckboxesConfirmed) {
    return {
      autoApprove: false,
      needsReview: true,
      reason: "Not all acknowledgments confirmed",
    };
  }

  if (isHighValue) {
    return {
      autoApprove: true,
      needsReview: false,
      reason: "High-value commitment with self-attestation",
    };
  }

  if (meetsMinimum && fundMinimum > 0) {
    return {
      autoApprove: true,
      needsReview: false,
      reason: "Minimum commitment met with self-attestation",
    };
  }

  return {
    autoApprove: false,
    needsReview: true,
    reason: "Below high-value threshold, requires manual review",
  };
}

export async function GET(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const auth = await requireLPAuthAppRouter();
    if (auth instanceof NextResponse) return auth;

    if (!auth.investorId) {
      return NextResponse.json(
        { error: "Investor profile not found" },
        { status: 404 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      include: {
        investorProfile: {
          include: {
            accreditationAcks: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
            fund: true,
          },
        },
      },
    });

    if (!user?.investorProfile) {
      return NextResponse.json(
        { error: "Investor profile not found" },
        { status: 404 },
      );
    }

    const latestAck = user.investorProfile.accreditationAcks[0];

    const investorData = user.investorProfile;

    const minimumInvestment = investorData.fund?.minimumInvestment
      ? parseFloat(investorData.fund.minimumInvestment.toString())
      : 0;
    const eligibleForSimplifiedPath =
      minimumInvestment >= HIGH_VALUE_THRESHOLD;

    return NextResponse.json({
      accreditationStatus: investorData.accreditationStatus,
      accreditationType: investorData.accreditationType,
      accreditationExpiresAt: investorData.accreditationExpiresAt,
      highValueThreshold: HIGH_VALUE_THRESHOLD,
      eligibleForSimplifiedPath,
      latestAcknowledgment: latestAck
        ? {
            id: latestAck.id,
            method: latestAck.method,
            accreditationType: latestAck.accreditationType,
            completedAt: latestAck.completedAt,
            kycStatus: latestAck.kycStatus,
          }
        : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const auth = await requireLPAuthAppRouter();
    if (auth instanceof NextResponse) return auth;

    const parsed = await validateBody(req, AccreditationSchema);
    if (parsed.error) return parsed.error;
    const {
      accreditationType,
      accreditationDetails,
      confirmAccredited,
      confirmRiskAware,
      confirmDocReview,
      confirmRepresentations,
      useSimplifiedPath,
      intendedCommitment,
      accreditationDocIds,
      accreditationVerificationMethod,
    } = parsed.data;

    // Validate doc IDs if provided — filter to non-empty strings
    const validDocIds: string[] = Array.isArray(accreditationDocIds)
      ? accreditationDocIds.filter(
          (id: string) => id.length > 0,
        )
      : [];
    const verificationMethodValue = accreditationVerificationMethod || null;

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      include: {
        investorProfile: {
          include: { fund: true },
        },
      },
    });

    if (!user?.investorProfile) {
      return NextResponse.json(
        { error: "Investor profile not found" },
        { status: 404 },
      );
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const sessionId = req.cookies.get("next-auth.session-token")?.value ||
      req.cookies.get("__Secure-next-auth.session-token")?.value ||
      `session_${Date.now()}`;
    const geoLocation =
      ipAddress !== "unknown" ? `IP-derived: ${ipAddress}` : null;

    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);

    const commitmentAmount = intendedCommitment ?? 0;
    const fundMinimum = user.investorProfile.fund?.minimumInvestment
      ? parseFloat(user.investorProfile.fund.minimumInvestment.toString())
      : 0;

    const allCheckboxesConfirmed =
      confirmAccredited &&
      confirmRiskAware &&
      confirmDocReview &&
      confirmRepresentations;
    const approvalDecision = shouldAutoApprove(
      commitmentAmount,
      fundMinimum,
      allCheckboxesConfirmed,
    );

    const isHighValueInvestor =
      commitmentAmount >= HIGH_VALUE_THRESHOLD ||
      fundMinimum >= HIGH_VALUE_THRESHOLD;

    // Document upload verification overrides auto-approval — GP must review docs
    const hasDocumentUpload =
      verificationMethodValue === "DOCUMENT_UPLOAD" && validDocIds.length > 0;
    if (hasDocumentUpload) {
      approvalDecision.autoApprove = false;
      approvalDecision.needsReview = true;
      approvalDecision.reason =
        "Document upload verification — requires GP review";
    }

    const verificationMethod = hasDocumentUpload
      ? "DOCUMENT_UPLOAD"
      : useSimplifiedPath && isHighValueInvestor
        ? "SELF_ATTEST_HIGH_VALUE"
        : verificationMethodValue === "SELF_CERTIFICATION"
          ? "SELF_CERTIFICATION"
          : "SELF_CERTIFIED";

    const accreditationStatus = approvalDecision.autoApprove
      ? "SELF_CERTIFIED"
      : "PENDING";

    const [updatedInvestor, accreditationAck] = await prisma.$transaction([
      prisma.investor.update({
        where: { id: user.investorProfile.id },
        data: {
          accreditationStatus,
          accreditationType,
          accreditationExpiresAt: approvalDecision.autoApprove
            ? expirationDate
            : null,
          onboardingStep: approvalDecision.autoApprove ? 2 : 1,
          updatedAt: new Date(),
          ...(validDocIds.length > 0 && {
            accreditationDocumentIds: validDocIds,
          }),
          ...(verificationMethodValue && {
            accreditationMethod: verificationMethodValue,
          }),
        },
      }),
      prisma.accreditationAck.create({
        data: {
          investorId: user.investorProfile.id,
          acknowledged: true,
          method: verificationMethod,
          accreditationType,
          accreditationDetails: {
            ...accreditationDetails,
            intendedCommitment: commitmentAmount,
            simplifiedPathUsed: useSimplifiedPath && isHighValueInvestor,
            highValueThreshold: HIGH_VALUE_THRESHOLD,
            approvalReason: approvalDecision.reason,
            ...(validDocIds.length > 0 && {
              documentUploadIds: validDocIds,
              documentUploadCount: validDocIds.length,
            }),
            ...(verificationMethodValue && {
              verificationMethod: verificationMethodValue,
            }),
          },
          confirmAccredited,
          confirmRiskAware,
          confirmDocReview,
          confirmRepresentations,
          autoApproved: approvalDecision.autoApprove,
          needsManualReview: approvalDecision.needsReview,
          minimumCommitmentMet:
            commitmentAmount >= fundMinimum && fundMinimum > 0,
          commitmentAmount:
            commitmentAmount > 0 ? commitmentAmount.toString() : null,
          ipAddress,
          userAgent,
          sessionId,
          geoLocation,
          completedAt: approvalDecision.autoApprove ? new Date() : null,
          completedSteps: hasDocumentUpload
            ? [
                "type_selection",
                "details",
                "document_upload",
                "acknowledgment",
              ]
            : useSimplifiedPath && isHighValueInvestor
              ? ["high_value_attestation", "acknowledgment"]
              : ["type_selection", "details", "acknowledgment"],
        },
      }),
    ]);

    await logAccreditationEvent(req, {
      eventType: approvalDecision.autoApprove
        ? "ACCREDITATION_AUTO_APPROVED"
        : "ACCREDITATION_SUBMITTED",
      userId: user.id,
      teamId: user.investorProfile.fund?.teamId || null,
      investorId: user.investorProfile.id,
      accreditationType,
      commitmentAmount,
      autoApproved: approvalDecision.autoApprove,
      reason: approvalDecision.reason,
    });

    return NextResponse.json({
      success: true,
      message: hasDocumentUpload
        ? "Accreditation documents submitted for GP review"
        : approvalDecision.autoApprove
          ? isHighValueInvestor && useSimplifiedPath
            ? "Simplified accreditation completed for high-value commitment"
            : "Accreditation verification completed successfully"
          : "Accreditation submitted for review",
      accreditationStatus,
      accreditationType,
      verificationMethod,
      expiresAt: approvalDecision.autoApprove ? expirationDate : null,
      ackId: accreditationAck.id,
      simplifiedPathUsed: useSimplifiedPath && isHighValueInvestor,
      autoApproved: approvalDecision.autoApprove,
      needsManualReview: approvalDecision.needsReview,
      approvalReason: approvalDecision.reason,
      documentUploadCount: validDocIds.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
