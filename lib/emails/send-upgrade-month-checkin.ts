import { sendEmail } from "@/lib/resend";
import { logger } from "@/lib/logger";

import UpgradeOneMonthCheckinEmail from "@/components/emails/upgrade-one-month-checkin";

import { CreateUserEmailProps } from "../types";

export const sendUpgradeOneMonthCheckinEmail = async (
  params: CreateUserEmailProps,
) => {
  const { name, email } = params.user;

  // Get the first name from the full name
  const firstName = name ? name.split(" ")[0] : null;

  const emailTemplate = UpgradeOneMonthCheckinEmail({
    name: firstName,
  });
  try {
    await sendEmail({
      to: email as string,
      subject: "Check-in from FundRoom",
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
    });
  } catch (e) {
    logger.error("Failed to send upgrade one-month checkin email", { module: "send-upgrade-month-checkin", error: String(e), email: email as string });
  }
};
