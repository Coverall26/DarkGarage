import { sendEmail } from "@/lib/resend";
import { logger } from "@/lib/logger";

import PauseResumeReminderEmail from "../components/pause-resume-reminder";

export const sendEmailPauseResumeReminder = async ({
  teamName,
  plan,
  resumeDate,
  teamMemberEmails,
}: {
  teamName: string;
  plan: string;
  resumeDate: string;
  teamMemberEmails: string[];
}) => {
  try {
    if (!teamMemberEmails || teamMemberEmails.length === 0) {
      return;
    }

    await sendEmail({
      to: teamMemberEmails[0], // Send to first team member
      cc: teamMemberEmails.slice(1).join(","), // Send to all other team members
      subject: "Your FundRoom subscription will resume in 3 days",
      react: PauseResumeReminderEmail({
        teamName,
        plan,
        resumeDate,
      }),
      test: process.env.NODE_ENV === "development",
      system: true,
    });
  } catch (e) {
    logger.error("Failed to send team member notification", { module: "billing", metadata: { error: (e as Error).message } });
  }
};
