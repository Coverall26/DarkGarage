import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit, rateLimiters } from "@/ee/features/security";
import { verifyNotBot } from "@/lib/security/bot-protection";
import { stripeInstance } from "@/ee/stripe";
import { getPlanFromPriceId, isOldAccount } from "@/ee/stripe/utils";
import { waitUntil } from "@vercel/functions";
import { getServerSession } from "next-auth";

import { identifyUser, trackAnalytics } from "@/lib/analytics";
import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";
import { getIpAddress } from "@/lib/utils/ip";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  // Bot protection
  const botCheck = await verifyNotBot();
  if (botCheck.blocked) return botCheck.response;

  // Apply rate limiting
  const clientIP = getIpAddress(
    Object.fromEntries(req.headers.entries()),
  );
  const rateLimitResult = await checkRateLimit(
    rateLimiters.billing,
    clientIP,
  );

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: "Too many billing requests. Please try again later.",
        remaining: rateLimitResult.remaining,
      },
      { status: 429 },
    );
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { teamId } = await params;
  const priceId = req.nextUrl.searchParams.get("priceId") ?? "";
  const { id: userId, email: userEmail } = session.user as CustomUser;

  const team = await prisma.team.findUnique({
    where: {
      id: teamId,
      users: {
        some: {
          userId,
        },
      },
    },
    select: { stripeId: true, plan: true },
  });

  if (!team) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 404 });
  }

  const oldAccount = isOldAccount(team.plan);
  const plan = getPlanFromPriceId(priceId, oldAccount);

  if (!plan) {
    return NextResponse.json({ error: "Invalid price ID" }, { status: 400 });
  }

  const minimumQuantity = plan.minQuantity;

  let stripeSession;

  const lineItem = {
    price: priceId,
    quantity: oldAccount ? 1 : minimumQuantity,
    ...(!oldAccount && {
      adjustable_quantity: {
        enabled: true,
        minimum: minimumQuantity,
        maximum: 99,
      },
    }),
  };

  const stripe = stripeInstance(oldAccount);
  if (team.stripeId) {
    stripeSession = await stripe.checkout.sessions.create({
      customer: team.stripeId,
      customer_update: { name: "auto" },
      billing_address_collection: "required",
      success_url: `${process.env.NEXTAUTH_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/settings/billing?cancel=true`,
      line_items: [lineItem],
      automatic_tax: {
        enabled: true,
      },
      tax_id_collection: {
        enabled: true,
      },
      mode: "subscription",
      allow_promotion_codes: true,
      client_reference_id: teamId,
    });
  } else {
    stripeSession = await stripe.checkout.sessions.create({
      customer_email: userEmail ?? undefined,
      billing_address_collection: "required",
      success_url: `${process.env.NEXTAUTH_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/settings/billing?cancel=true`,
      line_items: [lineItem],
      automatic_tax: {
        enabled: true,
      },
      tax_id_collection: {
        enabled: true,
      },
      mode: "subscription",
      client_reference_id: teamId,
      allow_promotion_codes: true,
    });
  }

  waitUntil(
    Promise.all([
      identifyUser(userEmail ?? userId),
      trackAnalytics({
        event: "Stripe Checkout Clicked",
        teamId,
        priceId: priceId,
      }),
    ]),
  );

  return NextResponse.json(stripeSession);
}
