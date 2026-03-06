/**
 * Viewer Authentication Library — Prompt 9.1
 *
 * Centralized OTP verification + session management for DataRoom/RaiseRoom
 * external viewers. Replaces the duplicated plaintext OTP code in
 * app/api/views/route.ts and app/api/views-dataroom/route.ts.
 *
 * Security improvements over the previous VerificationToken approach:
 *  - OTP codes stored as SHA-256 hashes (not plaintext)
 *  - Max 3 attempts before code is invalidated
 *  - Uses crypto.randomInt() instead of Math.random()
 *  - Purpose-built ViewerSession model (not repurposed VerificationToken)
 *  - 10-minute OTP expiry (was 20 minutes)
 *  - 24-hour session expiry (was 23 hours)
 */

import { hashToken } from "@/lib/api/auth/token";
import { sendOtpVerificationEmail } from "@/lib/emails/send-email-otp-verification";
import { newId } from "@/lib/id-helper";
import prisma from "@/lib/prisma";
import { generateOTP } from "@/lib/utils/generate-otp";
import { reportError } from "@/lib/error";

const MAX_ATTEMPTS = 3;
const OTP_EXPIRY_MINUTES = 10;
const SESSION_EXPIRY_HOURS = 24;

// --------------------------------------------------------------------------
// sendVerificationCode
// --------------------------------------------------------------------------

/**
 * Generate a 6-digit OTP, hash it, store in VerificationCode, and email it.
 *
 * Steps:
 *  1. Delete any existing codes for this email+linkId (prevent stacking)
 *  2. Generate code via crypto.randomInt(), hash via SHA-256
 *  3. Store hashed code in VerificationCode model
 *  4. Fire-and-forget email send
 *
 * @returns The plaintext OTP (only used in the email, never stored)
 */
export async function sendVerificationCode({
  email,
  linkId,
  teamId,
  isDataroom,
  ipAddress,
  userAgent,
}: {
  email: string;
  linkId: string;
  teamId: string;
  isDataroom: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ success: true }> {
  // Clean up any existing codes for this viewer+link
  await prisma.verificationCode.deleteMany({
    where: { email: email.toLowerCase(), linkId },
  });

  // Generate and hash the OTP
  const otpCode = generateOTP();
  const hashedCode = hashToken(otpCode);

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

  // Store hashed code — never store plaintext
  await prisma.verificationCode.create({
    data: {
      email: email.toLowerCase(),
      code: hashedCode,
      linkId,
      teamId,
      expiresAt,
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
    },
  });

  // Fire-and-forget email — caller wraps in waitUntil()
  await sendOtpVerificationEmail(
    email,
    otpCode,
    isDataroom,
    teamId,
  );

  return { success: true };
}

// --------------------------------------------------------------------------
// verifyCode
// --------------------------------------------------------------------------

export type VerifyCodeResult =
  | { verified: true; sessionToken: string }
  | { verified: false; error: string; resetVerification?: boolean };

/**
 * Verify a 6-digit OTP code against the VerificationCode model.
 *
 * Steps:
 *  1. Hash the submitted code
 *  2. Look up VerificationCode by email + linkId (most recent, not expired)
 *  3. Compare hashed codes
 *  4. Enforce max 3 attempts
 *  5. On success: mark as used, create ViewerSession, return session token
 */
export async function verifyCode({
  email,
  linkId,
  code,
  teamId,
  ipAddress,
  userAgent,
}: {
  email: string;
  linkId: string;
  code: string;
  teamId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<VerifyCodeResult> {
  const normalizedEmail = email.toLowerCase();
  const hashedCode = hashToken(code);

  // Find the most recent unused code for this email+linkId
  const verification = await prisma.verificationCode.findFirst({
    where: {
      email: normalizedEmail,
      linkId,
      usedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!verification) {
    return {
      verified: false,
      error: "Unauthorized access. Request new access.",
      resetVerification: true,
    };
  }

  // Check expiry
  if (Date.now() > verification.expiresAt.getTime()) {
    // Clean up expired code
    await prisma.verificationCode.delete({
      where: { id: verification.id },
    }).catch(() => {});
    return {
      verified: false,
      error: "Access expired. Request new access.",
      resetVerification: true,
    };
  }

  // Check attempt limit
  if (verification.attempts >= MAX_ATTEMPTS) {
    // Invalidate the code
    await prisma.verificationCode.delete({
      where: { id: verification.id },
    }).catch(() => {});
    return {
      verified: false,
      error: "Too many failed attempts. Request new access.",
      resetVerification: true,
    };
  }

  // Compare hashed codes
  if (verification.code !== hashedCode) {
    // Increment attempts
    await prisma.verificationCode.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });
    return {
      verified: false,
      error: "Invalid verification code.",
    };
  }

  // Code is valid — mark as used
  await prisma.verificationCode.update({
    where: { id: verification.id },
    data: { usedAt: new Date() },
  });

  // Create a ViewerSession for repeat access
  const sessionToken = newId("email");
  const hashedSessionToken = hashToken(sessionToken);
  const sessionExpiresAt = new Date();
  sessionExpiresAt.setHours(sessionExpiresAt.getHours() + SESSION_EXPIRY_HOURS);

  await prisma.viewerSession.create({
    data: {
      email: normalizedEmail,
      linkId,
      token: hashedSessionToken,
      verified: true,
      expiresAt: sessionExpiresAt,
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
    },
  });

  return {
    verified: true,
    sessionToken: hashedSessionToken,
  };
}

// --------------------------------------------------------------------------
// validateViewerSession
// --------------------------------------------------------------------------

export type ValidateSessionResult =
  | { valid: true }
  | { valid: false; error: string; resetVerification?: boolean };

/**
 * Validate an existing ViewerSession token for repeat access.
 *
 * Checks:
 *  1. Token exists in ViewerSession
 *  2. Email + linkId match
 *  3. Not expired (24-hour window)
 */
export async function validateViewerSession({
  token,
  linkId,
  email,
}: {
  token: string;
  linkId: string;
  email: string;
}): Promise<ValidateSessionResult> {
  const session = await prisma.viewerSession.findFirst({
    where: {
      token,
      linkId,
      email: email.toLowerCase(),
    },
  });

  if (!session) {
    return {
      valid: false,
      error: "Unauthorized access. Request new access.",
      resetVerification: true,
    };
  }

  if (Date.now() > session.expiresAt.getTime()) {
    // Clean up expired session
    await prisma.viewerSession.delete({
      where: { id: session.id },
    }).catch(() => {});
    return {
      valid: false,
      error: "Access expired. Request new access.",
      resetVerification: true,
    };
  }

  return { valid: true };
}
