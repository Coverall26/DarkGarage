import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { appRouterUploadRateLimit } from "@/lib/security/rate-limiter";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { fileToOrgVault } from "@/lib/esign/document-filing-service";
import type { DocumentFilingSourceType } from "@prisma/client";

export const dynamic = "force-dynamic";

const ALLOWED_SOURCE_TYPES: DocumentFilingSourceType[] = [
  "MANUAL_UPLOAD",
  "WIRE_PROOF",
  "TAX_FORM",
  "IDENTITY_DOCUMENT",
  "SHARED_DOCUMENT",
];

/**
 * POST /api/dataroom/upload — manual document upload to org vault
 */
export async function POST(req: NextRequest) {
  const blocked = await appRouterUploadRateLimit(req);
  if (blocked) return blocked;

  const auth = await requireAdminAppRouter();
  if (auth instanceof NextResponse) return auth;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sourceType = formData.get("sourceType") as string | null;
    const teamId = formData.get("teamId") as string | null;

    if (!file || !teamId) {
      return NextResponse.json(
        { error: "file and teamId are required" },
        { status: 400 },
      );
    }

    // Validate source type
    const resolvedSourceType = (sourceType || "MANUAL_UPLOAD") as DocumentFilingSourceType;
    if (!ALLOWED_SOURCE_TYPES.includes(resolvedSourceType)) {
      return NextResponse.json(
        { error: "Invalid source type" },
        { status: 400 },
      );
    }

    // 25 MB limit
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File must be under 25 MB" },
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

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const fileContent = Buffer.from(arrayBuffer);

    // File to org vault
    const result = await fileToOrgVault({
      teamId,
      sourceType: resolvedSourceType,
      fileContent,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      filedById: auth.userId,
      subPath: `manual/${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    });

    // Audit log
    await logAuditEvent({
      eventType: "DOCUMENT_UPLOADED",
      userId: auth.userId,
      teamId,
      resourceType: "DocumentFiling",
      resourceId: result.id,
      metadata: {
        fileName: file.name,
        sourceType: resolvedSourceType,
        fileSize: file.size,
      },
    }).catch((e) => reportError(e as Error));

    return NextResponse.json({
      id: result.id,
      path: result.path,
      fileName: file.name,
    });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
