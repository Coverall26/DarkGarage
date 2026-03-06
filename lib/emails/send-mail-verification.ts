import ConfirmEmailChange from "@/components/emails/verification-email-change";

import { sendEmail } from "@/lib/resend";
import { logger } from "@/lib/logger";

export const sendEmailChangeVerificationRequestEmail = async (params: {
  email: string;
  url: string;
  newEmail: string;
}) => {
  const { url, email, newEmail } = params;

  const emailTemplate = ConfirmEmailChange({
    confirmUrl: url,
    email,
    newEmail,
  });

  try {
    await sendEmail({
      to: email,
      system: true,
      subject: "Confirm your email address change for FundRoom",
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
    });
  } catch (e) {
    logger.error("Failed to send email change verification email", { module: "send-mail-verification", error: String(e), email });
  }
};
