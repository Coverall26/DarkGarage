import InvalidDomainEmail from "@/components/emails/invalid-domain";

import { sendEmail } from "@/lib/resend";
import { logger } from "@/lib/logger";

export const sendInvalidDomainEmail = async (
  email: string,
  domain: string,
  invalidDays: number,
) => {
  const emailTemplate = InvalidDomainEmail({ domain, invalidDays });
  try {
    await sendEmail({
      to: email,
      subject: `Your domain ${domain} needs to be configured`,
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
      system: true,
    });
  } catch (e) {
    logger.error("Failed to send invalid domain email", { module: "send-invalid-domain", error: String(e), email, domain });
  }
};
