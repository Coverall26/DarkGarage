import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import {
  verifyAuditChain,
  exportAuditLogForCompliance,
} from "@/lib/audit/immutable-audit-log";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/compliance-package
 *
 * Exports a comprehensive SEC compliance package as JSON.
 * Includes: org certification, Form D data, investor accreditation report,
 * representations summary, signature audit, immutable audit log with hash chain.
 *
 * Query params:
 * - fundId (optional) — scope to specific fund
 * - from (optional) — audit log start date (ISO)
 * - to (optional) — audit log end date (ISO)
 */
export async function GET(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const auth = await requireAdminAppRouter();
    if (auth instanceof NextResponse) return auth;

    const teamId = auth.teamId;
    const { searchParams } = req.nextUrl;
    const fundId = searchParams.get("fundId");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const fromDate = fromParam
      ? new Date(fromParam)
      : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // default 1 year
    const toDate = toParam ? new Date(toParam) : new Date();

    // Parallel data fetch
    const [org, funds, investors, auditExport, signatureStats, chainIntegrity] =
      await Promise.all([
        // Organization + defaults
        prisma.organization.findFirst({
          where: {
            teams: { some: { id: teamId } },
          },
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
            addressLine2: true,
            addressCity: true,
            addressState: true,
            addressZip: true,
            addressCountry: true,
            phone: true,
            website: true,
            sector: true,
            foundedYear: true,
          },
        }),

        // Funds (all or filtered)
        prisma.fund.findMany({
          where: {
            teamId,
            ...(fundId ? { id: fundId } : {}),
          },
          select: {
            id: true,
            name: true,
            status: true,
            regulationDExemption: true,
            investmentCompanyExemption: true,
            formDFilingDate: true,
            formDAmendmentDue: true,
            targetRaise: true,
            minimumInvestment: true,
            useOfProceeds: true,
            salesCommissions: true,
            createdAt: true,
            entityMode: true,
            fundSubType: true,
          },
          orderBy: { createdAt: "desc" },
        }),

        // Investors with accreditation data
        prisma.investor.findMany({
          where: {
            fund: {
              teamId,
              ...(fundId ? { id: fundId } : {}),
            },
          },
          select: {
            id: true,
            accreditationStatus: true,
            accreditationCategory: true,
            accreditationMethod: true,
            accreditationExpiresAt: true,
            accreditationDocumentIds: true,
            sourceOfFunds: true,
            occupation: true,
            entityType: true,
            ndaSigned: true,
            fundData: true,
            createdAt: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        }),

        // Immutable audit log export with hash chain verification
        exportAuditLogForCompliance(teamId, fromDate, toDate),

        // Signature document completion stats
        prisma.signatureDocument.groupBy({
          by: ["status"],
          where: { teamId },
          _count: { id: true },
        }),

        // Audit chain integrity
        verifyAuditChain(teamId),
      ]);

    // Build accreditation report per investor
    const accreditationReport = investors.map((inv) => {
      const fundData = inv.fundData as Record<string, unknown> | null;
      const reps = fundData?.representations as Record<string, boolean> | null;
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

      return {
        investorId: inv.id,
        name: inv.user?.name || "Unknown",
        email: inv.user?.email || "Unknown",
        entityType: inv.entityType,
        accreditationStatus: inv.accreditationStatus,
        accreditationCategory: inv.accreditationCategory,
        accreditationMethod: inv.accreditationMethod,
        accreditationExpiresAt: inv.accreditationExpiresAt
          ? new Date(inv.accreditationExpiresAt).toISOString()
          : null,
        accreditationDocumentIds: inv.accreditationDocumentIds || [],
        sourceOfFunds: inv.sourceOfFunds,
        occupation: inv.occupation,
        ndaSigned: inv.ndaSigned,
        onboardedAt: inv.createdAt.toISOString(),
        representations: reps
          ? {
              total: repKeys.length,
              confirmed: repKeys.filter((k) => reps[k] === true).length,
              items: repKeys.map((k) => ({
                key: k,
                confirmed: reps[k] === true,
              })),
            }
          : null,
      };
    });

    // Signature document stats
    const signatureDocStats = {
      total: signatureStats.reduce((sum, s) => sum + s._count.id, 0),
      byStatus: Object.fromEntries(
        signatureStats.map((s) => [s.status, s._count.id]),
      ),
    };

    // Form D timeline per fund
    const now = new Date();
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

      let filingStatus: "not_filed" | "filed" | "amendment_due" | "overdue" =
        "not_filed";
      if (fund.formDFilingDate) {
        filingStatus =
          amendmentDue && amendmentDue < now ? "amendment_due" : "filed";
      } else if (filingDeadline < now) {
        filingStatus = "overdue";
      }

      return {
        fundId: fund.id,
        fundName: fund.name,
        regulationDExemption: fund.regulationDExemption,
        investmentCompanyExemption: fund.investmentCompanyExemption,
        formDFilingDate: fund.formDFilingDate
          ? new Date(fund.formDFilingDate).toISOString()
          : null,
        filingDeadline: filingDeadline.toISOString(),
        amendmentDue: amendmentDue ? amendmentDue.toISOString() : null,
        filingStatus,
        useOfProceeds: fund.useOfProceeds,
        salesCommissions: fund.salesCommissions
          ? Number(fund.salesCommissions)
          : null,
        targetRaise: fund.targetRaise ? Number(fund.targetRaise) : null,
        minimumInvestment: fund.minimumInvestment
          ? Number(fund.minimumInvestment)
          : null,
      };
    });

    const compliancePackage = {
      exportedAt: new Date().toISOString(),
      exportVersion: "1.0",
      organization: {
        name: org?.name || "",
        entityType: org?.entityType || null,
        ein: org?.ein ? "***-***" + (org.ein as string).slice(-4) : null, // masked
        badActorCertification: {
          certified: org?.badActorCertified || false,
          certifiedAt: org?.badActorCertifiedAt
            ? new Date(org.badActorCertifiedAt).toISOString()
            : null,
          certifiedBy: org?.badActorCertifiedBy || null,
        },
        relatedPersonsCount: org?.relatedPersons
          ? (org.relatedPersons as unknown[]).length
          : 0,
        address: org?.addressLine1
          ? {
              line1: org.addressLine1,
              line2: org.addressLine2 || null,
              city: org.addressCity || "",
              state: org.addressState || "",
              zip: org.addressZip || "",
              country: org.addressCountry || "US",
            }
          : null,
        phone: org?.phone || null,
        website: org?.website || null,
        sector: org?.sector || null,
        foundedYear: org?.foundedYear || null,
      },
      formDTimeline,
      accreditationReport,
      accreditationSummary: {
        totalInvestors: investors.length,
        selfCertified: investors.filter(
          (i) => i.accreditationStatus === "SELF_CERTIFIED",
        ).length,
        thirdPartyVerified: investors.filter(
          (i) => i.accreditationStatus === "THIRD_PARTY_VERIFIED",
        ).length,
        kycVerified: investors.filter(
          (i) => i.accreditationStatus === "KYC_VERIFIED",
        ).length,
        pending: investors.filter(
          (i) =>
            !i.accreditationStatus || i.accreditationStatus === "PENDING",
        ).length,
        expired: investors.filter(
          (i) => i.accreditationStatus === "EXPIRED",
        ).length,
      },
      signatureCompliance: signatureDocStats,
      auditLog: {
        chainIntegrity: {
          isValid: chainIntegrity.isValid,
          totalEntries: chainIntegrity.totalEntries,
          verifiedEntries: chainIntegrity.verifiedEntries,
          errors: chainIntegrity.errors,
        },
        export: {
          dateRange: {
            from: fromDate.toISOString(),
            to: toDate.toISOString(),
          },
          totalRecords: auditExport.exportMetadata.totalRecords,
          checksum: auditExport.exportMetadata.checksum,
        },
      },
    };

    // Audit log the export
    await logAuditEvent({
      eventType: "DATA_EXPORT",
      userId: auth.userId,
      teamId,
      resourceType: "AuditLog",
      metadata: {
        exportType: "compliance_package",
        fundId: fundId || "all",
        dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
        investorCount: investors.length,
        fundCount: funds.length,
      },
    });

    return NextResponse.json(compliancePackage);
  } catch (error) {
    return errorResponse(error);
  }
}
