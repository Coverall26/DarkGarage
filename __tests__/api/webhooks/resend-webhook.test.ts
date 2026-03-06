/**
 * Tests for POST /api/webhooks/resend — Resend email event webhook handler.
 *
 * Route: app/api/webhooks/resend/route.ts
 *
 * Covers:
 *   1. Signature verification (invalid, missing headers, valid, no secret configured)
 *   2. email.delivered — marks existing activity as delivered, deduplication
 *   3. email.opened — logs activity + increments engagement (+2), deduplication
 *   4. email.clicked — logs link click + engagement (+3), skips tracking/unsubscribe links
 *   5. email.bounced — marks contact bounced (hard), cancels sequences, soft bounce handling
 *   6. email.complained — unsubscribes contact + cancels sequences
 *   7. Unknown event type — acknowledged without processing (200)
 *   8. Missing contact — no-op, returns 200
 *   9. Fallback contact lookup by email
 *  10. Handler error — returns 200 to prevent Resend retries, reports error
 */

import crypto from "crypto";

// ---------------------------------------------------------------------------
// Mocks (must be before imports)
// ---------------------------------------------------------------------------

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

const mockLogContactActivity = jest.fn().mockResolvedValue({});
jest.mock("@/lib/crm/contact-service", () => ({
  logContactActivity: (...args: unknown[]) => mockLogContactActivity(...args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks — uses global jest.setup.ts prisma mock)
// ---------------------------------------------------------------------------

import prisma from "@/lib/prisma";
import { reportError } from "@/lib/error";
import { POST } from "@/app/api/webhooks/resend/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET =
  "whsec_" + Buffer.from("test-secret-key-32bytes!").toString("base64");

function makeSignatureHeaders(
  body: string,
  secret: string = WEBHOOK_SECRET,
): Record<string, string> {
  const svixId = "msg_test123";
  const svixTimestamp = Math.floor(Date.now() / 1000).toString();
  const secretBytes = Buffer.from(secret.slice(6), "base64");
  const toSign = `${svixId}.${svixTimestamp}.${body}`;
  const signature = crypto
    .createHmac("sha256", secretBytes)
    .update(toSign)
    .digest("base64");

  return {
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": `v1,${signature}`,
  };
}

function makeEvent(
  type: string,
  dataOverrides: Record<string, unknown> = {},
) {
  return {
    type,
    created_at: new Date().toISOString(),
    data: {
      email_id: "email-001",
      from: "noreply@fundroom.ai",
      to: ["lp@example.com"],
      subject: "Test Email",
      ...dataOverrides,
    },
  };
}

function makeRequest(
  body: string,
  headers: Record<string, string> = {},
) {
  return new Request("http://localhost:3000/api/webhooks/resend", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  }) as unknown as import("next/server").NextRequest;
}

/** Mock findContactByEmailEvent to return a contact match via emailId lookup. */
function mockContactFound(
  contactId = "contact-001",
  teamId = "team-001",
) {
  (prisma.contactActivity.findFirst as jest.Mock).mockResolvedValueOnce({
    contactId,
    contact: { teamId },
  });
}

/** Mock findContactByEmailEvent to return no match. */
function mockContactNotFound() {
  (prisma.contactActivity.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/resend", () => {
  const originalEnv = process.env.RESEND_WEBHOOK_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  afterAll(() => {
    process.env.RESEND_WEBHOOK_SECRET = originalEnv;
  });

  // -------------------------------------------------------------------------
  // 1. Signature verification
  // -------------------------------------------------------------------------
  describe("signature verification", () => {
    it("returns 401 for invalid Svix signature", async () => {
      const body = JSON.stringify(makeEvent("email.delivered"));
      const headers = makeSignatureHeaders(body);
      headers["svix-signature"] = "v1,invalidsignature";

      const res = await POST(makeRequest(body, headers));
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Invalid webhook signature");
    });

    it("returns 401 for missing Svix headers", async () => {
      const body = JSON.stringify(makeEvent("email.delivered"));

      const res = await POST(makeRequest(body, {}));
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Invalid webhook signature");
    });

    it("accepts valid signature and returns 200", async () => {
      const event = makeEvent("unknown.event");
      const body = JSON.stringify(event);
      const headers = makeSignatureHeaders(body);

      const res = await POST(makeRequest(body, headers));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.received).toBe(true);
    });

    it("accepts events without verification when secret not set", async () => {
      delete process.env.RESEND_WEBHOOK_SECRET;

      const body = JSON.stringify(makeEvent("unknown.event"));

      const res = await POST(makeRequest(body, {}));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.received).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Invalid JSON
  // -------------------------------------------------------------------------
  it("returns 400 for invalid JSON body", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;

    const res = await POST(makeRequest("not-json", {}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid JSON body");
  });

  // -------------------------------------------------------------------------
  // 2. email.delivered
  // -------------------------------------------------------------------------
  describe("email.delivered", () => {
    it("updates existing EMAIL_SENT activity with delivery status", async () => {
      delete process.env.RESEND_WEBHOOK_SECRET;

      // findContactByEmailEvent returns match
      mockContactFound();
      // Dedup check returns null (no duplicate)
      (prisma.contactActivity.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.contactActivity.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const event = makeEvent("email.delivered");
      const body = JSON.stringify(event);

      const res = await POST(makeRequest(body, {}));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.received).toBe(true);
      expect(prisma.contactActivity.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contactId: "contact-001",
            emailId: "email-001",
            type: "EMAIL_SENT",
          }),
        }),
      );
    });

    it("skips duplicate delivered event", async () => {
      delete process.env.RESEND_WEBHOOK_SECRET;

      mockContactFound();
      // Dedup check finds existing
      (prisma.contactActivity.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "existing-activity",
      });

      const event = makeEvent("email.delivered");
      const body = JSON.stringify(event);

      await POST(makeRequest(body, {}));

      expect(prisma.contactActivity.updateMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 3. email.opened — logs activity + increments engagement
  // -------------------------------------------------------------------------
  describe("email.opened", () => {
    it("logs open activity and increments engagement score by 2", async () => {
      delete process.env.RESEND_WEBHOOK_SECRET;

      mockContactFound();
      // Dedup check returns null
      (prisma.contactActivity.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.contact.update as jest.Mock).mockResolvedValue({});

      const event = makeEvent("email.opened");
      const body = JSON.stringify(event);

      const res = await POST(makeRequest(body, {}));
      expect(res.status).toBe(200);

      // logContactActivity called with EMAIL_OPENED
      expect(mockLogContactActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          contactId: "contact-001",
          type: "EMAIL_OPENED",
        }),
      );

      // Engagement incremented by 2
      expect(prisma.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "contact-001" },
          data: expect.objectContaining({
            engagementScore: { increment: 2 },
            lastEngagedAt: expect.any(Date),
          }),
        }),
      );
    });

    it("deduplicates against existing open activity", async () => {
      delete process.env.RESEND_WEBHOOK_SECRET;

      mockContactFound();
      // Dedup check finds existing open
      (prisma.contactActivity.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "existing-open",
      });

      const event = makeEvent("email.opened");
      const body = JSON.stringify(event);

      await POST(makeRequest(body, {}));

      expect(mockLogContactActivity).not.toHaveBeenCalled();
      expect(prisma.contact.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 4. email.clicked — logs click + engagement, skips tracking links
  // -------------------------------------------------------------------------
  describe("email.clicked", () => {
    it("logs click activity and increments engagement by 3", async () => {
      delete process.env.RESEND_WEBHOOK_SECRET;

      mockContactFound();
      (prisma.contact.update as jest.Mock).mockResolvedValue({});

      const event = makeEvent("email.clicked", {
        click: {
          link: "https://app.fundroom.ai/lp/dashboard",
          timestamp: new Date().toISOString(),
        },
      });
      const body = JSON.stringify(event);

      const res = await POST(makeRequest(body, {}));
      expect(res.status).toBe(200);

      expect(mockLogContactActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          contactId: "contact-001",
          type: "LINK_CLICKED",
        }),
      );
      expect(prisma.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            engagementScore: { increment: 3 },
          }),
        }),
      );
    });

    it("skips tracking pixel links", async () => {
      delete process.env.RESEND_WEBHOOK_SECRET;

      mockContactFound();

      const event = makeEvent("email.clicked", {
        click: {
          link: "https://app.fundroom.ai/api/outreach/track/click123",
        },
      });
      const body = JSON.stringify(event);

      await POST(makeRequest(body, {}));

      expect(mockLogContactActivity).not.toHaveBeenCalled();
    });

    it("skips unsubscribe links", async () => {
      delete process.env.RESEND_WEBHOOK_SECRET;

      mockContactFound();

      const event = makeEvent("email.clicked", {
        click: {
          link: "https://app.fundroom.ai/api/outreach/unsubscribe?token=abc",
        },
      });
      const body = JSON.stringify(event);

      await POST(makeRequest(body, {}));

      expect(mockLogContactActivity).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 5. email.bounced — marks contact bounced, cancels sequences
  // -------------------------------------------------------------------------
  describe("email.bounced", () => {
    it("marks contact as bounced and cancels sequences for hard bounce", async () => {
      delete process.env.RESEND_WEBHOOK_SECRET;

      mockContactFound();
      (prisma.contact.update as jest.Mock).mockResolvedValue({});
      (prisma.sequenceEnrollment.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const event = makeEvent("email.bounced", {
        bounce: { type: "hard", message: "Mailbox not found" },
      });
      const body = JSON.stringify(event);

      const res = await POST(makeRequest(body, {}));
      expect(res.status).toBe(200);

      // Contact marked as bounced
      expect(prisma.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "contact-001" },
          data: { emailBounced: true },
        }),
      );

      // Active sequences cancelled
      expect(prisma.sequenceEnrollment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contactId: "contact-001",
            status: "ACTIVE",
          }),
          data: expect.objectContaining({
            status: "CANCELLED",
            pausedReason: "email_bounced",
          }),
        }),
      );

      // Activity logged
      expect(mockLogContactActivity).toHaveBeenCalled();
    });

    it("does not mark contact bounced or cancel sequences for soft bounce", async () => {
      delete process.env.RESEND_WEBHOOK_SECRET;

      mockContactFound();

      const event = makeEvent("email.bounced", {
        bounce: { type: "soft", message: "Mailbox full" },
      });
      const body = JSON.stringify(event);

      await POST(makeRequest(body, {}));

      // Should NOT update contact or cancel sequences for soft bounce
      expect(prisma.contact.update).not.toHaveBeenCalled();
      expect(prisma.sequenceEnrollment.updateMany).not.toHaveBeenCalled();

      // But should still log the bounce activity
      expect(mockLogContactActivity).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 6. email.complained — unsubscribes + cancels sequences
  // -------------------------------------------------------------------------
  describe("email.complained", () => {
    it("unsubscribes contact and cancels active sequences", async () => {
      delete process.env.RESEND_WEBHOOK_SECRET;

      mockContactFound();
      (prisma.contact.update as jest.Mock).mockResolvedValue({});
      (prisma.sequenceEnrollment.updateMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      const event = makeEvent("email.complained");
      const body = JSON.stringify(event);

      const res = await POST(makeRequest(body, {}));
      expect(res.status).toBe(200);

      // Unsubscribed
      expect(prisma.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "contact-001" },
          data: expect.objectContaining({
            unsubscribedAt: expect.any(Date),
          }),
        }),
      );

      // Sequences cancelled with spam_complaint reason
      expect(prisma.sequenceEnrollment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "CANCELLED",
            pausedReason: "spam_complaint",
          }),
        }),
      );

      // Activity logged
      expect(mockLogContactActivity).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 7. Unknown event type — acknowledged without processing
  // -------------------------------------------------------------------------
  it("returns 200 for unknown event types without processing", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;

    const event = makeEvent("email.some_future_event");
    const body = JSON.stringify(event);

    const res = await POST(makeRequest(body, {}));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 8. Missing contact — graceful no-op
  // -------------------------------------------------------------------------
  it("handles missing contact gracefully — no-ops and returns 200", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;

    mockContactNotFound();

    const event = makeEvent("email.opened");
    const body = JSON.stringify(event);

    const res = await POST(makeRequest(body, {}));

    expect(res.status).toBe(200);
    expect(mockLogContactActivity).not.toHaveBeenCalled();
    expect(prisma.contact.update).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 9. Fallback: find contact by email when emailId lookup fails
  // -------------------------------------------------------------------------
  it("falls back to email lookup when emailId not found in activities", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;

    // emailId lookup fails
    (prisma.contactActivity.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      // dedup check for opened
      .mockResolvedValueOnce(null);

    // Email fallback succeeds
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue({
      id: "contact-002",
      teamId: "team-002",
    });
    (prisma.contact.update as jest.Mock).mockResolvedValue({});

    const event = makeEvent("email.opened");
    const body = JSON.stringify(event);

    await POST(makeRequest(body, {}));

    // Should have tried contact.findFirst as fallback
    expect(prisma.contact.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "lp@example.com" },
      }),
    );
    // Should still log the activity
    expect(mockLogContactActivity).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 10. Handler error — returns 200 to prevent retries, reports error
  // -------------------------------------------------------------------------
  it("returns 200 even when handler throws to prevent Resend retries", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;

    mockContactFound();
    // Make the handler throw via logContactActivity (called by handleEmailOpened)
    mockLogContactActivity.mockRejectedValueOnce(
      new Error("DB connection lost"),
    );

    const event = makeEvent("email.opened");
    const body = JSON.stringify(event);

    const res = await POST(makeRequest(body, {}));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(json.error).toBe("Handler failed");
    expect(reportError).toHaveBeenCalled();
  });
});
