import { sendEmail } from "@/lib/resend";
import { logger } from "@/lib/logger";

import DataroomTrial24hReminderEmail from "@/components/emails/dataroom-trial-24h";

export const sendDataroomTrial24hReminderEmail = async (params: {
  email: string;
  name: string;
}) => {
  const { email, name } = params;

  const emailTemplate = DataroomTrial24hReminderEmail({ name });
  try {
    await sendEmail({
      to: email,
      subject: "Your Data Room plan trial expires in 24 hours",
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
    });
  } catch (e) {
    logger.error("Failed to send dataroom trial 24h reminder email", { module: "send-dataroom-trial-24h", error: String(e), email });
  }
};
