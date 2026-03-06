import { z } from "zod";

/**
 * Wire Transfer Validation Schemas
 *
 * Shared Zod schemas for wire proof upload and GP wire confirmation.
 */

const MAX_AMOUNT = 100_000_000_000;

/** Date string that is not in the future (with 1-day tolerance) */
const pastOrPresentDateSchema = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" })
  .refine(
    (val) => new Date(val).getTime() <= Date.now() + 86_400_000,
    { message: "Date cannot be in the future" },
  );

// ---------------------------------------------------------------------------
// Wire Proof Upload (POST /api/lp/wire-proof)
// ---------------------------------------------------------------------------

/**
 * LP wire proof upload input.
 * investmentId can be either a regular Investment ID or a ManualInvestment ID
 * (not necessarily a UUID — may use newId() format).
 */
export const WireProofSchema = z.object({
  investmentId: z.string().min(1, "Investment ID is required"),
  storageKey: z.string().min(1).max(1024),
  storageType: z.string().min(1).max(50),
  fileType: z.string().min(1).max(100),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().nonnegative().max(25 * 1024 * 1024).optional(),
  notes: z.string().max(500).optional(),
  bankReference: z.string().max(100).optional(),
  amountSent: z.number().finite().min(0).max(MAX_AMOUNT).optional().nullable(),
  wireDateInitiated: pastOrPresentDateSchema.optional(),
});

export type WireProofInput = z.infer<typeof WireProofSchema>;

// ---------------------------------------------------------------------------
// GP Wire Confirmation (POST /api/admin/wire/confirm)
// ---------------------------------------------------------------------------

export const WireConfirmSchema = z.object({
  transactionId: z.string().min(1, "transactionId is required"),
  teamId: z.string().min(1, "teamId is required"),
  fundsReceivedDate: z
    .string()
    .min(1, "fundsReceivedDate is required")
    .refine((val) => !isNaN(new Date(val).getTime()), "Invalid fundsReceivedDate")
    .refine((val) => {
      const d = new Date(val);
      const max = new Date();
      max.setDate(max.getDate() + 7);
      return d <= max;
    }, "fundsReceivedDate cannot be more than 7 days in the future"),
  amountReceived: z
    .number()
    .positive("amountReceived must be a positive number")
    .max(MAX_AMOUNT, "amountReceived exceeds maximum allowed ($100B)"),
  bankReference: z.string().max(100, "bankReference exceeds 100 characters").optional(),
  confirmationNotes: z.string().max(1000, "confirmationNotes exceeds 1000 characters").optional(),
  confirmationProofDocumentId: z.string().optional(),
});

export type WireConfirmInput = z.infer<typeof WireConfirmSchema>;
