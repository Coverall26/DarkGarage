import ConversationTeamNotification from "@/ee/features/conversations/emails/components/conversation-team-notification";

import { sendEmail } from "@/lib/resend";
import { logger } from "@/lib/logger";

export const sendConversationTeamNotification = async ({
  dataroomName,
  conversationTitle,
  senderEmail,
  teamMemberEmails,
  url,
}: {
  dataroomName: string;
  conversationTitle: string;
  senderEmail: string;
  teamMemberEmails: string[];
  url: string;
}) => {
  try {
    if (!teamMemberEmails || teamMemberEmails.length === 0) {
      return;
    }

    await sendEmail({
      to: teamMemberEmails[0], // Send to first team member
      cc: teamMemberEmails.slice(1).join(","), // Send to all other team members
      subject: `New visitor message in ${dataroomName}`,
      react: ConversationTeamNotification({
        senderEmail,
        conversationTitle,
        dataroomName,
        url,
      }),
      test: process.env.NODE_ENV === "development",
      system: true,
    });
  } catch (e) {
    logger.error("Failed to send team member notification", { module: "conversations", metadata: { error: (e as Error).message } });
  }
};
