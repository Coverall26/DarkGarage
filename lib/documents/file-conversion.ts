/**
 * Document File Conversion — Prompt 9.3
 *
 * Converts DOCX and XLSX files to PDF for consistent viewing/signing.
 * Uses mammoth (DOCX→HTML) + pdf-lib (HTML→PDF) and xlsx (XLSX→HTML→PDF).
 *
 * Design decisions:
 *  - Runs in Vercel serverless (no LibreOffice binary)
 *  - Keeps original file stored alongside converted PDF
 *  - Conversion is synchronous in the upload flow (sub-second for typical docs)
 *  - Falls back gracefully: if conversion fails, stores original with warning
 */

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { logger } from "@/lib/logger";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface ConversionResult {
  /** The converted PDF as a Buffer */
  pdfBuffer: Buffer;
  /** New filename with .pdf extension */
  pdfFilename: string;
  /** MIME type — always application/pdf */
  mimeType: "application/pdf";
  /** Number of pages in the generated PDF */
  pageCount: number;
  /** Original file format that was converted */
  originalFormat: "docx" | "xlsx" | "xls" | "doc";
}

export interface ConversionError {
  success: false;
  error: string;
  /** Whether the original file should still be accepted (true) or rejected (false) */
  acceptOriginal: boolean;
}

export type ConversionOutcome =
  | { success: true; result: ConversionResult }
  | ConversionError;

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Check whether a file needs conversion to PDF.
 */
export function needsConversion(filename: string): boolean {
  const ext = getExtension(filename);
  return ["docx", "xlsx", "xls", "doc"].includes(ext);
}

/**
 * Get the file extension (lowercase, no dot).
 */
export function getExtension(filename: string): string {
  return (filename.split(".").pop() || "").toLowerCase();
}

/**
 * Convert a DOCX, DOC, XLSX, or XLS file buffer to PDF.
 *
 * Returns the PDF buffer and metadata on success, or an error with
 * guidance on whether to accept the original file.
 */
export async function convertToPdf(
  fileBuffer: Buffer,
  filename: string,
): Promise<ConversionOutcome> {
  const ext = getExtension(filename);

  try {
    let result: ConversionResult;

    switch (ext) {
      case "docx":
      case "doc":
        result = await convertDocxToPdf(fileBuffer, filename);
        break;
      case "xlsx":
      case "xls":
        result = await convertXlsxToPdf(fileBuffer, filename);
        break;
      default:
        return {
          success: false,
          error: `Unsupported file format: .${ext}`,
          acceptOriginal: true,
        };
    }

    return { success: true, result };
  } catch (error) {
    logger.error("Document conversion failed", {
      module: "file-conversion",
      filename,
      ext,
      error: String(error),
    });
    return {
      success: false,
      error: `Conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      acceptOriginal: true,
    };
  }
}

// --------------------------------------------------------------------------
// DOCX → PDF
// --------------------------------------------------------------------------

async function convertDocxToPdf(
  fileBuffer: Buffer,
  filename: string,
): Promise<ConversionResult> {
  const mammoth = await import("mammoth");

  // Convert DOCX to HTML
  const { value: html } = await mammoth.convertToHtml(
    { buffer: fileBuffer },
    {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
      ],
    },
  );

  // Parse HTML into text lines for PDF rendering
  const lines = htmlToTextLines(html);

  // Generate PDF from text lines
  const { pdfBuffer, pageCount } = await textLinesToPdf(lines, filename);

  return {
    pdfBuffer: Buffer.from(pdfBuffer),
    pdfFilename: replaceExtension(filename, "pdf"),
    mimeType: "application/pdf",
    pageCount,
    originalFormat: getExtension(filename) as "docx" | "doc",
  };
}

// --------------------------------------------------------------------------
// XLSX → PDF
// --------------------------------------------------------------------------

async function convertXlsxToPdf(
  fileBuffer: Buffer,
  filename: string,
): Promise<ConversionResult> {
  const XLSX = await import("xlsx");

  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const allLines: TextLine[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Add sheet header
    allLines.push({ text: `Sheet: ${sheetName}`, style: "heading" });
    allLines.push({ text: "", style: "normal" });

    // Convert sheet to array of arrays
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    });

    if (rows.length === 0) {
      allLines.push({ text: "(empty sheet)", style: "normal" });
      allLines.push({ text: "", style: "normal" });
      continue;
    }

    // Calculate column widths for alignment
    const colCount = Math.max(...rows.map((r) => r.length));
    const colWidths: number[] = new Array(colCount).fill(0);

    for (const row of rows) {
      for (let i = 0; i < row.length; i++) {
        const cellStr = String(row[i] ?? "");
        colWidths[i] = Math.max(colWidths[i] ?? 0, cellStr.length);
      }
    }

    // Cap column widths to prevent overflow
    const maxColWidth = 30;
    const cappedWidths = colWidths.map((w) => Math.min(w, maxColWidth));

    // Render rows as fixed-width text
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const cells = (row ?? []).map((cell, i) => {
        const str = String(cell ?? "");
        const width = cappedWidths[i] ?? maxColWidth;
        return str.length > width
          ? str.substring(0, width - 1) + "…"
          : str.padEnd(width);
      });
      allLines.push({
        text: cells.join(" | "),
        style: r === 0 ? "tableHeader" : "tableRow",
      });
    }

    allLines.push({ text: "", style: "normal" });
  }

  const { pdfBuffer, pageCount } = await textLinesToPdf(allLines, filename);

  return {
    pdfBuffer: Buffer.from(pdfBuffer),
    pdfFilename: replaceExtension(filename, "pdf"),
    mimeType: "application/pdf",
    pageCount,
    originalFormat: getExtension(filename) as "xlsx" | "xls",
  };
}

// --------------------------------------------------------------------------
// HTML → Text Lines Parser
// --------------------------------------------------------------------------

interface TextLine {
  text: string;
  style: "heading" | "subheading" | "normal" | "bold" | "tableHeader" | "tableRow";
}

function htmlToTextLines(html: string): TextLine[] {
  const lines: TextLine[] = [];

  // Strip HTML tags but preserve structure
  const blocks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|li|tr)[^>]*>/gi, "\n")
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, (_, content) => `\n##H1##${stripTags(content)}\n`)
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, (_, content) => `\n##H2##${stripTags(content)}\n`)
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, (_, content) => `\n##H3##${stripTags(content)}\n`)
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, (_, content) => `##B##${stripTags(content)}##/B##`)
    .replace(/<b[^>]*>(.*?)<\/b>/gi, (_, content) => `##B##${stripTags(content)}##/B##`)
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split("\n");

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) {
      lines.push({ text: "", style: "normal" });
      continue;
    }

    if (trimmed.startsWith("##H1##")) {
      lines.push({ text: trimmed.replace("##H1##", ""), style: "heading" });
    } else if (trimmed.startsWith("##H2##")) {
      lines.push({ text: trimmed.replace("##H2##", ""), style: "subheading" });
    } else if (trimmed.startsWith("##H3##")) {
      lines.push({ text: trimmed.replace("##H3##", ""), style: "subheading" });
    } else {
      // Clean up bold markers for plain text rendering
      const cleaned = trimmed.replace(/##\/?B##/g, "");
      lines.push({ text: cleaned, style: "normal" });
    }
  }

  return lines;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

// --------------------------------------------------------------------------
// Text Lines → PDF (using pdf-lib)
// --------------------------------------------------------------------------

async function textLinesToPdf(
  lines: TextLine[],
  sourceFilename: string,
): Promise<{ pdfBuffer: Uint8Array; pageCount: number }> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);

  const PAGE_WIDTH = 612; // US Letter
  const PAGE_HEIGHT = 792;
  const MARGIN_LEFT = 50;
  const MARGIN_RIGHT = 50;
  const MARGIN_TOP = 50;
  const MARGIN_BOTTOM = 60;
  const MAX_TEXT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  const FONT_SIZES = {
    heading: 16,
    subheading: 13,
    normal: 10,
    bold: 10,
    tableHeader: 8,
    tableRow: 8,
  };

  const LINE_HEIGHTS = {
    heading: 24,
    subheading: 20,
    normal: 14,
    bold: 14,
    tableHeader: 12,
    tableRow: 12,
  };

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let yPos = PAGE_HEIGHT - MARGIN_TOP;
  let pageCount = 1;

  // Add source file watermark on first page
  const watermarkSize = 8;
  page.drawText(`Converted from: ${sourceFilename}`, {
    x: MARGIN_LEFT,
    y: MARGIN_BOTTOM - 20,
    size: watermarkSize,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });

  for (const line of lines) {
    const fontSize = FONT_SIZES[line.style];
    const lineHeight = LINE_HEIGHTS[line.style];
    const isTable = line.style === "tableHeader" || line.style === "tableRow";
    const activeFont = line.style === "heading" || line.style === "subheading" || line.style === "tableHeader"
      ? boldFont
      : isTable
        ? monoFont
        : font;

    // Word-wrap long lines
    const wrappedLines = wrapText(line.text, activeFont, fontSize, MAX_TEXT_WIDTH);

    for (const wrappedLine of wrappedLines) {
      // Check if we need a new page
      if (yPos - lineHeight < MARGIN_BOTTOM) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        yPos = PAGE_HEIGHT - MARGIN_TOP;
        pageCount++;
      }

      if (wrappedLine.trim()) {
        page.drawText(wrappedLine, {
          x: MARGIN_LEFT,
          y: yPos,
          size: fontSize,
          font: activeFont,
          color: rgb(0.1, 0.1, 0.1),
        });
      }

      yPos -= lineHeight;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return { pdfBuffer: pdfBytes, pageCount };
}

/**
 * Simple word-wrap for PDF text rendering.
 */
function wrapText(
  text: string,
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  fontSize: number,
  maxWidth: number,
): string[] {
  if (!text.trim()) return [""];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function replaceExtension(filename: string, newExt: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) return `${filename}.${newExt}`;
  return `${filename.substring(0, dotIndex)}.${newExt}`;
}
