import { sendEmail } from "@/lib/resend";
import { logger } from "@/lib/logger";

import ExportReady from "@/components/emails/export-ready";

export const sendExportReadyEmail = async ({
  to,
  resourceName,
  downloadUrl,
}: {
  to: string;
  resourceName: string;
  downloadUrl: string;
}) => {
  const emailTemplate = ExportReady({ resourceName, downloadUrl, email: to });

  try {
    await sendEmail({
      to,
      subject: `Your ${resourceName} export is ready`,
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
      system: true,
    });
  } catch (e) {
    logger.error("Failed to send export ready email", { module: "send-export-ready-email", error: String(e), to, resourceName });
    throw e;
  }
};
