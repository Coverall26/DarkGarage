import { pdfjs } from "react-pdf";
import * as XLSX from "xlsx";
import { logger } from "@/lib/logger";

// Default to CDN worker URL (react-pdf v10 requires .mjs extension)
const cdnWorkerUrl = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
pdfjs.GlobalWorkerOptions.workerSrc = cdnWorkerUrl;

export const getPagesCount = async (arrayBuffer: ArrayBuffer) => {
  try {
    // Only in browser context
    if (typeof window !== "undefined") {
      try {
        // First attempt with the current worker configuration
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        return pdf.numPages;
      } catch (workerError) {
        logger.warn("PDF worker error, trying fallback", { module: "pdf", metadata: { error: (workerError as Error).message } });

        // Fall back to local worker
        pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;

        try {
          // Try again with local worker
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          return pdf.numPages;
        } catch (fallbackError) {
          logger.warn("Both CDN and local worker failed", { module: "pdf", metadata: { error: (fallbackError as Error).message } });
          return 1; // Default to 1 page if both attempts fail
        }
      }
    } else {
      // Server-side rendering case
      const pdf = await pdfjs.getDocument(arrayBuffer).promise;
      return pdf.numPages;
    }
  } catch (error) {
    logger.error("Error getting PDF page count", { module: "pdf", metadata: { error: (error as Error).message } });
    return 1; // Assuming at least one page if we can't determine
  }
};

export const getSheetsCount = (arrayBuffer: ArrayBuffer) => {
  const data = new Uint8Array(arrayBuffer);
  const workbook = XLSX.read(data, { type: "array" });
  return workbook.SheetNames.length ?? 1;
};
