import { NextRequest, NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { enforceRBACAppRouter } from "@/lib/auth/rbac";
import { validateBody } from "@/lib/middleware/validate";
import { OfferingCreateSchema, OfferingPatchSchema } from "@/lib/validations/esign-outreach";

export const dynamic = "force-dynamic";

/**
 * GET /api/teams/[teamId]/offering
 * Returns offering page(s) for the team's funds.
 * Auth: GP admin (OWNER/ADMIN/SUPER_ADMIN).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;

  const auth = await enforceRBACAppRouter({
    roles: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
    teamId,
  });
  if (auth instanceof NextResponse) return auth;

  try {
    const offerings = await prisma.offeringPage.findMany({
      where: { teamId },
      include: {
        fund: {
          select: { id: true, name: true, status: true, targetRaise: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ offerings });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/teams/[teamId]/offering
 * Create or update an offering page for a fund.
 * Auth: GP admin (OWNER/ADMIN/SUPER_ADMIN).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;

  const auth = await enforceRBACAppRouter({
    roles: ["OWNER", "SUPER_ADMIN", "ADMIN"],
    teamId,
  });
  if (auth instanceof NextResponse) return auth;

  try {
    const parsed = await validateBody(req, OfferingCreateSchema);
    if (parsed.error) return parsed.error;
    const { fundId, ...offeringData } = parsed.data;

    // Verify fund belongs to team
    const fund = await prisma.fund.findFirst({
      where: { id: fundId, teamId },
    });

    if (!fund) {
      return NextResponse.json({ error: "Fund not found" }, { status: 404 });
    }

    // Generate slug from fund name if not provided
    const slug =
      offeringData.slug ||
      fund.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    // Check slug uniqueness
    const existingSlug = await prisma.offeringPage.findUnique({
      where: { slug },
      select: { id: true, fundId: true },
    });

    if (existingSlug && existingSlug.fundId !== fundId) {
      return NextResponse.json(
        { error: "Slug already in use by another offering" },
        { status: 409 }
      );
    }

    // Upsert: create or update offering for this fund
    const offering = await prisma.offeringPage.upsert({
      where: existingSlug ? { slug } : { slug: `__nonexistent_${Date.now()}` },
      create: {
        fundId,
        teamId,
        slug,
        ...sanitizeOfferingData(offeringData),
      },
      update: {
        ...sanitizeOfferingData(offeringData),
      },
    });

    return NextResponse.json({ offering }, { status: existingSlug ? 200 : 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/teams/[teamId]/offering
 * Update specific fields of an offering page.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;

  const auth = await enforceRBACAppRouter({
    roles: ["OWNER", "SUPER_ADMIN", "ADMIN"],
    teamId,
  });
  if (auth instanceof NextResponse) return auth;

  try {
    const parsed = await validateBody(req, OfferingPatchSchema);
    if (parsed.error) return parsed.error;
    const { offeringId, ...updates } = parsed.data;

    // Verify offering belongs to team
    const existing = await prisma.offeringPage.findFirst({
      where: { id: offeringId, teamId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Offering not found" }, { status: 404 });
    }

    const offering = await prisma.offeringPage.update({
      where: { id: offeringId },
      data: sanitizeOfferingData(updates),
    });

    return NextResponse.json({ offering });
  } catch (error) {
    return errorResponse(error);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sanitizeOfferingData(data: Record<string, unknown>) {
  const allowed = [
    "isPublic",
    "heroHeadline",
    "heroSubheadline",
    "heroImageUrl",
    "heroBadgeText",
    "offeringDescription",
    "keyMetrics",
    "highlights",
    "dealTerms",
    "timeline",
    "leadership",
    "gallery",
    "dataroomDocuments",
    "financialProjections",
    "advantages",
    "ctaText",
    "ctaSecondary",
    "emailGateEnabled",
    "brandColor",
    "accentColor",
    "logoUrl",
    "customCss",
    "disclaimerText",
    "removeBranding",
    "metaTitle",
    "metaDescription",
    "metaImageUrl",
  ];

  const sanitized: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in data) {
      sanitized[key] = data[key];
    }
  }
  return sanitized;
}
