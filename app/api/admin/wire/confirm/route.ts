import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { Decimal } from "@prisma/client/runtime/library";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { publishServerEvent } from "@/lib/tracking/server-events";
import { emitSSE, SSE_EVENTS } from "@/lib/sse/event-emitter";
import { appRouterStrictRateLimit } from "@/lib/security/rate-limiter";
import { validateBody } from "@/lib/middleware/validate";
import { WireConfirmSchema } from "@/lib/validations/wire";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/wire/confirm
 *
 * GP confirms receipt of wire transfer funds.
 * Updates Transaction status, Investment.fundedAmount, and Investment.status.
 * Sends LP notification email.
 *
 * Body:
 *   transactionId: string (required)
 *   teamId: string (required)
 *   fundsReceivedDate: string (ISO date, required)
 *   amountReceived: number (required)
 *   bankReference?: string
 *   confirmationNotes?: string
 *   confirmationProofDocumentId?: string
 */
export async function POST(req: NextRequest) {
  // Defense-in-depth: admin auth check (additive to edge middleware)
  const adminAuth = await requireAdminAppRouter();
  if (adminAuth instanceof NextResponse) return adminAuth;

  const blocked = await appRouterStrictRateLimit(req);
  if (blocked) return blocked;

  try {
    // 1. Validate request body with Zod
    const parsed = await validateBody(req, WireConfirmSchema);
    if (parsed.error) return parsed.error;

    const {
      transactionId,
      teamId,
      fundsReceivedDate,
      amountReceived,
      bankReference,
      confirmationNotes,
      confirmationProofDocumentId,
    } = parsed.data;

    // 2. Authenticate + authorize via RBAC (OWNER/ADMIN/SUPER_ADMIN)
    const auth = await requireAdminAppRouter(teamId);
    if (auth instanceof NextResponse) return auth;

    const receivedDate = new Date(fundsReceivedDate);

    // 3. Fetch transaction and verify it belongs to this team's fund
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        investor: {
          select: {
            id: true,
            userId: true,
            fundId: true,
            entityName: true,
            user: { select: { email: true, name: true } },
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Verify transaction belongs to this team via fund ownership.
    const verifyFundId = transaction.fundId ?? transaction.investor?.fundId;
    if (!verifyFundId) {
      return NextResponse.json(
        { error: "Transaction cannot be verified against this team" },
        { status: 403 },
      );
    }

    const fund = await prisma.fund.findFirst({
      where: { id: verifyFundId, teamId },
      select: { id: true, name: true },
    });
    if (!fund) {
      return NextResponse.json(
        { error: "Transaction does not belong to this team" },
        { status: 403 },
      );
    }

    if (transaction.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Transaction has already been confirmed" },
        { status: 400 },
      );
    }

    if (transaction.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Cannot confirm a cancelled transaction" },
        { status: 400 },
      );
    }

    // 5. Calculate variance if expected amount exists
    const expectedAmount = transaction.amount;
    const amountVariance = new Decimal(amountReceived).minus(expectedAmount);

    // 6. Atomically update Transaction + Investment
    const { updatedTransaction, investmentUpdated } = await prisma.$transaction(
      async (tx) => {
        // Double-check status inside transaction to prevent race condition
        const freshTx = await tx.transaction.findUnique({
          where: { id: transactionId },
          select: { status: true },
        });
        if (freshTx?.status === "COMPLETED") {
          throw new Error("ALREADY_CONFIRMED");
        }

        // 6a. Update Transaction with confirmation details
        const updatedTx = await tx.transaction.update({
          where: { id: transactionId },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            fundsReceivedDate: receivedDate,
            confirmedBy: auth.userId,
            confirmedAt: new Date(),
            confirmationMethod: "MANUAL",
            bankReference: bankReference || null,
            confirmationNotes: confirmationNotes || null,
            confirmationProofDocumentId: confirmationProofDocumentId || null,
            expectedAmount: expectedAmount,
            amountVariance: amountVariance,
            varianceNotes: !amountVariance.isZero()
              ? `Expected ${expectedAmount}, received ${amountReceived}`
              : null,
          },
        });

        // 6b. Update Investment.fundedAmount and status if applicable
        let invUpdated = false;
        const effectiveFundId = transaction.fundId ?? transaction.investor?.fundId;
        if (effectiveFundId && transaction.investorId) {
          const investment = await tx.investment.findFirst({
            where: {
              fundId: effectiveFundId,
              investorId: transaction.investorId,
            },
            select: {
              id: true,
              commitmentAmount: true,
              fundedAmount: true,
              status: true,
            },
          });

          if (investment) {
            const newFundedAmount = new Decimal(investment.fundedAmount).plus(
              new Decimal(amountReceived),
            );
            const isFullyFunded = newFundedAmount.greaterThanOrEqualTo(
              investment.commitmentAmount,
            );

            const newStatus =
              isFullyFunded &&
              (investment.status === "COMMITTED" || investment.status === "DOCS_APPROVED")
                ? "FUNDED"
                : investment.status;

            await tx.investment.update({
              where: { id: investment.id },
              data: {
                fundedAmount: newFundedAmount,
                status: newStatus,
              },
            });

            invUpdated = true;

            // Sync FundAggregate totals
            const fundedAgg = await tx.investment.aggregate({
              where: {
                fundId: effectiveFundId,
                status: { notIn: ["CANCELLED", "DECLINED", "WITHDRAWN"] },
              },
              _sum: { fundedAmount: true, commitmentAmount: true },
            });
            const totalInboundNow = Number(fundedAgg._sum.fundedAmount ?? 0);
            const totalCommittedNow = Number(fundedAgg._sum.commitmentAmount ?? 0);

            await tx.fundAggregate.upsert({
              where: { fundId: effectiveFundId },
              create: {
                fundId: effectiveFundId,
                totalCommitted: totalCommittedNow,
                totalInbound: totalInboundNow,
              },
              update: {
                totalInbound: totalInboundNow,
                totalCommitted: totalCommittedNow,
              },
            });
          }
        }

        return { updatedTransaction: updatedTx, investmentUpdated: invUpdated };
      },
    );

    // 8. Audit log
    const forwarded = req.headers.get("x-forwarded-for");
    await logAuditEvent({
      eventType: "ADMIN_ACTION",
      userId: auth.userId,
      teamId,
      resourceType: "Transaction",
      resourceId: transactionId,
      metadata: {
        action: "WIRE_TRANSFER_CONFIRMED",
        amountReceived,
        fundsReceivedDate,
        bankReference: bankReference || null,
        confirmationMethod: "MANUAL",
        investorId: transaction.investorId,
        fundId: transaction.fundId,
        amountVariance: amountVariance.toString(),
        investmentUpdated,
      },
      ipAddress: forwarded?.split(",")[0].trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    });

    // 9. Fire-and-forget: send LP notification email
    const formatCurrency = (val: number) =>
      `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    import("@/lib/emails/send-wire-confirmed")
      .then(({ sendWireConfirmedNotification }) =>
        sendWireConfirmedNotification({
          transactionId,
          amountReceived: formatCurrency(amountReceived),
          fundsReceivedDate: receivedDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          bankReference: bankReference || undefined,
          confirmationNotes: confirmationNotes || undefined,
        }),
      )
      .catch((err) => {
        reportError(err as Error);
      });

    // Fire-and-forget: Track GP wire confirmation
    publishServerEvent("funnel_gp_wire_confirmed", {
      userId: auth.userId,
      teamId,
    }).catch((e) => reportError(e as Error));

    // Fire-and-forget: SSE for real-time GP dashboard update
    emitSSE({
      type: SSE_EVENTS.WIRE_CONFIRMED,
      orgId: teamId,
      data: {
        transactionId,
        investorId: transaction.investorId,
        amountReceived,
      },
    });

    return NextResponse.json({
      success: true,
      transaction: {
        id: updatedTransaction.id,
        status: updatedTransaction.status,
        confirmedAt: updatedTransaction.confirmedAt,
        fundsReceivedDate: updatedTransaction.fundsReceivedDate,
        amountVariance: amountVariance.toString(),
      },
      investmentUpdated,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_CONFIRMED") {
      return NextResponse.json(
        { error: "Transaction has already been confirmed" },
        { status: 400 },
      );
    }
    reportError(error, {
      path: "/api/admin/wire/confirm",
      method: "POST",
      action: "wire_transfer_confirmation",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
