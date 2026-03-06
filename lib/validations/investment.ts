import { z } from "zod";

/**
 * Investment & Commitment Validation Schemas
 *
 * Shared Zod schemas for all investment-related API routes.
 * Max amount: $100 billion (100_000_000_000).
 */

const MAX_AMOUNT = 100_000_000_000;

// ---------------------------------------------------------------------------
// Common field validators
// ---------------------------------------------------------------------------

/** Non-negative financial amount, capped at $100B */
export const amountSchema = z.number().min(0).max(MAX_AMOUNT);

/** Positive financial amount (> 0), capped at $100B */
export const positiveAmountSchema = z.number().positive().max(MAX_AMOUNT);

/** UUID string */
export const uuidSchema = z.string().uuid();

/** Optional UUID string */
export const optionalUuidSchema = z.string().uuid().optional().nullable();

/** Date string (ISO 8601 or parseable date) */
export const dateStringSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: "Invalid date format" },
);

// ---------------------------------------------------------------------------
// LP Commitment / Subscribe (POST /api/lp/subscribe)
// ---------------------------------------------------------------------------

/**
 * SEC investor representations — stored as a flexible record in fundData.
 * Route enforces max 20 keys as DoS protection.
 */
export const RepresentationsSchema = z
  .record(z.string(), z.unknown())
  .refine((obj) => Object.keys(obj).length <= 20, "Too many representation fields")
  .optional()
  .nullable();

/**
 * LP commitment / subscription input.
 * amount/units accept strings (client may send "25000") — coerced to number.
 */
export const CommitmentSchema = z.object({
  fundId: uuidSchema,
  amount: z.coerce.number().positive().max(MAX_AMOUNT),
  units: z.coerce.number().int().positive().optional().nullable(),
  tierId: z.string().uuid().optional().nullable(),
  representations: RepresentationsSchema,
  /** 506(c) extras */
  noThirdPartyFinancing: z.boolean().optional(),
  sourceOfFunds: z.string().max(50).optional(),
  occupation: z.string().max(255).optional(),
});

export type CommitmentInput = z.infer<typeof CommitmentSchema>;

// ---------------------------------------------------------------------------
// Staged Commitment / Tranches (POST /api/lp/staged-commitment)
// ---------------------------------------------------------------------------

/** Single tranche in a staged commitment. Matches CommitmentTranche interface. */
export const StagedTrancheSchema = z.object({
  amount: positiveAmountSchema,
  scheduledDate: z.string().min(1, "Scheduled date is required"),
  label: z.string().max(255).optional().default(""),
});

/**
 * Staged commitment input.
 * fundId comes from the investor profile, NOT the request body.
 */
export const StagedCommitmentSchema = z.object({
  totalCommitment: positiveAmountSchema,
  tranches: z.array(StagedTrancheSchema).min(2).max(12),
  schedule: z.string().max(100).optional(),
  confirmTerms: z.literal(true, {
    errorMap: () => ({ message: "You must confirm the commitment terms" }),
  }),
});

export type StagedCommitmentInput = z.infer<typeof StagedCommitmentSchema>;
