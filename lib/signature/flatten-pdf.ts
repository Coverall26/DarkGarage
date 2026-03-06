import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import prisma from "@/lib/prisma";
import { getFile } from "@/lib/files/get-file";
import { getStorageProvider } from "@/lib/storage/providers";
import { logSignatureEvent } from "@/lib/signature/audit-logger";
import { reportError } from "@/lib/error";
import { logger } from "@/lib/logger";

export interface FlattenSignatureOptions {
  documentId: string;
  /** Save flattened PDF to storage and update DB record */
  saveToStorage?: boolean;
}

export interface FlattenResult {
  success: boolean;
  pdfBytes?: Uint8Array;
  signedFileUrl?: string;
  error?: string;
}

/**
 * Flatten signatures and field values onto a PDF document.
 * This embeds signature images and text field values directly into the PDF
 * pages, producing a final signed document.
 */
export async function flattenSignatureDocument(
  options: FlattenSignatureOptions,
): Promise<FlattenResult> {
  const { documentId, saveToStorage = true } = options;

  try {
    const document = await prisma.signatureDocument.findUnique({
      where: { id: documentId },
      include: {
        recipients: {
          orderBy: { signingOrder: "asc" },
        },
        fields: {
          orderBy: [{ pageNumber: "asc" }, { y: "asc" }],
        },
        team: { select: { name: true } },
      },
    });

    if (!document) {
      return { success: false, error: "Document not found" };
    }

    // Get original PDF
    const fileUrl = await getFile({
      type: document.storageType,
      data: document.file,
    });

    const pdfResponse = await fetch(fileUrl);
    if (!pdfResponse.ok) {
      return { success: false, error: "Failed to fetch original PDF" };
    }

    const pdfBytes = await pdfResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Embed signatures and field values into PDF pages
    for (const field of document.fields) {
      if (!field.value && field.type !== "SIGNATURE") continue;

      const pageIndex = field.pageNumber - 1;
      if (pageIndex < 0 || pageIndex >= pages.length) continue;

      const page = pages[pageIndex];
      const { width: pageWidth, height: pageHeight } = page.getSize();

      // Convert percentage coordinates to absolute PDF coordinates
      const x = (field.x / 100) * pageWidth;
      const y =
        pageHeight -
        (field.y / 100) * pageHeight -
        (field.height / 100) * pageHeight;
      const fieldWidth = (field.width / 100) * pageWidth;
      const fieldHeight = (field.height / 100) * pageHeight;

      if (field.type === "SIGNATURE" || field.type === "INITIALS") {
        // For INITIALS fields, use field.value (contains the initials base64 image
        // stored by the signing component). For SIGNATURE fields, use recipient.signatureImage
        // (the encrypted/stored primary signature). Fall back to the other source if primary is empty.
        const recipient = document.recipients.find(
          (r) => r.id === field.recipientId,
        );

        let imageDataUrl: string | null = null;

        if (field.type === "INITIALS" && field.value) {
          // Initials are stored as base64 data URLs in the field value
          imageDataUrl = field.value;
        } else if (recipient?.signatureImage) {
          imageDataUrl = recipient.signatureImage;
        }

        if (imageDataUrl) {
          try {
            let signatureDataUrl = imageDataUrl;

            // Try to decrypt if it's encrypted JSON
            if (
              signatureDataUrl.startsWith("{") ||
              signatureDataUrl.startsWith("[")
            ) {
              try {
                const { decryptStoredSignature } = await import(
                  "@/lib/signature/encryption-service"
                );
                const decryptedBase64 =
                  await decryptStoredSignature(signatureDataUrl);
                signatureDataUrl = `data:image/png;base64,${decryptedBase64}`;
              } catch {
                // If decryption fails, skip this signature
                continue;
              }
            }

            if (signatureDataUrl.startsWith("data:image/png")) {
              const base64Data = signatureDataUrl.split(",")[1];
              const signatureBytes = Buffer.from(base64Data, "base64");
              const signatureImage = await pdfDoc.embedPng(signatureBytes);

              // Maintain aspect ratio
              const aspectRatio = signatureImage.width / signatureImage.height;
              let drawWidth = fieldWidth;
              let drawHeight = fieldWidth / aspectRatio;

              if (drawHeight > fieldHeight) {
                drawHeight = fieldHeight;
                drawWidth = fieldHeight * aspectRatio;
              }

              page.drawImage(signatureImage, {
                x: x + (fieldWidth - drawWidth) / 2,
                y: y + (fieldHeight - drawHeight) / 2,
                width: drawWidth,
                height: drawHeight,
              });
            }
          } catch (err) {
            logger.error("Failed to embed signature/initials", { module: "flatten-pdf", error: String(err) });
          }
        }
      } else if (field.type === "CHECKBOX") {
        if (field.value === "true") {
          const fontSize = Math.min(fieldHeight * 0.8, 14);
          page.drawText("\u2713", {
            x: x + fieldWidth / 2 - fontSize / 3,
            y: y + fieldHeight / 2 - fontSize / 3,
            size: fontSize,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
        }
      } else if (field.value) {
        const fontSize = Math.min(fieldHeight * 0.6, 12);
        page.drawText(field.value, {
          x: x + 4,
          y: y + fieldHeight / 2 - fontSize / 3,
          size: fontSize,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }
    }

    // Add Certificate of Completion as a dedicated page for completed documents
    if (document.status === "COMPLETED") {
      const certPage = pdfDoc.addPage([612, 792]); // US Letter
      const certMargin = 50;
      const certWidth = 612 - certMargin * 2;
      const emerald = rgb(0.06, 0.73, 0.51); // SignSuite brand
      const dark = rgb(0.1, 0.1, 0.1);
      const medium = rgb(0.3, 0.3, 0.3);
      const light = rgb(0.5, 0.5, 0.5);
      const bgLight = rgb(0.97, 0.97, 0.97);
      const borderGray = rgb(0.8, 0.8, 0.8);
      const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);

      let cy = 742; // Starting Y

      // --- Top accent bar ---
      certPage.drawRectangle({
        x: certMargin,
        y: cy,
        width: certWidth,
        height: 4,
        color: emerald,
      });
      cy -= 30;

      // --- Title ---
      certPage.drawText("CERTIFICATE OF COMPLETION", {
        x: certMargin,
        y: cy,
        size: 18,
        font: helveticaBold,
        color: dark,
      });
      cy -= 14;
      certPage.drawText("SignSuite Electronic Signature Platform", {
        x: certMargin,
        y: cy,
        size: 9,
        font: helveticaFont,
        color: light,
      });
      cy -= 30;

      // --- Document Summary Box ---
      const summaryBoxH = 100;
      certPage.drawRectangle({
        x: certMargin,
        y: cy - summaryBoxH,
        width: certWidth,
        height: summaryBoxH,
        color: bgLight,
        borderColor: borderGray,
        borderWidth: 0.5,
      });

      let sy = cy - 16;
      const drawCertField = (label: string, value: string, yPos: number): number => {
        certPage.drawText(`${label}:`, {
          x: certMargin + 12,
          y: yPos,
          size: 8,
          font: helveticaBold,
          color: medium,
        });
        const lw = helveticaBold.widthOfTextAtSize(`${label}: `, 8);
        certPage.drawText(value, {
          x: certMargin + 12 + lw,
          y: yPos,
          size: 8,
          font: helveticaFont,
          color: dark,
        });
        return yPos - 14;
      };

      sy = drawCertField("Document", document.title, sy);
      sy = drawCertField("Document ID", documentId, sy);
      if (document.completedAt) {
        sy = drawCertField("Completed", new Date(document.completedAt).toLocaleString("en-US", {
          year: "numeric", month: "long", day: "numeric",
          hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short",
        }), sy);
      }
      sy = drawCertField("Total Signers", String(document.recipients.filter((r) => r.status === "SIGNED").length), sy);
      if (document.team?.name) {
        drawCertField("Organization", document.team.name, sy);
      }

      cy -= summaryBoxH + 24;

      // --- Signers Section ---
      certPage.drawRectangle({
        x: certMargin,
        y: cy - 2,
        width: 3,
        height: 14,
        color: emerald,
      });
      certPage.drawText("SIGNER DETAILS", {
        x: certMargin + 10,
        y: cy,
        size: 11,
        font: helveticaBold,
        color: dark,
      });
      cy -= 6;
      certPage.drawLine({
        start: { x: certMargin, y: cy },
        end: { x: 612 - certMargin, y: cy },
        thickness: 0.5,
        color: borderGray,
      });
      cy -= 16;

      for (const recipient of document.recipients.filter(
        (r) => r.status === "SIGNED",
      )) {
        if (cy < 140) break; // Leave room for compliance section

        // Signer name + status
        certPage.drawRectangle({
          x: certMargin + 5,
          y: cy - 3,
          width: certWidth - 10,
          height: 16,
          color: bgLight,
        });
        certPage.drawText(`${recipient.name} (${recipient.email})`, {
          x: certMargin + 10,
          y: cy,
          size: 9,
          font: helveticaBold,
          color: dark,
        });
        const signedLabel = "SIGNED";
        const signedLabelW = helveticaBold.widthOfTextAtSize(signedLabel, 7);
        certPage.drawText(signedLabel, {
          x: 612 - certMargin - signedLabelW - 10,
          y: cy,
          size: 7,
          font: helveticaBold,
          color: emerald,
        });
        cy -= 18;

        if (recipient.signedAt) {
          cy = drawCertField("Signed At", new Date(recipient.signedAt).toLocaleString("en-US", {
            year: "numeric", month: "long", day: "numeric",
            hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short",
          }), cy);
        }
        if (recipient.ipAddress) {
          cy = drawCertField("IP Address", recipient.ipAddress, cy);
        }

        // Signature checksum (if present on recipient)
        const checksum = typeof recipient.signatureChecksum === "object" && recipient.signatureChecksum !== null
          ? (recipient.signatureChecksum as Record<string, unknown>)
          : undefined;
        if (checksum?.documentHash) {
          const hashStr = String(checksum.documentHash);
          const truncHash = hashStr.length > 64 ? hashStr.substring(0, 64) + "..." : hashStr;
          certPage.drawText(`Doc Hash: ${truncHash}`, {
            x: certMargin + 12,
            y: cy,
            size: 6,
            font: courierFont,
            color: light,
          });
          cy -= 12;
        }
        if (checksum?.signatureHash) {
          const hashStr = String(checksum.signatureHash);
          const truncHash = hashStr.length > 64 ? hashStr.substring(0, 64) + "..." : hashStr;
          certPage.drawText(`Sig Hash: ${truncHash}`, {
            x: certMargin + 12,
            y: cy,
            size: 6,
            font: courierFont,
            color: light,
          });
          cy -= 12;
        }

        cy -= 8;
      }

      // --- ESIGN/UETA Compliance Statement ---
      cy = Math.min(cy, 130);
      certPage.drawLine({
        start: { x: certMargin, y: cy },
        end: { x: 612 - certMargin, y: cy },
        thickness: 0.5,
        color: borderGray,
      });
      cy -= 14;

      const complianceLines = [
        "This certificate confirms that all signatures were captured electronically in compliance with",
        "the Electronic Signatures in Global and National Commerce Act (ESIGN Act, 15 U.S.C. § 7001",
        "et seq.) and the Uniform Electronic Transactions Act (UETA). Each signer provided explicit",
        "consent. Signature integrity is verifiable via SHA-256 cryptographic hashes.",
      ];
      for (const line of complianceLines) {
        certPage.drawText(line, {
          x: certMargin + 5,
          y: cy,
          size: 6.5,
          font: helveticaFont,
          color: light,
        });
        cy -= 10;
      }

      // Footer
      certPage.drawText(`Generated by SignSuite — ${new Date().toISOString()} — Confidential`, {
        x: certMargin,
        y: 30,
        size: 6,
        font: helveticaFont,
        color: light,
      });
    }

    const flattenedPdfBytes = await pdfDoc.save();

    // Save to storage if requested
    let signedFileUrl: string | undefined;
    if (saveToStorage) {
      try {
        const provider = getStorageProvider();
        const safeTitle = document.title.replace(/[^a-zA-Z0-9-_]/g, "_");
        const storageKey = `signed-documents/${document.teamId}/${documentId}/${safeTitle}_signed_${Date.now()}.pdf`;

        await provider.put(storageKey, Buffer.from(flattenedPdfBytes), {
          contentType: "application/pdf",
        });

        const existing = await prisma.signatureDocument.findUnique({
          where: { id: documentId },
          select: { metadata: true, storageType: true },
        });
        const existingMeta = (typeof existing?.metadata === "object" && existing?.metadata !== null)
          ? existing.metadata as Record<string, unknown>
          : {};

        const storageType = existing?.storageType || "S3_PATH";

        await prisma.signatureDocument.update({
          where: { id: documentId },
          data: {
            status: "COMPLETED",
            signedFileUrl: storageKey,
            signedFileType: storageType,
            signedAt: new Date(),
            // Keep metadata update for backward compatibility
            metadata: { ...existingMeta, signedFileUrl: storageKey },
          },
        });

        signedFileUrl = storageKey;
      } catch (storageError) {
        logger.error("Failed to save flattened PDF to storage", { module: "flatten-pdf", error: String(storageError) });
        // Non-fatal: we still have the bytes
      }
    }

    return {
      success: true,
      pdfBytes: flattenedPdfBytes,
      signedFileUrl,
    };
  } catch (error) {
    reportError(error, {
      path: "lib/signature/flatten-pdf",
      action: "flatten_signature_document",
    });
    logger.error("Error flattening signature document", { module: "flatten-pdf", error: String(error) });
    return {
      success: false,
      error: "Failed to flatten signature document",
    };
  }
}

/**
 * Flatten a signature image directly onto a PDF buffer at specified coordinates.
 * Used for inline signing (e.g., LP onboarding NDA signing without pre-placed fields).
 */
export async function flattenSignatureOnPdf(
  pdfBuffer: Buffer | Uint8Array,
  signatureDataUrl: string,
  placements: Array<{
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();

  if (!signatureDataUrl.startsWith("data:image/png")) {
    throw new Error("Signature must be a PNG data URL");
  }

  const base64Data = signatureDataUrl.split(",")[1];
  const signatureBytes = Buffer.from(base64Data, "base64");
  const signatureImage = await pdfDoc.embedPng(signatureBytes);

  for (const placement of placements) {
    const pageIndex = placement.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    const x = (placement.x / 100) * pageWidth;
    const y =
      pageHeight -
      (placement.y / 100) * pageHeight -
      (placement.height / 100) * pageHeight;
    const fieldWidth = (placement.width / 100) * pageWidth;
    const fieldHeight = (placement.height / 100) * pageHeight;

    const aspectRatio = signatureImage.width / signatureImage.height;
    let drawWidth = fieldWidth;
    let drawHeight = fieldWidth / aspectRatio;

    if (drawHeight > fieldHeight) {
      drawHeight = fieldHeight;
      drawWidth = fieldHeight * aspectRatio;
    }

    page.drawImage(signatureImage, {
      x: x + (fieldWidth - drawWidth) / 2,
      y: y + (fieldHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
  }

  return pdfDoc.save();
}
