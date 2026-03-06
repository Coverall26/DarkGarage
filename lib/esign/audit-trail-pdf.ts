/**
 * Audit Trail PDF Generator for SignSuite Envelopes
 *
 * Generates a comprehensive, multi-page PDF audit trail document containing:
 * - Envelope metadata (title, ID, status, signing mode)
 * - Complete event timeline from AuditLog
 * - Signer details with consent records, checksums, IP addresses
 * - Hash chain verification status
 * - ESIGN/UETA compliance information
 *
 * @module lib/esign/audit-trail-pdf
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { reportError } from "@/lib/error";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditTrailOptions {
  envelopeId: string;
  teamId: string;
  /** Include hash chain verification results */
  includeChainVerification?: boolean;
}

export interface AuditTrailResult {
  success: boolean;
  pdfBytes?: Uint8Array;
  error?: string;
}

interface AuditEvent {
  id: string;
  eventType: string;
  timestamp: Date | null;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
}

interface SignerInfo {
  name: string;
  email: string;
  role: string;
  order: number;
  status: string | null;
  signedAt: Date | null;
  viewedAt: Date | null;
  declinedAt: Date | null;
  declinedReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  consentRecord: Record<string, unknown> | null;
  signatureChecksum: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 60;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const LINE_HEIGHT = 14;
const SECTION_GAP = 24;

// Colors
const DARK = rgb(0.1, 0.1, 0.1);
const MEDIUM = rgb(0.3, 0.3, 0.3);
const LIGHT = rgb(0.5, 0.5, 0.5);
const EMERALD = rgb(0.06, 0.73, 0.51); // SignSuite brand
const BORDER_COLOR = rgb(0.8, 0.8, 0.8);
const BG_LIGHT = rgb(0.97, 0.97, 0.97);

// Event type labels
const EVENT_LABELS: Record<string, string> = {
  ENVELOPE_CREATED: "Envelope Created",
  ENVELOPE_SENT: "Envelope Sent for Signing",
  ENVELOPE_VOIDED: "Envelope Voided",
  ENVELOPE_DECLINED: "Envelope Declined",
  ENVELOPE_REMINDER_SENT: "Reminder Sent",
  DOCUMENT_VIEWED: "Document Viewed",
  DOCUMENT_SIGNED: "Document Signed",
  DOCUMENT_COMPLETED: "All Signatures Completed",
  DOCUMENT_DECLINED: "Signing Declined",
  DOCUMENT_FILED: "Document Filed",
  DOCUMENT_UPLOADED: "Document Uploaded",
  CERTIFICATE_GENERATED: "Certificate Generated",
  NDA_SIGNING_INITIATED: "NDA Signing Initiated",
  NDA_SIGNING_COMPLETED: "NDA Signing Completed",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

function formatShortDate(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars - 3) + "...";
}

/** Add a new page to the PDF document, returning the page and starting Y cursor */
function addPage(
  pdfDoc: PDFDocument,
  fonts: { regular: PDFFont; bold: PDFFont },
  envelopeTitle: string,
  pageNumber: number,
): { page: PDFPage; y: number } {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // Header line
  page.drawLine({
    start: { x: MARGIN_LEFT, y: PAGE_HEIGHT - MARGIN_TOP + 10 },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: PAGE_HEIGHT - MARGIN_TOP + 10 },
    thickness: 0.5,
    color: BORDER_COLOR,
  });

  // Header text
  page.drawText("SignSuite — Audit Trail", {
    x: MARGIN_LEFT,
    y: PAGE_HEIGHT - MARGIN_TOP + 16,
    size: 7,
    font: fonts.regular,
    color: LIGHT,
  });

  const pageLabel = `Page ${pageNumber}`;
  const pageLabelWidth = fonts.regular.widthOfTextAtSize(pageLabel, 7);
  page.drawText(pageLabel, {
    x: PAGE_WIDTH - MARGIN_RIGHT - pageLabelWidth,
    y: PAGE_HEIGHT - MARGIN_TOP + 16,
    size: 7,
    font: fonts.regular,
    color: LIGHT,
  });

  // Footer
  page.drawLine({
    start: { x: MARGIN_LEFT, y: MARGIN_BOTTOM - 10 },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: MARGIN_BOTTOM - 10 },
    thickness: 0.5,
    color: BORDER_COLOR,
  });

  const footerText = `Generated ${new Date().toISOString()} • ${truncateText(envelopeTitle, 60)} • Confidential`;
  page.drawText(footerText, {
    x: MARGIN_LEFT,
    y: MARGIN_BOTTOM - 22,
    size: 6,
    font: fonts.regular,
    color: LIGHT,
  });

  return { page, y: PAGE_HEIGHT - MARGIN_TOP - 10 };
}

/** Draw a section title and return updated Y */
function drawSectionTitle(
  page: PDFPage,
  y: number,
  title: string,
  font: PDFFont,
): number {
  y -= SECTION_GAP;

  // Green accent bar
  page.drawRectangle({
    x: MARGIN_LEFT,
    y: y - 2,
    width: 3,
    height: 14,
    color: EMERALD,
  });

  page.drawText(title, {
    x: MARGIN_LEFT + 10,
    y,
    size: 11,
    font,
    color: DARK,
  });

  y -= 6;
  page.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y },
    thickness: 0.5,
    color: BORDER_COLOR,
  });

  return y - LINE_HEIGHT;
}

/** Draw a label: value pair and return updated Y */
function drawField(
  page: PDFPage,
  y: number,
  label: string,
  value: string,
  fonts: { regular: PDFFont; bold: PDFFont },
  options?: { fontSize?: number; valueColor?: ReturnType<typeof rgb> },
): number {
  const fontSize = options?.fontSize ?? 8;
  const valueColor = options?.valueColor ?? MEDIUM;

  page.drawText(`${label}:`, {
    x: MARGIN_LEFT + 10,
    y,
    size: fontSize,
    font: fonts.bold,
    color: MEDIUM,
  });

  const labelWidth = fonts.bold.widthOfTextAtSize(`${label}: `, fontSize);
  page.drawText(value, {
    x: MARGIN_LEFT + 10 + labelWidth,
    y,
    size: fontSize,
    font: fonts.regular,
    color: valueColor,
  });

  return y - LINE_HEIGHT;
}

// ---------------------------------------------------------------------------
// Main Generator
// ---------------------------------------------------------------------------

export async function generateAuditTrailPdf(
  options: AuditTrailOptions,
): Promise<AuditTrailResult> {
  const { envelopeId, teamId, includeChainVerification = true } = options;

  try {
    // -----------------------------------------------------------------------
    // 1. Fetch envelope with recipients
    // -----------------------------------------------------------------------
    const envelope = await prisma.envelope.findUnique({
      where: { id: envelopeId },
      include: {
        recipients: { orderBy: { order: "asc" } },
        createdBy: { select: { name: true, email: true } },
      },
    });

    if (!envelope) {
      return { success: false, error: "Envelope not found" };
    }

    if (envelope.teamId !== teamId) {
      return { success: false, error: "Access denied" };
    }

    // -----------------------------------------------------------------------
    // 2. Fetch audit log events for this envelope
    // -----------------------------------------------------------------------
    const auditEvents = await prisma.auditLog.findMany({
      where: {
        OR: [
          { resourceId: envelopeId, resourceType: "Envelope" },
          { resourceId: envelopeId, resourceType: "SignatureDocument" },
          ...(envelope.signatureDocId
            ? [{ resourceId: envelope.signatureDocId, resourceType: "SignatureDocument" as const }]
            : []),
        ],
        teamId,
      },
      orderBy: { timestamp: "asc" },
    });

    const events: AuditEvent[] = auditEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      timestamp: e.timestamp,
      userId: e.userId,
      metadata: e.metadata as Record<string, unknown> | null,
      ipAddress: e.ipAddress,
      userAgent: e.userAgent,
    }));

    // -----------------------------------------------------------------------
    // 3. Build signer info
    // -----------------------------------------------------------------------
    const signers: SignerInfo[] = envelope.recipients
      .filter((r) => r.role === "SIGNER")
      .map((r) => ({
        name: r.name,
        email: r.email,
        role: r.role,
        order: r.order,
        status: r.status,
        signedAt: r.signedAt,
        viewedAt: r.viewedAt,
        declinedAt: r.declinedAt,
        declinedReason: r.declinedReason,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        consentRecord: r.consentRecord as Record<string, unknown> | null,
        signatureChecksum: r.signatureChecksum as Record<string, unknown> | null,
      }));

    // -----------------------------------------------------------------------
    // 4. Chain verification (optional)
    // -----------------------------------------------------------------------
    let chainVerification: { isValid: boolean; totalEntries: number; errors: string[] } | null = null;
    if (includeChainVerification) {
      try {
        const { verifyAuditChain } = await import("@/lib/audit/immutable-audit-log");
        const result = await verifyAuditChain(teamId);
        chainVerification = {
          isValid: result.isValid,
          totalEntries: result.totalEntries,
          errors: result.errors,
        };
      } catch {
        // Chain verification is optional — don't fail if it errors
        chainVerification = null;
      }
    }

    // -----------------------------------------------------------------------
    // 5. Generate PDF
    // -----------------------------------------------------------------------
    const pdfDoc = await PDFDocument.create();
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const mono = await pdfDoc.embedFont(StandardFonts.Courier);
    const fonts = { regular, bold };

    let pageNumber = 1;
    let { page, y } = addPage(pdfDoc, fonts, envelope.title, pageNumber);

    /** Check if we need a new page and add one if so */
    const ensureSpace = (needed: number): void => {
      if (y - needed < MARGIN_BOTTOM) {
        pageNumber++;
        const result = addPage(pdfDoc, fonts, envelope!.title, pageNumber);
        page = result.page;
        y = result.y;
      }
    };

    // ------- Title Block -------
    y -= 10;
    page.drawText("AUDIT TRAIL", {
      x: MARGIN_LEFT,
      y,
      size: 20,
      font: bold,
      color: DARK,
    });
    y -= 8;
    page.drawText("Certificate of Signing Activity", {
      x: MARGIN_LEFT,
      y,
      size: 9,
      font: regular,
      color: LIGHT,
    });
    y -= LINE_HEIGHT;

    // ------- Section 1: Envelope Summary -------
    y = drawSectionTitle(page, y, "ENVELOPE SUMMARY", bold);
    ensureSpace(120);

    y = drawField(page, y, "Title", envelope.title, fonts);
    y = drawField(page, y, "Envelope ID", envelope.id, fonts);
    y = drawField(page, y, "Status", envelope.status, fonts, {
      valueColor: envelope.status === "COMPLETED" ? EMERALD : MEDIUM,
    });
    y = drawField(
      page,
      y,
      "Signing Mode",
      envelope.signingMode === "SEQUENTIAL"
        ? "Sequential (In Order)"
        : envelope.signingMode === "PARALLEL"
          ? "Parallel (Any Order)"
          : "Mixed (Group-Based)",
      fonts,
    );
    if (envelope.createdBy) {
      y = drawField(
        page,
        y,
        "Created By",
        `${envelope.createdBy.name || envelope.createdBy.email} (${envelope.createdBy.email})`,
        fonts,
      );
    }
    y = drawField(page, y, "Created", formatDate(new Date(envelope.createdAt)), fonts);
    if (envelope.sentAt) {
      y = drawField(page, y, "Sent", formatDate(new Date(envelope.sentAt)), fonts);
    }
    if (envelope.completedAt) {
      y = drawField(page, y, "Completed", formatDate(new Date(envelope.completedAt)), fonts);
    }
    if (envelope.voidedAt) {
      y = drawField(page, y, "Voided", formatDate(new Date(envelope.voidedAt)), fonts);
      if (envelope.voidedReason) {
        y = drawField(page, y, "Void Reason", envelope.voidedReason, fonts);
      }
    }
    if (envelope.declinedAt) {
      y = drawField(page, y, "Declined", formatDate(new Date(envelope.declinedAt)), fonts);
    }
    if (envelope.sourceFileName) {
      y = drawField(page, y, "Document", envelope.sourceFileName, fonts);
    }
    if (envelope.emailSubject) {
      y = drawField(page, y, "Email Subject", envelope.emailSubject, fonts);
    }

    // ------- Section 2: Signers -------
    ensureSpace(60 + signers.length * 100);
    y = drawSectionTitle(page, y, "SIGNER DETAILS", bold);

    for (let i = 0; i < signers.length; i++) {
      const signer = signers[i];
      ensureSpace(120);

      // Signer header
      y -= 4;
      page.drawRectangle({
        x: MARGIN_LEFT + 5,
        y: y - 3,
        width: CONTENT_WIDTH - 10,
        height: 16,
        color: BG_LIGHT,
      });
      page.drawText(`Signer ${i + 1}: ${signer.name} (${signer.email})`, {
        x: MARGIN_LEFT + 10,
        y,
        size: 9,
        font: bold,
        color: DARK,
      });

      // Status badge
      const statusText = signer.signedAt
        ? "SIGNED"
        : signer.declinedAt
          ? "DECLINED"
          : signer.status || "PENDING";
      const statusWidth = regular.widthOfTextAtSize(statusText, 7);
      const statusColor = signer.signedAt
        ? EMERALD
        : signer.declinedAt
          ? rgb(0.9, 0.2, 0.2)
          : LIGHT;
      page.drawText(statusText, {
        x: PAGE_WIDTH - MARGIN_RIGHT - statusWidth - 10,
        y,
        size: 7,
        font: bold,
        color: statusColor,
      });

      y -= LINE_HEIGHT + 4;

      y = drawField(page, y, "Order", `#${signer.order}`, fonts);
      y = drawField(page, y, "Role", signer.role, fonts);

      if (signer.viewedAt) {
        y = drawField(page, y, "Viewed", formatShortDate(new Date(signer.viewedAt)), fonts);
      }
      if (signer.signedAt) {
        y = drawField(page, y, "Signed", formatDate(new Date(signer.signedAt)), fonts);
      }
      if (signer.declinedAt) {
        y = drawField(page, y, "Declined", formatDate(new Date(signer.declinedAt)), fonts);
        if (signer.declinedReason) {
          y = drawField(page, y, "Decline Reason", signer.declinedReason, fonts);
        }
      }
      if (signer.ipAddress) {
        y = drawField(page, y, "IP Address", signer.ipAddress, fonts);
      }
      if (signer.userAgent) {
        y = drawField(page, y, "User Agent", truncateText(signer.userAgent, 80), fonts);
      }

      // Consent Record
      if (signer.consentRecord) {
        ensureSpace(50);
        y -= 4;
        page.drawText("ESIGN/UETA Consent:", {
          x: MARGIN_LEFT + 10,
          y,
          size: 7,
          font: bold,
          color: MEDIUM,
        });
        y -= LINE_HEIGHT;

        const consent = signer.consentRecord;
        if (consent.consentedAt) {
          y = drawField(page, y, "  Consented", String(consent.consentedAt), fonts, { fontSize: 7 });
        }
        if (consent.consentVersion) {
          y = drawField(page, y, "  Version", String(consent.consentVersion), fonts, { fontSize: 7 });
        }
        if (consent.consentType) {
          y = drawField(page, y, "  Type", String(consent.consentType), fonts, { fontSize: 7 });
        }
      }

      // Signature Checksum
      if (signer.signatureChecksum) {
        ensureSpace(50);
        y -= 4;
        page.drawText("Signature Integrity:", {
          x: MARGIN_LEFT + 10,
          y,
          size: 7,
          font: bold,
          color: MEDIUM,
        });
        y -= LINE_HEIGHT;

        const cs = signer.signatureChecksum;
        if (cs.documentHash) {
          page.drawText(`  Document Hash: ${truncateText(String(cs.documentHash), 64)}`, {
            x: MARGIN_LEFT + 10,
            y,
            size: 6,
            font: mono,
            color: LIGHT,
          });
          y -= LINE_HEIGHT - 2;
        }
        if (cs.signatureHash) {
          page.drawText(`  Signature Hash: ${truncateText(String(cs.signatureHash), 64)}`, {
            x: MARGIN_LEFT + 10,
            y,
            size: 6,
            font: mono,
            color: LIGHT,
          });
          y -= LINE_HEIGHT - 2;
        }
        if (cs.verificationToken) {
          page.drawText(`  Verification Token: ${truncateText(String(cs.verificationToken), 32)}`, {
            x: MARGIN_LEFT + 10,
            y,
            size: 6,
            font: mono,
            color: LIGHT,
          });
          y -= LINE_HEIGHT - 2;
        }
        if (cs.algorithm) {
          y = drawField(page, y, "  Algorithm", String(cs.algorithm).toUpperCase(), fonts, { fontSize: 7 });
        }
      }

      y -= 6;
    }

    // ------- Section 3: CC Recipients -------
    const ccRecipients = envelope.recipients.filter((r) => r.role !== "SIGNER");
    if (ccRecipients.length > 0) {
      ensureSpace(40 + ccRecipients.length * LINE_HEIGHT);
      y = drawSectionTitle(page, y, "CC / CERTIFIED DELIVERY", bold);

      for (const r of ccRecipients) {
        y = drawField(page, y, r.role, `${r.name || r.email} (${r.email})`, fonts);
      }
    }

    // ------- Section 4: Event Timeline -------
    ensureSpace(40);
    y = drawSectionTitle(page, y, "EVENT TIMELINE", bold);

    if (events.length === 0) {
      page.drawText("No audit events recorded for this envelope.", {
        x: MARGIN_LEFT + 10,
        y,
        size: 8,
        font: regular,
        color: LIGHT,
      });
      y -= LINE_HEIGHT;
    } else {
      for (const event of events) {
        ensureSpace(40);

        const label = EVENT_LABELS[event.eventType] || event.eventType;
        const timestamp = event.timestamp ? formatShortDate(new Date(event.timestamp)) : "N/A";

        // Timestamp
        page.drawText(timestamp, {
          x: MARGIN_LEFT + 10,
          y,
          size: 7,
          font: mono,
          color: LIGHT,
        });

        // Event label
        page.drawText(label, {
          x: MARGIN_LEFT + 150,
          y,
          size: 8,
          font: bold,
          color: DARK,
        });

        y -= LINE_HEIGHT;

        // Metadata details
        if (event.metadata) {
          const meta = event.metadata;
          const details: string[] = [];

          if (meta.signerEmail) details.push(`Signer: ${meta.signerEmail}`);
          if (meta.signerName) details.push(`Name: ${meta.signerName}`);
          if (meta.viewerEmail) details.push(`Viewer: ${meta.viewerEmail}`);
          if (meta.reason) details.push(`Reason: ${meta.reason}`);
          if (meta.recipientEmail) details.push(`Recipient: ${meta.recipientEmail}`);

          if (details.length > 0) {
            page.drawText(details.join(" • "), {
              x: MARGIN_LEFT + 150,
              y: y + 2,
              size: 6.5,
              font: regular,
              color: LIGHT,
            });
            y -= LINE_HEIGHT - 2;
          }
        }

        if (event.ipAddress) {
          page.drawText(`IP: ${event.ipAddress}`, {
            x: MARGIN_LEFT + 150,
            y: y + 2,
            size: 6,
            font: regular,
            color: LIGHT,
          });
          y -= LINE_HEIGHT - 4;
        }

        // Thin separator line between events
        page.drawLine({
          start: { x: MARGIN_LEFT + 10, y: y + 4 },
          end: { x: PAGE_WIDTH - MARGIN_RIGHT - 10, y: y + 4 },
          thickness: 0.25,
          color: rgb(0.9, 0.9, 0.9),
        });
        y -= 4;
      }
    }

    // ------- Section 5: Chain Verification -------
    if (chainVerification) {
      ensureSpace(80);
      y = drawSectionTitle(page, y, "AUDIT LOG INTEGRITY", bold);

      const verifyStatus = chainVerification.isValid ? "VERIFIED — Chain Intact" : "WARNING — Chain Broken";
      const verifyColor = chainVerification.isValid ? EMERALD : rgb(0.9, 0.2, 0.2);

      y = drawField(page, y, "Status", verifyStatus, fonts, { valueColor: verifyColor });
      y = drawField(page, y, "Total Chain Entries", String(chainVerification.totalEntries), fonts);
      y = drawField(page, y, "Algorithm", "SHA-256 Hash Chain", fonts);
      y = drawField(page, y, "Isolation", "Per-Team Chains (Multi-Tenant)", fonts);

      if (chainVerification.errors.length > 0) {
        y -= 4;
        page.drawText("Verification Errors:", {
          x: MARGIN_LEFT + 10,
          y,
          size: 7,
          font: bold,
          color: rgb(0.9, 0.2, 0.2),
        });
        y -= LINE_HEIGHT;
        for (const err of chainVerification.errors.slice(0, 5)) {
          ensureSpace(LINE_HEIGHT);
          page.drawText(`• ${truncateText(err, 80)}`, {
            x: MARGIN_LEFT + 15,
            y,
            size: 7,
            font: regular,
            color: rgb(0.7, 0.2, 0.2),
          });
          y -= LINE_HEIGHT;
        }
      }
    }

    // ------- Section 6: Compliance Statement -------
    ensureSpace(100);
    y = drawSectionTitle(page, y, "COMPLIANCE & LEGAL", bold);

    const complianceLines = [
      "This document serves as an official record of signing activity for the referenced envelope.",
      "All electronic signatures were captured in accordance with the Electronic Signatures in Global",
      "and National Commerce Act (ESIGN Act, 15 U.S.C. § 7001 et seq.) and the Uniform Electronic",
      "Transactions Act (UETA).",
      "",
      "Each signer provided explicit consent to use electronic signatures before signing. Consent",
      "records, IP addresses, user agents, and timestamps were captured at the time of each action.",
      "",
      "The audit log is maintained using SHA-256 cryptographic hash chaining to ensure tamper-evident",
      "record keeping. Any modification to historical entries will be detected during chain verification.",
      "",
      `Generated by SignSuite — ${new Date().toISOString()}`,
    ];

    for (const line of complianceLines) {
      ensureSpace(LINE_HEIGHT);
      if (line === "") {
        y -= 4;
        continue;
      }
      page.drawText(line, {
        x: MARGIN_LEFT + 10,
        y,
        size: 7,
        font: regular,
        color: MEDIUM,
      });
      y -= LINE_HEIGHT - 2;
    }

    // -----------------------------------------------------------------------
    // 6. Save and return
    // -----------------------------------------------------------------------
    const pdfBytes = await pdfDoc.save();

    return {
      success: true,
      pdfBytes,
    };
  } catch (error) {
    reportError(error as Error);
    logger.error("Failed to generate audit trail PDF", {
      module: "esign",
      metadata: { envelopeId, error: String(error) },
    });
    return {
      success: false,
      error: "Failed to generate audit trail PDF",
    };
  }
}
