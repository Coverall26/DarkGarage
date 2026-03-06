import { z } from "zod";

/**
 * Admin / GP-Related Validation Schemas
 *
 * Shared Zod schemas for admin API routes (fund management, capital calls,
 * wire confirmations, investor management, etc.)
 */

const MAX_AMOUNT = 100_000_000_000;

/** Date string (ISO 8601 or parseable date) */
const dateStringSchema = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" });

// ---------------------------------------------------------------------------
// POST /api/funds/create
// ---------------------------------------------------------------------------

export const FundCreateSchema = z.object({
  // Required
  name: z.string().min(1, "Fund name is required").max(200),
  teamId: z.string().min(1, "Team ID is required"),
  // Optional descriptors
  description: z.string().max(2000).optional().nullable(),
  entityMode: z.enum(["FUND", "STARTUP"]).optional(),
  style: z.string().max(50).optional().nullable(),
  fundType: z.string().max(50).optional().nullable(),
  fundStrategy: z.string().max(50).optional().nullable(),
  fundSubType: z.string().max(50).optional().nullable(),
  instrumentType: z.string().max(50).optional().nullable(),
  regulationDExemption: z.string().max(20).optional().nullable(),
  investmentCompanyExemption: z.string().max(20).optional().nullable(),
  // Financial targets
  targetRaise: z.coerce.number().positive().max(MAX_AMOUNT).optional().nullable(),
  minimumInvestment: z.coerce.number().min(0).max(MAX_AMOUNT).optional().nullable(),
  aumTarget: z.coerce.number().min(0).max(MAX_AMOUNT).optional().nullable(),
  currency: z.string().max(10).optional().nullable(),
  // Fund economics — client sends display percentages (e.g. 2.5 for 2.5%), route divides by 100 before storage
  managementFeePct: z.coerce.number().min(0).max(10).optional().nullable(),
  carryPct: z.coerce.number().min(0).max(50).optional().nullable(),
  hurdleRate: z.coerce.number().min(0).max(20).optional().nullable(),
  gpCommitmentAmount: z.coerce.number().min(0).max(MAX_AMOUNT).optional().nullable(),
  gpCommitmentPct: z.coerce.number().min(0).max(100).optional().nullable(),
  mgmtFeeOffsetPct: z.coerce.number().min(0).max(100).optional().nullable(),
  waterfallType: z.enum(["EUROPEAN", "AMERICAN", "DEAL_BY_DEAL"]).optional().nullable(),
  preferredReturnMethod: z.enum(["SIMPLE", "COMPOUNDED", "NONE"]).optional().nullable(),
  // Fund structure
  termYears: z.coerce.number().int().min(1).max(30).optional().nullable(),
  extensionYears: z.coerce.number().int().min(0).max(5).optional().nullable(),
  investmentPeriodYears: z.coerce.number().int().min(0).max(30).optional().nullable(),
  callFrequency: z.enum(["AS_NEEDED", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]).optional().nullable(),
  // Boolean settings
  highWaterMark: z.boolean().optional().nullable(),
  recyclingEnabled: z.boolean().optional().nullable(),
  keyPersonEnabled: z.boolean().optional().nullable(),
  clawbackProvision: z.boolean().optional().nullable(),
  stagedCommitmentsEnabled: z.boolean().optional().nullable(),
  thresholdEnabled: z.boolean().optional().nullable(),
  marketplaceInterest: z.boolean().optional().nullable(),
  // Conditional fields
  keyPersonName: z.string().max(200).optional().nullable(),
  noFaultDivorceThreshold: z.coerce.number().min(0).max(100).optional().nullable(),
  thresholdAmount: z.coerce.number().min(0).max(MAX_AMOUNT).optional().nullable(),
  marketplaceDescription: z.string().max(2000).optional().nullable(),
  marketplaceCategory: z.string().max(100).optional().nullable(),
  // Complex fields
  featureFlags: z.record(z.string(), z.unknown()).optional().nullable(),
  wireInstructions: z.record(z.string(), z.unknown()).optional().nullable(),
  useOfProceeds: z.string().max(5000).optional().nullable(),
  salesCommissions: z.coerce.number().min(0).max(MAX_AMOUNT).optional().nullable(),
});

export type FundCreateInput = z.infer<typeof FundCreateSchema>;

// ---------------------------------------------------------------------------
// PATCH /api/teams/[teamId]/funds/[fundId]
// ---------------------------------------------------------------------------

export const FundUpdateSchema = z.object({
  fundName: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  targetSize: z.coerce.number().positive().max(MAX_AMOUNT).optional().nullable(),
  targetRaise: z.coerce.number().positive().max(MAX_AMOUNT).optional().nullable(),
  fundType: z.string().max(50).optional().nullable(),
  fundSubType: z.string().max(50).optional().nullable(),
  instrumentType: z.string().max(50).optional().nullable(),
  currency: z.string().max(10).optional().nullable(),
  regulationDExemption: z.string().max(20).optional().nullable(),
  minimumCommitment: z.coerce.number().min(0).max(MAX_AMOUNT).optional().nullable(),
  minimumInvestment: z.coerce.number().min(0).max(MAX_AMOUNT).optional().nullable(),
  managementFeePct: z.coerce.number().min(0).max(10).optional().nullable(),
  carryPct: z.coerce.number().min(0).max(50).optional().nullable(),
  hurdleRate: z.coerce.number().min(0).max(20).optional().nullable(),
  waterfallType: z.string().max(50).optional().nullable(),
  termYears: z.coerce.number().int().min(1).max(99).optional().nullable(),
  extensionYears: z.coerce.number().int().min(0).max(10).optional().nullable(),
  gpCommitmentAmount: z.coerce.number().min(0).max(MAX_AMOUNT).optional().nullable(),
  gpCommitmentPct: z.coerce.number().min(0).max(100).optional().nullable(),
  mgmtFeeOffsetPct: z.coerce.number().min(0).max(100).optional().nullable(),
  investmentPeriodYears: z.coerce.number().int().min(0).max(30).optional().nullable(),
  noFaultDivorceThreshold: z.coerce.number().min(0).max(100).optional().nullable(),
  highWaterMark: z.boolean().optional().nullable(),
  recyclingEnabled: z.boolean().optional().nullable(),
  keyPersonEnabled: z.boolean().optional().nullable(),
  keyPersonName: z.string().max(200).optional().nullable(),
  clawbackProvision: z.boolean().optional().nullable(),
  preferredReturnMethod: z.enum(["SIMPLE", "COMPOUNDED", "NONE"]).optional().nullable(),
  marketplaceInterest: z.boolean().optional().nullable(),
  marketplaceDescription: z.string().max(2000).optional().nullable(),
  marketplaceCategory: z.string().max(100).optional().nullable(),
  callFrequency: z.enum(["AS_NEEDED", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]).optional().nullable(),
  stagedCommitmentsEnabled: z.boolean().optional().nullable(),
  wireInstructions: z.record(z.string(), z.unknown()).optional().nullable(),
  featureFlags: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type FundUpdateInput = z.infer<typeof FundUpdateSchema>;

// ---------------------------------------------------------------------------
// PATCH /api/teams/[teamId]/funds/[fundId]/fund-mode
// ---------------------------------------------------------------------------

export const FundModeSchema = z.object({
  mode: z.enum(["FUND", "STARTUP"]),
});

export type FundModeInput = z.infer<typeof FundModeSchema>;

// ---------------------------------------------------------------------------
// POST /api/teams/[teamId]/funds/[fundId]/capital-calls
// ---------------------------------------------------------------------------

export const CapitalCallCreateSchema = z.object({
  callNumber: z.coerce.number().int().min(1).optional(),
  amount: z.coerce.number().positive().max(MAX_AMOUNT),
  dueDate: dateStringSchema,
  purpose: z.string().max(500).optional().nullable(),
  proRataPercentage: z.coerce.number().min(0).max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type CapitalCallCreateInput = z.infer<typeof CapitalCallCreateSchema>;

// ---------------------------------------------------------------------------
// PATCH /api/teams/[teamId]/funds/[fundId]/capital-calls/[callId]
// ---------------------------------------------------------------------------

export const CapitalCallUpdateSchema = z.object({
  amount: z.coerce.number().positive().max(MAX_AMOUNT).optional(),
  purpose: z.string().max(500).optional().nullable(),
  dueDate: dateStringSchema.optional(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.string().max(50).optional(),
});

export type CapitalCallUpdateInput = z.infer<typeof CapitalCallUpdateSchema>;

// ---------------------------------------------------------------------------
// POST /api/teams/[teamId]/funds/[fundId]/capital-calls/[callId]/responses/[responseId]/confirm
// ---------------------------------------------------------------------------

export const CapitalCallConfirmSchema = z.object({
  amountPaid: z.coerce.number().positive().max(MAX_AMOUNT),
  fundReceivedDate: dateStringSchema.optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export type CapitalCallConfirmInput = z.infer<typeof CapitalCallConfirmSchema>;

// ---------------------------------------------------------------------------
// PATCH /api/teams/[teamId]/funds/[fundId]/tranches/[trancheId]
// ---------------------------------------------------------------------------

export const TrancheUpdateSchema = z.object({
  status: z.string().max(50).optional(),
  fundedAmount: z.coerce.number().min(0).max(MAX_AMOUNT).optional(),
  capitalCallId: z.string().max(100).optional().nullable(),
  wireProofDocumentId: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type TrancheUpdateInput = z.infer<typeof TrancheUpdateSchema>;

// ---------------------------------------------------------------------------
// POST /api/teams/[teamId]/funds/[fundId]/closes
// ---------------------------------------------------------------------------

export const FundCloseCreateSchema = z.object({
  name: z.string().min(1, "Close name is required").max(200),
  targetAmount: z.coerce.number().min(0).max(MAX_AMOUNT).optional().nullable(),
  scheduledCloseDate: dateStringSchema.optional().nullable(),
  isFinal: z.boolean().optional(),
});

export type FundCloseCreateInput = z.infer<typeof FundCloseCreateSchema>;

// ---------------------------------------------------------------------------
// PATCH /api/teams/[teamId]/funds/[fundId]/fees
// ---------------------------------------------------------------------------

export const FundFeesUpdateSchema = z.object({
  // Percentages as display values (e.g. 2.5 for 2.5%), route divides by 100 before storage
  managementFeePct: z.coerce.number().min(0).max(10).optional(),
  carryPct: z.coerce.number().min(0).max(50).optional(),
  hurdleRate: z.coerce.number().min(0).max(20).optional(),
  waterfallType: z.string().max(50).optional(),
  aumCalculationFrequency: z.string().max(50).optional(),
});

export type FundFeesUpdateInput = z.infer<typeof FundFeesUpdateSchema>;

// ---------------------------------------------------------------------------
// POST /api/teams/[teamId]/funds/[fundId]/invite
// ---------------------------------------------------------------------------

export const InvestorInviteSchema = z.object({
  emails: z
    .array(z.string().email().max(254))
    .min(1, "At least one email is required")
    .max(100, "Maximum 100 emails per batch"),
  message: z.string().max(2000).optional().nullable(),
});

export type InvestorInviteInput = z.infer<typeof InvestorInviteSchema>;

// ---------------------------------------------------------------------------
// POST /api/teams/[teamId]/funds/[fundId]/wire-instructions
// ---------------------------------------------------------------------------

export const WireInstructionsSchema = z.object({
  bankName: z.string().min(1, "Bank name is required").max(200),
  accountNumber: z.string().min(1, "Account number is required").max(50),
  routingNumber: z
    .string()
    .min(1, "Routing number is required")
    .max(20),
  beneficiaryName: z.string().min(1, "Beneficiary name is required").max(200),
  swiftCode: z.string().max(20).optional().nullable(),
  intermediaryBank: z.string().max(200).optional().nullable(),
  specialInstructions: z.string().max(2000).optional().nullable(),
  memoFormat: z.string().max(200).optional().nullable(),
  currency: z.string().max(10).optional().nullable(),
});

export type WireInstructionsInput = z.infer<typeof WireInstructionsSchema>;

// ---------------------------------------------------------------------------
// POST /api/teams/[teamId]/wire-transfers/bulk
// ---------------------------------------------------------------------------

export const BulkWireActionSchema = z.object({
  action: z.enum(["require_proof", "verify", "reject"]),
  investmentIds: z
    .array(z.string().max(100))
    .min(1, "At least one investment ID is required")
    .max(100, "Maximum 100 investments per batch"),
  rejectionReason: z.string().max(1000).optional().nullable(),
});

export type BulkWireActionInput = z.infer<typeof BulkWireActionSchema>;

// ---------------------------------------------------------------------------
// POST /api/teams/[teamId]/funds/[fundId]/pricing-tiers
// ---------------------------------------------------------------------------

export const PricingTierCreateSchema = z.object({
  tranche: z.string().min(1, "Tranche name is required").max(100),
  name: z.string().max(200).optional().nullable(),
  pricePerUnit: z.coerce.number().positive().max(MAX_AMOUNT),
  unitsTotal: z.coerce.number().int().positive().max(1_000_000),
});

export const PricingTierUpdateSchema = z.object({
  flatModeEnabled: z.boolean().optional(),
});

export type PricingTierCreateInput = z.infer<typeof PricingTierCreateSchema>;
export type PricingTierUpdateInput = z.infer<typeof PricingTierUpdateSchema>;

// ---------------------------------------------------------------------------
// POST /api/billing/checkout
// ---------------------------------------------------------------------------

export const BillingCheckoutSchema = z.object({
  plan: z.enum(["CRM_PRO", "FUNDROOM"]),
  period: z.enum(["monthly", "yearly"]),
});

export type BillingCheckoutInput = z.infer<typeof BillingCheckoutSchema>;

// ---------------------------------------------------------------------------
// POST /api/billing/ai-addon
// ---------------------------------------------------------------------------

export const AiAddonSchema = z.object({
  action: z.enum(["subscribe", "cancel"]),
  period: z.enum(["monthly", "yearly"]).optional(),
});

export type AiAddonInput = z.infer<typeof AiAddonSchema>;

// ---------------------------------------------------------------------------
// PUT /api/admin/manual-investment/[id]
// ---------------------------------------------------------------------------

export const ManualInvestmentUpdateSchema = z.object({
  documentTitle: z.string().max(255).optional(),
  documentNumber: z.string().max(100).optional().nullable(),
  commitmentAmount: z.coerce.number().positive().max(MAX_AMOUNT).optional(),
  fundedAmount: z.coerce.number().min(0).max(MAX_AMOUNT).optional(),
  units: z.coerce.number().min(0).optional().nullable(),
  shares: z.coerce.number().min(0).optional().nullable(),
  pricePerUnit: z.coerce.number().min(0).max(MAX_AMOUNT).optional().nullable(),
  ownershipPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  signedDate: dateStringSchema.optional(),
  effectiveDate: dateStringSchema.optional().nullable(),
  fundedDate: dateStringSchema.optional().nullable(),
  maturityDate: dateStringSchema.optional().nullable(),
  transferMethod: z.string().max(50).optional().nullable(),
  transferStatus: z.string().max(50).optional(),
  transferDate: dateStringSchema.optional().nullable(),
  transferRef: z.string().max(255).optional().nullable(),
  bankName: z.string().max(255).optional().nullable(),
  accountLast4: z.string().max(4).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type ManualInvestmentUpdateInput = z.infer<typeof ManualInvestmentUpdateSchema>;

// ---------------------------------------------------------------------------
// POST /api/admin/manual-investment/[id]/verify-proof
// ---------------------------------------------------------------------------

export const VerifyProofSchema = z.object({
  action: z.enum(["verify", "reject"]),
  reason: z.string().max(1000).optional().nullable(),
});

export type VerifyProofInput = z.infer<typeof VerifyProofSchema>;

// ---------------------------------------------------------------------------
// POST /api/teams/[teamId]/funds/[fundId]/signature-documents
// SignatureDocumentCreateSchema is canonical in teams.ts (more complete).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// PATCH /api/admin/settings/update
// ---------------------------------------------------------------------------

export const SettingsUpdateSchema = z.object({
  section: z.string().min(1, "Section is required").max(50),
  teamId: z.string().min(1, "Team ID is required"),
  fundId: z.string().optional().nullable(),
  data: z.record(z.string(), z.unknown()),
  applyToExisting: z.boolean().optional(),
});

export type SettingsUpdateInput = z.infer<typeof SettingsUpdateSchema>;

// ---------------------------------------------------------------------------
// POST /api/admin/activate-fundroom
// ---------------------------------------------------------------------------

export const ActivateFundroomSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
  fundId: z.string().optional().nullable(),
  mode: z.string().max(50).optional().nullable(),
});

export type ActivateFundroomInput = z.infer<typeof ActivateFundroomSchema>;

// ---------------------------------------------------------------------------
// POST /api/billing/portal
// ---------------------------------------------------------------------------

export const BillingPortalSchema = z.object({
  returnUrl: z.string().url().max(500).optional().nullable(),
});

export type BillingPortalInput = z.infer<typeof BillingPortalSchema>;

// ---------------------------------------------------------------------------
// PATCH /api/funds/[fundId]/settings
// ---------------------------------------------------------------------------

export const FundSettingsUpdateSchema = z.object({
  // Boolean settings
  ndaGateEnabled: z.boolean().optional(),
  stagedCommitmentsEnabled: z.boolean().optional(),
  capitalCallThresholdEnabled: z.boolean().optional(),
  highWaterMark: z.boolean().optional(),
  recyclingEnabled: z.boolean().optional(),
  clawbackProvision: z.boolean().optional(),
  keyPersonEnabled: z.boolean().optional(),
  marketplaceInterest: z.boolean().optional(),
  // String enums
  callFrequency: z.enum(["AS_NEEDED", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]).optional(),
  waterfallType: z.enum(["EUROPEAN", "AMERICAN", "DEAL_BY_DEAL"]).optional().nullable(),
  preferredReturnMethod: z.enum(["SIMPLE", "COMPOUND", "NONE"]).optional().nullable(),
  currency: z.string().max(10).optional(),
  keyPersonName: z.string().max(200).optional().nullable(),
  // Numeric fields
  minimumInvestment: z.coerce.number().min(0).max(MAX_AMOUNT).optional(),
  capitalCallThreshold: z.coerce.number().min(0).max(MAX_AMOUNT).optional().nullable(),
  termYears: z.coerce.number().int().min(1).max(30).optional(),
  extensionYears: z.coerce.number().int().min(0).max(5).optional(),
  investmentPeriodYears: z.coerce.number().int().min(0).max(30).optional(),
  gpCommitmentAmount: z.coerce.number().min(0).max(MAX_AMOUNT).optional(),
  noFaultDivorceThreshold: z.coerce.number().min(0).max(100).optional().nullable(),
  // Percentages as display values (e.g. 2.5 for 2.5%), route divides by 100 before storage
  managementFeePct: z.coerce.number().min(0).max(10).optional(),
  carryPct: z.coerce.number().min(0).max(50).optional(),
  hurdleRate: z.coerce.number().min(0).max(20).optional(),
  gpCommitmentPct: z.coerce.number().min(0).max(100).optional(),
  mgmtFeeOffsetPct: z.coerce.number().min(0).max(100).optional(),
  // Complex fields
  wireInstructions: z.record(z.string(), z.unknown()).optional().nullable(),
  featureFlags: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type FundSettingsUpdateInput = z.infer<typeof FundSettingsUpdateSchema>;

// ---------------------------------------------------------------------------
// POST /api/admin/bulk-action
// ---------------------------------------------------------------------------

export const BulkActionSchema = z.object({
  fundId: z.string().min(1, "Fund ID is required"),
  actionType: z.enum(["capital_call", "distribution"]),
  totalAmount: z.coerce.number().positive("Amount must be positive").max(MAX_AMOUNT),
  allocationType: z.enum(["equal", "pro_rata"]).default("pro_rata"),
  selectedInvestors: z.array(z.string().min(1)).optional(),
});

export type BulkActionInput = z.infer<typeof BulkActionSchema>;

// ---------------------------------------------------------------------------
// POST /api/admin/entities
// ---------------------------------------------------------------------------

export const EntityCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  mode: z.enum(["FUND", "STARTUP"]).default("FUND"),
});

export type EntityCreateInput = z.infer<typeof EntityCreateSchema>;

// ---------------------------------------------------------------------------
// PATCH /api/admin/entities/[id]
// ---------------------------------------------------------------------------

export const EntityUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  mode: z.enum(["FUND", "STARTUP"]).optional(),
  fundConfig: z.record(z.string(), z.unknown()).optional().nullable(),
  startupConfig: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type EntityUpdateInput = z.infer<typeof EntityUpdateSchema>;

// ---------------------------------------------------------------------------
// PATCH /api/admin/entities/[id]/config
// ---------------------------------------------------------------------------

export const FeeConfigSchema = z.object({
  managementFee: z.object({
    rate: z.number().min(0).max(100),
    frequency: z.enum(["MONTHLY", "QUARTERLY", "ANNUALLY"]),
    calculationBasis: z.enum(["COMMITTED", "CALLED", "NAV"]),
  }),
  performanceFee: z.object({
    carriedInterest: z.number().min(0).max(100),
    hurdleRate: z.number().min(0).max(100),
    catchUp: z.boolean(),
    catchUpPercentage: z.number().min(0).max(100).optional(),
  }),
  organizationalFees: z.object({
    amount: z.number().min(0).max(MAX_AMOUNT),
    amortizePeriod: z.number().int().min(0).max(120).optional(),
  }),
  expenseRatio: z.number().min(0).max(100).optional(),
  adminFee: z.number().min(0).max(MAX_AMOUNT).optional(),
});

export const TierConfigSchema = z.object({
  tiers: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1).max(200),
      minInvestment: z.number().min(0).max(MAX_AMOUNT),
      maxInvestment: z.number().min(0).max(MAX_AMOUNT).optional(),
      managementFeeDiscount: z.number().min(0).max(100).optional(),
      performanceFeeDiscount: z.number().min(0).max(100).optional(),
      benefits: z.array(z.string().max(500)).optional(),
    })
  ),
  defaultTierId: z.string().optional(),
});

export const EntityConfigSchema = z.object({
  feeConfig: FeeConfigSchema.optional(),
  tierConfig: TierConfigSchema.optional(),
  customSettings: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type FeeConfigInput = z.infer<typeof FeeConfigSchema>;
export type TierConfigInput = z.infer<typeof TierConfigSchema>;
export type EntityConfigInput = z.infer<typeof EntityConfigSchema>;

// ---------------------------------------------------------------------------
// POST /api/admin/investor-notes
// ---------------------------------------------------------------------------

export const InvestorNoteCreateSchema = z.object({
  investorId: z.string().min(1, "Investor ID is required"),
  content: z.string().min(1, "Content is required").max(5000),
});

export type InvestorNoteCreateInput = z.infer<typeof InvestorNoteCreateSchema>;

// ---------------------------------------------------------------------------
// POST /api/admin/form-d-reminders
// ---------------------------------------------------------------------------

export const FormDReminderActionSchema = z.object({
  action: z.enum(["send_reminder", "check_all", "update_filing"]),
  fundId: z.string().optional(),
  formDFilingDate: dateStringSchema.optional(),
  formDAmendmentDue: dateStringSchema.optional(),
});

export type FormDReminderActionInput = z.infer<typeof FormDReminderActionSchema>;

// ---------------------------------------------------------------------------
// PATCH /api/admin/platform/organizations
// ---------------------------------------------------------------------------

export const PlatformOrgActionSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
  action: z.enum(["activate", "suspend", "deactivate", "reactivate"]),
  reason: z.string().max(1000).optional(),
});

export type PlatformOrgActionInput = z.infer<typeof PlatformOrgActionSchema>;

// ---------------------------------------------------------------------------
// POST /api/admin/import
// ---------------------------------------------------------------------------

export const AdminImportSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
  data: z.record(z.string(), z.unknown()),
  dryRun: z.boolean().optional(),
});

export type AdminImportInput = z.infer<typeof AdminImportSchema>;

// ---------------------------------------------------------------------------
// POST /api/admin/export-blobs
// ---------------------------------------------------------------------------

export const ExportBlobsSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
  includeSignedUrls: z.boolean().optional(),
});

export type ExportBlobsInput = z.infer<typeof ExportBlobsSchema>;

// ---------------------------------------------------------------------------
// POST /api/admin/reports/aum/history (snapshot trigger)
// ---------------------------------------------------------------------------

export const AumSnapshotSchema = z.object({
  fundId: z.string().min(1, "Fund ID is required"),
  period: z.enum(["DAILY", "WEEKLY", "MONTHLY", "ANNUAL"]).optional(),
});

export type AumSnapshotInput = z.infer<typeof AumSnapshotSchema>;

// ---------------------------------------------------------------------------
// POST /api/admin/investors/bulk-import
// ---------------------------------------------------------------------------

export const InvestorRowSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  entityType: z
    .enum([
      "INDIVIDUAL",
      "LLC",
      "TRUST",
      "RETIREMENT",
      "JOINT",
      "PARTNERSHIP",
      "CHARITY",
      "OTHER",
    ])
    .default("INDIVIDUAL"),
  entityName: z.string().optional(),
  commitmentAmount: z.number().positive().max(MAX_AMOUNT),
  commitmentDate: z.string().optional(),
  fundingStatus: z.enum(["COMMITTED", "FUNDED"]).default("COMMITTED"),
  accreditationStatus: z.string().default("SELF_CERTIFIED"),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const BulkInvestorImportSchema = z.object({
  fundId: z.string().min(1, "Fund ID is required"),
  teamId: z.string().min(1, "Team ID is required"),
  investors: z.array(InvestorRowSchema).min(1).max(500),
});

export type InvestorRowInput = z.infer<typeof InvestorRowSchema>;
export type BulkInvestorImportInput = z.infer<typeof BulkInvestorImportSchema>;
