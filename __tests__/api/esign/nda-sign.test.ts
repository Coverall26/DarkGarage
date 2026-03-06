/**
 * Tests for GET/POST /api/esign/nda-sign
 *
 * SignSuite NDA signing for dataroom/document link visitors.
 * GET: Check if signer has already signed NDA for a link.
 * POST: Initiate NDA signing — creates envelope, tracks e-sig usage, returns signing token.
 */

import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

const mockCreateEnvelope = jest.fn();
jest.mock("@/lib/esign/envelope-service", () => ({
  createEnvelope: (...args: unknown[]) => mockCreateEnvelope(...args),
}));

const mockRecordDocumentCreated = jest.fn().mockResolvedValue(undefined);
const mockRecordDocumentSent = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/esig/usage-service", () => ({
  recordDocumentCreated: (...args: unknown[]) =>
    mockRecordDocumentCreated(...args),
  recordDocumentSent: (...args: unknown[]) =>
    mockRecordDocumentSent(...args),
}));

const mockLogAuditEvent = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/audit/audit-logger", () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

// ── Import handlers after mocks ────────────────────────────────────────────

import { GET, POST } from "@/app/api/esign/nda-sign/route";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeGetRequest(params: Record<string, string>) {
  const url = new URL("http://localhost/api/esign/nda-sign");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

function makePostRequest(
  body: Record<string, unknown>,
  headers?: Record<string, string>,
) {
  return new NextRequest("http://localhost/api/esign/nda-sign", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

// ── Test Data ──────────────────────────────────────────────────────────────

const LINK_ID = "link-nda-1";
const EMAIL = "visitor@example.com";
const NORMALIZED_EMAIL = "visitor@example.com";

const MOCK_LINK = {
  id: LINK_ID,
  enableSignSuiteNda: true,
  signSuiteNdaDocumentId: "sig-doc-nda-1",
  teamId: "team-1",
};

const MOCK_NDA_DOC = {
  id: "sig-doc-nda-1",
  title: "Non-Disclosure Agreement",
  file: "https://storage.example.com/nda.pdf",
  storageType: "S3",
  numPages: 3,
};

const MOCK_ENVELOPE = {
  id: "envelope-1",
  recipients: [
    {
      id: "recipient-1",
      email: NORMALIZED_EMAIL,
      signingToken: "sign-token-abc",
    },
  ],
};

const MOCK_RECORD = {
  id: "nda-record-1",
  linkId: LINK_ID,
  envelopeId: "envelope-1",
  signerEmail: NORMALIZED_EMAIL,
  signerName: "Test Visitor",
};

// ── GET Tests ──────────────────────────────────────────────────────────────

describe("GET /api/esign/nda-sign", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when linkId is missing", async () => {
    const res = await GET(makeGetRequest({ email: EMAIL }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("linkId and email are required");
  });

  it("returns 400 when email is missing", async () => {
    const res = await GET(makeGetRequest({ linkId: LINK_ID }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("linkId and email are required");
  });

  it("returns signed=true when NDA already signed", async () => {
    const signedAt = new Date("2026-02-20T12:00:00Z");
    (prisma.ndaSigningRecord.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "nda-record-1",
      signedAt,
      envelopeId: "envelope-1",
    });

    const res = await GET(
      makeGetRequest({ linkId: LINK_ID, email: EMAIL }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.signed).toBe(true);
    expect(json.signedAt).toBe(signedAt.toISOString());
    expect(json.recordId).toBe("nda-record-1");
  });

  it("returns pending=true with signing token when in-progress", async () => {
    // First query: no signed record
    (prisma.ndaSigningRecord.findFirst as jest.Mock)
      .mockResolvedValueOnce(null) // signed check
      .mockResolvedValueOnce({
        // pending check
        id: "nda-record-2",
        envelopeId: "envelope-2",
      });

    (prisma.envelopeRecipient.findFirst as jest.Mock).mockResolvedValueOnce({
      signingToken: "resume-token-xyz",
    });

    const res = await GET(
      makeGetRequest({ linkId: LINK_ID, email: EMAIL }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.signed).toBe(false);
    expect(json.pending).toBe(true);
    expect(json.recordId).toBe("nda-record-2");
    expect(json.signingToken).toBe("resume-token-xyz");
  });

  it("returns signed=false, pending=false when no record exists", async () => {
    (prisma.ndaSigningRecord.findFirst as jest.Mock)
      .mockResolvedValueOnce(null) // signed check
      .mockResolvedValueOnce(null); // pending check

    const res = await GET(
      makeGetRequest({ linkId: LINK_ID, email: EMAIL }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.signed).toBe(false);
    expect(json.pending).toBe(false);
  });

  it("normalizes email to lowercase and trims whitespace", async () => {
    (prisma.ndaSigningRecord.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await GET(
      makeGetRequest({ linkId: LINK_ID, email: "  Visitor@Example.COM  " }),
    );

    expect(prisma.ndaSigningRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          signerEmail: "visitor@example.com",
        }),
      }),
    );
  });

  it("returns 500 on unexpected error", async () => {
    (prisma.ndaSigningRecord.findFirst as jest.Mock).mockRejectedValueOnce(
      new Error("DB failure"),
    );

    const res = await GET(
      makeGetRequest({ linkId: LINK_ID, email: EMAIL }),
    );
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
  });
});

// ── POST Tests ─────────────────────────────────────────────────────────────

describe("POST /api/esign/nda-sign", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateEnvelope.mockResolvedValue(MOCK_ENVELOPE);
  });

  it("returns 400 when linkId is missing", async () => {
    const res = await POST(makePostRequest({ email: EMAIL }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("linkId and email are required");
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(makePostRequest({ linkId: LINK_ID }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("linkId and email are required");
  });

  it("returns 404 when link not found", async () => {
    (prisma.link.findUnique as jest.Mock).mockResolvedValueOnce(null);

    const res = await POST(
      makePostRequest({ linkId: LINK_ID, email: EMAIL }),
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("Link not found");
  });

  it("returns 400 when SignSuite NDA is not enabled on link", async () => {
    (prisma.link.findUnique as jest.Mock).mockResolvedValueOnce({
      ...MOCK_LINK,
      enableSignSuiteNda: false,
    });

    const res = await POST(
      makePostRequest({ linkId: LINK_ID, email: EMAIL }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("SignSuite NDA is not enabled on this link");
  });

  it("returns 400 when signSuiteNdaDocumentId is null", async () => {
    (prisma.link.findUnique as jest.Mock).mockResolvedValueOnce({
      ...MOCK_LINK,
      signSuiteNdaDocumentId: null,
    });

    const res = await POST(
      makePostRequest({ linkId: LINK_ID, email: EMAIL }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("SignSuite NDA is not enabled on this link");
  });

  it("returns alreadySigned when NDA previously completed", async () => {
    const signedAt = new Date("2026-02-20T12:00:00Z");
    (prisma.link.findUnique as jest.Mock).mockResolvedValueOnce(MOCK_LINK);
    (prisma.ndaSigningRecord.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "nda-record-existing",
      signedAt,
    });

    const res = await POST(
      makePostRequest({ linkId: LINK_ID, email: EMAIL }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.alreadySigned).toBe(true);
    expect(json.signedAt).toBe(signedAt.toISOString());
    expect(json.recordId).toBe("nda-record-existing");
  });

  it("resumes pending envelope instead of creating new one", async () => {
    (prisma.link.findUnique as jest.Mock).mockResolvedValueOnce(MOCK_LINK);
    // No signed record
    (prisma.ndaSigningRecord.findFirst as jest.Mock)
      .mockResolvedValueOnce(null) // signed check
      .mockResolvedValueOnce({
        // pending check
        id: "nda-pending",
        envelopeId: "envelope-pending",
      });
    (prisma.envelopeRecipient.findFirst as jest.Mock).mockResolvedValueOnce({
      signingToken: "resume-token",
    });

    const res = await POST(
      makePostRequest({ linkId: LINK_ID, email: EMAIL }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.resumed).toBe(true);
    expect(json.envelopeId).toBe("envelope-pending");
    expect(json.signingToken).toBe("resume-token");

    // Should NOT have called createEnvelope
    expect(mockCreateEnvelope).not.toHaveBeenCalled();
  });

  it("returns 404 when NDA document template not found", async () => {
    (prisma.link.findUnique as jest.Mock).mockResolvedValueOnce(MOCK_LINK);
    (prisma.ndaSigningRecord.findFirst as jest.Mock)
      .mockResolvedValueOnce(null) // signed check
      .mockResolvedValueOnce(null); // pending check
    (prisma.signatureDocument.findUnique as jest.Mock).mockResolvedValueOnce(
      null,
    );

    const res = await POST(
      makePostRequest({ linkId: LINK_ID, email: EMAIL }),
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("NDA document template not found");
  });

  it("returns 400 when link has no teamId", async () => {
    (prisma.link.findUnique as jest.Mock).mockResolvedValueOnce({
      ...MOCK_LINK,
      teamId: null,
    });
    (prisma.ndaSigningRecord.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.signatureDocument.findUnique as jest.Mock).mockResolvedValueOnce(
      MOCK_NDA_DOC,
    );

    const res = await POST(
      makePostRequest({ linkId: LINK_ID, email: EMAIL }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Link is not associated with a team");
  });

  it("creates envelope, records NDA signing, and returns token on success", async () => {
    (prisma.link.findUnique as jest.Mock).mockResolvedValueOnce(MOCK_LINK);
    (prisma.ndaSigningRecord.findFirst as jest.Mock)
      .mockResolvedValueOnce(null) // signed check
      .mockResolvedValueOnce(null); // pending check
    (prisma.signatureDocument.findUnique as jest.Mock).mockResolvedValueOnce(
      MOCK_NDA_DOC,
    );
    (prisma.ndaSigningRecord.create as jest.Mock).mockResolvedValueOnce(
      MOCK_RECORD,
    );

    const res = await POST(
      makePostRequest(
        { linkId: LINK_ID, email: EMAIL, name: "Test Visitor" },
        { "x-forwarded-for": "1.2.3.4", "user-agent": "TestBrowser/1.0" },
      ),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recordId).toBe("nda-record-1");
    expect(json.envelopeId).toBe("envelope-1");
    expect(json.signingToken).toBe("sign-token-abc");
  });

  it("calls createEnvelope with correct parameters", async () => {
    (prisma.link.findUnique as jest.Mock).mockResolvedValueOnce(MOCK_LINK);
    (prisma.ndaSigningRecord.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.signatureDocument.findUnique as jest.Mock).mockResolvedValueOnce(
      MOCK_NDA_DOC,
    );
    (prisma.ndaSigningRecord.create as jest.Mock).mockResolvedValueOnce(
      MOCK_RECORD,
    );

    await POST(
      makePostRequest({ linkId: LINK_ID, email: EMAIL, name: "Visitor" }),
    );

    expect(mockCreateEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        createdById: "system",
        title: "NDA — Non-Disclosure Agreement",
        signingMode: "SEQUENTIAL",
        recipients: [
          expect.objectContaining({
            name: "Visitor",
            email: NORMALIZED_EMAIL,
            role: "SIGNER",
            order: 1,
          }),
        ],
        sourceFile: MOCK_NDA_DOC.file,
        sourceStorageType: MOCK_NDA_DOC.storageType,
        sourceFileName: "NDA.pdf",
        sourceMimeType: "application/pdf",
        sourceNumPages: MOCK_NDA_DOC.numPages,
      }),
    );
  });

  it("tracks e-sig usage (document created and sent)", async () => {
    (prisma.link.findUnique as jest.Mock).mockResolvedValueOnce(MOCK_LINK);
    (prisma.ndaSigningRecord.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.signatureDocument.findUnique as jest.Mock).mockResolvedValueOnce(
      MOCK_NDA_DOC,
    );
    (prisma.ndaSigningRecord.create as jest.Mock).mockResolvedValueOnce(
      MOCK_RECORD,
    );

    await POST(
      makePostRequest({ linkId: LINK_ID, email: EMAIL }),
    );

    expect(mockRecordDocumentCreated).toHaveBeenCalledWith(
      "team-1",
      "NDA_AGREEMENT",
    );
    expect(mockRecordDocumentSent).toHaveBeenCalledWith("team-1");
  });

  it("creates NdaSigningRecord with IP and user-agent", async () => {
    (prisma.link.findUnique as jest.Mock).mockResolvedValueOnce(MOCK_LINK);
    (prisma.ndaSigningRecord.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.signatureDocument.findUnique as jest.Mock).mockResolvedValueOnce(
      MOCK_NDA_DOC,
    );
    (prisma.ndaSigningRecord.create as jest.Mock).mockResolvedValueOnce(
      MOCK_RECORD,
    );

    await POST(
      makePostRequest(
        { linkId: LINK_ID, email: "  VISITOR@Example.com  ", name: "Bob" },
        { "x-forwarded-for": "10.0.0.1, 10.0.0.2", "user-agent": "Safari" },
      ),
    );

    expect(prisma.ndaSigningRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        linkId: LINK_ID,
        envelopeId: "envelope-1",
        signerEmail: "visitor@example.com",
        signerName: "Bob",
        ipAddress: "10.0.0.1",
        userAgent: "Safari",
      }),
    });
  });

  it("audit logs NDA_SIGNING_INITIATED with metadata", async () => {
    (prisma.link.findUnique as jest.Mock).mockResolvedValueOnce(MOCK_LINK);
    (prisma.ndaSigningRecord.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.signatureDocument.findUnique as jest.Mock).mockResolvedValueOnce(
      MOCK_NDA_DOC,
    );
    (prisma.ndaSigningRecord.create as jest.Mock).mockResolvedValueOnce(
      MOCK_RECORD,
    );

    await POST(
      makePostRequest({ linkId: LINK_ID, email: EMAIL }),
    );

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "NDA_SIGNING_INITIATED",
        teamId: "team-1",
        resourceType: "NdaSigningRecord",
        resourceId: "nda-record-1",
        metadata: expect.objectContaining({
          linkId: LINK_ID,
          signerEmail: NORMALIZED_EMAIL,
          envelopeId: "envelope-1",
          documentId: "sig-doc-nda-1",
        }),
      }),
    );
  });

  it("uses email as name fallback when name not provided", async () => {
    (prisma.link.findUnique as jest.Mock).mockResolvedValueOnce(MOCK_LINK);
    (prisma.ndaSigningRecord.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (prisma.signatureDocument.findUnique as jest.Mock).mockResolvedValueOnce(
      MOCK_NDA_DOC,
    );
    (prisma.ndaSigningRecord.create as jest.Mock).mockResolvedValueOnce(
      MOCK_RECORD,
    );

    await POST(makePostRequest({ linkId: LINK_ID, email: EMAIL }));

    // createEnvelope should use email as recipient name
    expect(mockCreateEnvelope).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: [
          expect.objectContaining({
            name: NORMALIZED_EMAIL,
          }),
        ],
      }),
    );

    // NdaSigningRecord should have null signerName
    expect(prisma.ndaSigningRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        signerName: null,
      }),
    });
  });

  it("returns 500 on unexpected error", async () => {
    (prisma.link.findUnique as jest.Mock).mockRejectedValueOnce(
      new Error("DB connection failed"),
    );

    const res = await POST(
      makePostRequest({ linkId: LINK_ID, email: EMAIL }),
    );
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Internal server error");
  });
});
