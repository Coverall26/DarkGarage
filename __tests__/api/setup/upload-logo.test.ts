/**
 * Upload Logo Route Tests
 *
 * Tests for:
 *   POST /api/setup/upload-logo
 *
 * Validates: auth enforcement, file type validation, file size validation,
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

import { POST } from "@/app/api/setup/upload-logo/route";

// --- Helpers ---

const USER_ID = "user-upload-001";

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
 * Create a NextRequest with multipart form data containing a file.
 */
function makeUploadRequest(
  fileName: string,
  fileType: string,
  fileSize: number,
) {
  const fileContent = new Uint8Array(fileSize);
  const file = new File([fileContent], fileName, { type: fileType });

  const formData = new FormData();
  formData.append("file", file);

  return new NextRequest("http://localhost/api/setup/upload-logo", {
    method: "POST",
    body: formData,
  });
}

/**
 * Create a NextRequest with empty form data (no file).
 */
function makeEmptyRequest() {
  const formData = new FormData();

  return new NextRequest("http://localhost/api/setup/upload-logo", {
    method: "POST",
    body: formData,
  });
}

// --- Tests ---

beforeEach(() => {
  jest.clearAllMocks();
  mockPutFileServer.mockResolvedValue({
    type: "S3_PATH",
    data: "https://storage.example.com/logos/test-logo.png",
  });
});

describe("POST /api/setup/upload-logo", () => {
  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuthDenied();

      const res = await POST(makeUploadRequest("logo.png", "image/png", 1024));
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

    it("returns 400 for invalid file type (text/plain)", async () => {
      mockAuth();

      const res = await POST(
        makeUploadRequest("readme.txt", "text/plain", 100),
      );
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Invalid file type. Allowed: PNG, JPG, SVG, WebP");
    });

    it("returns 400 for invalid file type (application/pdf)", async () => {
      mockAuth();

      const res = await POST(
        makeUploadRequest("doc.pdf", "application/pdf", 100),
      );
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Invalid file type. Allowed: PNG, JPG, SVG, WebP");
    });

    it("returns 400 when file exceeds 5MB", async () => {
      mockAuth();

      const sixMB = 6 * 1024 * 1024;
      const res = await POST(makeUploadRequest("big.png", "image/png", sixMB));
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("File too large. Maximum 5MB.");
    });

    it("allows file at exactly 5MB", async () => {
      mockAuth();

      const fiveMB = 5 * 1024 * 1024;
      const res = await POST(
        makeUploadRequest("exact.png", "image/png", fiveMB),
      );
      expect(res.status).toBe(200);
    });
  });

  describe("Allowed File Types", () => {
    const allowedTypes = [
      { type: "image/png", name: "logo.png" },
      { type: "image/jpeg", name: "logo.jpeg" },
      { type: "image/jpg", name: "logo.jpg" },
      { type: "image/svg+xml", name: "logo.svg" },
      { type: "image/webp", name: "logo.webp" },
    ];

    for (const { type, name } of allowedTypes) {
      it(`accepts ${type}`, async () => {
        mockAuth();

        const res = await POST(makeUploadRequest(name, type, 1024));
        expect(res.status).toBe(200);
      });
    }
  });

  describe("Happy Path", () => {
    it("uploads a PNG file and returns URL", async () => {
      mockAuth();

      const res = await POST(
        makeUploadRequest("company-logo.png", "image/png", 2048),
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.url).toBe(
        "https://storage.example.com/logos/test-logo.png",
      );
      expect(json.type).toBe("S3_PATH");
    });

    it("calls putFileServer with correct parameters", async () => {
      mockAuth();

      await POST(makeUploadRequest("logo.png", "image/png", 512));

      expect(mockPutFileServer).toHaveBeenCalledTimes(1);
      expect(mockPutFileServer).toHaveBeenCalledWith(
        expect.objectContaining({
          file: expect.objectContaining({
            name: "logo.png",
            type: "image/png",
          }),
          teamId: `setup-${USER_ID}`,
          restricted: false,
        }),
      );
    });

    it("passes a buffer in the file object", async () => {
      mockAuth();

      await POST(makeUploadRequest("logo.png", "image/png", 256));

      const callArgs = mockPutFileServer.mock.calls[0][0];
      expect(callArgs.file.buffer).toBeInstanceOf(Buffer);
      expect(callArgs.file.buffer.length).toBe(256);
    });
  });

  describe("Error Handling", () => {
    it("returns 500 and calls reportError when putFileServer throws", async () => {
      mockAuth();
      mockPutFileServer.mockRejectedValueOnce(new Error("Storage failure"));

      const res = await POST(
        makeUploadRequest("logo.png", "image/png", 1024),
      );
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalledTimes(1);
    });
  });
});
