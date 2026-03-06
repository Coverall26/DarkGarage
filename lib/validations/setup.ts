import { z } from "zod";

/**
 * GP Setup Wizard Validation Schemas
 *
 * Shared Zod schemas for the 9-step Organization Setup Wizard
 * and its completion endpoint.
 */

const MAX_AMOUNT = 100_000_000_000;

/**
 * Preprocessor that coerces string/number input to a number,
 * stripping non-numeric characters (e.g. "$1,000" → 1000).
 * Returns undefined for empty/null/unparseable values.
 */
const coerceAmount = (val: unknown): number | undefined => {
  if (val === undefined || val === null || val === "") return undefined;
  const n =
    typeof val === "string"
      ? parseFloat(String(val).replace(/[^0-9.-]/g, ""))
      : Number(val);
  return isNaN(n) ? undefined : n;
};

/** Optional amount field: coerced, min 0, max 100B */
const optAmount = z
  .preprocess(coerceAmount, z.number().min(0).max(MAX_AMOUNT).optional())
  .optional()
  .nullable();

/** Optional positive amount field: coerced, >0, max 100B */
const optPositiveAmount = z
  .preprocess(
    coerceAmount,
    z.number().positive().max(MAX_AMOUNT).optional(),
  )
  .optional()
  .nullable();

/** Optional percentage field: coerced, 0–100 */
const optPercent = z
  .preprocess(coerceAmount, z.number().min(0).max(100).optional())
  .optional()
  .nullable();

/** Optional integer field: coerced, min 0 */
const optInt = z
  .preprocess(coerceAmount, z.number().int().min(0).optional())
  .optional()
  .nullable();

// ---------------------------------------------------------------------------
// Setup: Save Step Progress (POST /api/setup)
// ---------------------------------------------------------------------------

export const SetupStepSchema = z.object({
  step: z.coerce.number().int().min(0).max(8),
  data: z.record(z.string(), z.unknown()),
});
export type SetupStepInput = z.infer<typeof SetupStepSchema>;

// ---------------------------------------------------------------------------
// Setup: Complete Wizard (POST /api/setup/complete)
// ---------------------------------------------------------------------------

const PlannedRoundSchema = z.object({
  roundName: z.string().max(200).optional(),
  targetAmount: optPositiveAmount,
  instrumentType: z.string().max(50).optional().nullable(),
  valuationCap: optPositiveAmount,
  discount: optPercent,
  notes: z.string().max(2000).optional().nullable(),
});

const PricingTierSchema = z.object({
  tranche: z.preprocess(coerceAmount, z.number().int().min(0)),
  name: z.string().max(200).optional().nullable(),
  pricePerUnit: z.preprocess(coerceAmount, z.number().positive().max(MAX_AMOUNT)),
  unitsAvailable: z.preprocess(coerceAmount, z.number().int().min(0).max(1_000_000_000)),
});

export const SetupCompleteSchema = z.object({
  // Step 1: Company Info (required)
  companyName: z.string().min(1, "Company name is required").max(255),
  entityType: z.string().max(50).optional().nullable(),
  ein: z.string().max(20).optional().nullable(),
  contactPhone: z.string().max(30).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  country: z.string().max(10).optional().nullable(),
  legalName: z.string().max(255).optional().nullable(),
  yearIncorporated: z.preprocess(coerceAmount, z.number().int().min(1800).max(2100).optional()).optional().nullable(),
  jurisdiction: z.string().max(100).optional().nullable(),
  previousNames: z.string().max(1000).optional().nullable(),
  previousNamesList: z.array(z.string().max(255)).max(20).optional(),
  relatedPersons: z.array(z.record(z.string(), z.unknown())).max(50).optional(),
  contactName: z.string().max(255).optional().nullable(),
  contactEmail: z.string().max(254).optional().nullable(),
  badActorCertified: z.boolean().optional(),
  description: z.string().max(5000).optional().nullable(),

  // Step 2: Branding
  logoUrl: z.string().max(2048).optional().nullable(),
  brandColor: z.string().max(20).optional().nullable(),
  accentColor: z.string().max(20).optional().nullable(),
  sector: z.string().max(100).optional().nullable(),
  geography: z.string().max(100).optional().nullable(),
  website: z.string().max(2048).optional().nullable(),
  foundedYear: z.preprocess(coerceAmount, z.number().int().min(1800).max(2100).optional()).optional().nullable(),

  // Step 3: Raise Style
  raiseMode: z.enum(["GP_FUND", "STARTUP", "DATAROOM_ONLY"]).optional().nullable(),
  regDExemption: z.string().max(20).optional().nullable(),
  formDReminder: z.boolean().optional(),

  // Step 4: Team
  inviteEmails: z.array(z.string().max(254)).max(50).optional(),
  inviteRoles: z.array(z.string().max(50)).max(50).optional(),

  // Step 5: Fund Details — GP
  fundName: z.string().max(255).optional().nullable(),
  targetRaise: optPositiveAmount,
  minInvestment: optAmount,
  mgmtFee: optPercent,
  carry: optPercent,
  hurdle: optPercent,
  fundTerm: optInt,
  extensionYears: optInt,
  waterfallType: z.string().max(50).optional().nullable(),
  fundStrategy: z.string().max(50).optional().nullable(),
  currency: z.string().max(10).optional().nullable(),

  // Step 5: Fund Details — Startup instrument
  instrumentType: z.string().max(50).optional().nullable(),
  safeType: z.string().max(50).optional().nullable(),
  valCap: optPositiveAmount,
  discount: optPercent,
  interestRate: z.preprocess(coerceAmount, z.number().min(0).max(30).optional()).optional().nullable(),
  maturityDate: z.string().max(30).optional().nullable(),
  qualFinancing: optPositiveAmount,
  preMoneyVal: optPositiveAmount,
  liqPref: z.string().max(50).optional().nullable(),
  antiDilution: z.string().max(50).optional().nullable(),
  optionPool: optPercent,
  mfn: z.boolean().optional(),
  proRata: z.boolean().optional(),
  roundName: z.string().max(200).optional().nullable(),
  sharePrice: optPositiveAmount,
  highWaterMark: z.boolean().optional(),
  minimumCommitment: optAmount,

  // Step 5: Fund Details — SPV
  spvName: z.string().max(255).optional().nullable(),
  targetCompanyName: z.string().max(255).optional().nullable(),
  dealDescription: z.string().max(5000).optional().nullable(),
  allocationAmount: optPositiveAmount,
  minimumLpInvestment: optAmount,
  maxInvestors: optInt,
  spvTerm: z.string().max(50).optional().nullable(),
  spvMgmtFee: optPercent,
  spvCarry: optPercent,
  spvGpCommitment: optAmount,

  // Step 5: Fund Details — Advanced
  gpCommitment: optAmount,
  investmentPeriod: optInt,
  recyclingEnabled: z.boolean().optional(),
  keyPersonEnabled: z.boolean().optional(),
  keyPersonName: z.string().max(255).optional().nullable(),
  noFaultDivorceThreshold: optPercent,
  preferredReturnMethod: z.string().max(50).optional().nullable(),
  clawbackProvision: z.boolean().optional(),
  mgmtFeeOffset: optPercent,

  // Step 5: Fund Details — Priced Round governance
  boardSeats: optInt,
  protectiveProvisions: z.boolean().optional(),
  informationRights: z.boolean().optional(),
  rofrCoSale: z.boolean().optional(),
  dragAlong: z.boolean().optional(),

  // Step 5: Fund Details — SEC
  investmentCompanyExemption: z.string().max(50).optional().nullable(),
  useOfProceeds: z.string().max(5000).optional().nullable(),
  salesCommissions: z.string().max(500).optional().nullable(),

  // Step 5: Fund Details — Marketplace
  marketplaceInterest: z.boolean().optional(),
  marketplaceDescription: z.string().max(5000).optional().nullable(),
  marketplaceCategory: z.string().max(100).optional().nullable(),

  // Step 5: Wire instructions
  bankName: z.string().max(255).optional().nullable(),
  accountName: z.string().max(255).optional().nullable(),
  accountNumber: z.string().max(50).optional().nullable(),
  routingNumber: z.string().max(20).optional().nullable(),
  swift: z.string().max(20).optional().nullable(),
  memoFormat: z.string().max(500).optional().nullable(),
  wireIntermediaryBank: z.string().max(255).optional().nullable(),
  wireSpecialInstructions: z.string().max(2000).optional().nullable(),
  wireCurrency: z.string().max(10).optional().nullable(),

  // Step 5: Pricing tiers / rounds
  plannedRounds: z.array(PlannedRoundSchema).max(20).optional(),
  initialTiers: z.array(PricingTierSchema).max(20).optional(),

  // Step 6: LP Onboarding
  documentTemplates: z.array(z.record(z.string(), z.unknown())).max(20).optional(),
  gpApproval: z.boolean().optional(),
  allowExternalUpload: z.boolean().optional(),
  allowGPUpload: z.boolean().optional(),
  accreditationMethod: z.string().max(50).optional().nullable(),
  minimumInvestThreshold: optAmount,
  auditRetention: z.preprocess(coerceAmount, z.number().int().min(1).max(10).optional()).optional().nullable(),

  // Step 6: Notifications
  emailGPCommitment: z.boolean().optional(),
  emailGPWire: z.boolean().optional(),
  emailLPSteps: z.boolean().optional(),
  notifyGpLpOnboardingStart: z.boolean().optional(),
  notifyGpLpInactive: z.boolean().optional(),
  notifyGpExternalDocUpload: z.boolean().optional(),
  notifyLpWireConfirm: z.boolean().optional(),
  notifyLpNewDocument: z.boolean().optional(),
  notifyLpChangeRequest: z.boolean().optional(),
  notifyLpOnboardingReminder: z.boolean().optional(),

  // Step 7: Dataroom
  dataroomName: z.string().max(255).optional().nullable(),
});
export type SetupCompleteInput = z.infer<typeof SetupCompleteSchema>;
