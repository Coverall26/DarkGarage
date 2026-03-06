import { NextRequest, NextResponse } from "next/server";

import { reportError } from "@/lib/error";
import { errorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { validateBody } from "@/lib/middleware/validate";
import { BulkInvestorImportSchema } from "@/lib/validations/admin";
import type { AccreditationStatus, InvestmentStatus } from "@prisma/client";
import { invalidateTierCache } from "@/lib/tier/crm-tier";

export const dynamic = "force-dynamic";

/**
 * Bulk Investor Import API (App Router)
 *
 * GET  /api/admin/investors/bulk-import — Returns CSV template
 * POST /api/admin/investors/bulk-import — Imports investor records
 */

const CSV_TEMPLATE_COLUMNS = [
  "name",
  "email",
  "phone",
  "entityType",
  "entityName",
  "commitmentAmount",
  "commitmentDate",
  "fundingStatus",
  "accreditationStatus",
  "address",
  "notes",
];

export async function GET() {
  // Defense-in-depth: admin auth check (additive to edge middleware)
  const adminAuth = await requireAdminAppRouter();
  if (adminAuth instanceof NextResponse) return adminAuth;

  const csvHeader = CSV_TEMPLATE_COLUMNS.join(",");
  const csvExample = [
    "John Smith",
    "john@example.com",
    "+1-555-0100",
    "INDIVIDUAL",
    "",
    "100000",
    "2026-01-15",
    "COMMITTED",
    "SELF_CERTIFIED",
    '"123 Main St, New York, NY 10001"',
    "Referred by Jane",
  ].join(",");

  return new NextResponse(`${csvHeader}\n${csvExample}\n`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition":
        "attachment; filename=investor-import-template.csv",
    },
  });
}

export async function POST(req: NextRequest) {
  // Defense-in-depth: admin auth check (additive to edge middleware)
  const adminAuth = await requireAdminAppRouter();
  if (adminAuth instanceof NextResponse) return adminAuth;

  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const parsed = await validateBody(req, BulkInvestorImportSchema);
  if (parsed.error) return parsed.error;

  const { fundId, teamId, investors } = parsed.data;

  // Authenticate + authorize via RBAC (OWNER/ADMIN/SUPER_ADMIN)
  const auth = await requireAdminAppRouter(teamId);
  if (auth instanceof NextResponse) return auth;

  try {
    // Verify fund belongs to the authorized team
    const fund = await prisma.fund.findUnique({
      where: { id: fundId },
      select: { id: true, teamId: true, name: true },
    });

    if (!fund || fund.teamId !== teamId) {
      return NextResponse.json(
        { error: "Fund not found" },
        { status: 404 },
      );
    }

    // Process each investor
    const results: Array<{
      email: string;
      name: string;
      success: boolean;
      error?: string;
      investorId?: string;
    }> = [];

    for (const row of investors) {
      try {
        const user = await prisma.user.upsert({
          where: { email: row.email.toLowerCase() },
          update: { name: row.name },
          create: {
            email: row.email.toLowerCase(),
            name: row.name,
            role: "LP",
          },
        });

        const investor = await prisma.investor.upsert({
          where: { userId: user.id },
          update: {
            entityType: row.entityType,
            entityName: row.entityName || null,
            address: row.address || null,
            phone: row.phone || null,
            accreditationStatus:
              row.accreditationStatus as AccreditationStatus,
            fundData: {
              stage:
                row.fundingStatus === "FUNDED" ? "FUNDED" : "COMMITTED",
              manualEntry: true,
              bulkImport: true,
              enteredBy: auth.userId,
              enteredAt: new Date().toISOString(),
            },
          },
          create: {
            userId: user.id,
            fundId,
            teamId,
            entityType: row.entityType,
            entityName: row.entityName || null,
            address: row.address || null,
            phone: row.phone || null,
            accreditationStatus:
              row.accreditationStatus as AccreditationStatus,
            ndaSigned: true,
            ndaSignedAt: new Date(),
            onboardingStep: 5,
            onboardingCompletedAt: new Date(),
            fundData: {
              stage:
                row.fundingStatus === "FUNDED" ? "FUNDED" : "COMMITTED",
              manualEntry: true,
              bulkImport: true,
              enteredBy: auth.userId,
              enteredAt: new Date().toISOString(),
            },
          },
        });

        await prisma.investment.upsert({
          where: {
            fundId_investorId: {
              fundId,
              investorId: investor.id,
            },
          },
          update: {
            commitmentAmount: row.commitmentAmount,
            fundedAmount:
              row.fundingStatus === "FUNDED" ? row.commitmentAmount : 0,
            status: (row.fundingStatus === "FUNDED"
              ? "FUNDED"
              : "COMMITTED") as InvestmentStatus,
          },
          create: {
            fundId,
            investorId: investor.id,
            teamId,
            commitmentAmount: row.commitmentAmount,
            fundedAmount:
              row.fundingStatus === "FUNDED" ? row.commitmentAmount : 0,
            status: (row.fundingStatus === "FUNDED"
              ? "FUNDED"
              : "COMMITTED") as InvestmentStatus,
            subscriptionDate: row.commitmentDate
              ? new Date(row.commitmentDate)
              : new Date(),
          },
        });

        results.push({
          email: row.email,
          name: row.name,
          success: true,
          investorId: investor.id,
        });
      } catch (investorError) {
        reportError(investorError as Error);
        results.push({
          email: row.email,
          name: row.name,
          success: false,
          error: "Failed to create record",
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    // Sync FundAggregate with updated totals
    if (succeeded > 0) {
      try {
        const aggregates = await prisma.investment.aggregate({
          where: { fundId },
          _sum: { commitmentAmount: true, fundedAmount: true },
          _count: true,
        });

        await prisma.fundAggregate.upsert({
          where: { fundId },
          update: {
            totalCommitted: aggregates._sum.commitmentAmount || 0,
            totalInbound: aggregates._sum.fundedAmount || 0,
          },
          create: {
            fundId,
            totalCommitted: aggregates._sum.commitmentAmount || 0,
            totalInbound: aggregates._sum.fundedAmount || 0,
          },
        });
      } catch (aggError) {
        reportError(aggError as Error);
      }

      // Invalidate tier cache so contact limits reflect new imports
      try {
        const team = await prisma.team.findUnique({
          where: { id: teamId },
          select: { organizationId: true },
        });
        if (team?.organizationId) {
          invalidateTierCache(team.organizationId);
        }
      } catch (cacheError) {
        reportError(cacheError as Error);
      }
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const userAgent = req.headers.get("user-agent") || null;

    await logAuditEvent({
      eventType: "INVESTOR_IMPORT",
      userId: auth.userId,
      teamId,
      resourceType: "Fund",
      resourceId: fundId,
      metadata: {
        fundName: fund.name,
        totalRows: investors.length,
        succeeded,
        failed,
        bulkImport: true,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      message: `Import complete: ${succeeded} succeeded, ${failed} failed`,
      total: investors.length,
      succeeded,
      failed,
      results,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
