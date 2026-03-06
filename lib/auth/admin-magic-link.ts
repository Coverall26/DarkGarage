import { encode, decode } from "next-auth/jwt";

import { isAuthDebugEnabled } from "@/lib/feature-flags";
import { isUserAdminAsync } from "@/lib/constants/admins";
import { logger } from "@/lib/logger";

const AUTH_DEBUG = isAuthDebugEnabled();
const ADMIN_MAGIC_LINK_EXPIRY_SECONDS = 60 * 60; // 1 hour

/**
 * Creates an admin magic link using a signed JWT token.
 *
 * Uses JWT instead of database-stored tokens to avoid dependency on the
 * VerificationToken table (which may have schema mismatches in production).
 * The JWT is signed with NEXTAUTH_SECRET and includes the admin email +
 * purpose claim. Expiry is enforced by the JWT `exp` claim.
 */
export async function createAdminMagicLink({
  email,
  redirectPath,
  baseUrl,
}: {
  email: string;
  redirectPath?: string;
  baseUrl: string;
}): Promise<{ magicLink: string; token: string } | null> {
  const normalizedEmail = email.trim().toLowerCase();

  // Check if user is an admin (static list OR database)
  const isAdmin = await isUserAdminAsync(normalizedEmail);
  if (!isAdmin) {
    logger.error("Email not an admin", { module: "admin-magic-link", email: normalizedEmail });
    return null;
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    logger.error("NEXTAUTH_SECRET is not configured", { module: "admin-magic-link" });
    return null;
  }

  try {
    // Create a signed JWT — no database write required
    const token = await encode({
      token: {
        email: normalizedEmail,
        purpose: "admin-magic-link",
      },
      secret,
      maxAge: ADMIN_MAGIC_LINK_EXPIRY_SECONDS,
    });

    const params = new URLSearchParams({
      token,
      email: normalizedEmail,
    });

    if (redirectPath) {
      params.set("redirect", redirectPath);
    }

    const magicLink = `${baseUrl}/api/auth/admin-magic-verify?${params.toString()}`;
    if (AUTH_DEBUG) logger.debug("Created JWT magic link", { module: "admin-magic-link", email: normalizedEmail });

    return { magicLink, token };
  } catch (error) {
    logger.error("Error creating JWT magic link", { module: "admin-magic-link", error: String(error) });
    return null;
  }
}

/**
 * Verifies an admin magic link by decoding and validating the JWT token.
 *
 * Checks: signature validity, expiry, purpose claim, and email match.
 * Also verifies the email belongs to an admin user.
 */
export async function verifyAdminMagicLink({
  token,
  email,
}: {
  token: string;
  email: string;
}): Promise<boolean> {
  try {
    const normalizedEmail = email.trim().toLowerCase();

    if (AUTH_DEBUG) logger.debug("Verifying JWT token", { module: "admin-magic-link", email: normalizedEmail });

    // Check if user is an admin (static list OR database)
    const isAdmin = await isUserAdminAsync(normalizedEmail);
    if (!isAdmin) {
      if (AUTH_DEBUG) logger.debug("User is not an admin", { module: "admin-magic-link", email: normalizedEmail });
      return false;
    }

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      logger.error("NEXTAUTH_SECRET is not configured", { module: "admin-magic-link" });
      return false;
    }

    // Decode and verify the JWT (signature + expiry checked by jose)
    const decoded = await decode({ token, secret });

    if (!decoded) {
      if (AUTH_DEBUG) logger.debug("Failed to decode JWT token (invalid or expired)", { module: "admin-magic-link" });
      return false;
    }

    // Verify purpose claim
    if (decoded.purpose !== "admin-magic-link") {
      if (AUTH_DEBUG) logger.debug("Invalid token purpose", { module: "admin-magic-link", purpose: String(decoded.purpose) });
      return false;
    }

    // Verify email match
    if (decoded.email !== normalizedEmail) {
      if (AUTH_DEBUG) logger.debug("Email mismatch in token", { module: "admin-magic-link" });
      return false;
    }

    // Extra safety: manual expiry check (decode should already enforce this)
    const expValue = decoded.exp as number | undefined;
    if (expValue && expValue < Math.floor(Date.now() / 1000)) {
      if (AUTH_DEBUG) logger.debug("Token expired", { module: "admin-magic-link" });
      return false;
    }

    if (AUTH_DEBUG) logger.debug("JWT token verified successfully", { module: "admin-magic-link", email: normalizedEmail });
    return true;
  } catch (error) {
    logger.error("Error verifying JWT magic link", { module: "admin-magic-link", error: String(error) });
    return false;
  }
}
