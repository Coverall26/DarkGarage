import { NextRequest, NextResponse } from "next/server";
import { authenticateGP } from "@/lib/marketplace/auth";
import {
  upsertListing,
  publishListing,
  unpublishListing,
} from "@/lib/marketplace";
import { verifyNotBot } from "@/lib/security/bot-protection";
import { errorResponse } from "@/lib/errors";
import { validateBody } from "@/lib/middleware/validate";
import { DealListingSchema } from "@/lib/validations/esign-outreach";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ teamId: string; dealId: string }>;
};

/**
 * POST /api/teams/[teamId]/marketplace/deals/[dealId]/listing
 * Create or update a marketplace listing for a deal.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const botCheck = await verifyNotBot();
    if (botCheck.blocked) return botCheck.response;

    const { teamId, dealId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const parsed = await validateBody(req, DealListingSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    if (!body.title || !body.description) {
      return NextResponse.json(
        { error: "title and description are required" },
        { status: 400 },
      );
    }

    const listing = await upsertListing(
      {
        dealId,
        headline: body.title,
        summary: body.description,
        highlights: undefined,
        category: body.category,
        coverImageUrl: undefined,
        searchTags: body.tags,
      },
      teamId,
    );

    return NextResponse.json({ success: true, listing });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/teams/[teamId]/marketplace/deals/[dealId]/listing
 * Publish or unpublish a listing.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const botCheck = await verifyNotBot();
    if (botCheck.blocked) return botCheck.response;

    const { teamId, dealId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const parsed = await validateBody(req, DealListingSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    // Look up the listing by dealId (unique constraint)
    const existingListing = await prisma.marketplaceListing.findUnique({
      where: { dealId },
      select: { id: true },
    });

    if (!existingListing) {
      return NextResponse.json(
        { error: "No listing found for this deal" },
        { status: 404 },
      );
    }

    const listing = body.isPublic
      ? await publishListing(existingListing.id)
      : await unpublishListing(existingListing.id);

    return NextResponse.json({ success: true, listing });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
