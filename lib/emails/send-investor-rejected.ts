import { sendOrgEmail } from "@/lib/resend";
import prisma from "@/lib/prisma";
import InvestorRejectedEmail from "@/components/emails/investor-rejected";
import { logger } from "@/lib/logger";

/**
 * Send a "Rejected" notification email to the investor.
 * Tier 2 (org-branded) — sends from org's verified domain if configured.
 *
 * Called when GP rejects an investor's application.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function sendInvestorRejectedEmail(
  investorId: string,
  fundId: string,
  rejectionReason?: string,
): Promise<void> {
  try {
    const investor = await prisma.investor.findUnique({
      where: { id: investorId },
      select: {
        entityName: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (!investor?.user?.email) {
      logger.warn("No email found for rejection notification", { module: "send-investor-rejected", investorId });
      return;
    }

    const fund = await prisma.fund.findUnique({
      where: { id: fundId },
      select: {
        name: true,
        teamId: true,
        team: { select: { name: true } },
      },
    });

    const investorName =
      investor.entityName || investor.user.name || "Investor";
    const fundName = fund?.name ?? "the fund";
    const gpFirmName = fund?.team?.name ?? "the fund manager";
    const teamId = fund?.teamId || "";

    await sendOrgEmail({
      teamId,
      to: investor.user.email,
      subject: `Update regarding your ${fundName} application`,
      react: InvestorRejectedEmail({
        investorName,
        fundName,
        gpFirmName,
        reason: rejectionReason,
      }),
      test: process.env.NODE_ENV === "development",
    });

  } catch (error) {
    logger.error("Failed to send investor rejection notification", { module: "send-investor-rejected", error: String(error), investorId, fundId });
  }
}
