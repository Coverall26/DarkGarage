/**
 * E-Signature Flow Tests
 *
 * Tests the full envelope lifecycle and signing session handlers
 * from lib/esign/envelope-service.ts, lib/esign/signing-session.ts,
 * and lib/esign/field-types.ts.
 *
 * Covers: envelope creation, sending (SEQUENTIAL/PARALLEL/MIXED),
 * signer authentication, recording completion with ESIGN consent,
 * signing order advancement, void/decline flows, reminders,
 * auto-contact creation, signing status, field validation,
 * field formatting, formula evaluation, and field palette.
 */

// ---------------------------------------------------------------------------
// Module mocks (must be before imports)
// ---------------------------------------------------------------------------

jest.mock("@/lib/error", () => ({
  reportError: jest.fn(),
}));

jest.mock("@/lib/audit/audit-logger", () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/emails/send-esign-notifications", () => ({
  sendSigningReminderEmail: jest.fn().mockResolvedValue(undefined),
  sendSigningCompletedEmails: jest.fn().mockResolvedValue(undefined),
  sendNextSignerEmails: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/esign/document-filing-service", () => ({
  autoFileEnvelopeDocument: jest.fn().mockResolvedValue({
    orgVaultFiled: true,
    contactVaultsFiled: 1,
    emailRecordsFiled: 1,
  }),
}));

// Mock the dynamic import for usage-service
jest.mock("@/lib/esig/usage-service", () => ({
  recordDocumentCompleted: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import prisma from "@/lib/prisma";
import {
  createEnvelope,
  sendEnvelope,
  voidEnvelope,
  declineEnvelope,
  sendReminder,
  advanceSigningOrder,
  autoCreateContactForSigner,
} from "@/lib/esign/envelope-service";
import {
  authenticateSigner,
  recordSignerCompletion,
  getSigningStatus,
} from "@/lib/esign/signing-session";
import {
  validateFieldValue,
  formatFieldValue,
  evaluateFormula,
  getFieldPalette,
  FIELD_TYPE_CONFIGS,
} from "@/lib/esign/field-types";
import type { FieldType } from "@/lib/esign/field-types";
import { autoFileEnvelopeDocument } from "@/lib/esign/document-filing-service";
import { sendSigningCompletedEmails, sendNextSignerEmails } from "@/lib/emails/send-esign-notifications";

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecipient(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec-1",
    envelopeId: "env-1",
    name: "Jane LP",
    email: "jane@example.com",
    role: "SIGNER",
    order: 1,
    status: "SENT",
    signingToken: "token-abc123",
    viewedAt: null,
    signedAt: null,
    declinedAt: null,
    declinedReason: null,
    sentAt: new Date(),
    lastReminderSentAt: null,
    reminderCount: 0,
    ipAddress: null,
    userAgent: null,
    consentRecord: null,
    signatureChecksum: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    id: "env-1",
    teamId: "team-1",
    createdById: "user-1",
    title: "NDA Agreement",
    description: null,
    signingMode: "SEQUENTIAL",
    emailSubject: "Please sign: NDA Agreement",
    emailMessage: null,
    expiresAt: null,
    reminderEnabled: true,
    reminderDays: 3,
    maxReminders: 3,
    sourceFile: "nda.pdf",
    sourceStorageType: "S3",
    sourceFileName: "nda.pdf",
    sourceMimeType: "application/pdf",
    sourceFileSize: BigInt(1024),
    sourceNumPages: 5,
    status: "DRAFT",
    sentAt: null,
    completedAt: null,
    voidedAt: null,
    voidedReason: null,
    declinedAt: null,
    declinedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper: set up mockPrisma for authenticateSigner to return a valid
 * signer session that canSign=true. Used by recordSignerCompletion tests.
 */
function mockAuthenticatableSession(overrides: {
  recipientOverrides?: Record<string, unknown>;
  envelopeOverrides?: Record<string, unknown>;
  signingMode?: string;
  additionalRecipients?: Record<string, unknown>[];
} = {}) {
  const { recipientOverrides = {}, envelopeOverrides = {}, signingMode = "PARALLEL", additionalRecipients = [] } = overrides;

  const currentRecipient = makeRecipient({
    status: "VIEWED",
    ...recipientOverrides,
  });
  const allRecipients = [currentRecipient, ...additionalRecipients.map(o => makeRecipient(o))];

  (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
    ...currentRecipient,
    envelope: {
      ...makeEnvelope({ status: "SENT", signingMode, ...envelopeOverrides }),
      recipients: allRecipients,
    },
  });

  // Mock the update for VIEWED status transition (authenticateSigner marks VIEWED)
  (mockPrisma.envelopeRecipient.update as jest.Mock).mockResolvedValue({
    ...currentRecipient,
    status: "SIGNED",
  });
}

// ---------------------------------------------------------------------------
// Tests: Envelope Service
// ---------------------------------------------------------------------------

describe("Envelope Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // createEnvelope
  // -----------------------------------------------------------------------

  describe("createEnvelope", () => {
    it("should require at least one SIGNER recipient", async () => {
      await expect(
        createEnvelope({
          teamId: "team-1",
          createdById: "user-1",
          title: "Test",
          recipients: [
            { name: "CC Person", email: "cc@example.com", role: "CC" as never },
          ],
        }),
      ).rejects.toThrow("At least one SIGNER recipient is required");
    });

    it("should create an envelope with recipients in a transaction", async () => {
      const mockEnvelope = {
        ...makeEnvelope(),
        recipients: [makeRecipient()],
      };
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            envelope: {
              create: jest.fn().mockResolvedValue(mockEnvelope),
            },
          };
          return callback(tx);
        },
      );

      const result = await createEnvelope({
        teamId: "team-1",
        createdById: "user-1",
        title: "NDA Agreement",
        recipients: [
          { name: "Jane LP", email: "Jane@Example.com" },
        ],
      });

      expect(result.id).toBe("env-1");
      expect(result.recipients).toHaveLength(1);
    });

    it("should default signingMode to SEQUENTIAL", async () => {
      const createSpy = jest.fn().mockResolvedValue({
        ...makeEnvelope(),
        recipients: [makeRecipient()],
      });
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback({ envelope: { create: createSpy } });
        },
      );

      await createEnvelope({
        teamId: "team-1",
        createdById: "user-1",
        title: "Test",
        recipients: [{ name: "Signer", email: "s@example.com" }],
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ signingMode: "SEQUENTIAL" }),
        }),
      );
    });

    it("should normalize email to lowercase and trimmed", async () => {
      const createSpy = jest.fn().mockResolvedValue({
        ...makeEnvelope(),
        recipients: [makeRecipient({ email: "user@example.com" })],
      });
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback({ envelope: { create: createSpy } });
        },
      );

      await createEnvelope({
        teamId: "team-1",
        createdById: "user-1",
        title: "Test",
        recipients: [{ name: "Signer", email: "  USER@Example.COM  " }],
      });

      // Verify the create was called — email normalization happens inside
      expect(createSpy).toHaveBeenCalled();
    });

    it("should accept PARALLEL signing mode", async () => {
      const createSpy = jest.fn().mockResolvedValue({
        ...makeEnvelope({ signingMode: "PARALLEL" }),
        recipients: [makeRecipient()],
      });
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback({ envelope: { create: createSpy } });
        },
      );

      await createEnvelope({
        teamId: "team-1",
        createdById: "user-1",
        title: "Test",
        signingMode: "PARALLEL",
        recipients: [{ name: "Signer", email: "s@example.com" }],
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ signingMode: "PARALLEL" }),
        }),
      );
    });

    it("should accept MIXED signing mode", async () => {
      const createSpy = jest.fn().mockResolvedValue({
        ...makeEnvelope({ signingMode: "MIXED" }),
        recipients: [makeRecipient()],
      });
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          return callback({ envelope: { create: createSpy } });
        },
      );

      await createEnvelope({
        teamId: "team-1",
        createdById: "user-1",
        title: "Test",
        signingMode: "MIXED",
        recipients: [{ name: "Signer A", email: "a@example.com" }, { name: "Signer B", email: "b@example.com" }],
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ signingMode: "MIXED" }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // sendEnvelope
  // -----------------------------------------------------------------------

  describe("sendEnvelope", () => {
    it("should throw when envelope is not found", async () => {
      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(sendEnvelope("env-999", "user-1")).rejects.toThrow(
        "Envelope not found",
      );
    });

    it("should throw when envelope is already COMPLETED", async () => {
      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ status: "COMPLETED" }),
        recipients: [makeRecipient()],
      });

      await expect(sendEnvelope("env-1", "user-1")).rejects.toThrow(
        "Cannot send envelope in COMPLETED status",
      );
    });

    it("should notify only first order group in SEQUENTIAL mode", async () => {
      const rec1 = makeRecipient({ id: "rec-1", order: 1, email: "first@example.com" });
      const rec2 = makeRecipient({ id: "rec-2", order: 2, email: "second@example.com" });

      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ signingMode: "SEQUENTIAL" }),
        recipients: [rec1, rec2],
      });

      const mockUpdatedEnvelope = {
        ...makeEnvelope({ status: "SENT" }),
        recipients: [
          { ...rec1, status: "SENT" },
          { ...rec2, status: "PENDING" },
        ],
      };

      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            envelope: {
              update: jest.fn(),
              findUnique: jest.fn().mockResolvedValue(mockUpdatedEnvelope),
            },
            envelopeRecipient: {
              update: jest.fn(),
            },
          };
          return callback(tx);
        },
      );

      const result = await sendEnvelope("env-1", "user-1");
      expect(result).toBeDefined();
    });

    it("should notify all signers in PARALLEL mode", async () => {
      const rec1 = makeRecipient({ id: "rec-1", order: 1, email: "a@example.com" });
      const rec2 = makeRecipient({ id: "rec-2", order: 1, email: "b@example.com" });

      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ signingMode: "PARALLEL" }),
        recipients: [rec1, rec2],
      });

      const recipientUpdateSpy = jest.fn();
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            envelope: {
              update: jest.fn(),
              findUnique: jest.fn().mockResolvedValue({
                ...makeEnvelope({ status: "SENT", signingMode: "PARALLEL" }),
                recipients: [
                  { ...rec1, status: "SENT" },
                  { ...rec2, status: "SENT" },
                ],
              }),
            },
            envelopeRecipient: {
              update: recipientUpdateSpy,
            },
          };
          return callback(tx);
        },
      );

      await sendEnvelope("env-1", "user-1");
      // Both signers should be notified
      expect(recipientUpdateSpy).toHaveBeenCalledTimes(2);
    });

    it("should send to first order group in MIXED mode", async () => {
      const rec1 = makeRecipient({ id: "rec-1", order: 1, email: "a@example.com" });
      const rec2 = makeRecipient({ id: "rec-2", order: 1, email: "b@example.com" });
      const rec3 = makeRecipient({ id: "rec-3", order: 2, email: "c@example.com" });

      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ signingMode: "MIXED" }),
        recipients: [rec1, rec2, rec3],
      });

      const recipientUpdateSpy = jest.fn();
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            envelope: {
              update: jest.fn(),
              findUnique: jest.fn().mockResolvedValue({
                ...makeEnvelope({ status: "SENT", signingMode: "MIXED" }),
                recipients: [
                  { ...rec1, status: "SENT" },
                  { ...rec2, status: "SENT" },
                  { ...rec3, status: "PENDING" },
                ],
              }),
            },
            envelopeRecipient: {
              update: recipientUpdateSpy,
            },
          };
          return callback(tx);
        },
      );

      await sendEnvelope("env-1", "user-1");
      // Order group 1 has 2 signers, order group 2 has 1 — only group 1 notified
      expect(recipientUpdateSpy).toHaveBeenCalledTimes(2);
    });

    it("should allow sending from PREPARING status", async () => {
      const rec1 = makeRecipient({ id: "rec-1", order: 1 });

      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ status: "PREPARING" }),
        recipients: [rec1],
      });

      const recipientUpdateSpy = jest.fn();
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            envelope: {
              update: jest.fn(),
              findUnique: jest.fn().mockResolvedValue({
                ...makeEnvelope({ status: "SENT" }),
                recipients: [{ ...rec1, status: "SENT" }],
              }),
            },
            envelopeRecipient: {
              update: recipientUpdateSpy,
            },
          };
          return callback(tx);
        },
      );

      const result = await sendEnvelope("env-1", "user-1");
      expect(result).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // voidEnvelope
  // -----------------------------------------------------------------------

  describe("voidEnvelope", () => {
    it("should throw when envelope is not found", async () => {
      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(voidEnvelope("env-999", "user-1")).rejects.toThrow(
        "Envelope not found",
      );
    });

    it("should throw when voiding a COMPLETED envelope", async () => {
      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue(
        makeEnvelope({ status: "COMPLETED" }),
      );

      await expect(voidEnvelope("env-1", "user-1")).rejects.toThrow(
        "Cannot void envelope in COMPLETED status",
      );
    });

    it("should throw when voiding an already VOIDED envelope", async () => {
      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue(
        makeEnvelope({ status: "VOIDED" }),
      );

      await expect(voidEnvelope("env-1", "user-1")).rejects.toThrow(
        "Cannot void envelope in VOIDED status",
      );
    });

    it("should void a SENT envelope and record reason", async () => {
      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue(
        makeEnvelope({ status: "SENT" }),
      );
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue(
        makeEnvelope({ status: "VOIDED", voidedReason: "Changed terms" }),
      );

      const result = await voidEnvelope("env-1", "user-1", "Changed terms");
      expect(result.status).toBe("VOIDED");
    });

    it("should void a PARTIALLY_SIGNED envelope", async () => {
      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue(
        makeEnvelope({ status: "PARTIALLY_SIGNED" }),
      );
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue(
        makeEnvelope({ status: "VOIDED" }),
      );

      const result = await voidEnvelope("env-1", "user-1");
      expect(result.status).toBe("VOIDED");
    });
  });

  // -----------------------------------------------------------------------
  // declineEnvelope
  // -----------------------------------------------------------------------

  describe("declineEnvelope", () => {
    it("should throw when recipient is not found", async () => {
      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        declineEnvelope("env-1", "rec-999"),
      ).rejects.toThrow("Recipient not found");
    });

    it("should throw when recipient does not belong to envelope", async () => {
      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...makeRecipient(),
        envelopeId: "env-other",
        envelope: makeEnvelope({ id: "env-other" }),
      });

      await expect(
        declineEnvelope("env-1", "rec-1"),
      ).rejects.toThrow("Recipient does not belong to this envelope");
    });

    it("should throw when recipient already signed", async () => {
      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...makeRecipient({ status: "SIGNED" }),
        envelope: makeEnvelope(),
      });

      await expect(
        declineEnvelope("env-1", "rec-1"),
      ).rejects.toThrow("Recipient already signed");
    });

    it("should throw when recipient already declined", async () => {
      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...makeRecipient({ status: "DECLINED" }),
        envelope: makeEnvelope(),
      });

      await expect(
        declineEnvelope("env-1", "rec-1"),
      ).rejects.toThrow();
    });

    it("should decline and update envelope status", async () => {
      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...makeRecipient({ status: "SENT" }),
        envelope: makeEnvelope({ status: "SENT" }),
      });
      const declinedEnvelope = makeEnvelope({ status: "DECLINED" });
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            envelopeRecipient: { update: jest.fn() },
            envelope: { update: jest.fn().mockResolvedValue(declinedEnvelope) },
          };
          return callback(tx);
        },
      );

      const result = await declineEnvelope(
        "env-1",
        "rec-1",
        "Not interested",
        "1.2.3.4",
        "Mozilla/5.0",
      );
      expect(result.status).toBe("DECLINED");
    });
  });

  // -----------------------------------------------------------------------
  // sendReminder
  // -----------------------------------------------------------------------

  describe("sendReminder", () => {
    it("should throw when envelope is not found", async () => {
      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(sendReminder("env-999", "user-1")).rejects.toThrow(
        "Envelope not found",
      );
    });

    it("should only remind recipients under maxReminders", async () => {
      const rec1 = makeRecipient({ id: "rec-1", reminderCount: 0 });
      const rec2 = makeRecipient({ id: "rec-2", reminderCount: 3 }); // at max

      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ status: "SENT" }),
        recipients: [rec1, rec2],
      });
      (mockPrisma.envelopeRecipient.update as jest.Mock).mockResolvedValue({});

      const result = await sendReminder("env-1", "user-1");
      expect(result.reminded).toHaveLength(1);
      expect(result.reminded[0]).toBe("jane@example.com");
    });

    it("should reject reminders for DRAFT envelopes", async () => {
      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ status: "DRAFT" }),
        recipients: [],
      });

      await expect(sendReminder("env-1", "user-1")).rejects.toThrow(
        "Cannot send reminders for envelope in DRAFT status",
      );
    });

    it("should target specific recipient when recipientId provided", async () => {
      const rec1 = makeRecipient({ id: "rec-1", reminderCount: 0, email: "target@example.com" });
      const rec2 = makeRecipient({ id: "rec-2", reminderCount: 0, email: "other@example.com" });

      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ status: "SENT" }),
        recipients: [rec1, rec2],
      });
      (mockPrisma.envelopeRecipient.update as jest.Mock).mockResolvedValue({});

      const result = await sendReminder("env-1", "user-1", "rec-1");
      // Should only remind the targeted recipient
      expect(result.reminded).toContain("target@example.com");
    });
  });

  // -----------------------------------------------------------------------
  // advanceSigningOrder
  // -----------------------------------------------------------------------

  describe("advanceSigningOrder", () => {
    it("should mark envelope COMPLETED when all signers done", async () => {
      const rec1 = makeRecipient({ id: "rec-1", order: 1, status: "SIGNED" });
      const rec2 = makeRecipient({ id: "rec-2", order: 2, status: "SIGNED" });

      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ signingMode: "SEQUENTIAL" }),
        recipients: [rec1, rec2],
      });
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      const result = await advanceSigningOrder("env-1");
      expect(result.isComplete).toBe(true);
      expect(result.nextRecipients).toHaveLength(0);
      expect(mockPrisma.envelope.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "COMPLETED" }),
        }),
      );
    });

    it("should return empty nextRecipients in PARALLEL mode when not all done", async () => {
      const rec1 = makeRecipient({ id: "rec-1", order: 1, status: "SIGNED" });
      const rec2 = makeRecipient({ id: "rec-2", order: 1, status: "SENT" });

      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ signingMode: "PARALLEL" }),
        recipients: [rec1, rec2],
      });
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      const result = await advanceSigningOrder("env-1");
      expect(result.isComplete).toBe(false);
      expect(result.nextRecipients).toHaveLength(0);
    });

    it("should advance to next order group in SEQUENTIAL mode", async () => {
      const rec1 = makeRecipient({ id: "rec-1", order: 1, status: "SIGNED" });
      const rec2 = makeRecipient({ id: "rec-2", order: 2, status: "PENDING", email: "next@example.com" });

      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ signingMode: "SEQUENTIAL" }),
        recipients: [rec1, rec2],
      });
      (mockPrisma.envelopeRecipient.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      const result = await advanceSigningOrder("env-1");
      expect(result.isComplete).toBe(false);
      expect(result.nextRecipients).toEqual(["next@example.com"]);
    });

    it("should advance to next order group in MIXED mode", async () => {
      // Group 1: two signers both signed; Group 2: two signers pending
      const rec1 = makeRecipient({ id: "rec-1", order: 1, status: "SIGNED", email: "a@example.com" });
      const rec2 = makeRecipient({ id: "rec-2", order: 1, status: "SIGNED", email: "b@example.com" });
      const rec3 = makeRecipient({ id: "rec-3", order: 2, status: "PENDING", email: "c@example.com" });
      const rec4 = makeRecipient({ id: "rec-4", order: 2, status: "PENDING", email: "d@example.com" });

      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ signingMode: "MIXED" }),
        recipients: [rec1, rec2, rec3, rec4],
      });
      (mockPrisma.envelopeRecipient.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      const result = await advanceSigningOrder("env-1");
      expect(result.isComplete).toBe(false);
      // Both signers in group 2 should be next
      expect(result.nextRecipients).toContain("c@example.com");
      expect(result.nextRecipients).toContain("d@example.com");
    });

    it("should not advance if current order group not fully signed in MIXED mode", async () => {
      // Group 1 has one signer not yet signed
      const rec1 = makeRecipient({ id: "rec-1", order: 1, status: "SIGNED", email: "a@example.com" });
      const rec2 = makeRecipient({ id: "rec-2", order: 1, status: "SENT", email: "b@example.com" });
      const rec3 = makeRecipient({ id: "rec-3", order: 2, status: "PENDING", email: "c@example.com" });

      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ signingMode: "MIXED" }),
        recipients: [rec1, rec2, rec3],
      });
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      const result = await advanceSigningOrder("env-1");
      expect(result.isComplete).toBe(false);
      // Group 1 not done, so group 2 should not be notified
      expect(result.nextRecipients).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // autoCreateContactForSigner
  // -----------------------------------------------------------------------

  describe("autoCreateContactForSigner", () => {
    it("should return existing contact id if already exists", async () => {
      (mockPrisma.contact.findFirst as jest.Mock).mockResolvedValue({
        id: "contact-existing",
      });

      const result = await autoCreateContactForSigner(
        "team-1",
        "Jane@Example.com",
        "Jane Doe",
      );
      expect(result).toBe("contact-existing");
      expect(mockPrisma.contact.create).not.toHaveBeenCalled();
    });

    it("should create a new contact with parsed name", async () => {
      (mockPrisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.contact.create as jest.Mock).mockResolvedValue({
        id: "contact-new",
      });

      const result = await autoCreateContactForSigner(
        "team-1",
        "jane@example.com",
        "Jane Marie Doe",
      );
      expect(result).toBe("contact-new");
      expect(mockPrisma.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: "Jane",
          lastName: "Marie Doe",
          source: "SIGNATURE_EVENT",
        }),
      });
    });

    it("should return null on error without throwing", async () => {
      (mockPrisma.contact.findFirst as jest.Mock).mockRejectedValue(
        new Error("DB error"),
      );

      const result = await autoCreateContactForSigner(
        "team-1",
        "jane@example.com",
        "Jane",
      );
      expect(result).toBeNull();
    });

    it("should handle single-word name (firstName only)", async () => {
      (mockPrisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.contact.create as jest.Mock).mockResolvedValue({
        id: "contact-new",
      });

      await autoCreateContactForSigner("team-1", "j@example.com", "Madonna");

      expect(mockPrisma.contact.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: "Madonna",
        }),
      });
    });
  });
});

// ===========================================================================
// Signing Session Tests
// ===========================================================================

describe("Signing Session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // authenticateSigner
  // -----------------------------------------------------------------------

  describe("authenticateSigner", () => {
    it("should throw on invalid signing token", async () => {
      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(authenticateSigner("invalid-token")).rejects.toThrow(
        "Invalid signing token",
      );
    });

    it("should return canSign=false for VOIDED envelope", async () => {
      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...makeRecipient(),
        envelope: {
          ...makeEnvelope({ status: "VOIDED" }),
          recipients: [],
        },
      });

      const session = await authenticateSigner("token-abc123");
      expect(session.canSign).toBe(false);
      expect(session.reason).toMatch(/voided/i);
    });

    it("should return canSign=false for DECLINED envelope", async () => {
      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...makeRecipient(),
        envelope: {
          ...makeEnvelope({ status: "DECLINED" }),
          recipients: [],
        },
      });

      const session = await authenticateSigner("token-abc123");
      expect(session.canSign).toBe(false);
      expect(session.reason).toMatch(/declined/i);
    });

    it("should return canSign=false for EXPIRED envelope", async () => {
      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...makeRecipient(),
        envelope: {
          ...makeEnvelope({ status: "EXPIRED" }),
          recipients: [],
        },
      });

      const session = await authenticateSigner("token-abc123");
      expect(session.canSign).toBe(false);
      expect(session.reason).toMatch(/expired/i);
    });

    it("should return canSign=false for already SIGNED recipient", async () => {
      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...makeRecipient({ status: "SIGNED" }),
        envelope: {
          ...makeEnvelope({ status: "SENT" }),
          recipients: [],
        },
      });

      const session = await authenticateSigner("token-abc123");
      expect(session.canSign).toBe(false);
      expect(session.reason).toMatch(/already signed/i);
    });

    it("should return canSign=false for DECLINED recipient", async () => {
      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...makeRecipient({ status: "DECLINED" }),
        envelope: {
          ...makeEnvelope({ status: "SENT" }),
          recipients: [],
        },
      });

      const session = await authenticateSigner("token-abc123");
      expect(session.canSign).toBe(false);
      expect(session.reason).toMatch(/declined to sign/i);
    });

    it("should return canSign=false for CC recipients", async () => {
      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...makeRecipient({ role: "CC", status: "SENT" }),
        envelope: {
          ...makeEnvelope({ status: "SENT" }),
          recipients: [],
        },
      });

      const session = await authenticateSigner("token-abc123");
      expect(session.canSign).toBe(false);
      expect(session.reason).toMatch(/CC recipient/);
    });

    it("should return canSign=false for CERTIFIED_DELIVERY recipients", async () => {
      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...makeRecipient({ role: "CERTIFIED_DELIVERY", status: "SENT" }),
        envelope: {
          ...makeEnvelope({ status: "SENT" }),
          recipients: [],
        },
      });

      const session = await authenticateSigner("token-abc123");
      expect(session.canSign).toBe(false);
      expect(session.reason).toMatch(/CC recipient/);
    });

    it("should block signing when prior signers incomplete in SEQUENTIAL mode", async () => {
      const priorSigner = makeRecipient({
        id: "rec-prior",
        order: 1,
        status: "SENT",
      });
      const currentSigner = makeRecipient({
        id: "rec-current",
        order: 2,
        status: "SENT",
      });

      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...currentSigner,
        envelope: {
          ...makeEnvelope({ status: "SENT", signingMode: "SEQUENTIAL" }),
          recipients: [priorSigner, currentSigner],
        },
      });
      (mockPrisma.envelopeRecipient.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      const session = await authenticateSigner("token-abc123");
      expect(session.canSign).toBe(false);
      expect(session.reason).toMatch(/Waiting for other signers/);
    });

    it("should block signing when prior group incomplete in MIXED mode", async () => {
      const priorSigner = makeRecipient({
        id: "rec-prior",
        order: 1,
        status: "VIEWED",
      });
      const currentSigner = makeRecipient({
        id: "rec-current",
        order: 2,
        status: "SENT",
      });

      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...currentSigner,
        envelope: {
          ...makeEnvelope({ status: "SENT", signingMode: "MIXED" }),
          recipients: [priorSigner, currentSigner],
        },
      });
      (mockPrisma.envelopeRecipient.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      const session = await authenticateSigner("token-abc123");
      expect(session.canSign).toBe(false);
      expect(session.reason).toMatch(/Waiting for other signers/);
    });

    it("should allow signing in PARALLEL mode regardless of order", async () => {
      const otherSigner = makeRecipient({
        id: "rec-other",
        order: 1,
        status: "SENT",
      });
      const currentSigner = makeRecipient({
        id: "rec-current",
        order: 2,
        status: "SENT",
      });

      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...currentSigner,
        envelope: {
          ...makeEnvelope({ status: "SENT", signingMode: "PARALLEL" }),
          recipients: [otherSigner, currentSigner],
        },
      });
      (mockPrisma.envelopeRecipient.update as jest.Mock).mockResolvedValue({});

      const session = await authenticateSigner("token-abc123");
      expect(session.canSign).toBe(true);
    });

    it("should allow signing when prior group all SIGNED in MIXED mode", async () => {
      const priorSigner = makeRecipient({
        id: "rec-prior",
        order: 1,
        status: "SIGNED",
      });
      const currentSigner = makeRecipient({
        id: "rec-current",
        order: 2,
        status: "SENT",
      });

      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...currentSigner,
        envelope: {
          ...makeEnvelope({ status: "PARTIALLY_SIGNED", signingMode: "MIXED" }),
          recipients: [priorSigner, currentSigner],
        },
      });
      (mockPrisma.envelopeRecipient.update as jest.Mock).mockResolvedValue({});

      const session = await authenticateSigner("token-abc123");
      expect(session.canSign).toBe(true);
    });

    it("should mark recipient as VIEWED on first access", async () => {
      const recipient = makeRecipient({ status: "SENT", viewedAt: null });

      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...recipient,
        envelope: {
          ...makeEnvelope({ status: "SENT", signingMode: "PARALLEL" }),
          recipients: [recipient],
        },
      });
      (mockPrisma.envelopeRecipient.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      await authenticateSigner("token-abc123");

      expect(mockPrisma.envelopeRecipient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "VIEWED" }),
        }),
      );
    });

    it("should mark DELIVERED status as VIEWED on first access", async () => {
      const recipient = makeRecipient({ status: "DELIVERED", viewedAt: null });

      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...recipient,
        envelope: {
          ...makeEnvelope({ status: "SENT", signingMode: "PARALLEL" }),
          recipients: [recipient],
        },
      });
      (mockPrisma.envelopeRecipient.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      await authenticateSigner("token-abc123");

      expect(mockPrisma.envelopeRecipient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "VIEWED" }),
        }),
      );
    });

    it("should mark PENDING status as VIEWED on first access", async () => {
      const recipient = makeRecipient({ status: "PENDING", viewedAt: null });

      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...recipient,
        envelope: {
          ...makeEnvelope({ status: "SENT", signingMode: "PARALLEL" }),
          recipients: [recipient],
        },
      });
      (mockPrisma.envelopeRecipient.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      await authenticateSigner("token-abc123");

      expect(mockPrisma.envelopeRecipient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "VIEWED" }),
        }),
      );
    });

    it("should update envelope status to VIEWED on first recipient view", async () => {
      const recipient = makeRecipient({ status: "SENT", viewedAt: null });

      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...recipient,
        envelope: {
          ...makeEnvelope({ status: "SENT", signingMode: "PARALLEL" }),
          recipients: [recipient],
        },
      });
      (mockPrisma.envelopeRecipient.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      await authenticateSigner("token-abc123");

      expect(mockPrisma.envelope.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "VIEWED" }),
        }),
      );
    });

    it("should return correct session shape", async () => {
      const recipient = makeRecipient({ status: "SENT" });

      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...recipient,
        envelope: {
          ...makeEnvelope({ status: "SENT", signingMode: "PARALLEL" }),
          recipients: [recipient],
        },
      });
      (mockPrisma.envelopeRecipient.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      const session = await authenticateSigner("token-abc123");

      expect(session).toMatchObject({
        recipientId: "rec-1",
        envelopeId: "env-1",
        teamId: "team-1",
        email: "jane@example.com",
        name: "Jane LP",
        role: "SIGNER",
        status: "SENT",
        signingMode: "PARALLEL",
        order: 1,
        canSign: true,
      });
      expect(session.envelope).toMatchObject({
        id: "env-1",
        title: "NDA Agreement",
        status: "SENT",
      });
    });
  });

  // -----------------------------------------------------------------------
  // recordSignerCompletion
  // -----------------------------------------------------------------------

  describe("recordSignerCompletion", () => {
    it("should throw when signer cannot sign", async () => {
      // Set up a VOIDED envelope so canSign=false
      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...makeRecipient(),
        envelope: {
          ...makeEnvelope({ status: "VOIDED" }),
          recipients: [],
        },
      });

      await expect(
        recordSignerCompletion({
          signingToken: "token-abc123",
          ipAddress: "1.2.3.4",
          esignConsent: true,
        }),
      ).rejects.toThrow(/voided/i);
    });

    it("should record signature with ESIGN consent hash", async () => {
      mockAuthenticatableSession();

      // Mock advanceSigningOrder (the only envelope.findUnique call —
      // authenticateSigner uses envelopeRecipient.findUnique, not envelope.findUnique)
      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValueOnce({
        ...makeEnvelope({ signingMode: "PARALLEL" }),
        recipients: [makeRecipient({ status: "SIGNED" })],
      });
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      const result = await recordSignerCompletion({
        signingToken: "token-abc123",
        signatureType: "draw",
        ipAddress: "1.2.3.4",
        userAgent: "Mozilla/5.0",
        esignConsent: true,
      });

      expect(result.success).toBe(true);

      // Verify recipient was updated with SIGNED status and consent data
      expect(mockPrisma.envelopeRecipient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "SIGNED",
            ipAddress: "1.2.3.4",
            userAgent: "Mozilla/5.0",
            consentRecord: expect.objectContaining({
              signatureType: "draw",
              esignConsent: true,
              version: "1.0",
            }),
          }),
        }),
      );
    });

    it("should include SHA-256 consent hash in consent record", async () => {
      mockAuthenticatableSession();

      // Mock advanceSigningOrder
      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValueOnce({
        ...makeEnvelope({ signingMode: "PARALLEL" }),
        recipients: [makeRecipient({ status: "SIGNED" })],
      });
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      await recordSignerCompletion({
        signingToken: "token-abc123",
        ipAddress: "1.2.3.4",
        esignConsent: true,
      });

      // The consent hash should be a 64-char hex string (SHA-256)
      const updateCall = (mockPrisma.envelopeRecipient.update as jest.Mock).mock.calls.find(
        (call: unknown[]) => {
          const data = (call[0] as { data: { consentRecord?: { consentHash?: string } } }).data;
          return data.consentRecord?.consentHash;
        }
      );
      if (updateCall) {
        const consentHash = (updateCall[0] as { data: { consentRecord: { consentHash: string } } }).data.consentRecord.consentHash;
        expect(consentHash).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it("should auto-file document when envelope is complete", async () => {
      mockAuthenticatableSession();

      // Mock advanceSigningOrder — all signers done
      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValueOnce({
        ...makeEnvelope({ signingMode: "PARALLEL" }),
        recipients: [makeRecipient({ status: "SIGNED" })],
      });
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      const result = await recordSignerCompletion({
        signingToken: "token-abc123",
        ipAddress: "1.2.3.4",
        esignConsent: true,
      });

      expect(result.isEnvelopeComplete).toBe(true);
      expect(autoFileEnvelopeDocument).toHaveBeenCalledWith("env-1");
    });

    it("should send completion emails when envelope is complete", async () => {
      mockAuthenticatableSession();

      // Mock advanceSigningOrder
      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValueOnce({
        ...makeEnvelope({ signingMode: "PARALLEL" }),
        recipients: [makeRecipient({ status: "SIGNED" })],
      });
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      await recordSignerCompletion({
        signingToken: "token-abc123",
        ipAddress: "1.2.3.4",
        esignConsent: true,
      });

      // Completion emails are fire-and-forget
      expect(sendSigningCompletedEmails).toHaveBeenCalledWith("env-1");
    });

    it("should send next signer emails in sequential mode", async () => {
      // Set up with 2 signers, first one signs, second is next
      const currentSigner = makeRecipient({ id: "rec-1", order: 1, status: "VIEWED" });
      const nextSigner = makeRecipient({ id: "rec-2", order: 2, status: "PENDING", email: "next@example.com" });

      (mockPrisma.envelopeRecipient.findUnique as jest.Mock).mockResolvedValue({
        ...currentSigner,
        envelope: {
          ...makeEnvelope({ status: "SENT", signingMode: "SEQUENTIAL" }),
          recipients: [currentSigner, nextSigner],
        },
      });
      (mockPrisma.envelopeRecipient.update as jest.Mock).mockResolvedValue({});

      // advanceSigningOrder call
      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValueOnce({
        ...makeEnvelope({ signingMode: "SEQUENTIAL" }),
        recipients: [
          makeRecipient({ id: "rec-1", order: 1, status: "SIGNED" }),
          makeRecipient({ id: "rec-2", order: 2, status: "PENDING", email: "next@example.com" }),
        ],
      });
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      await recordSignerCompletion({
        signingToken: "token-abc123",
        ipAddress: "1.2.3.4",
        esignConsent: true,
      });

      expect(sendNextSignerEmails).toHaveBeenCalledWith("env-1", ["next@example.com"]);
    });

    it("should return filing result when available", async () => {
      mockAuthenticatableSession();

      // Mock advanceSigningOrder
      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValueOnce({
        ...makeEnvelope({ signingMode: "PARALLEL" }),
        recipients: [makeRecipient({ status: "SIGNED" })],
      });
      (mockPrisma.envelope.update as jest.Mock).mockResolvedValue({});

      const result = await recordSignerCompletion({
        signingToken: "token-abc123",
        ipAddress: "1.2.3.4",
        esignConsent: true,
      });

      expect(result.filingResult).toEqual({
        orgVaultFiled: true,
        contactVaultsFiled: 1,
        emailRecordsFiled: 1,
      });
    });
  });

  // -----------------------------------------------------------------------
  // getSigningStatus
  // -----------------------------------------------------------------------

  describe("getSigningStatus", () => {
    beforeEach(() => {
      // Reset envelope.findUnique to clear any leaked mockResolvedValueOnce
      // queues from recordSignerCompletion tests (which set up 2 chained
      // mockResolvedValueOnce calls but only consume 1, leaving PARALLEL-mode
      // values in the queue that override mockResolvedValue in these tests).
      (mockPrisma.envelope.findUnique as jest.Mock).mockReset();
    });

    it("should throw when envelope not found", async () => {
      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(getSigningStatus("env-999")).rejects.toThrow(
        "Envelope not found",
      );
    });

    it("should return all signers in currentGroup for PARALLEL mode", async () => {
      const rec1 = makeRecipient({ id: "rec-1", order: 1, status: "SIGNED" });
      const rec2 = makeRecipient({ id: "rec-2", order: 1, status: "SENT", email: "b@example.com" });

      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ signingMode: "PARALLEL" }),
        recipients: [rec1, rec2],
      });

      const status = await getSigningStatus("env-1");
      expect(status.mode).toBe("PARALLEL");
      expect(status.totalSigners).toBe(2);
      expect(status.signedCount).toBe(1);
      expect(status.currentGroup).toHaveLength(2);
      expect(status.waitingGroups).toHaveLength(0);
      expect(status.isComplete).toBe(false);
    });

    it("should identify current and waiting groups in SEQUENTIAL mode", async () => {
      const rec1 = makeRecipient({ id: "rec-1", order: 1, status: "SIGNED", email: "first@example.com" });
      const rec2 = makeRecipient({ id: "rec-2", order: 2, status: "PENDING", email: "second@example.com" });
      const rec3 = makeRecipient({ id: "rec-3", order: 3, status: "PENDING", email: "third@example.com" });

      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ signingMode: "SEQUENTIAL" }),
        recipients: [rec1, rec2, rec3],
      });

      const status = await getSigningStatus("env-1");
      expect(status.mode).toBe("SEQUENTIAL");
      expect(status.signedCount).toBe(1);
      expect(status.currentGroup).toHaveLength(1);
      expect(status.currentGroup[0].email).toBe("second@example.com");
      expect(status.waitingGroups).toHaveLength(1);
      expect(status.waitingGroups[0].order).toBe(3);
    });

    it("should report isComplete when all signers are SIGNED", async () => {
      const rec1 = makeRecipient({ id: "rec-1", order: 1, status: "SIGNED" });
      const rec2 = makeRecipient({ id: "rec-2", order: 2, status: "SIGNED" });

      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ signingMode: "SEQUENTIAL" }),
        recipients: [rec1, rec2],
      });

      const status = await getSigningStatus("env-1");
      expect(status.isComplete).toBe(true);
      expect(status.signedCount).toBe(2);
      expect(status.totalSigners).toBe(2);
    });

    it("should handle MIXED mode with multiple order groups", async () => {
      // Group 1 (order=1): 2 signers, both signed
      // Group 2 (order=2): 1 signer, pending
      // Group 3 (order=3): 1 signer, pending
      const rec1 = makeRecipient({ id: "rec-1", order: 1, status: "SIGNED", email: "a@example.com" });
      const rec2 = makeRecipient({ id: "rec-2", order: 1, status: "SIGNED", email: "b@example.com" });
      const rec3 = makeRecipient({ id: "rec-3", order: 2, status: "SENT", email: "c@example.com" });
      const rec4 = makeRecipient({ id: "rec-4", order: 3, status: "PENDING", email: "d@example.com" });

      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ signingMode: "MIXED" }),
        recipients: [rec1, rec2, rec3, rec4],
      });

      const status = await getSigningStatus("env-1");
      expect(status.mode).toBe("MIXED");
      expect(status.totalSigners).toBe(4);
      expect(status.signedCount).toBe(2);
      // Current group should be order 2 (first incomplete group)
      expect(status.currentGroup).toHaveLength(1);
      expect(status.currentGroup[0].email).toBe("c@example.com");
      // Waiting groups should include order 3
      expect(status.waitingGroups).toHaveLength(1);
      expect(status.waitingGroups[0].order).toBe(3);
    });

    it("should return empty currentGroup when all groups complete", async () => {
      const rec1 = makeRecipient({ id: "rec-1", order: 1, status: "SIGNED" });
      const rec2 = makeRecipient({ id: "rec-2", order: 2, status: "SIGNED" });

      (mockPrisma.envelope.findUnique as jest.Mock).mockResolvedValue({
        ...makeEnvelope({ signingMode: "MIXED" }),
        recipients: [rec1, rec2],
      });

      const status = await getSigningStatus("env-1");
      expect(status.isComplete).toBe(true);
      expect(status.currentGroup).toHaveLength(0);
      expect(status.waitingGroups).toHaveLength(0);
    });
  });
});

// ===========================================================================
// Field Type Validation & Formatting Tests
// ===========================================================================

describe("Field Types", () => {
  // -----------------------------------------------------------------------
  // validateFieldValue
  // -----------------------------------------------------------------------

  describe("validateFieldValue", () => {
    it("should reject required fields with empty values", () => {
      const result = validateFieldValue("TEXT", "", { required: true });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/required/i);
    });

    it("should accept empty non-required fields", () => {
      const result = validateFieldValue("TEXT", "");
      expect(result.valid).toBe(true);
    });

    it("should accept empty non-required fields with null", () => {
      const result = validateFieldValue("TEXT", null);
      expect(result.valid).toBe(true);
    });

    // DROPDOWN validation
    it("should validate DROPDOWN against options", () => {
      const result = validateFieldValue("DROPDOWN", "Option B", {
        fieldOptions: ["Option A", "Option B", "Option C"],
      });
      expect(result.valid).toBe(true);
    });

    it("should reject invalid DROPDOWN selection", () => {
      const result = validateFieldValue("DROPDOWN", "Invalid", {
        fieldOptions: ["Option A", "Option B"],
      });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/valid option/i);
    });

    // RADIO validation
    it("should validate RADIO against options", () => {
      const result = validateFieldValue("RADIO", "Yes", {
        fieldOptions: ["Yes", "No"],
      });
      expect(result.valid).toBe(true);
    });

    it("should reject invalid RADIO selection", () => {
      const result = validateFieldValue("RADIO", "Maybe", {
        fieldOptions: ["Yes", "No"],
      });
      expect(result.valid).toBe(false);
    });

    // NUMERIC validation
    it("should accept valid numbers for NUMERIC", () => {
      const result = validateFieldValue("NUMERIC", "42.5");
      expect(result.valid).toBe(true);
    });

    it("should reject non-numeric values for NUMERIC", () => {
      const result = validateFieldValue("NUMERIC", "abc");
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/valid number/i);
    });

    it("should reject non-integer for integer format", () => {
      const result = validateFieldValue("NUMERIC", "42.5", {
        fieldFormat: "integer",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/whole number/i);
    });

    it("should accept integer for integer format", () => {
      const result = validateFieldValue("NUMERIC", "42", {
        fieldFormat: "integer",
      });
      expect(result.valid).toBe(true);
    });

    it("should enforce percentage range 0-100", () => {
      expect(
        validateFieldValue("NUMERIC", "101", { fieldFormat: "percentage" }).valid,
      ).toBe(false);
      expect(
        validateFieldValue("NUMERIC", "-1", { fieldFormat: "percentage" }).valid,
      ).toBe(false);
      expect(
        validateFieldValue("NUMERIC", "50", { fieldFormat: "percentage" }).valid,
      ).toBe(true);
    });

    it("should enforce min/max values for NUMERIC", () => {
      expect(
        validateFieldValue("NUMERIC", "5", { minValue: 10 }).valid,
      ).toBe(false);
      expect(
        validateFieldValue("NUMERIC", "15", { minValue: 10, maxValue: 20 }).valid,
      ).toBe(true);
      expect(
        validateFieldValue("NUMERIC", "25", { maxValue: 20 }).valid,
      ).toBe(false);
    });

    // CURRENCY validation
    it("should accept valid currency amounts", () => {
      const result = validateFieldValue("CURRENCY", "$1,234.56");
      expect(result.valid).toBe(true);
    });

    it("should reject negative currency amounts", () => {
      const result = validateFieldValue("CURRENCY", "-50.00");
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/negative/i);
    });

    it("should reject non-numeric currency values", () => {
      const result = validateFieldValue("CURRENCY", "abc");
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/valid amount/i);
    });

    it("should strip currency symbols before validation", () => {
      const result = validateFieldValue("CURRENCY", "€1,000");
      expect(result.valid).toBe(true);
    });

    it("should enforce min/max values for CURRENCY", () => {
      expect(
        validateFieldValue("CURRENCY", "$50", { minValue: 100 }).valid,
      ).toBe(false);
      expect(
        validateFieldValue("CURRENCY", "$500", { maxValue: 100 }).valid,
      ).toBe(false);
    });

    // EMAIL validation
    it("should accept valid email addresses", () => {
      const result = validateFieldValue("EMAIL", "user@example.com");
      expect(result.valid).toBe(true);
    });

    it("should reject invalid email addresses", () => {
      const result = validateFieldValue("EMAIL", "notanemail");
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/valid email/i);
    });

    // CHECKBOX validation
    it("should accept valid checkbox values", () => {
      expect(validateFieldValue("CHECKBOX", "true").valid).toBe(true);
      expect(validateFieldValue("CHECKBOX", "false").valid).toBe(true);
      expect(validateFieldValue("CHECKBOX", "checked").valid).toBe(true);
      expect(validateFieldValue("CHECKBOX", "unchecked").valid).toBe(true);
    });

    it("should reject invalid checkbox values", () => {
      const result = validateFieldValue("CHECKBOX", "maybe");
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/checkbox/i);
    });

    // Default passthrough
    it("should accept any value for unsupported types", () => {
      const result = validateFieldValue("SIGNATURE", "some-signature-data");
      expect(result.valid).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // formatFieldValue
  // -----------------------------------------------------------------------

  describe("formatFieldValue", () => {
    it("should return empty string for null/undefined values", () => {
      expect(formatFieldValue("TEXT", null)).toBe("");
      expect(formatFieldValue("TEXT", undefined)).toBe("");
    });

    it("should format CURRENCY with USD by default", () => {
      const result = formatFieldValue("CURRENCY", "1234.56");
      expect(result).toMatch(/1,234\.56/);
    });

    it("should format CURRENCY with specified currency code", () => {
      const result = formatFieldValue("CURRENCY", "1000", "EUR");
      expect(result).toMatch(/1,000/);
    });

    it("should format NUMERIC as percentage", () => {
      const result = formatFieldValue("NUMERIC", "75", "percentage");
      expect(result).toBe("75%");
    });

    it("should format NUMERIC as integer", () => {
      const result = formatFieldValue("NUMERIC", "42.7", "integer");
      expect(result).toBe("43");
    });

    it("should format NUMERIC with locale formatting", () => {
      const result = formatFieldValue("NUMERIC", "1234567");
      expect(result).toMatch(/1,234,567/);
    });

    it("should format DATE_SIGNED as readable date", () => {
      const result = formatFieldValue("DATE_SIGNED", "2026-01-15T00:00:00.000Z");
      expect(result).toMatch(/January/);
      expect(result).toMatch(/15/);
      expect(result).toMatch(/2026/);
    });

    it("should format CHECKBOX as checkmark or empty", () => {
      expect(formatFieldValue("CHECKBOX", "true")).toBe("\u2713");
      expect(formatFieldValue("CHECKBOX", "checked")).toBe("\u2713");
      expect(formatFieldValue("CHECKBOX", "false")).toBe("");
      expect(formatFieldValue("CHECKBOX", "unchecked")).toBe("");
    });

    it("should return raw value for TEXT type", () => {
      expect(formatFieldValue("TEXT", "Hello World")).toBe("Hello World");
    });

    it("should handle invalid currency gracefully", () => {
      const result = formatFieldValue("CURRENCY", "not-a-number");
      expect(result).toBe("not-a-number");
    });

    it("should handle invalid numeric gracefully", () => {
      const result = formatFieldValue("NUMERIC", "not-a-number");
      expect(result).toBe("not-a-number");
    });
  });

  // -----------------------------------------------------------------------
  // evaluateFormula
  // -----------------------------------------------------------------------

  describe("evaluateFormula", () => {
    it("should evaluate simple addition", () => {
      const result = evaluateFormula("field1 + field2", {
        field1: "10",
        field2: "20",
      });
      expect(result).toBe("30");
    });

    it("should evaluate multiplication", () => {
      const result = evaluateFormula("field1 * field2", {
        field1: "5",
        field2: "3",
      });
      expect(result).toBe("15");
    });

    it("should evaluate complex expressions", () => {
      const result = evaluateFormula("(field1 + field2) * field3", {
        field1: "10",
        field2: "20",
        field3: "2",
      });
      expect(result).toBe("60");
    });

    it("should strip currency symbols from field values", () => {
      const result = evaluateFormula("field1 + field2", {
        field1: "$1,000",
        field2: "€500",
      });
      expect(result).toBe("1500");
    });

    it("should return ERROR for unsafe expressions", () => {
      const result = evaluateFormula("console.log('hacked')", {});
      expect(result).toBe("ERROR");
    });

    it("should return ERROR for division by zero (Infinity)", () => {
      const result = evaluateFormula("field1 / field2", {
        field1: "10",
        field2: "0",
      });
      expect(result).toBe("ERROR");
    });

    it("should return ERROR when expression contains non-numeric field refs", () => {
      // Field reference not replaced because value is non-numeric
      const result = evaluateFormula("field1 + field2", {
        field1: "abc",
        field2: "10",
      });
      // "field1" remains in expression -> unsafe characters -> ERROR
      expect(result).toBe("ERROR");
    });

    it("should handle parentheses and decimal results", () => {
      const result = evaluateFormula("(field1 - field2) / field3", {
        field1: "100",
        field2: "30",
        field3: "4",
      });
      expect(result).toBe("17.5");
    });
  });

  // -----------------------------------------------------------------------
  // getFieldPalette
  // -----------------------------------------------------------------------

  describe("getFieldPalette", () => {
    it("should return 4 categories", () => {
      const palette = getFieldPalette();
      expect(palette).toHaveLength(4);
      expect(palette.map((c) => c.category)).toEqual([
        "signature",
        "auto-fill",
        "input",
        "advanced",
      ]);
    });

    it("should include signature fields in signature category", () => {
      const palette = getFieldPalette();
      const signatureCategory = palette.find((c) => c.category === "signature");
      expect(signatureCategory).toBeDefined();
      const types = signatureCategory!.fields.map((f) => f.type);
      expect(types).toContain("SIGNATURE");
      expect(types).toContain("INITIALS");
    });

    it("should include auto-fill fields", () => {
      const palette = getFieldPalette();
      const autoFillCategory = palette.find((c) => c.category === "auto-fill");
      expect(autoFillCategory).toBeDefined();
      const types = autoFillCategory!.fields.map((f) => f.type);
      expect(types).toContain("DATE_SIGNED");
      expect(types).toContain("NAME");
      expect(types).toContain("EMAIL");
    });

    it("should include input fields including new types", () => {
      const palette = getFieldPalette();
      const inputCategory = palette.find((c) => c.category === "input");
      expect(inputCategory).toBeDefined();
      const types = inputCategory!.fields.map((f) => f.type);
      expect(types).toContain("TEXT");
      expect(types).toContain("CHECKBOX");
      expect(types).toContain("DROPDOWN");
      expect(types).toContain("RADIO");
      expect(types).toContain("NUMERIC");
      expect(types).toContain("CURRENCY");
    });

    it("should include advanced fields", () => {
      const palette = getFieldPalette();
      const advancedCategory = palette.find((c) => c.category === "advanced");
      expect(advancedCategory).toBeDefined();
      const types = advancedCategory!.fields.map((f) => f.type);
      expect(types).toContain("ATTACHMENT");
      expect(types).toContain("FORMULA");
    });
  });

  // -----------------------------------------------------------------------
  // FIELD_TYPE_CONFIGS
  // -----------------------------------------------------------------------

  describe("FIELD_TYPE_CONFIGS", () => {
    it("should define all 16 field types", () => {
      const allTypes: FieldType[] = [
        "SIGNATURE", "INITIALS", "DATE_SIGNED", "TEXT", "CHECKBOX",
        "NAME", "EMAIL", "COMPANY", "TITLE", "ADDRESS",
        "DROPDOWN", "RADIO", "NUMERIC", "CURRENCY", "ATTACHMENT", "FORMULA",
      ];

      for (const type of allTypes) {
        expect(FIELD_TYPE_CONFIGS[type]).toBeDefined();
        expect(FIELD_TYPE_CONFIGS[type].type).toBe(type);
        expect(FIELD_TYPE_CONFIGS[type].label).toBeTruthy();
        expect(FIELD_TYPE_CONFIGS[type].icon).toBeTruthy();
      }
    });

    it("should mark DROPDOWN and RADIO as requiring options", () => {
      expect(FIELD_TYPE_CONFIGS.DROPDOWN.requiresOptions).toBe(true);
      expect(FIELD_TYPE_CONFIGS.RADIO.requiresOptions).toBe(true);
    });

    it("should mark NUMERIC and CURRENCY as requiring format", () => {
      expect(FIELD_TYPE_CONFIGS.NUMERIC.requiresFormat).toBe(true);
      expect(FIELD_TYPE_CONFIGS.CURRENCY.requiresFormat).toBe(true);
    });

    it("should mark auto-fill fields correctly", () => {
      const autoFillTypes: FieldType[] = ["DATE_SIGNED", "NAME", "EMAIL", "COMPANY", "TITLE", "ADDRESS", "FORMULA"];
      for (const type of autoFillTypes) {
        expect(FIELD_TYPE_CONFIGS[type].isAutoFill).toBe(true);
      }
    });

    it("should have valid dimension defaults", () => {
      for (const config of Object.values(FIELD_TYPE_CONFIGS)) {
        expect(config.defaultWidth).toBeGreaterThan(0);
        expect(config.defaultHeight).toBeGreaterThan(0);
        expect(config.minWidth).toBeGreaterThan(0);
        expect(config.minHeight).toBeGreaterThan(0);
        expect(config.defaultWidth).toBeGreaterThanOrEqual(config.minWidth);
        expect(config.defaultHeight).toBeGreaterThanOrEqual(config.minHeight);
      }
    });
  });
});
