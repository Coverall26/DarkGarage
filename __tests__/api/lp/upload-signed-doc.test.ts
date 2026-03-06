/**
 * Tests for POST /api/lp/upload-signed-doc
 *
 * Upload externally signed documents (wet-ink signed subscription agreements, etc.).
 * Tests: auth, file validation, investor lookup, storage, LPDocument creation, audit.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockRequireLPAuthAppRouter = jest.fn();

jest.mock("@/lib/auth/rbac", () => ({
  requireLPAuthAppRouter: (...args: any[]) =>
    mockRequireLPAuthAppRouter(...args),
  enforceRBAC: jest.fn(),
  requireAdmin: jest.fn(),
  enforceRBACAppRouter: jest.fn(),
  requireAdminAppRouter: jest.fn(),
}));

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterUploadRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

const mockLogAuditEvent = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/audit/audit-logger", () => ({
  logAuditEvent: (...args: any[]) => mockLogAuditEvent(...args),
}));

const mockPutFileServer = jest.fn().mockResolvedValue({
  data: "uploads/signed-doc.pdf",
  type: "S3_PATH",
});
jest.mock("@/lib/files/put-file-server", () => ({
  putFileServer: (...args: any[]) => mockPutFileServer(...args),
}));

// ── Import handler after mocks ─────────────────────────────────────────────

import { POST } from "@/app/api/lp/upload-signed-doc/route";

// ── Helpers ────────────────────────────────────────────────────────────────

const AUTH_RESULT = {
  userId: "user-1",
  email: "lp@example.com",
  investorId: "inv-1",
  session: { user: { id: "user-1", email: "lp@example.com" } },
};

const MOCK_INVESTOR = {
  id: "inv-1",
  userId: "user-1",
  fundId: "fund-default",
};

function makeFormDataRequest(fields: Record<string, string | Blob>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return new NextRequest("http://localhost/api/lp/upload-signed-doc", {
    method: "POST",
    body: formData,
  });
}

function makePdfBlob(sizeBytes = 1024): Blob {
  return new Blob([new Uint8Array(sizeBytes)], { type: "application/pdf" });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/lp/upload-signed-doc", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireLPAuthAppRouter.mockResolvedValue(AUTH_RESULT);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireLPAuthAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const req = makeFormDataRequest({
      file: new Blob(["pdf"], { type: "application/pdf" }),
      documentType: "SUBSCRIPTION_AGREEMENT",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when no file provided", async () => {
    const req = makeFormDataRequest({
      documentType: "SUBSCRIPTION_AGREEMENT",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("No file provided");
  });

  it("returns 400 when documentType missing", async () => {
    const req = makeFormDataRequest({
      file: makePdfBlob(),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Document type is required");
  });

  it("returns 400 for invalid file type", async () => {
    const csvBlob = new Blob(["a,b,c"], { type: "text/csv" });
    const req = makeFormDataRequest({
      file: csvBlob,
      documentType: "NDA",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid file type");
  });

  it("returns 400 for file exceeding 25MB", async () => {
    const largeBlob = new Blob([new Uint8Array(26 * 1024 * 1024)], {
      type: "application/pdf",
    });
    const req = makeFormDataRequest({
      file: largeBlob,
      documentType: "LPA",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("File too large");
  });

  it("returns 404 when user not found", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const req = makeFormDataRequest({
      file: makePdfBlob(),
      documentType: "NDA",
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("User not found");
  });

  it("returns 404 when investor profile not found", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: null,
    });

    const req = makeFormDataRequest({
      file: makePdfBlob(),
      documentType: "NDA",
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Investor profile not found");
  });

  it("uploads file and creates LPDocument on success", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: MOCK_INVESTOR,
    });
    (prisma.fund.findUnique as jest.Mock).mockResolvedValue({
      teamId: "team-1",
    });
    (prisma.lPDocument.create as jest.Mock).mockResolvedValue({
      id: "doc-1",
      status: "UPLOADED_PENDING_REVIEW",
    });

    const pdfBlob = new File([new Uint8Array(512)], "signed-sub-ag.pdf", {
      type: "application/pdf",
    });
    const formData = new FormData();
    formData.append("file", pdfBlob);
    formData.append("documentType", "SUBSCRIPTION_AGREEMENT");
    formData.append("fundId", "fund-1");
    formData.append("externalSigningDate", "2026-02-01");

    const req = new NextRequest(
      "http://localhost/api/lp/upload-signed-doc",
      { method: "POST", body: formData },
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.documentId).toBe("doc-1");
    expect(json.status).toBe("UPLOADED_PENDING_REVIEW");

    // Verify putFileServer was called
    expect(mockPutFileServer).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        restricted: true,
      }),
    );

    // Verify LPDocument creation
    expect(prisma.lPDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "UPLOADED_PENDING_REVIEW",
          uploadSource: "LP_UPLOADED_EXTERNAL",
          isOfflineSigned: true,
        }),
      }),
    );
  });

  it("uses investor ID as teamId when no fundId", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: { ...MOCK_INVESTOR, fundId: null },
    });
    (prisma.lPDocument.create as jest.Mock).mockResolvedValue({
      id: "doc-2",
      status: "UPLOADED_PENDING_REVIEW",
    });

    const req = makeFormDataRequest({
      file: makePdfBlob(),
      documentType: "NDA",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPutFileServer).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "lp-inv-1",
      }),
    );
  });

  it("accepts PNG and JPG files", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: MOCK_INVESTOR,
    });
    (prisma.lPDocument.create as jest.Mock).mockResolvedValue({
      id: "doc-3",
      status: "UPLOADED_PENDING_REVIEW",
    });

    for (const type of ["image/png", "image/jpeg"]) {
      jest.clearAllMocks();
      mockRequireLPAuthAppRouter.mockResolvedValue(AUTH_RESULT);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user-1",
        investorProfile: MOCK_INVESTOR,
      });
      (prisma.lPDocument.create as jest.Mock).mockResolvedValue({
        id: "doc-3",
        status: "UPLOADED_PENDING_REVIEW",
      });
      mockPutFileServer.mockResolvedValue({
        data: "uploads/img.png",
        type: "S3_PATH",
      });

      const blob = new Blob([new Uint8Array(100)], { type });
      const req = makeFormDataRequest({
        file: blob,
        documentType: "WIRE_CONFIRMATION",
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    }
  });

  it("audit logs the upload", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      investorProfile: MOCK_INVESTOR,
    });
    (prisma.fund.findUnique as jest.Mock).mockResolvedValue({
      teamId: "team-1",
    });
    (prisma.lPDocument.create as jest.Mock).mockResolvedValue({
      id: "doc-4",
      status: "UPLOADED_PENDING_REVIEW",
    });

    const req = makeFormDataRequest({
      file: makePdfBlob(),
      documentType: "SIDE_LETTER",
      fundId: "fund-1",
    });

    await POST(req);

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "DOCUMENT_SIGNED",
        resourceType: "Document",
        resourceId: "doc-4",
        metadata: expect.objectContaining({
          action: "externally_signed_doc_uploaded",
          documentType: "SIDE_LETTER",
          isOfflineSigned: true,
        }),
      }),
    );
  });

  it("returns 500 on unexpected error", async () => {
    (prisma.user.findUnique as jest.Mock).mockRejectedValue(
      new Error("Storage failure"),
    );

    const req = makeFormDataRequest({
      file: makePdfBlob(),
      documentType: "NDA",
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
  });
});
