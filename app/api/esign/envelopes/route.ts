/**
 * POST /api/esign/envelopes — Create a new standalone e-signature envelope
 * GET  /api/esign/envelopes — List envelopes for the authenticated user's team
 *
 * Envelopes can be sent to ANY email address without requiring the recipient
 * to be in a dataroom, investor pipeline, or contact list.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuthAppRouter } from "@/lib/auth/rbac";
import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { errorResponse } from "@/lib/errors";
import { createEnvelope } from "@/lib/esign/envelope-service";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import {
  requireFundroomActive,
  PAYWALL_ERROR,
} from "@/lib/auth/paywall";
import { validateBody } from "@/lib/middleware/validate";
import { EnvelopeCreateSchema } from "@/lib/validations/esign-outreach";
import { checkModuleAccess, resolveOrgIdFromTeam } from "@/lib/middleware/module-access";

export const dynamic = "force-dynamic";

// ============================================================================
// GET — List envelopes
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const auth = await requireAuthAppRouter();
    if (auth instanceof NextResponse) return auth;

    // Get user's team
    const userTeam = await prisma.userTeam.findFirst({
      where: {
        user: { email: auth.email },
        status: "ACTIVE",
      },
      select: { teamId: true },
    });

    if (!userTeam) {
      return NextResponse.json({ error: "No active team" }, { status: 403 });
    }

    // Module access check — SIGNSUITE required for e-signature features
    const orgId = await resolveOrgIdFromTeam(userTeam.teamId);
    if (orgId) {
      const moduleBlocked = await checkModuleAccess(orgId, "SIGNSUITE");
      if (moduleBlocked) return moduleBlocked;
    }

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20", 10), 100);

    const where: Record<string, unknown> = { teamId: userTeam.teamId };
    if (status) {
      where.status = status;
    }

    const [envelopes, total] = await Promise.all([
      prisma.envelope.findMany({
        where,
        include: {
          recipients: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              order: true,
              status: true,
              signedAt: true,
              viewedAt: true,
            },
          },
          createdBy: {
            select: { name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.envelope.count({ where }),
    ]);

    // Status counts for dashboard
    const statusCounts = await prisma.envelope.groupBy({
      by: ["status"],
      where: { teamId: userTeam.teamId },
      _count: { id: true },
    });

    const counts = statusCounts.reduce(
      (acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      envelopes,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      statusCounts: counts,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// ============================================================================
// POST — Create envelope
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const blocked = await appRouterRateLimit(req);
    if (blocked) return blocked;

    const auth = await requireAuthAppRouter();
    if (auth instanceof NextResponse) return auth;

    const user = await prisma.user.findUnique({
      where: { email: auth.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user's team
    const userTeam = await prisma.userTeam.findFirst({
      where: {
        userId: user.id,
        status: "ACTIVE",
      },
      select: { teamId: true, role: true },
    });

    if (!userTeam) {
      return NextResponse.json({ error: "No active team" }, { status: 403 });
    }

    // Module access check — SIGNSUITE required for e-signature features
    const postOrgId = await resolveOrgIdFromTeam(userTeam.teamId);
    if (postOrgId) {
      const moduleBlocked = await checkModuleAccess(postOrgId, "SIGNSUITE");
      if (moduleBlocked) return moduleBlocked;
    }

    // Paywall check — envelope creation is a paid GP action
    const paywallAllowed = await requireFundroomActive(userTeam.teamId);
    if (!paywallAllowed) {
      return NextResponse.json(PAYWALL_ERROR, { status: 402 });
    }

    const parsed = await validateBody(req, EnvelopeCreateSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    // Validate expiration
    let expiresAt: Date | undefined;
    if (body.expiresAt) {
      expiresAt = new Date(body.expiresAt);
      if (isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        return NextResponse.json(
          { error: "Expiration date must be in the future" },
          { status: 400 }
        );
      }
    }

    const envelope = await createEnvelope({
      teamId: userTeam.teamId,
      createdById: user.id,
      title: body.title.trim(),
      description: body.description?.trim(),
      signingMode: body.signingMode,
      emailSubject: body.emailSubject?.trim(),
      emailMessage: body.emailMessage?.trim(),
      expiresAt,
      reminderEnabled: body.reminderEnabled,
      reminderDays: body.reminderDays,
      maxReminders: body.maxReminders,
      recipients: body.recipients,
      sourceFile: body.sourceFile ?? undefined,
      sourceStorageType: body.sourceStorageType ?? undefined,
      sourceFileName: body.sourceFileName ?? undefined,
      sourceMimeType: body.sourceMimeType ?? undefined,
      sourceFileSize: body.sourceFileSize ?? undefined,
      sourceNumPages: body.sourceNumPages ?? undefined,
    });

    // Fire-and-forget: Record e-sig document creation for tier enforcement
    import("@/lib/esig/usage-service").then(({ recordDocumentCreated }) =>
      recordDocumentCreated(userTeam.teamId)
    ).catch((e) => reportError(e as Error));

    return NextResponse.json(envelope, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message.includes("required") || message.includes("SIGNER")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return errorResponse(error);
  }
}
