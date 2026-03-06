import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { requireLPAuthAppRouter } from "@/lib/auth/rbac";
import { CapitalCallStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/lp/capital-calls
 * Returns capital calls for the authenticated LP's fund(s),
 * including their specific response for each call.
 *
 * Query params:
 *   ?fundId=xxx   — filter to a specific fund (optional)
 *   ?status=SENT  — filter by call status (optional)
 */
export async function GET(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  try {
    const auth = await requireLPAuthAppRouter();
    if (auth instanceof NextResponse) return auth;

    // Find investor profile — strict userId scoping (no email fallback)
    const investor = await prisma.investor.findFirst({
      where: { userId: auth.userId },
      select: {
        id: true,
        fundId: true,
      },
    });

    if (!investor) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const fundIdFilter = searchParams.get("fundId");
    const statusFilter = searchParams.get("status");

    // Use the investor's fund or the specified fundId
    const fundId = fundIdFilter || investor.fundId;
    if (!fundId) {
      return NextResponse.json({ error: "No fund associated" }, { status: 400 });
    }

    // Get capital calls for the fund that are visible to LP (SENT or later, not DRAFT)
    const calls = await prisma.capitalCall.findMany({
      where: {
        fundId,
        status: statusFilter
          ? (statusFilter as CapitalCallStatus)
          : { not: "DRAFT" as CapitalCallStatus }, // LPs never see drafts
        // Only return calls where this investor has a response
        responses: {
          some: { investorId: investor.id },
        },
      },
      include: {
        responses: {
          where: { investorId: investor.id },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    // Serialize and flatten — LP sees their own response inline
    const serialized = calls.map((call) => {
      const myResponse = call.responses[0] || null;
      return {
        id: call.id,
        callNumber: call.callNumber,
        amount: call.amount.toNumber(),
        purpose: call.purpose,
        dueDate: call.dueDate,
        status: call.status,
        noticeDate: call.noticeDate,
        sentAt: call.sentAt,
        fundedAt: call.fundedAt,
        noticePdfUrl: call.noticePdfUrl,
        proRataPercentage: call.proRataPercentage?.toNumber() ?? null,
        createdAt: call.createdAt,
        // LP's own response data
        myResponse: myResponse
          ? {
              id: myResponse.id,
              amountDue: myResponse.amountDue.toNumber(),
              amountPaid: myResponse.amountPaid.toNumber(),
              status: myResponse.status,
              proofDocumentId: myResponse.proofDocumentId,
              proofUploadedAt: myResponse.proofUploadedAt,
              confirmedAt: myResponse.confirmedAt,
              fundReceivedDate: myResponse.fundReceivedDate,
              notes: myResponse.notes,
            }
          : null,
      };
    });

    // Summary for LP dashboard
    const pendingCalls = serialized.filter(
      (c) => c.myResponse?.status === "PENDING",
    );
    const totalOwed = pendingCalls.reduce(
      (sum, c) => sum + (c.myResponse?.amountDue || 0),
      0,
    );

    return NextResponse.json({
      calls: serialized,
      summary: {
        totalCalls: serialized.length,
        pendingCount: pendingCalls.length,
        totalOwed,
        fundedCount: serialized.filter(
          (c) => c.myResponse?.status === "FUNDED",
        ).length,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
