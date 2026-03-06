/**
 * NOT YET WIRED — View milestone celebration email (1,000 views).
 *
 * Template and send helper are complete but no trigger calls this function.
 * Phase 2: Wire into dataroom analytics — fire when a document/dataroom
 * crosses 1,000 total views for the first time.
 */
import ThousandViewsCongratsEmail from "@/components/emails/thousand-views-congrats";

import { sendEmail } from "@/lib/resend";
import { logger } from "@/lib/logger";

import { CreateUserEmailProps } from "../types";

export const sendThousandViewsCongratsEmail = async (params: CreateUserEmailProps) => {
  const { name, email } = params.user;
  const emailTemplate = ThousandViewsCongratsEmail({ name });
  try {
    await sendEmail({
      to: email as string,
      subject: `1000 views on your documents. Awesome, ${name}`,
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
    });
  } catch (e) {
    logger.error("Failed to send 1000 views congrats email", { module: "send-thousand-views-congrats", error: String(e), email: email as string });
  }
};