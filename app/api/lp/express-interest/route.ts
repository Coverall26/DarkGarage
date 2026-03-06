import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { validateBody } from "@/lib/middleware/validate";
import { ExpressInterestSchema } from "@/lib/validations/lp";

export const dynamic = "force-dynamic";

/**
 * Express Interest API
 *
 * POST /api/lp/express-interest
 *
 * INTENTIONALLY_PUBLIC: Lead capture endpoint — no session auth required because
 * visitors express interest before they have an account. Protected by rate limiting
 * and Zod schema validation.
 *
 * Captures lead interest when no fund is configured ("Express Interest" button).
 * Stores in MarketplaceWaitlist or as a viewer record.
 */

export async function POST(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const parsed = await validateBody(req, ExpressInterestSchema);
  if (parsed.error) return parsed.error;

  const {
    email,
    name,
    dataroomSlug,
    referralCode,
    investorType,
    investmentPreferences,
  } = parsed.data;

  // Determine source from context
  const source = dataroomSlug
    ? "WEBSITE"
    : referralCode
      ? "REFERRAL"
      : "DIRECT";

  try {
    // Store in MarketplaceWaitlist (upsert to avoid duplicates)
    await prisma.marketplaceWaitlist.upsert({
      where: { email },
      update: {
        name: name || undefined,
        source,
        ...(referralCode ? { referralCode } : {}),
        ...(investorType ? { investorType } : {}),
        ...(investmentPreferences ? { investmentPreferences } : {}),
      },
      create: {
        email,
        name: name || null,
        source,
        investorType: investorType || null,
        referralCode: referralCode || null,
        investmentPreferences: investmentPreferences || undefined,
      },
    });

    return NextResponse.json({ message: "Interest recorded" });
  } catch (error) {
    return errorResponse(error);
  }
}
