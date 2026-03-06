import { z } from "zod";

/**
 * Fund-Related Validation Schemas
 *
 * Shared Zod schemas for funding rounds and manual investments.
 */

const MAX_AMOUNT = 100_000_000_000;

/** Parse decimal value from string or number (matches route's parseDecimal logic) */
const parseDecimalVal = (val: unknown): number | undefined => {
  if (val === undefined || val === null || val === "") return undefined;
  const n =
    typeof val === "string"
      ? parseFloat(String(val).replace(/[^0-9.-]/g, ""))
      : Number(val);
  return isNaN(n) ? undefined : n;
};

/** Optional decimal amount — accepts number or currency string like "$1,000" */
const optionalDecimalSchema = z.preprocess(
  parseDecimalVal,
  z.number().min(0).max(MAX_AMOUNT).optional(),
);

/** Date string (ISO 8601 or parseable date) */
const dateStringSchema = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" });

// ---------------------------------------------------------------------------
// Funding Rounds (Startup mode)
// POST /api/teams/[teamId]/funds/[fundId]/funding-rounds
// ---------------------------------------------------------------------------

/** Accepted instrument types — includes both display names and enum values */
const VALID_INSTRUMENT_TYPES = [
  "SAFE",
  "Convertible Note",
  "Priced Round",
  "CONVERTIBLE_NOTE",
  "PRICED_ROUND",
] as const;

export const FundingRoundCreateSchema = z.object({
  roundName: z.string().min(1, "Round name is required").max(100),
  status: z
    .enum(["PLANNED", "ACTIVE", "COMPLETED"])
    .optional()
    .default("PLANNED"),
  instrumentType: z.enum(VALID_INSTRUMENT_TYPES).optional().nullable(),
  targetAmount: optionalDecimalSchema,
  amountRaised: optionalDecimalSchema,
  preMoneyVal: optionalDecimalSchema,
  postMoneyVal: optionalDecimalSchema,
  valuationCap: optionalDecimalSchema,
  discount: z.preprocess(
    parseDecimalVal,
    z.number().min(0).max(100).optional(),
  ),
  leadInvestor: z.string().max(255).optional().nullable(),
  investorCount: z.coerce.number().int().min(0).optional(),
  roundDate: dateStringSchema.optional().nullable(),
  closeDate: dateStringSchema.optional().nullable(),
  roundOrder: z.coerce.number().int().min(1).optional(),
  isExternal: z.boolean().optional(),
  externalNotes: z.string().max(2000).optional().nullable(),
});

export const FundingRoundUpdateSchema = FundingRoundCreateSchema.partial();

export type FundingRoundCreateInput = z.infer<typeof FundingRoundCreateSchema>;
export type FundingRoundUpdateInput = z.infer<typeof FundingRoundUpdateSchema>;

// ---------------------------------------------------------------------------
// Manual Investment (GP creates on behalf of LP)
// POST /api/admin/manual-investment
// ---------------------------------------------------------------------------

export const ManualInvestmentSchema = z.object({
  investorId: z.string().uuid(),
  fundId: z.string().uuid(),
  documentType: z.string().min(1).max(50),
  documentTitle: z.string().min(1).max(255),
  documentNumber: z.string().max(100).optional().nullable(),
  commitmentAmount: z.coerce.number().positive().max(MAX_AMOUNT),
  fundedAmount: z.coerce.number().min(0).max(MAX_AMOUNT).optional().default(0),
  units: z.coerce.number().min(0).optional().nullable(),
  shares: z.coerce.number().min(0).optional().nullable(),
  pricePerUnit: z.coerce.number().min(0).max(MAX_AMOUNT).optional().nullable(),
  ownershipPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  signedDate: dateStringSchema,
  effectiveDate: dateStringSchema.optional().nullable(),
  fundedDate: dateStringSchema.optional().nullable(),
  maturityDate: dateStringSchema.optional().nullable(),
  transferMethod: z.string().max(50).optional().nullable(),
  transferStatus: z.string().max(50).optional().default("PENDING"),
  transferDate: dateStringSchema.optional().nullable(),
  transferRef: z.string().max(255).optional().nullable(),
  bankName: z.string().max(255).optional().nullable(),
  accountLast4: z.string().max(4).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type ManualInvestmentInput = z.infer<typeof ManualInvestmentSchema>;
