import { NextRequest, NextResponse } from "next/server";

import { requireAdminAppRouter } from "@/lib/auth/rbac";
import prisma from "@/lib/prisma";
import { getFile } from "@/lib/files/get-file";
import { DocumentStorageType } from "@prisma/client";
import { reportError } from "@/lib/error";
import { errorResponse } from "@/lib/errors";
import { appRouterUploadRateLimit } from "@/lib/security/rate-limiter";
import { validateBody } from "@/lib/middleware/validate";
import { ExportBlobsSchema } from "@/lib/validations/admin";

export const dynamic = "force-dynamic";

interface BlobManifest {
  exportedAt: string;
  exportedBy: string;
  teamId: string;
  blobs: {
    storageKey: string;
    documentType: string;
    investorId: string;
    title: string;
    signedUrl?: string;
    error?: string;
  }[];
}

/**
 * GET /api/admin/export-blobs
 *
 * Export blob/document manifest with optional signed URLs.
 */
export async function GET(req: NextRequest) {
  // Defense-in-depth: admin auth check (additive to edge middleware)
  const adminAuth = await requireAdminAppRouter();
  if (adminAuth instanceof NextResponse) return adminAuth;

  try {
    const blocked = await appRouterUploadRateLimit(req);
    if (blocked) return blocked;

    const searchParams = new URL(req.url).searchParams;
    const teamId = searchParams.get("teamId");
    const includeSignedUrls = searchParams.get("includeSignedUrls");

    if (!teamId) {
      return NextResponse.json({ error: "Team ID required" }, { status: 400 });
    }

    const auth = await requireAdminAppRouter(teamId);
    if (auth instanceof NextResponse) return auth;

    return await handleBlobExport(req, auth, teamId, includeSignedUrls === "true");
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

/**
 * POST /api/admin/export-blobs
 *
 * Export blob/document manifest via POST body.
 */
export async function POST(req: NextRequest) {
  // Defense-in-depth: admin auth check (additive to edge middleware)
  const adminAuth = await requireAdminAppRouter();
  if (adminAuth instanceof NextResponse) return adminAuth;

  try {
    const blocked = await appRouterUploadRateLimit(req);
    if (blocked) return blocked;

    const parsed = await validateBody(req, ExportBlobsSchema);
    if (parsed.error) return parsed.error;
    const { teamId, includeSignedUrls } = parsed.data;

    const auth = await requireAdminAppRouter(teamId);
    if (auth instanceof NextResponse) return auth;

    return await handleBlobExport(
      req,
      auth,
      teamId,
      includeSignedUrls === true,
    );
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

async function handleBlobExport(
  req: NextRequest,
  auth: { userId: string; email: string; teamId: string },
  teamId: string,
  includeSignedUrls: boolean,
) {
  const funds = await prisma.fund.findMany({
    where: { teamId },
    select: { id: true },
  });
  const fundIds = funds.map((f: { id: string }) => f.id);

  const investments = await prisma.investment.findMany({
    where: { fundId: { in: fundIds } },
    select: { investorId: true },
  });
  const investorIds = [...new Set(investments.map((i: { investorId: string }) => i.investorId))];

  const documents = await prisma.investorDocument.findMany({
    where: { investorId: { in: investorIds } },
    select: {
      storageKey: true,
      documentType: true,
      investorId: true,
      title: true,
    },
  });

  const manifest: BlobManifest = {
    exportedAt: new Date().toISOString(),
    exportedBy: auth.email,
    teamId,
    blobs: [],
  };

  for (const doc of documents) {
    const blobEntry: BlobManifest["blobs"][0] = {
      storageKey: doc.storageKey,
      documentType: doc.documentType,
      investorId: doc.investorId,
      title: doc.title,
    };

    if (includeSignedUrls) {
      try {
        const signedUrl = await getFile({
          type: DocumentStorageType.S3_PATH,
          data: doc.storageKey,
        });
        blobEntry.signedUrl = signedUrl;
      } catch (err: unknown) {
        blobEntry.error = "Export failed for this blob";
      }
    }

    manifest.blobs.push(blobEntry);
  }

  await prisma.auditLog.create({
    data: {
      eventType: "BLOB_EXPORT",
      userId: auth.userId,
      teamId,
      resourceType: "TEAM_BLOBS",
      resourceId: teamId,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0] || "",
      userAgent: req.headers.get("user-agent") || "",
      metadata: {
        blobCount: manifest.blobs.length,
        includeSignedUrls,
      },
    },
  }).catch((e: unknown) => reportError(e as Error));

  return NextResponse.json(manifest);
}
