import { NextRequest, NextResponse } from "next/server";
import { authenticateGP } from "@/lib/marketplace/auth";
import {
  createDealDocument,
  listDealDocuments,
} from "@/lib/marketplace";
import { verifyNotBot } from "@/lib/security/bot-protection";
import { errorResponse } from "@/lib/errors";
import { validateBody } from "@/lib/middleware/validate";
import { DealDocumentSchema } from "@/lib/validations/esign-outreach";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ teamId: string; dealId: string }>;
};

/**
 * GET /api/teams/[teamId]/marketplace/deals/[dealId]/documents
 * List documents for a deal.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { teamId, dealId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const category = url.searchParams.get("category") ?? undefined;

    const documents = await listDealDocuments(dealId, category);
    return NextResponse.json({ documents });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

/**
 * POST /api/teams/[teamId]/marketplace/deals/[dealId]/documents
 * Upload/create a document record for a deal.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const botCheck = await verifyNotBot();
    if (botCheck.blocked) return botCheck.response;

    const { teamId, dealId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const parsed = await validateBody(req, DealDocumentSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    // DealDocumentSchema requires `title` — map to downstream `name` field
    const document = await createDealDocument(
      dealId,
      {
        name: body.title,
        description: body.notes ?? undefined,
        category: body.documentType,
        storageKey: body.storageKey,
        storageType: undefined,
        fileType: undefined,
        fileSize: undefined,
        requiredStage: undefined,
        restricted: undefined,
      },
      auth.userId,
    );

    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/teams/[teamId]/marketplace/deals/[dealId]/documents
 * Update a document's metadata.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { teamId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const documentId = url.searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId query parameter is required" },
        { status: 400 },
      );
    }

    const parsed = await validateBody(req, DealDocumentSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    const { updateDealDocument } = await import("@/lib/marketplace");
    const document = await updateDealDocument(
      documentId,
      {
        name: body.title,
        description: body.notes ?? undefined,
        category: body.documentType,
        requiredStage: undefined,
        restricted: undefined,
      },
      auth.userId,
    );

    return NextResponse.json({ success: true, document });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/teams/[teamId]/marketplace/deals/[dealId]/documents
 * Delete a document.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { teamId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const documentId = url.searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId query parameter is required" },
        { status: 400 },
      );
    }

    const { deleteDealDocument } = await import("@/lib/marketplace");
    const document = await deleteDealDocument(documentId, auth.userId);

    return NextResponse.json({ success: true, document });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
