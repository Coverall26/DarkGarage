/**
 * NOT YET WIRED — 5-day onboarding drip campaign.
 *
 * Templates (onboarding-1 through onboarding-4, data-rooms-information) and
 * send helper are complete but no trigger calls this function.
 * Phase 2: Wire into a cron job or Resend scheduled sends — fire Day 1 on
 * GP signup, then Day 2-5 at 24-hour intervals.
 */
import { sendEmail } from "@/lib/resend";
import { logger } from "@/lib/logger";

import Onboarding5Email from "@/components/emails/data-rooms-information";
import Onboarding1Email from "@/components/emails/onboarding-1";
import Onboarding2Email from "@/components/emails/onboarding-2";
import Onboarding3Email from "@/components/emails/onboarding-3";
import Onboarding4Email from "@/components/emails/onboarding-4";

import { CreateUserEmailProps } from "../types";

type EmailType =
  | "onboarding1"
  | "onboarding2"
  | "onboarding3"
  | "onboarding4"
  | "onboarding5";

export const sendOnboardingEmail = async (
  params: CreateUserEmailProps,
  emailType: EmailType,
) => {
  const { email } = params.user;

  let emailTemplate;
  let subject;

  switch (emailType) {
    case "onboarding1":
      emailTemplate = Onboarding1Email();
      subject = "Welcome to FundRoom";
      break;
    case "onboarding2":
      emailTemplate = Onboarding2Email();
      subject = "Day 2 - Set link permissions";
      break;
    case "onboarding3":
      emailTemplate = Onboarding3Email();
      subject = "Day 3 - Track analytics on each page";
      break;
    case "onboarding4":
      emailTemplate = Onboarding4Email();
      subject = "Day 4 - Custom domain and branding";
      break;
    case "onboarding5":
      emailTemplate = Onboarding5Email();
      subject = "Day 5 - Virtual Data Rooms";
      break;
    default:
      emailTemplate = Onboarding1Email();
      subject = "Welcome to FundRoom";
      break;
  }

  try {
    await sendEmail({
      to: email as string,
      subject,
      react: emailTemplate,
      test: process.env.NODE_ENV === "development",
    });
  } catch (e) {
    logger.error("Failed to send onboarding email", { module: "send-onboarding", error: String(e), email: email as string, emailType });
  }
};
