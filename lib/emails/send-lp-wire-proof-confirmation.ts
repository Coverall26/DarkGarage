/**
 * NOT YET WIRED — LP wire proof upload confirmation email.
 *
 * Template and send helper are complete but no trigger calls this function.
 * Phase 2: Wire into POST /api/lp/wire-proof — fire after Transaction
 * record is created with PROOF_UPLOADED status.
 *
 * Tier 2 (org-branded) — sends from org's verified domain if configured.
 * Fire-and-forget — errors are logged, not thrown.
 */
import { sendOrgEmail } from "@/lib/resend";
import prisma from "@/lib/prisma";
import LpWireProofConfirmationEmail from "@/components/emails/lp-wire-proof-confirmation";
import { reportError } from "@/lib/error";
import { logger } from "@/lib/logger";
export async function sendLpWireProofConfirmation({
  investmentId,
  fileName,
  amountSent,
}: {
  investmentId: string;
  fileName: string;
  amountSent?: number | null;
}): Promise<void> {
  try {
    const investment = await prisma.investment.findUnique({
      where: { id: investmentId },
      select: {
        fundId: true,
        investorId: true,
        fund: { select: { name: true, teamId: true } },
        investor: {
          select: {
            entityName: true,
            user: { select: { email: true, name: true } },
          },
        },
      },
    });

    if (!investment?.investor?.user?.email) return;
    if (!investment.fund) return;

    const investorName =
      investment.investor.user.name ||
      investment.investor.entityName ||
      "Investor";

    const formatCurrency = (val: number) =>
      `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ?? "https://app.fundroom.ai";
    const portalUrl = `${baseUrl}/lp/dashboard`;

    await sendOrgEmail({
      teamId: investment.fund.teamId,
      to: investment.investor.user.email,
      subject: `Wire proof received — ${investment.fund.name}`,
      react: LpWireProofConfirmationEmail({
        investorName,
        fundName: investment.fund.name,
        fileName,
        amountSent: amountSent ? formatCurrency(amountSent) : null,
        submittedAt: new Date().toLocaleDateString("en-US"),
        portalUrl,
      }),
      test: process.env.NODE_ENV === "development",
    });
  } catch (error) {
    reportError(error as Error);
    logger.error("Failed to send wire proof confirmation", { module: "send-lp-wire-proof-confirmation", error: String(error), investmentId });
  }
}
