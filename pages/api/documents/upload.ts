// MIGRATION STATUS: LEGACY
// App Router equivalent: none
// See docs/PAGES-ROUTER-MIGRATION.md
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import { LPDocumentType, LPDocumentUploadSource } from "@prisma/client";
import { logAuditEvent } from "@/lib/audit/audit-logger";
import { uploadInvestorDocument } from "@/lib/storage/investor-storage";
import { reportError } from "@/lib/error";
import { uploadRateLimiter } from "@/lib/security/rate-limiter";
import { resolveDocumentStorageType } from "@/lib/storage/resolve-storage-type";
import { z } from "zod";
import { needsConversion, convertToPdf } from "@/lib/documents/file-conversion";
import { logger } from "@/lib/logger";

const LPDocumentTypeValues = [
  "NDA",
  "SUBSCRIPTION_AGREEMENT",
  "LPA",
  "SIDE_LETTER",
  "K1_TAX_FORM",
  "PROOF_OF_FUNDS",
  "WIRE_CONFIRMATION",
  "ACH_RECEIPT",
  "ACCREDITATION_PROOF",
  "IDENTITY_DOCUMENT",
  "FORMATION_DOCS",
  "POWER_OF_ATTORNEY",
  "TRUST_DOCUMENTS",
  "CUSTODIAN_DOCUMENTS",
  "OTHER",
] as const;

const DocumentUploadSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  documentType: z.enum(LPDocumentTypeValues, {
    errorMap: () => ({ message: `Invalid document type. Must be one of: ${LPDocumentTypeValues.join(", ")}` }),
  }),
  fundId: z.string().min(1, "Fund ID is required"),
  uploadSource: z.enum(["LP_UPLOADED", "LP_UPLOADED_EXTERNAL", "GP_UPLOADED_FOR_LP"]).optional(),
  investorId: z.string().optional(),
  lpNotes: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  isOfflineSigned: z.boolean().optional(),
  externalSigningDate: z.string().optional(),
  investmentId: z.string().optional(),
  fileData: z.string().min(1, "File data is required"),
  fileName: z.string().min(1, "File name is required").max(500),
  mimeType: z.string().optional(),
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

/**
 * POST /api/documents/upload
 *
 * Unified document upload endpoint — handles both LP and GP uploads.
 *
 * LP upload (uploadSource: LP_UPLOADED or LP_UPLOADED_EXTERNAL):
 *   - Authenticated LP uploads their own document
 *   - Status: UPLOADED_PENDING_REVIEW
 *   - GP admins notified via email
 *
 * GP upload (uploadSource: GP_UPLOADED_FOR_LP):
 *   - Requires investorId in body
 *   - GP must have admin role on fund's team
 *   - Status: APPROVED (auto-approved)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Rate limit: 20 uploads per minute
  const allowed = await uploadRateLimiter(req, res);
  if (!allowed) return;

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id || !session?.user?.email) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const parsed = DocumentUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || "Invalid request body",
      });
    }

    const {
      title,
      documentType,
      fundId,
      uploadSource: requestedSource,
      investorId: bodyInvestorId,
      lpNotes,
      notes,
      isOfflineSigned,
      externalSigningDate,
      investmentId,
      fileData,
      fileName,
      mimeType,
    } = parsed.data;

    const fund = await prisma.fund.findUnique({
      where: { id: fundId },
      select: { teamId: true, name: true },
    });

    if (!fund) {
      return res.status(404).json({ error: "Fund not found" });
    }

    const isGPUpload = requestedSource === "GP_UPLOADED_FOR_LP";

    if (isGPUpload) {
      // ── GP upload flow ──
      if (!bodyInvestorId) {
        return res.status(400).json({
          error: "investorId is required for GP uploads",
        });
      }

      const userTeam = await prisma.userTeam.findFirst({
        where: {
          userId: session.user.id,
          teamId: fund.teamId,
          role: { in: ["OWNER", "ADMIN", "SUPER_ADMIN"] },
        },
      });

      if (!userTeam) {
        return res.status(403).json({
          error: "You do not have permission to upload documents for this fund",
        });
      }

      const investor = await prisma.investor.findUnique({
        where: { id: bodyInvestorId },
        select: { id: true, fundId: true },
      });

      if (!investor) {
        return res.status(404).json({ error: "Investor not found" });
      }

      if (investor.fundId !== fundId) {
        const inv = await prisma.investment.findFirst({
          where: { investorId: bodyInvestorId, fundId },
          select: { id: true },
        });
        if (!inv) {
          return res.status(400).json({
            error: "Investor is not associated with this fund",
          });
        }
      }

      const fileBuffer = Buffer.from(fileData, "base64");
      const fileSize = BigInt(fileBuffer.length);

      // Auto-convert DOCX/XLSX to PDF for consistent viewing
      let uploadBuffer: Buffer = fileBuffer;
      let uploadFilename = fileName;
      let uploadMimeType = mimeType || "application/octet-stream";

      if (needsConversion(fileName)) {
        const conversion = await convertToPdf(fileBuffer, fileName);
        if (conversion.success) {
          uploadBuffer = conversion.result.pdfBuffer;
          uploadFilename = conversion.result.pdfFilename;
          uploadMimeType = conversion.result.mimeType;
          logger.info("Document converted to PDF", {
            module: "document-upload",
            originalFile: fileName,
            convertedFile: uploadFilename,
            pageCount: conversion.result.pageCount,
          });
        } else {
          logger.warn("Document conversion failed, using original", {
            module: "document-upload",
            fileName,
            error: conversion.error,
          });
        }
      }

      const { path: storageKey, hash } = await uploadInvestorDocument(
        bodyInvestorId,
        documentType,
        uploadBuffer,
        uploadFilename
      );

      const lpDocument = await prisma.lPDocument.create({
        data: {
          title,
          documentType: documentType as LPDocumentType,
          fundId,
          investorId: bodyInvestorId,
          uploadedByUserId: session.user.id,
          uploadSource: "GP_UPLOADED_FOR_LP" as LPDocumentUploadSource,
          storageKey,
          storageType: resolveDocumentStorageType(),
          originalFilename: fileName,
          fileSize,
          mimeType: uploadMimeType,
          reviewNotes: notes || null,
          isOfflineSigned: false,
          externalSigningDate: externalSigningDate
            ? new Date(externalSigningDate)
            : null,
          investmentId: investmentId || null,
          status: "APPROVED",
          reviewedByUserId: session.user.id,
          reviewedAt: new Date(),
        },
      });

      await logAuditEvent({
        eventType: "ADMIN_ACTION",
        userId: session.user.id,
        teamId: fund.teamId,
        resourceType: "Document",
        resourceId: lpDocument.id,
        metadata: {
          action: "GP uploaded document for investor",
          documentType,
          title,
          fileName,
          fileSize: fileSize.toString(),
          investorId: bodyInvestorId,
          fundId,
          hash,
          uploadSource: "GP_UPLOADED_FOR_LP",
          actorEmail: session.user.email,
        },
        ipAddress: req.socket?.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
      });

      return res.status(201).json({
        success: true,
        document: {
          id: lpDocument.id,
          title: lpDocument.title,
          documentType: lpDocument.documentType,
          status: lpDocument.status,
          createdAt: lpDocument.createdAt,
        },
      });
    } else {
      // ── LP upload flow ──
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          investorProfile: {
            select: { id: true, fundId: true },
          },
        },
      });

      const investorId = dbUser?.investorProfile?.id;
      if (!investorId) {
        return res.status(400).json({
          error:
            "No investor profile found. Please complete your investor setup first.",
        });
      }

      if (dbUser.investorProfile?.fundId !== fundId) {
        return res.status(403).json({
          error: "You can only upload documents to your associated fund.",
        });
      }

      if (investmentId) {
        const investment = await prisma.investment.findFirst({
          where: { id: investmentId, investorId, fundId },
        });
        if (!investment) {
          return res.status(400).json({
            error: "Invalid investment ID - not associated with your account.",
          });
        }
      }

      const fileBuffer = Buffer.from(fileData, "base64");
      const fileSize = BigInt(fileBuffer.length);

      // Auto-convert DOCX/XLSX to PDF for consistent viewing
      let uploadBuffer: Buffer = fileBuffer;
      let uploadFilename = fileName;
      let uploadMimeType = mimeType || "application/octet-stream";

      if (needsConversion(fileName)) {
        const conversion = await convertToPdf(fileBuffer, fileName);
        if (conversion.success) {
          uploadBuffer = conversion.result.pdfBuffer;
          uploadFilename = conversion.result.pdfFilename;
          uploadMimeType = conversion.result.mimeType;
          logger.info("Document converted to PDF", {
            module: "document-upload",
            originalFile: fileName,
            convertedFile: uploadFilename,
            pageCount: conversion.result.pageCount,
          });
        } else {
          logger.warn("Document conversion failed, using original", {
            module: "document-upload",
            fileName,
            error: conversion.error,
          });
        }
      }

      const { path: storageKey, hash } = await uploadInvestorDocument(
        investorId,
        documentType,
        uploadBuffer,
        uploadFilename
      );

      const uploadSource: LPDocumentUploadSource =
        requestedSource === "LP_UPLOADED_EXTERNAL" || isOfflineSigned
          ? "LP_UPLOADED_EXTERNAL"
          : "LP_UPLOADED";

      const lpDocument = await prisma.lPDocument.create({
        data: {
          title,
          documentType: documentType as LPDocumentType,
          fundId,
          investorId,
          uploadedByUserId: session.user.id,
          uploadSource,
          storageKey,
          storageType: resolveDocumentStorageType(),
          originalFilename: fileName,
          fileSize,
          mimeType: uploadMimeType,
          lpNotes: lpNotes || null,
          isOfflineSigned: isOfflineSigned || false,
          externalSigningDate: externalSigningDate
            ? new Date(externalSigningDate)
            : null,
          investmentId: investmentId || null,
          status: "UPLOADED_PENDING_REVIEW",
        },
        include: {
          fund: { select: { name: true, teamId: true } },
        },
      });

      const fundData = lpDocument.fund as { name: string; teamId: string } | null;

      await logAuditEvent({
        eventType: "ADMIN_ACTION",
        userId: session.user.id,
        teamId: fundData?.teamId || fundId,
        resourceType: "Document",
        resourceId: lpDocument.id,
        metadata: {
          action: "LP document uploaded",
          documentType,
          title,
          fileName,
          fileSize: fileSize.toString(),
          investorId,
          fundId,
          hash,
          uploadSource,
          actorEmail: session.user.email,
        },
        ipAddress: req.socket?.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
      });

      // Fire-and-forget: notify GP admins about new LP upload
      notifyGPOfLPUpload(
        fundData?.teamId || fundId,
        session.user.email || "LP",
        lpDocument.title,
        lpDocument.documentType
      ).catch((err) => {
        reportError(err as Error);
      });

      return res.status(201).json({
        success: true,
        document: {
          id: lpDocument.id,
          title: lpDocument.title,
          documentType: lpDocument.documentType,
          status: lpDocument.status,
          createdAt: lpDocument.createdAt,
        },
      });
    }
  } catch (error: unknown) {
    reportError(error as Error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function notifyGPOfLPUpload(
  teamId: string,
  lpEmail: string,
  docTitle: string,
  docType: string
) {
  try {
    const admins = await prisma.userTeam.findMany({
      where: {
        teamId,
        role: { in: ["OWNER", "ADMIN", "SUPER_ADMIN"] },
      },
      include: { user: { select: { email: true } } },
    });

    if (admins.length === 0) return;

    const { sendOrgEmail } = await import("@/lib/resend");
    const { DocumentUploadNotification } = await import(
      "@/components/emails/document-upload-notification"
    );

    const recipients = admins.slice(0, 5);
    for (const admin of recipients) {
      if (!admin.user.email) continue;
      await sendOrgEmail({
        teamId,
        to: admin.user.email,
        subject: `New document uploaded by ${lpEmail} — ${docType.replace(/_/g, " ")}`,
        react: DocumentUploadNotification({
          lpEmail,
          documentTitle: docTitle,
          documentType: docType.replace(/_/g, " "),
          portalUrl: `${process.env.NEXT_PUBLIC_BASE_URL || "https://app.fundroom.ai"}/admin/documents`,
        }),
      });
    }
  } catch (error) {
    reportError(error as Error);
  }
}
