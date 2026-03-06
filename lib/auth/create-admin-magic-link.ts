import { createHash, randomUUID } from "crypto";

import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

const MAGIC_LINK_EXPIRY_MINUTES = 20;

export async function createAdminMagicLink({
  email,
  callbackUrl = "/dashboard",
  baseUrl,
}: {
  email: string;
  callbackUrl?: string;
  baseUrl: string;
}): Promise<string | null> {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      logger.error("NEXTAUTH_SECRET not set", { module: "magic-link" });
      return null;
    }

    const token = randomUUID();
    const expires = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);
    
    const hashedToken = createHash("sha256")
      .update(`${token}${secret}`)
      .digest("hex");

    await prisma.verificationToken.create({
      data: {
        identifier: email.toLowerCase(),
        token: hashedToken,
        expires,
      },
    });

    const params = new URLSearchParams({
      token,
      email: email.toLowerCase(),
      callbackUrl,
    });

    const magicLink = `${baseUrl}/api/auth/callback/email?${params.toString()}`;

    return magicLink;
  } catch (error) {
    logger.error("Error creating magic link", { module: "magic-link", error: String(error) });
    return null;
  }
}
