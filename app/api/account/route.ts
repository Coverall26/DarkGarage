import { NextRequest, NextResponse } from "next/server";

import { waitUntil } from "@vercel/functions";
import { randomBytes } from "crypto";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { hashToken } from "@/lib/api/auth/token";
import { sendEmailChangeVerificationRequestEmail } from "@/lib/emails/send-mail-verification";
import { newId } from "@/lib/id-helper";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";
import { trim } from "@/lib/utils";
import { authOptions } from "@/lib/auth/auth-options";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { ratelimit, redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

const updateUserSchema = z.object({
  name: z.preprocess(trim, z.string().min(1).max(64)).optional(),
  email: z.preprocess(trim, z.string().email()).optional(),
  image: z.string().url().optional(),
});

export async function PATCH(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionUser = session.user as CustomUser;

  try {
    const body = await req.json();
    const { email, image, name } = await updateUserSchema.parseAsync(body);

    if (email && email !== sessionUser.email) {
      const userWithEmail = await prisma.user.findUnique({
        where: { email },
      });
      if (userWithEmail) {
        return NextResponse.json(
          { error: "Email is already in use." },
          { status: 400 },
        );
      }

      const { success } = await ratelimit(6, "6 h").limit(
        `email-change-request:${sessionUser.id}`,
      );
      if (!success) {
        return NextResponse.json(
          { error: "Too many email change requests. Please try again later." },
          { status: 429 },
        );
      }

      const token = randomBytes(32).toString("hex");
      const expiresIn = 15 * 60 * 1000;

      await prisma.verificationToken.create({
        data: {
          identifier: sessionUser.id,
          token: hashToken(token),
          expires: new Date(Date.now() + expiresIn),
        },
      });

      if (redis) {
        await redis.set(
          `email-change-request:user:${sessionUser.id}`,
          {
            email: sessionUser.email,
            newEmail: email,
          },
          {
            px: expiresIn,
          },
        );
      }

      waitUntil(
        sendEmailChangeVerificationRequestEmail({
          email: sessionUser.email as string,
          newEmail: email,
          url: `${process.env.NEXTAUTH_URL}/auth/confirm-email-change/${token}`,
        }),
      );

      return NextResponse.json({ message: "success" });
    }

    await prisma.user.update({
      where: { id: sessionUser.id },
      data: {
        ...(name && { name }),
        ...(image && { image }),
      },
    });

    return NextResponse.json({ message: "success" });
  } catch (error) {
    return errorResponse(error);
  }
}
