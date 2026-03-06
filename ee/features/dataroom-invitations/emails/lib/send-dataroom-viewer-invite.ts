import { sendEmail } from "@/lib/resend";
import { logger } from "@/lib/logger";

import DataroomViewerInvitation from "@/ee/features/dataroom-invitations/emails/components/dataroom-viewer-invitation";

export const sendDataroomViewerInvite = async ({
  dataroomName,
  senderEmail,
  to,
  url,
  customMessage,
}: {
  dataroomName: string;
  senderEmail: string;
  to: string;
  url: string;
  customMessage?: string;
}) => {
  try {
    await sendEmail({
      to: to,
      subject: `${dataroomName} | Confidential Investor Data Room Access`,
      react: DataroomViewerInvitation({
        senderEmail,
        dataroomName,
        url,
        recipientEmail: to,
        customMessage,
      }),
      test: process.env.NODE_ENV === "development",
      system: true,
    });
  } catch (e) {
    logger.error("Failed to send dataroom viewer invite", { module: "dataroom-invitations", metadata: { error: (e as Error).message } });
  }
};
