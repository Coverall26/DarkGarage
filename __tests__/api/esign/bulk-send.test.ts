/**
 * Tests for /api/esign/bulk-send — POST (create bulk send) + GET (batch status)
 *
 * POST: Creates one Envelope per recipient with shared batchId.
 *       Inline for ≤10 recipients, background for >10.
 * GET:  Lists all batches (no batchId) or single batch detail (with batchId).
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRequireAuthAppRouter = jest.fn();
jest.mock("@/lib/auth/rbac", () => ({
  requireAuthAppRouter: (...args: unknown[]) =>
    mockRequireAuthAppRouter(...args),
}));

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

jest.mock("@/lib/errors", () => ({
  errorResponse: jest.fn().mockImplementation(() =>
    NextResponse.json({ error: "Internal server error" }, { status: 500 })
  ),
}));

jest.mock("@/lib/security/rate-limiter", () => ({
  appRouterRateLimit: jest.fn().mockResolvedValue(null),
}));

const mockResolveOrgIdFromTeam = jest.fn();
const mockCheckModuleAccess = jest.fn();
jest.mock("@/lib/middleware/module-access", () => ({
  resolveOrgIdFromTeam: (...args: unknown[]) =>
    mockResolveOrgIdFromTeam(...args),
  checkModuleAccess: (...args: unknown[]) => mockCheckModuleAccess(...args),
}));

const mockGetEsigUsage = jest.fn();
jest.mock("@/lib/esig/usage-service", () => ({
  getEsigUsage: (...args: unknown[]) => mockGetEsigUsage(...args),
  recordDocumentCreated: jest.fn().mockResolvedValue(undefined),
  recordDocumentSent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/audit/audit-logger", () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/lib/crm/contact-upsert-job", () => ({
  captureFromSigningEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/emails/send-esign-notifications", () => ({
  sendSigningInvitationEmail: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let GET: typeof import("@/app/api/esign/bulk-send/route").GET;
let POST: typeof import("@/app/api/esign/bulk-send/route").POST;

const mockSession = {
  userId: "user-1",
  email: "gp@fundroom.ai",
  teamId: "team-1",
  role: "ADMIN",
  session: { user: { id: "user-1", email: "gp@fundroom.ai" } },
};

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:5000/api/esign/bulk-send", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeGetRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost:5000/api/esign/bulk-send");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url);
}

const validBody = {
  title: "Bulk NDA",
  recipients: [
    { name: "Alice Smith", email: "alice@example.com" },
    { name: "Bob Jones", email: "bob@example.com" },
  ],
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(async () => {
  jest.clearAllMocks();
  mockRequireAuthAppRouter.mockResolvedValue(mockSession);
  mockResolveOrgIdFromTeam.mockResolvedValue("org-1");
  mockCheckModuleAccess.mockResolvedValue(null);
  mockGetEsigUsage.mockResolvedValue({ remaining: 100 });

  (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "user-1" });
  (prisma.envelope.create as jest.Mock).mockImplementation(
    ({ data }: { data: { title: string } }) => ({
      id: `env-${Math.random().toString(36).slice(2, 8)}`,
      title: data.title,
      status: "SENT",
    })
  );
  (prisma.envelopeRecipient.findFirst as jest.Mock).mockResolvedValue({
    id: "r-1",
  });

  const mod = await import("@/app/api/esign/bulk-send/route");
  GET = mod.GET;
  POST = mod.POST;
});

// ============================================================================
// POST /api/esign/bulk-send
// ============================================================================

describe("POST /api/esign/bulk-send", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuthAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 when no organization found", async () => {
    mockResolveOrgIdFromTeam.mockResolvedValue(null);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("No organization found");
  });

  it("returns 403 when module access blocked", async () => {
    mockCheckModuleAccess.mockResolvedValue(
      NextResponse.json(
        { error: "MODULE_NOT_AVAILABLE" },
        { status: 403 }
      )
    );

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(403);
  });

  it("returns 400 when title is missing", async () => {
    const res = await POST(
      makePostRequest({ recipients: validBody.recipients })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when recipients array is empty", async () => {
    const res = await POST(
      makePostRequest({ title: "Test", recipients: [] })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when recipients missing name", async () => {
    const res = await POST(
      makePostRequest({
        title: "Test",
        recipients: [{ email: "test@example.com" }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when recipients have invalid email", async () => {
    const res = await POST(
      makePostRequest({
        title: "Test",
        recipients: [{ name: "Test", email: "not-an-email" }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("deduplicates recipients by email (case-insensitive)", async () => {
    const bodyWithDupes = {
      title: "Test",
      recipients: [
        { name: "Alice", email: "ALICE@example.com" },
        { name: "Alice Dup", email: "alice@example.com" },
        { name: "Bob", email: "bob@example.com" },
      ],
    };

    const res = await POST(makePostRequest(bodyWithDupes));
    expect(res.status).toBe(201);
    const data = await res.json();
    // Should deduplicate to 2 unique recipients
    expect(data.recipientCount).toBe(2);
  });

  it("returns 400 when all recipients deduplicated away", async () => {
    // All same email
    const bodyAllDupes = {
      title: "Test",
      recipients: [
        { name: "Alice", email: "alice@example.com" },
        { name: "Alice Dup", email: "ALICE@example.com" },
      ],
    };

    const res = await POST(makePostRequest(bodyAllDupes));
    // After dedup: only 1 unique recipient, which is valid
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.recipientCount).toBe(1);
  });

  it("returns 403 when e-sig monthly limit exceeded", async () => {
    mockGetEsigUsage.mockResolvedValue({ remaining: 1 });

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe("ESIG_LIMIT_EXCEEDED");
    expect(data.remaining).toBe(1);
    expect(data.required).toBe(2);
  });

  it("allows when remaining is null (unlimited)", async () => {
    mockGetEsigUsage.mockResolvedValue({ remaining: null });

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(201);
  });

  it("returns 400 when expiresAt is in the past", async () => {
    const res = await POST(
      makePostRequest({
        ...validBody,
        expiresAt: "2020-01-01T00:00:00Z",
      })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Expiration date must be in the future");
  });

  it("returns 404 when user not found", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("User not found");
  });

  it("creates envelopes inline for ≤10 recipients (201 COMPLETED)", async () => {
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.status).toBe("COMPLETED");
    expect(data.batchId).toBeDefined();
    expect(data.batchName).toBeDefined();
    expect(data.envelopeCount).toBe(2);
    expect(data.recipientCount).toBe(2);
    expect(data.envelopeIds).toHaveLength(2);
  });

  it("creates envelopes with correct batch name", async () => {
    const res = await POST(
      makePostRequest({
        ...validBody,
        batchName: "My Custom Batch",
      })
    );
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.batchName).toBe("My Custom Batch");
  });

  it("defaults batch name to 'Bulk: {title}' when not provided", async () => {
    const res = await POST(makePostRequest(validBody));
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.batchName).toBe("Bulk: Bulk NDA");
  });

  it("processes >10 recipients in background (202 PROCESSING)", async () => {
    const manyRecipients = Array.from({ length: 15 }, (_, i) => ({
      name: `Person ${i}`,
      email: `person${i}@example.com`,
    }));

    const res = await POST(
      makePostRequest({ title: "Big Batch", recipients: manyRecipients })
    );
    expect(res.status).toBe(202);

    const data = await res.json();
    expect(data.status).toBe("PROCESSING");
    expect(data.processedSoFar).toBe(10);
    expect(data.remaining).toBe(5);
    expect(data.recipientCount).toBe(15);
  });

  it("creates each envelope with SENT status and signing token", async () => {
    await POST(makePostRequest(validBody));

    expect(prisma.envelope.create).toHaveBeenCalledTimes(2);

    const firstCall = (prisma.envelope.create as jest.Mock).mock.calls[0][0];
    expect(firstCall.data.status).toBe("SENT");
    expect(firstCall.data.sentAt).toBeDefined();
    expect(firstCall.data.batchId).toBeDefined();
    expect(firstCall.data.recipients.create.signingToken).toBeDefined();
    expect(firstCall.data.recipients.create.role).toBe("SIGNER");
    expect(firstCall.data.recipients.create.status).toBe("SENT");
  });

  it("passes email subject and message to envelopes", async () => {
    await POST(
      makePostRequest({
        ...validBody,
        emailSubject: "Custom Subject",
        emailMessage: "Custom message body",
      })
    );

    const firstCall = (prisma.envelope.create as jest.Mock).mock.calls[0][0];
    expect(firstCall.data.emailSubject).toBe("Custom Subject");
    expect(firstCall.data.emailMessage).toBe("Custom message body");
  });

  it("handles envelope creation failure gracefully", async () => {
    (prisma.envelope.create as jest.Mock)
      .mockResolvedValueOnce({ id: "env-1" })
      .mockRejectedValueOnce(new Error("DB error"));

    const res = await POST(makePostRequest(validBody));
    // Should still succeed with partial results
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.envelopeCount).toBe(1); // Only 1 succeeded
  });
});

// ============================================================================
// GET /api/esign/bulk-send (list batches)
// ============================================================================

describe("GET /api/esign/bulk-send (batch list)", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuthAppRouter.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns batch list when no batchId provided", async () => {
    (prisma.envelope.groupBy as jest.Mock).mockResolvedValue([
      { batchId: "batch-1", batchName: "Test Batch", _count: { id: 5 } },
    ]);
    (prisma.envelope.groupBy as jest.Mock)
      .mockResolvedValueOnce([
        { batchId: "batch-1", batchName: "Test Batch", _count: { id: 5 } },
      ])
      .mockResolvedValue([
        { status: "SENT", _count: { id: 3 } },
        { status: "COMPLETED", _count: { id: 2 } },
      ]);
    (prisma.envelope.findFirst as jest.Mock).mockResolvedValue({
      createdAt: "2026-02-28T10:00:00Z",
      title: "Test Doc",
    });

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.batches).toBeDefined();
    expect(Array.isArray(data.batches)).toBe(true);
  });

  it("returns empty batches when none exist", async () => {
    (prisma.envelope.groupBy as jest.Mock).mockResolvedValue([]);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.batches).toEqual([]);
  });
});

// ============================================================================
// GET /api/esign/bulk-send?batchId=xxx (batch detail)
// ============================================================================

describe("GET /api/esign/bulk-send?batchId=xxx (batch detail)", () => {
  it("returns 404 when batch not found", async () => {
    (prisma.envelope.findMany as jest.Mock).mockResolvedValue([]);

    const res = await GET(makeGetRequest({ batchId: "nonexistent" }));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Batch not found");
  });

  it("returns batch detail with envelopes", async () => {
    const mockEnvelopes = [
      {
        id: "env-1",
        status: "SENT",
        batchName: "Test Batch",
        title: "NDA",
        sentAt: "2026-02-28T10:00:00Z",
        completedAt: null,
        createdAt: "2026-02-28T10:00:00Z",
        recipients: [
          {
            id: "r-1",
            name: "Alice",
            email: "alice@example.com",
            status: "SENT",
            signedAt: null,
          },
        ],
      },
      {
        id: "env-2",
        status: "COMPLETED",
        batchName: "Test Batch",
        title: "NDA",
        sentAt: "2026-02-28T10:00:00Z",
        completedAt: "2026-02-28T12:00:00Z",
        createdAt: "2026-02-28T10:00:00Z",
        recipients: [
          {
            id: "r-2",
            name: "Bob",
            email: "bob@example.com",
            status: "COMPLETED",
            signedAt: "2026-02-28T12:00:00Z",
          },
        ],
      },
    ];

    (prisma.envelope.findMany as jest.Mock).mockResolvedValue(mockEnvelopes);

    const res = await GET(makeGetRequest({ batchId: "batch-1" }));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.batchId).toBe("batch-1");
    expect(data.batchName).toBe("Test Batch");
    expect(data.totalEnvelopes).toBe(2);
    expect(data.signed).toBe(1);
    expect(data.sent).toBe(1);
    expect(data.envelopes).toHaveLength(2);

    // Verify envelope shape
    expect(data.envelopes[0]).toMatchObject({
      id: "env-1",
      status: "SENT",
      recipientName: "Alice",
      recipientEmail: "alice@example.com",
    });
    expect(data.envelopes[1]).toMatchObject({
      id: "env-2",
      status: "COMPLETED",
      recipientName: "Bob",
      recipientEmail: "bob@example.com",
    });
  });

  it("calculates status counts correctly", async () => {
    const mockEnvelopes = [
      { id: "e1", status: "SENT", batchName: "B", title: "T", sentAt: null, completedAt: null, createdAt: "2026-01-01", recipients: [{ id: "r1", name: "A", email: "a@b.com", status: "SENT", signedAt: null }] },
      { id: "e2", status: "SENT", batchName: "B", title: "T", sentAt: null, completedAt: null, createdAt: "2026-01-01", recipients: [{ id: "r2", name: "B", email: "b@b.com", status: "SENT", signedAt: null }] },
      { id: "e3", status: "COMPLETED", batchName: "B", title: "T", sentAt: null, completedAt: "2026-01-02", createdAt: "2026-01-01", recipients: [{ id: "r3", name: "C", email: "c@b.com", status: "COMPLETED", signedAt: "2026-01-02" }] },
      { id: "e4", status: "VIEWED", batchName: "B", title: "T", sentAt: null, completedAt: null, createdAt: "2026-01-01", recipients: [{ id: "r4", name: "D", email: "d@b.com", status: "VIEWED", signedAt: null }] },
    ];

    (prisma.envelope.findMany as jest.Mock).mockResolvedValue(mockEnvelopes);

    const res = await GET(makeGetRequest({ batchId: "batch-1" }));
    const data = await res.json();

    expect(data.statuses).toEqual({
      SENT: 2,
      COMPLETED: 1,
      VIEWED: 1,
    });
    expect(data.sent).toBe(3); // SENT(2) + VIEWED(1)
    expect(data.signed).toBe(1); // COMPLETED(1)
    expect(data.pending).toBe(0); // No DRAFT or PREPARING
  });
});
