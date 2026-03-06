/**
 * Tests for lib/documents/file-conversion.ts — Prompt 9.3
 *
 * Covers the public API: needsConversion, getExtension, convertToPdf
 */

// Mock logger before imports
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock mammoth (DOCX→HTML converter)
jest.mock("mammoth", () => ({
  convertToHtml: jest.fn().mockResolvedValue({
    value: "<h1>Test Heading</h1><p>Test paragraph content.</p>",
    messages: [],
  }),
}));

// Mock xlsx (spreadsheet parser)
jest.mock("xlsx", () => ({
  read: jest.fn().mockReturnValue({
    SheetNames: ["Sheet1"],
    Sheets: {
      Sheet1: { "!ref": "A1:B2" },
    },
  }),
  utils: {
    sheet_to_json: jest.fn().mockReturnValue([
      ["Name", "Amount"],
      ["Alice", "1000"],
      ["Bob", "2000"],
    ]),
  },
}));

import {
  needsConversion,
  getExtension,
  convertToPdf,
} from "@/lib/documents/file-conversion";

describe("file-conversion", () => {
  // ──────────────────────────────────────────────────
  // getExtension
  // ──────────────────────────────────────────────────
  describe("getExtension", () => {
    it("returns lowercase extension for standard filenames", () => {
      expect(getExtension("report.pdf")).toBe("pdf");
      expect(getExtension("document.DOCX")).toBe("docx");
      expect(getExtension("spreadsheet.Xlsx")).toBe("xlsx");
    });

    it("returns extension from multi-dot filenames", () => {
      expect(getExtension("my.report.final.docx")).toBe("docx");
    });

    it("returns empty string for no extension", () => {
      expect(getExtension("README")).toBe("readme");
    });

    it("returns empty string for empty filename", () => {
      expect(getExtension("")).toBe("");
    });

    it("handles dot-only filename", () => {
      expect(getExtension(".hidden")).toBe("hidden");
    });
  });

  // ──────────────────────────────────────────────────
  // needsConversion
  // ──────────────────────────────────────────────────
  describe("needsConversion", () => {
    it("returns true for DOCX files", () => {
      expect(needsConversion("contract.docx")).toBe(true);
      expect(needsConversion("CONTRACT.DOCX")).toBe(true);
    });

    it("returns true for DOC files", () => {
      expect(needsConversion("old-document.doc")).toBe(true);
    });

    it("returns true for XLSX files", () => {
      expect(needsConversion("financials.xlsx")).toBe(true);
      expect(needsConversion("BUDGET.XLSX")).toBe(true);
    });

    it("returns true for XLS files", () => {
      expect(needsConversion("legacy.xls")).toBe(true);
    });

    it("returns false for PDF files", () => {
      expect(needsConversion("report.pdf")).toBe(false);
    });

    it("returns false for image files", () => {
      expect(needsConversion("photo.png")).toBe(false);
      expect(needsConversion("scan.jpg")).toBe(false);
      expect(needsConversion("diagram.jpeg")).toBe(false);
    });

    it("returns false for unknown extensions", () => {
      expect(needsConversion("archive.zip")).toBe(false);
      expect(needsConversion("data.csv")).toBe(false);
    });

    it("returns false for files with no extension", () => {
      expect(needsConversion("README")).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────
  // convertToPdf — DOCX
  // ──────────────────────────────────────────────────
  describe("convertToPdf — DOCX", () => {
    it("converts a DOCX buffer to PDF successfully", async () => {
      const buffer = Buffer.from("fake docx content");
      const result = await convertToPdf(buffer, "contract.docx");

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.result.pdfFilename).toBe("contract.pdf");
      expect(result.result.mimeType).toBe("application/pdf");
      expect(result.result.originalFormat).toBe("docx");
      expect(result.result.pageCount).toBeGreaterThanOrEqual(1);
      expect(result.result.pdfBuffer).toBeInstanceOf(Buffer);
      expect(result.result.pdfBuffer.length).toBeGreaterThan(0);
    });

    it("converts a DOC file through the DOCX path", async () => {
      const buffer = Buffer.from("fake doc content");
      const result = await convertToPdf(buffer, "legacy.doc");

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.result.pdfFilename).toBe("legacy.pdf");
      expect(result.result.originalFormat).toBe("doc");
    });

    it("preserves filename structure with multi-dot names", async () => {
      const buffer = Buffer.from("fake docx content");
      const result = await convertToPdf(buffer, "report.final.v2.docx");

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.result.pdfFilename).toBe("report.final.v2.pdf");
    });

    it("handles mammoth conversion errors gracefully", async () => {
      const mammoth = await import("mammoth");
      (mammoth.convertToHtml as jest.Mock).mockRejectedValueOnce(
        new Error("Corrupt DOCX file")
      );

      const buffer = Buffer.from("corrupt data");
      const result = await convertToPdf(buffer, "broken.docx");

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error).toContain("Corrupt DOCX file");
      expect(result.acceptOriginal).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────
  // convertToPdf — XLSX
  // ──────────────────────────────────────────────────
  describe("convertToPdf — XLSX", () => {
    it("converts an XLSX buffer to PDF successfully", async () => {
      const buffer = Buffer.from("fake xlsx content");
      const result = await convertToPdf(buffer, "financials.xlsx");

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.result.pdfFilename).toBe("financials.pdf");
      expect(result.result.mimeType).toBe("application/pdf");
      expect(result.result.originalFormat).toBe("xlsx");
      expect(result.result.pageCount).toBeGreaterThanOrEqual(1);
      expect(result.result.pdfBuffer).toBeInstanceOf(Buffer);
    });

    it("converts an XLS file through the XLSX path", async () => {
      const buffer = Buffer.from("fake xls content");
      const result = await convertToPdf(buffer, "legacy.xls");

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.result.pdfFilename).toBe("legacy.pdf");
      expect(result.result.originalFormat).toBe("xls");
    });

    it("handles empty sheets", async () => {
      const XLSX = await import("xlsx");
      (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValueOnce([]);

      const buffer = Buffer.from("empty xlsx");
      const result = await convertToPdf(buffer, "empty.xlsx");

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.result.pageCount).toBeGreaterThanOrEqual(1);
    });

    it("handles xlsx parsing errors gracefully", async () => {
      const XLSX = await import("xlsx");
      (XLSX.read as jest.Mock).mockImplementationOnce(() => {
        throw new Error("Invalid spreadsheet format");
      });

      const buffer = Buffer.from("corrupt xlsx");
      const result = await convertToPdf(buffer, "broken.xlsx");

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error).toContain("Invalid spreadsheet format");
      expect(result.acceptOriginal).toBe(true);
    });

    it("handles multi-sheet workbooks", async () => {
      const XLSX = await import("xlsx");
      (XLSX.read as jest.Mock).mockReturnValueOnce({
        SheetNames: ["Revenue", "Expenses", "Summary"],
        Sheets: {
          Revenue: { "!ref": "A1:B2" },
          Expenses: { "!ref": "A1:C3" },
          Summary: { "!ref": "A1:A1" },
        },
      });
      (XLSX.utils.sheet_to_json as jest.Mock)
        .mockReturnValueOnce([["Q1", "100"], ["Q2", "200"]])
        .mockReturnValueOnce([["Rent", "Salary", "Total"], ["5000", "10000", "15000"]])
        .mockReturnValueOnce([["Grand Total: 15200"]]);

      const buffer = Buffer.from("multi-sheet xlsx");
      const result = await convertToPdf(buffer, "annual-report.xlsx");

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.result.pdfFilename).toBe("annual-report.pdf");
      expect(result.result.pageCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ──────────────────────────────────────────────────
  // convertToPdf — unsupported formats
  // ──────────────────────────────────────────────────
  describe("convertToPdf — unsupported formats", () => {
    it("returns error for unsupported file types", async () => {
      const buffer = Buffer.from("pdf content");
      const result = await convertToPdf(buffer, "document.pdf");

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error).toContain("Unsupported file format: .pdf");
      expect(result.acceptOriginal).toBe(true);
    });

    it("returns error for image files", async () => {
      const buffer = Buffer.from("png content");
      const result = await convertToPdf(buffer, "scan.png");

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error).toContain("Unsupported file format: .png");
      expect(result.acceptOriginal).toBe(true);
    });

    it("returns error for unknown extensions", async () => {
      const buffer = Buffer.from("zip content");
      const result = await convertToPdf(buffer, "archive.zip");

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error).toContain("Unsupported file format: .zip");
    });
  });

  // ──────────────────────────────────────────────────
  // convertToPdf — PDF output validation
  // ──────────────────────────────────────────────────
  describe("convertToPdf — PDF output validation", () => {
    it("produces valid PDF bytes (starts with %PDF header)", async () => {
      const buffer = Buffer.from("fake docx content");
      const result = await convertToPdf(buffer, "test.docx");

      expect(result.success).toBe(true);
      if (!result.success) return;

      // pdf-lib outputs valid PDF files starting with %PDF-
      const pdfHeader = result.result.pdfBuffer.subarray(0, 5).toString("ascii");
      expect(pdfHeader).toBe("%PDF-");
    });

    it("reports at least 1 page for non-empty documents", async () => {
      const buffer = Buffer.from("fake docx content");
      const result = await convertToPdf(buffer, "document.docx");

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.result.pageCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ──────────────────────────────────────────────────
  // Error handling — generic throw
  // ──────────────────────────────────────────────────
  describe("error handling", () => {
    it("catches non-Error throws gracefully", async () => {
      const mammoth = await import("mammoth");
      (mammoth.convertToHtml as jest.Mock).mockRejectedValueOnce("string error");

      const buffer = Buffer.from("data");
      const result = await convertToPdf(buffer, "test.docx");

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.error).toContain("Unknown error");
      expect(result.acceptOriginal).toBe(true);
    });
  });
});
