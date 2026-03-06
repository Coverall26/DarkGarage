/**
 * NOT YET WIRED — View milestone celebration email (100 views).
 *
 * Template and send helper are complete but no trigger calls this function.
 * Phase 2: Wire into dataroom analytics — fire when a document/dataroom
 * crosses 100 total views for the first time.
 */
import HundredViewsCongratsEmail from "@/components/emails/hundred-views-congrats";

import { sendEmail } from "@/lib/resend";
import { logger } from "@/lib/logger";

import { CreateUserEmailProps } from "../types";

export const sendHundredViewsCongratsEmail = async (params: CreateUserEmailProps) => {
  const { name, email } = params.user;
  const emailTemplate = HundredViewsCongratsEmail({ name });
  try {
    await sendEmail({
      to: email as string,
      subject: `100 views on your documents. Awesome, ${name}`,
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
    });
  } catch (e) {
    logger.error("Failed to send 100 views congrats email", { module: "send-hundred-views-congrats", error: String(e), email: email as string });
  }
};