import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { requireAdminAppRouter } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/compliance-overview
 *
 * Returns comprehensive SEC compliance data for the organization:
 * - Bad Actor certification status
 * - Regulation D exemption per fund
 * - Form D filing timeline + deadlines
 * - Investor accreditation breakdown by method
 * - SEC representations tracking
 * - E-signature compliance status
 * - Audit log integrity status
 * - Compliance checklist items
 */
export async function GET(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const auth = await requireAdminAppRouter();
    if (auth instanceof NextResponse) return auth;

    const teamId = auth.teamId;

    // Parallel queries for maximum performance
    const [team, funds, investors, auditStats, signatureStats] =
      await Promise.all([
        // Team + organization
        prisma.team.findUnique({
          where: { id: teamId },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                entityType: true,
                ein: true,
                badActorCertified: true,
                badActorCertifiedAt: true,
                badActorCertifiedBy: true,
                regulationDExemption: true,
                relatedPersons: true,
                previousNames: true,
                addressLine1: true,
                addressCity: true,
                addressState: true,
                addressZip: true,
                addressCountry: true,
                phone: true,
                defaults: {
                  select: {
                    accreditationMethod: true,
                    minimumInvestThreshold: true,
                    auditLogRetentionDays: true,
                  },
                },
              },
            },
          },
        }),

        // All funds for this team
        prisma.fund.findMany({
          where: { teamId },
          select: {
            id: true,
            name: true,
            status: true,
            regulationDExemption: true,
            investmentCompanyExemption: true,
            formDFilingDate: true,
            formDAmendmentDue: true,
            formDReminderSent: true,
            targetRaise: true,
            minimumInvestment: true,
            useOfProceeds: true,
            salesCommissions: true,
            createdAt: true,
            entityMode: true,
          },
          orderBy: { createdAt: "desc" },
        }),

        // All investors with accreditation data
        prisma.investor.findMany({
          where: {
            fund: { teamId },
          },
          select: {
            id: true,
            accreditationStatus: true,
            accreditationCategory: true,
            accreditationMethod: true,
            accreditationExpiresAt: true,
            sourceOfFunds: true,
            occupation: true,
            entityType: true,
            ndaSigned: true,
            fundData: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        }),

        // Audit log stats (last 30 days)
        prisma.auditLog.count({
          where: {
            teamId,
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        }),

        // Signature document stats
        prisma.signatureDocument.count({
          where: {
            teamId,
            status: "COMPLETED",
          },
        }),
      ]);

    const org = team?.organization;
    const orgDefaults = team?.organization?.defaults;

    // Build accreditation breakdown
    const accreditationBreakdown = {
      total: investors.length,
      selfCertified: 0,
      thirdPartyVerified: 0,
      kycVerified: 0,
      pending: 0,
      expired: 0,
      expiringSoon: 0, // Within 90 days
    };

    const representationsTracking = {
      total: investors.length,
      allConfirmed: 0,
      partial: 0,
      none: 0,
    };

    const now = new Date();
    const ninetyDaysFromNow = new Date(
      now.getTime() + 90 * 24 * 60 * 60 * 1000,
    );

    for (const inv of investors) {
      // Accreditation breakdown
      switch (inv.accreditationStatus) {
        case "SELF_CERTIFIED":
          accreditationBreakdown.selfCertified++;
          break;
        case "THIRD_PARTY_VERIFIED":
          accreditationBreakdown.thirdPartyVerified++;
          break;
        case "KYC_VERIFIED":
          accreditationBreakdown.kycVerified++;
          break;
        case "EXPIRED":
          accreditationBreakdown.expired++;
          break;
        default:
          accreditationBreakdown.pending++;
      }

      // Check expiring accreditations
      if (
        inv.accreditationExpiresAt &&
        new Date(inv.accreditationExpiresAt) <= ninetyDaysFromNow &&
        new Date(inv.accreditationExpiresAt) > now
      ) {
        accreditationBreakdown.expiringSoon++;
      }

      // Representations tracking
      const fundData = inv.fundData as Record<string, unknown> | null;
      const reps = fundData?.representations as Record<string, unknown> | null;
      if (reps) {
        const repKeys = [
          "accreditedCert",
          "investingAsPrincipal",
          "readOfferingDocs",
          "riskAwareness",
          "restrictedSecurities",
          "amlOfac",
          "taxConsent",
          "independentAdvice",
        ];
        const confirmedCount = repKeys.filter((k) => reps[k] === true).length;
        if (confirmedCount === repKeys.length) {
          representationsTracking.allConfirmed++;
        } else if (confirmedCount > 0) {
          representationsTracking.partial++;
        } else {
          representationsTracking.none++;
        }
      } else {
        representationsTracking.none++;
      }
    }

    // Form D timeline per fund
    const formDTimeline = funds.map((fund) => {
      const firstSaleDate = fund.createdAt;
      const filingDeadline = new Date(
        firstSaleDate.getTime() + 15 * 24 * 60 * 60 * 1000,
      );
      const amendmentDue = fund.formDFilingDate
        ? new Date(
            new Date(fund.formDFilingDate).getTime() +
              365 * 24 * 60 * 60 * 1000,
          )
        : null;

      let status: "not_filed" | "filed" | "amendment_due" | "overdue" =
        "not_filed";
      if (fund.formDFilingDate) {
        if (amendmentDue && amendmentDue < now) {
          status = "amendment_due";
        } else {
          status = "filed";
        }
      } else if (filingDeadline < now) {
        status = "overdue";
      }

      return {
        fundId: fund.id,
        fundName: fund.name,
        fundStatus: fund.status,
        entityMode: fund.entityMode,
        regulationDExemption: fund.regulationDExemption,
        investmentCompanyExemption: fund.investmentCompanyExemption,
        formDFilingDate: fund.formDFilingDate
          ? new Date(fund.formDFilingDate).toISOString()
          : null,
        formDAmendmentDue: amendmentDue ? amendmentDue.toISOString() : null,
        formDReminderSent: fund.formDReminderSent,
        filingDeadline: filingDeadline.toISOString(),
        filingStatus: status,
        targetRaise: fund.targetRaise
          ? Number(fund.targetRaise)
          : null,
        minimumInvestment: fund.minimumInvestment
          ? Number(fund.minimumInvestment)
          : null,
      };
    });

    // Compliance checklist
    const checklist = [
      {
        id: "bad_actor",
        label: "Bad Actor Certification (Rule 506(d))",
        complete: org?.badActorCertified || false,
        detail: org?.badActorCertifiedAt
          ? `Certified on ${new Date(org.badActorCertifiedAt).toLocaleDateString("en-US")}`
          : "Not yet certified",
        category: "organization",
      },
      {
        id: "reg_d",
        label: "Regulation D Exemption Selected",
        complete: funds.some((f) => f.regulationDExemption),
        detail: funds.find((f) => f.regulationDExemption)
          ? `${funds.find((f) => f.regulationDExemption)?.regulationDExemption} configured`
          : "No exemption selected",
        category: "fund",
      },
      {
        id: "related_persons",
        label: "Related Persons Defined (Form D Section 3)",
        complete: Boolean(
          org?.relatedPersons &&
            Array.isArray(org.relatedPersons) &&
            (org.relatedPersons as unknown[]).length > 0,
        ),
        detail: org?.relatedPersons
          ? `${(org.relatedPersons as unknown[]).length} person(s) defined`
          : "No related persons defined",
        category: "organization",
      },
      {
        id: "accreditation_method",
        label: "Accreditation Verification Method Configured",
        complete: Boolean(orgDefaults?.accreditationMethod),
        detail: orgDefaults?.accreditationMethod || "Not configured",
        category: "compliance",
      },
      {
        id: "address",
        label: "Principal Place of Business Address",
        complete: Boolean(org?.addressLine1 && org?.addressCity),
        detail:
          org?.addressLine1 && org?.addressCity
            ? `${org.addressCity}, ${org.addressState || ""}`
            : "Address not set",
        category: "organization",
      },
      {
        id: "entity_info",
        label: "Entity Name and Type",
        complete: Boolean(org?.name && org?.entityType),
        detail:
          org?.name && org?.entityType
            ? `${org.entityType}`
            : "Missing entity information",
        category: "organization",
      },
      {
        id: "audit_retention",
        label: "Audit Log Retention Period Set",
        complete: Boolean(orgDefaults?.auditLogRetentionDays),
        detail: orgDefaults?.auditLogRetentionDays
          ? `${Math.round(orgDefaults.auditLogRetentionDays / 365)} year(s) retention`
          : "Default 7 years",
        category: "compliance",
      },
      {
        id: "form_d_filed",
        label: "Form D Filed with SEC",
        complete: funds.some((f) => f.formDFilingDate),
        detail: funds.find((f) => f.formDFilingDate)
          ? "Filed"
          : "Not yet filed — file within 15 days of first sale",
        category: "filing",
      },
    ];

    const completeCount = checklist.filter((c) => c.complete).length;

    return NextResponse.json({
      organization: {
        name: org?.name || "",
        entityType: org?.entityType || null,
        badActorCertified: org?.badActorCertified || false,
        badActorCertifiedAt: org?.badActorCertifiedAt
          ? new Date(org.badActorCertifiedAt).toISOString()
          : null,
        relatedPersonsCount: org?.relatedPersons
          ? (org.relatedPersons as unknown[]).length
          : 0,
        address: org?.addressLine1
          ? `${org.addressLine1}, ${org.addressCity || ""}, ${org.addressState || ""} ${org.addressZip || ""}`
          : null,
      },
      accreditationBreakdown,
      representationsTracking,
      formDTimeline,
      checklist,
      complianceScore: {
        complete: completeCount,
        total: checklist.length,
        percentage: Math.round((completeCount / checklist.length) * 100),
      },
      stats: {
        totalFunds: funds.length,
        totalInvestors: investors.length,
        auditEventsLast30Days: auditStats,
        signedDocuments: signatureStats,
        accreditationMethod: orgDefaults?.accreditationMethod || "SELF_ACK",
        auditRetentionDays: orgDefaults?.auditLogRetentionDays || 2555,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
