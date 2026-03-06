/**
 * NOT YET WIRED — Custom domain setup confirmation email.
 *
 * Template and send helper are complete but no trigger calls this function.
 * Phase 2: Wire into custom domain verification flow — fire when DNS
 * verification succeeds via the email domain wizard.
 */
import CustomDomainSetupEmail from "@/components/emails/custom-domain-setup";

import { sendEmail } from "@/lib/resend";
import { logger } from "@/lib/logger";

export const sendCustomDomainSetupEmail = async (
  email: string,
  name?: string,
  currentPlan?: string,
  hasAccess?: boolean,
) => {
  const emailTemplate = CustomDomainSetupEmail({ 
    name: name || "there", 
    currentPlan: currentPlan || "Free",
    hasAccess: hasAccess || false,
  });
  
  try {
    await sendEmail({
      to: email,
      subject: "Your custom domain has been set up",
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
    });
  } catch (e) {
    logger.error("Failed to send custom domain setup email", { module: "send-custom-domain-setup", error: String(e), email });
  }
}; 