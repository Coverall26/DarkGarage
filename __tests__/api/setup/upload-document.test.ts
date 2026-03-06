/**
 * Upload Document Route Tests
 *
 * Tests for:
 *   POST /api/setup/upload-document
 *
 * Validates: auth enforcement, file type validation (PDF/DOCX),
 * file size validation (25MB), document type passthrough,
 * happy path upload, and error handling.
 */

import { NextRequest, NextResponse } from "next/server";

const mockRequireAuthAppRouter = jest.fn();
const mockPutFileServer = jest.fn();
const mockReportError = jest.fn();

jest.mock("@/lib/auth/rbac", () => ({
  requireAuthAppRouter: (...args: any[]) => mockRequireAuthAppRouter(...args),
}));

jest.mock("@/lib/files/put-file-server", () => ({
  putFileServer: (...args: any[]) => mockPutFileServer(...args),
}));

jest.mock("@/lib/error", () => ({
  reportError: (...args: any[]) => mockReportError(...args),
}));

import { POST } from "@/app/api/setup/upload-document/route";

// --- Helpers ---

const USER_ID = "user-doc-upload-001";

function mockAuth() {
  mockRequireAuthAppRouter.mockResolvedValue({
    userId: USER_ID,
    email: "gp@example.com",
    teamId: "",
    role: "MEMBER",
    session: { user: { id: USER_ID, email: "gp@example.com" } },
  });
}

function mockAuthDenied() {
  mockRequireAuthAppRouter.mockResolvedValue(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  );
}

/**
 * Create a NextRequest with multipart form data containing a file
 * and optional documentType field.
 */
function makeUploadRequest(
  fileName: string,
  fileType: string,
  fileSize: number,
  documentType?: string,
) {
  const fileContent = new Uint8Array(fileSize);
  const file = new File([fileContent], fileName, { type: fileType });

  const formData = new FormData();
  formData.append("file", file);
  if (documentType !== undefined) {
    formData.append("documentType", documentType);
  }

  return new NextRequest("http://localhost/api/setup/upload-document", {
    method: "POST",
    body: formData,
  });
}

/**
 * Create a NextRequest with empty form data (no file).
 */
function makeEmptyRequest() {
  const formData = new FormData();

  return new NextRequest("http://localhost/api/setup/upload-document", {
    method: "POST",
    body: formData,
  });
}

// --- Tests ---

beforeEach(() => {
  jest.clearAllMocks();
  mockPutFileServer.mockResolvedValue({
    type: "S3_PATH",
    data: "https://storage.example.com/docs/template.pdf",
  });
});

describe("POST /api/setup/upload-document", () => {
  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuthDenied();

      const res = await POST(
        makeUploadRequest("nda.pdf", "application/pdf", 1024),
      );
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toBe("Unauthorized");
    });
  });

  describe("File Validation", () => {
    it("returns 400 when no file is provided", async () => {
      mockAuth();

      const res = await POST(makeEmptyRequest());
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("No file provided");
    });

    it("returns 400 for invalid file type (image/png)", async () => {
      mockAuth();

      const res = await POST(
        makeUploadRequest("logo.png", "image/png", 100),
      );
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Invalid file type. Allowed: PDF, DOCX");
    });

    it("returns 400 for invalid file type (text/plain)", async () => {
      mockAuth();

      const res = await POST(
        makeUploadRequest("notes.txt", "text/plain", 100),
      );
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Invalid file type. Allowed: PDF, DOCX");
    });

    it("returns 400 for invalid file type (application/msword - legacy .doc)", async () => {
      mockAuth();

      const res = await POST(
        makeUploadRequest("old.doc", "application/msword", 100),
      );
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Invalid file type. Allowed: PDF, DOCX");
    });

    it("returns 400 when file exceeds 25MB", async () => {
      mockAuth();

      const twentySixMB = 26 * 1024 * 1024;
      const res = await POST(
        makeUploadRequest("huge.pdf", "application/pdf", twentySixMB),
      );
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("File too large. Maximum 25MB.");
    });

    it("allows file at exactly 25MB", async () => {
      mockAuth();

      const twentyFiveMB = 25 * 1024 * 1024;
      const res = await POST(
        makeUploadRequest("max.pdf", "application/pdf", twentyFiveMB),
      );
      expect(res.status).toBe(200);
    });
  });

  describe("Allowed File Types", () => {
    it("accepts application/pdf", async () => {
      mockAuth();

      const res = await POST(
        makeUploadRequest("template.pdf", "application/pdf", 1024),
      );
      expect(res.status).toBe(200);
    });

    it("accepts DOCX (application/vnd.openxmlformats-officedocument.wordprocessingml.document)", async () => {
      mockAuth();

      const res = await POST(
        makeUploadRequest(
          "template.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          1024,
        ),
      );
      expect(res.status).toBe(200);
    });
  });

  describe("Happy Path", () => {
    it("uploads a PDF and returns URL with metadata", async () => {
      mockAuth();

      const res = await POST(
        makeUploadRequest("nda-template.pdf", "application/pdf", 5000, "NDA"),
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.url).toBe(
        "https://storage.example.com/docs/template.pdf",
      );
      expect(json.type).toBe("S3_PATH");
      expect(json.documentType).toBe("NDA");
      expect(json.fileName).toBe("nda-template.pdf");
      expect(json.fileSize).toBe(5000);
    });

    it("returns null documentType when not provided", async () => {
      mockAuth();

      const res = await POST(
        makeUploadRequest("generic.pdf", "application/pdf", 2048),
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.documentType).toBeNull();
    });

    it("passes through various document types", async () => {
      mockAuth();

      const docTypes = ["NDA", "SUBSCRIPTION", "LPA", "SIDE_LETTER", "PPM"];

      for (const docType of docTypes) {
        const res = await POST(
          makeUploadRequest("doc.pdf", "application/pdf", 1024, docType),
        );
        const json = await res.json();
        expect(json.documentType).toBe(docType);
      }
    });

    it("calls putFileServer with correct parameters", async () => {
      mockAuth();

      await POST(
        makeUploadRequest("sub-agreement.pdf", "application/pdf", 4096),
      );

      expect(mockPutFileServer).toHaveBeenCalledTimes(1);
      expect(mockPutFileServer).toHaveBeenCalledWith(
        expect.objectContaining({
          file: expect.objectContaining({
            name: "sub-agreement.pdf",
            type: "application/pdf",
          }),
          teamId: `setup-${USER_ID}`,
          restricted: true,
        }),
      );
    });

    it("sets restricted: true (unlike logo upload)", async () => {
      mockAuth();

      await POST(makeUploadRequest("doc.pdf", "application/pdf", 512));

      const callArgs = mockPutFileServer.mock.calls[0][0];
      expect(callArgs.restricted).toBe(true);
    });

    it("passes a buffer in the file object", async () => {
      mockAuth();

      await POST(makeUploadRequest("doc.pdf", "application/pdf", 128));

      const callArgs = mockPutFileServer.mock.calls[0][0];
      expect(callArgs.file.buffer).toBeInstanceOf(Buffer);
      expect(callArgs.file.buffer.length).toBe(128);
    });
  });

  describe("Error Handling", () => {
    it("returns 500 and calls reportError when putFileServer throws", async () => {
      mockAuth();
      mockPutFileServer.mockRejectedValueOnce(new Error("S3 bucket gone"));

      const res = await POST(
        makeUploadRequest("doc.pdf", "application/pdf", 1024),
      );
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalledTimes(1);
    });
  });
});
