/**
 * POST /api/admin/manual-investment/[id]/verify-proof
 *
 * GP verifies or rejects proof of payment on a manual investment.
 * Actions: "verify" or "reject"
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { requireAdminAppRouter } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Defense-in-depth: admin auth check (additive to edge middleware)
  const adminAuth = await requireAdminAppRouter();
  if (adminAuth instanceof NextResponse) return adminAuth;

  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Investment ID required" }, { status: 400 });
  }

  const userTeam = await prisma.userTeam.findFirst({
    where: {
      userId: session.user.id,
      role: { in: ["OWNER", "ADMIN", "SUPER_ADMIN"] },
      status: "ACTIVE",
    },
  });

  if (!userTeam) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const teamId = userTeam.teamId;
  const userId = session.user.id;

  try {
    const body = await req.json();
    const { action, reason } = body;

    if (!action || !["verify", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Action must be 'verify' or 'reject'" },
        { status: 400 },
      );
    }

    const investment = await prisma.manualInvestment.findFirst({
      where: { id, teamId },
      include: {
        investor: {
          include: { user: { select: { name: true, email: true } } },
        },
        fund: { select: { id: true, name: true } },
      },
    });

    if (!investment) {
      return NextResponse.json({ error: "Investment not found" }, { status: 404 });
    }

    if (
      investment.proofStatus !== "UPLOADED" &&
      investment.proofStatus !== "PENDING" &&
      investment.proofStatus !== "RECEIVED"
    ) {
      return NextResponse.json(
        { error: "No proof available to review" },
        { status: 400 },
      );
    }

    const forwarded = req.headers.get("x-forwarded-for");
    const existingAudit =
      (investment.auditTrail as Record<string, unknown>) || {};
    const existingUpdates = (existingAudit.updates as unknown[]) || [];

    if (action === "verify") {
      const updated = await prisma.manualInvestment.update({
        where: { id },
        data: {
          proofStatus: "VERIFIED",
          proofVerifiedBy: userId,
          proofVerifiedAt: new Date(),
          transferStatus: "COMPLETED",
          auditTrail: {
            ...existingAudit,
            updates: [
              ...existingUpdates,
              {
                by: userId,
                at: new Date().toISOString(),
                action: "proof_verified",
                ip: forwarded || null,
              },
            ],
          },
        },
        include: {
          investor: {
            include: { user: { select: { name: true, email: true } } },
          },
          fund: { select: { id: true, name: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          teamId,
          eventType: "MANUAL_INVESTMENT_UPDATED",
          resourceType: "MANUAL_INVESTMENT",
          resourceId: id,
          userId,
          metadata: {
            action: "proof_verified",
            investorId: investment.investorId,
            fundId: investment.fundId,
          },
          ipAddress: forwarded?.split(",")[0].trim() || null,
          userAgent: req.headers.get("user-agent") || null,
        },
      });

      return NextResponse.json({ investment: updated });
    }

    // Reject
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 },
      );
    }

    const updated = await prisma.manualInvestment.update({
      where: { id },
      data: {
        proofStatus: "REJECTED",
        proofRejectedBy: userId,
        proofRejectedAt: new Date(),
        proofRejectionReason: reason.trim(),
        auditTrail: {
          ...existingAudit,
          updates: [
            ...existingUpdates,
            {
              by: userId,
              at: new Date().toISOString(),
              action: "proof_rejected",
              reason: reason.trim(),
              ip: forwarded || null,
            },
          ],
        },
      },
      include: {
        investor: {
          include: { user: { select: { name: true, email: true } } },
        },
        fund: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        teamId,
        eventType: "MANUAL_INVESTMENT_UPDATED",
        resourceType: "MANUAL_INVESTMENT",
        resourceId: id,
        userId,
        metadata: {
          action: "proof_rejected",
          reason: reason.trim(),
          investorId: investment.investorId,
          fundId: investment.fundId,
        },
        ipAddress: forwarded?.split(",")[0].trim() || null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    return NextResponse.json({ investment: updated });
  } catch (error) {
    return errorResponse(error);
  }
}
