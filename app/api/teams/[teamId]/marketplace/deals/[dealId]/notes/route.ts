import { NextRequest, NextResponse } from "next/server";
import { authenticateGP } from "@/lib/marketplace/auth";
import {
  createDealNote,
  listDealNotes,
  updateDealNote,
  deleteDealNote,
} from "@/lib/marketplace";
import { verifyNotBot } from "@/lib/security/bot-protection";
import { errorResponse } from "@/lib/errors";
import { validateBody } from "@/lib/middleware/validate";
import { DealNoteSchema } from "@/lib/validations/esign-outreach";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ teamId: string; dealId: string }>;
};

/**
 * GET /api/teams/[teamId]/marketplace/deals/[dealId]/notes
 * List notes for a deal (GP view — includes private notes).
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { teamId, dealId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    // GP users can see private notes
    const notes = await listDealNotes(dealId, true);
    return NextResponse.json({ notes });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

/**
 * POST /api/teams/[teamId]/marketplace/deals/[dealId]/notes
 * Create a note on a deal.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const botCheck = await verifyNotBot();
    if (botCheck.blocked) return botCheck.response;

    const { teamId, dealId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const parsed = await validateBody(req, DealNoteSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    const note = await createDealNote(
      dealId,
      {
        content: body.content,
        isPrivate: body.isInternal,
        pinned: undefined,
      },
      auth.userId,
    );

    return NextResponse.json({ success: true, note }, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/teams/[teamId]/marketplace/deals/[dealId]/notes
 * Update a note.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { teamId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const noteId = url.searchParams.get("noteId");

    if (!noteId) {
      return NextResponse.json(
        { error: "noteId query parameter is required" },
        { status: 400 },
      );
    }

    const parsed = await validateBody(req, DealNoteSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    const note = await updateDealNote(
      noteId,
      {
        content: body.content,
        isPrivate: body.isInternal,
        pinned: undefined,
      },
      auth.userId,
    );

    return NextResponse.json({ success: true, note });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/teams/[teamId]/marketplace/deals/[dealId]/notes
 * Delete a note.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { teamId } = await params;
    const auth = await authenticateGP(teamId);
    if ("error" in auth) return auth.error;

    const url = new URL(req.url);
    const noteId = url.searchParams.get("noteId");

    if (!noteId) {
      return NextResponse.json(
        { error: "noteId query parameter is required" },
        { status: 400 },
      );
    }

    const note = await deleteDealNote(noteId, auth.userId);
    return NextResponse.json({ success: true, note });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
