import { z } from "zod";

/**
 * LP-Related Validation Schemas
 *
 * Shared Zod schemas for LP onboarding, accreditation, and document APIs.
 */

const MAX_AMOUNT = 100_000_000_000;

/** Normalized email — trimmed, lowercased */
const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email format")
  .transform((v) => v.toLowerCase().trim());

// ---------------------------------------------------------------------------
// POST /api/lp/register
// ---------------------------------------------------------------------------

export const LpRegisterSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: emailSchema,
  phone: z.string().max(30).optional().nullable(),
  password: z.string().min(8).max(72).optional(),
  entityType: z.string().max(50).optional().nullable(),
  entityName: z.string().max(255).optional().nullable(),
  entityData: z.record(z.string(), z.unknown()).optional().nullable(),
  address: z
    .object({
      street1: z.string().max(255).optional(),
      street2: z.string().max(255).optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(100).optional(),
      zip: z.string().max(20).optional(),
      country: z.string().max(100).optional(),
    })
    .optional()
    .nullable(),
  accreditationType: z.string().max(100).optional().nullable(),
  ndaAccepted: z.boolean().optional(),
  sourceOfFunds: z.string().max(50).optional().nullable(),
  occupation: z.string().max(255).optional().nullable(),
  fundId: z.string().max(100).optional().nullable(),
  teamId: z.string().max(100).optional().nullable(),
  referralSource: z.string().max(255).optional().nullable(),
});

export type LpRegisterInput = z.infer<typeof LpRegisterSchema>;

// ---------------------------------------------------------------------------
// POST /api/lp/sign-nda
// ---------------------------------------------------------------------------

export const SignNdaSchema = z.object({
  fundId: z.string().max(100).optional().nullable(),
  ndaAccepted: z.literal(true, {
    errorMap: () => ({ message: "NDA must be accepted" }),
  }),
  signatureMethod: z.string().max(50).optional().nullable(),
  signatureData: z
    .union([z.string().max(500_000), z.record(z.string(), z.unknown())])
    .optional()
    .nullable(),
});

export type SignNdaInput = z.infer<typeof SignNdaSchema>;

// ---------------------------------------------------------------------------
// POST /api/lp/investor-details
// ---------------------------------------------------------------------------

const VALID_ENTITY_TYPES = [
  "INDIVIDUAL",
  "JOINT",
  "TRUST",
  "TRUST_ESTATE",
  "LLC",
  "LLC_CORPORATION",
  "CORPORATION",
  "PARTNERSHIP",
  "IRA",
  "IRA_RETIREMENT",
  "CHARITY",
  "CHARITY_FOUNDATION",
  "OTHER",
] as const;

export const InvestorDetailsSchema = z.object({
  fundId: z.string().max(100).optional().nullable(),
  entityType: z.enum(VALID_ENTITY_TYPES).optional().nullable(),
  entityName: z.string().max(255).optional().nullable(),
  entityData: z.record(z.string(), z.unknown()).optional().nullable(),
  taxId: z.string().max(20).optional().nullable(),
  taxIdType: z.enum(["SSN", "EIN", "ITIN"]).optional().nullable(),
  address: z
    .object({
      street1: z.string().max(255).optional(),
      street2: z.string().max(255).optional(),
      city: z.string().max(100).optional(),
      state: z.string().max(100).optional(),
      zip: z.string().max(20).optional(),
      country: z.string().max(100).optional(),
    })
    .optional()
    .nullable(),
  authorizedSignerName: z.string().max(255).optional().nullable(),
  authorizedSignerTitle: z.string().max(255).optional().nullable(),
  authorizedSignerEmail: z.string().email().max(254).optional().nullable(),
});

export type InvestorDetailsInput = z.infer<typeof InvestorDetailsSchema>;

// ---------------------------------------------------------------------------
// POST /api/lp/commitment
// ---------------------------------------------------------------------------

export const LpCommitmentSchema = z.object({
  fundId: z.string().min(1, "Fund ID is required"),
  amount: z.coerce.number().positive().max(MAX_AMOUNT),
  units: z.coerce.number().int().positive().optional().nullable(),
  tierId: z.string().uuid().optional().nullable(),
  representations: z
    .record(z.string(), z.unknown())
    .refine((obj) => Object.keys(obj).length <= 20, "Too many representation fields")
    .optional()
    .nullable(),
  noThirdPartyFinancing: z.boolean().optional(),
  sourceOfFunds: z.string().max(50).optional(),
  occupation: z.string().max(255).optional(),
});

export type LpCommitmentInput = z.infer<typeof LpCommitmentSchema>;

// ---------------------------------------------------------------------------
// PUT /api/lp/onboarding-flow
// ---------------------------------------------------------------------------

export const OnboardingFlowUpdateSchema = z.object({
  fundId: z.string().min(1, "Fund ID is required"),
  currentStep: z.number().int().min(0).max(10),
  formData: z.record(z.string(), z.unknown()).optional().nullable(),
  stepsCompleted: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type OnboardingFlowUpdateInput = z.infer<typeof OnboardingFlowUpdateSchema>;

// ---------------------------------------------------------------------------
// POST /api/lp/kyc
// ---------------------------------------------------------------------------

export const KycActionSchema = z.object({
  action: z.enum(["start", "resume"]),
});

export type KycActionInput = z.infer<typeof KycActionSchema>;

// ---------------------------------------------------------------------------
// POST /api/lp/notes
// ---------------------------------------------------------------------------

export const LpNoteSchema = z.object({
  content: z.string().min(1, "Note content is required").max(5000),
});

export type LpNoteInput = z.infer<typeof LpNoteSchema>;

// ---------------------------------------------------------------------------
// POST /api/lp/documents/upload
// ---------------------------------------------------------------------------

const LP_DOCUMENT_TYPES = [
  "NDA",
  "SUBSCRIPTION_AGREEMENT",
  "LPA",
  "SIDE_LETTER",
  "ACCREDITATION_LETTER",
  "TAX_FORM",
  "ID_VERIFICATION",
  "PROOF_OF_ADDRESS",
  "BANK_STATEMENT",
  "WIRE_CONFIRMATION",
  "OTHER",
] as const;

export const LpDocumentUploadSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  documentType: z.enum(LP_DOCUMENT_TYPES),
  fundId: z.string().min(1, "Fund ID is required"),
  lpNotes: z.string().max(2000).optional().nullable(),
  isOfflineSigned: z.boolean().optional(),
  externalSigningDate: z.string().optional().nullable(),
  investmentId: z.string().max(100).optional().nullable(),
  fileData: z.string().min(1, "File data is required"),
  fileName: z.string().min(1, "File name is required").max(255),
  mimeType: z.string().max(100).optional().nullable(),
});

export type LpDocumentUploadInput = z.infer<typeof LpDocumentUploadSchema>;

// ---------------------------------------------------------------------------
// POST /api/lp/accreditation
// ---------------------------------------------------------------------------

export const AccreditationSchema = z.object({
  accreditationType: z.string().min(1, "Accreditation type is required").max(100),
  accreditationDetails: z.record(z.string(), z.unknown()).optional().nullable(),
  confirmAccredited: z.literal(true, {
    errorMap: () => ({ message: "Accredited investor confirmation required" }),
  }),
  confirmRiskAware: z.literal(true, {
    errorMap: () => ({ message: "Risk awareness confirmation required" }),
  }),
  confirmDocReview: z.literal(true, {
    errorMap: () => ({ message: "Document review confirmation required" }),
  }),
  confirmRepresentations: z.literal(true, {
    errorMap: () => ({ message: "Representations confirmation required" }),
  }),
  useSimplifiedPath: z.boolean().optional(),
  intendedCommitment: z.coerce.number().min(0).max(MAX_AMOUNT).optional().nullable(),
  accreditationDocIds: z.array(z.string().max(100)).max(20).optional().nullable(),
  accreditationVerificationMethod: z
    .enum(["DOCUMENT_UPLOAD", "SELF_CERTIFICATION"])
    .optional()
    .nullable(),
});

export type AccreditationInput = z.infer<typeof AccreditationSchema>;

// ---------------------------------------------------------------------------
// POST /api/lp/process-payment
// ---------------------------------------------------------------------------

export const ProcessPaymentSchema = z.object({
  subscriptionId: z.string().min(1, "Subscription ID is required"),
});

export type ProcessPaymentInput = z.infer<typeof ProcessPaymentSchema>;

// ---------------------------------------------------------------------------
// POST /api/lp/express-interest
// ---------------------------------------------------------------------------

export const ExpressInterestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().optional(),
  dataroomSlug: z.string().optional(),
  teamId: z.string().optional(),
  referralCode: z.string().max(100).optional(),
  investorType: z.string().max(50).optional(),
  investmentPreferences: z.record(z.unknown()).optional(),
});

export type ExpressInterestInput = z.infer<typeof ExpressInterestSchema>;

// ---------------------------------------------------------------------------
// PUT /api/lp/wizard-progress
// ---------------------------------------------------------------------------

const WIZARD_STEPS = [
  "ACCREDITATION_CHECKPOINT",
  "ONBOARDING_STEP",
  "COMPLETE_ONBOARDING",
] as const;

const AccreditationCheckpointData = z.object({
  completedSteps: z.array(z.unknown()),
});

const OnboardingStepData = z.object({
  step: z.coerce.number().int().min(0).max(10),
});

export const WizardProgressSchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal("ACCREDITATION_CHECKPOINT"),
    data: AccreditationCheckpointData,
  }),
  z.object({
    step: z.literal("ONBOARDING_STEP"),
    data: OnboardingStepData,
  }),
  z.object({
    step: z.literal("COMPLETE_ONBOARDING"),
    data: z.record(z.unknown()).optional().nullable(),
  }),
]);

export type WizardProgressInput = z.infer<typeof WizardProgressSchema>;

// ---------------------------------------------------------------------------
// POST /api/lp/complete-gate
// ---------------------------------------------------------------------------

export const CompleteGateSchema = z.object({
  ndaAccepted: z.boolean(),
  ndaSignature: z.string().max(500 * 1024).optional(),
  accreditationType: z.string().max(100).optional(),
  confirmIncome: z.boolean().optional(),
  confirmNetWorth: z.boolean().optional(),
  confirmAccredited: z.boolean().optional(),
  confirmRiskAware: z.boolean().optional(),
  resendConfirmation: z.boolean().optional(),
});

export type CompleteGateInput = z.infer<typeof CompleteGateSchema>;

// ---------------------------------------------------------------------------
// POST /api/lp/accreditation-audit
// ---------------------------------------------------------------------------

export const AccreditationAuditSchema = z.object({
  fundId: z.string().max(100).optional().nullable(),
  certificationIndex: z.coerce.number().int().min(0).max(50),
  certificationText: z.string().min(1, "Certification text is required").max(1000),
  certificationField: z.string().min(1, "Certification field is required").max(100),
  checked: z.boolean(),
  certificationCategory: z.string().max(50).optional(),
});

export type AccreditationAuditInput = z.infer<typeof AccreditationAuditSchema>;

// ---------------------------------------------------------------------------
// POST /api/lp/manual-investments/[investmentId]/proof
// ---------------------------------------------------------------------------

export const ManualInvestmentProofSchema = z.object({
  storageKey: z.string().min(1, "Storage key is required").max(1000),
  storageType: z.string().min(1, "Storage type is required").max(50),
  fileType: z.string().min(1, "File type is required").max(100),
  fileName: z.string().min(1, "File name is required").max(255),
  fileSize: z.coerce.number().int().min(0).optional().default(0),
  notes: z.string().max(2000).optional(),
});

export type ManualInvestmentProofInput = z.infer<typeof ManualInvestmentProofSchema>;
