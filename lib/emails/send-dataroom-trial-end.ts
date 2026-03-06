import { sendEmail } from "@/lib/resend";
import { logger } from "@/lib/logger";

import DataroomTrialEnd from "@/components/emails/dataroom-trial-end";

export const sendDataroomTrialEndEmail = async (params: {
  email: string;
  name: string;
}) => {
  const { email, name } = params;

  let emailTemplate;
  let subject;

  emailTemplate = DataroomTrialEnd({ name });
  subject = "Your Data Room plan trial has ended";

  try {
    await sendEmail({
      to: email as string,
      subject,
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
    });
  } catch (e) {
    logger.error("Failed to send dataroom trial end email", { module: "send-dataroom-trial-end", error: String(e), email });
  }
};
