import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";

/**
 * GET /api/dataroom/vaults — list contact vaults for the authenticated user's team
 */
export async function GET(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const auth = await requireAdminAppRouter();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = req.nextUrl;
    const teamId = searchParams.get("teamId");
    if (!teamId) {
      return NextResponse.json(
        { error: "teamId is required" },
        { status: 400 },
      );
    }

    // Verify team membership
    const membership = await prisma.userTeam.findFirst({
      where: {
        userId: auth.userId,
        teamId,
        status: "ACTIVE",
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const vaults = await prisma.contactVault.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
    });

    // Batch-fetch contacts for all vaults
    const contactIds = vaults.map((v) => v.contactId).filter(Boolean);
    const contacts =
      contactIds.length > 0
        ? await prisma.contact.findMany({
            where: { id: { in: contactIds } },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              company: true,
            },
          })
        : [];
    const contactMap = new Map(contacts.map((c) => [c.id, c]));

    // Enrich with filing stats per vault
    const enriched = await Promise.all(
      vaults.map(async (vault) => {
        const filingStats = await prisma.documentFiling.aggregate({
          where: { contactVaultId: vault.id },
          _count: { id: true },
          _sum: { filedFileSize: true },
        });

        const contact = contactMap.get(vault.contactId) ?? {
          id: vault.contactId,
          email: "Unknown",
          firstName: null,
          lastName: null,
          company: null,
        };

        return {
          id: vault.id,
          contact,
          totalDocuments: filingStats._count.id,
          totalSizeBytes: Number(filingStats._sum.filedFileSize ?? 0),
          expiresAt: vault.accessExpiry,
          createdAt: vault.createdAt,
        };
      }),
    );

    return NextResponse.json({ vaults: enriched });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
