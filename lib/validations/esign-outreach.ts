import { z } from "zod";

/**
 * E-Signature / Outreach / Marketplace Validation Schemas
 *
 * Shared Zod schemas for envelope management, outreach sequences/templates,
 * marketplace deals, and related operations.
 */

const MAX_AMOUNT = 100_000_000_000;

// ---------------------------------------------------------------------------
// E-Signature: Envelope Create (POST /api/esign/envelopes)
// ---------------------------------------------------------------------------

const EnvelopeRecipientSchema = z.object({
  name: z.string().min(1, "Recipient name is required").max(255),
  email: z.string().email("Invalid recipient email").max(254),
  role: z.enum(["SIGNER", "CC", "CERTIFIED_DELIVERY"]).optional().default("SIGNER"),
  order: z.coerce.number().int().min(0).max(100).optional(),
});

export const EnvelopeCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  recipients: z.array(EnvelopeRecipientSchema).min(1, "At least one recipient is required").max(50),
  description: z.string().max(5000).optional().nullable(),
  signingMode: z.enum(["SEQUENTIAL", "PARALLEL", "MIXED"]).optional().default("SEQUENTIAL"),
  emailSubject: z.string().max(255).optional().nullable(),
  emailMessage: z.string().max(5000).optional().nullable(),
  expiresAt: z.string().max(30).optional().nullable(),
  reminderEnabled: z.boolean().optional().default(true),
  reminderDays: z.coerce.number().int().min(1).max(30).optional().default(3),
  maxReminders: z.coerce.number().int().min(0).max(20).optional().default(3),
  sourceFile: z.string().max(2048).optional().nullable(),
  sourceStorageType: z.string().max(50).optional().nullable(),
  sourceFileName: z.string().max(255).optional().nullable(),
  sourceMimeType: z.string().max(100).optional().nullable(),
  sourceFileSize: z.coerce.number().int().min(0).optional().nullable(),
  sourceNumPages: z.coerce.number().int().min(0).optional().nullable(),
});
export type EnvelopeCreateInput = z.infer<typeof EnvelopeCreateSchema>;

// ---------------------------------------------------------------------------
// E-Signature: Standalone Send (POST /api/esign/standalone/send)
// ---------------------------------------------------------------------------

export const StandaloneSendSchema = EnvelopeCreateSchema.extend({
  sourceModule: z.enum([
    "DATAROOM", "SIGNSUITE", "DOCROOMS",
    "PIPELINE_IQ_LITE", "PIPELINE_IQ", "FUNDROOM",
  ]).optional().default("SIGNSUITE"),
  // Fields placed on the document (stored on the envelope for later use)
  fields: z.array(z.object({
    id: z.string(),
    type: z.string(),
    label: z.string().optional(),
    page: z.number().int().min(1),
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().min(0),
    height: z.number().min(0),
    required: z.boolean().optional().default(true),
    recipientIndex: z.number().int().min(0).optional(),
    options: z.array(z.string()).optional(),
  })).optional(),
});
export type StandaloneSendInput = z.infer<typeof StandaloneSendSchema>;

// ---------------------------------------------------------------------------
// E-Signature: Envelope Remind (POST /api/esign/envelopes/[id]/remind)
// ---------------------------------------------------------------------------

export const EnvelopeRemindSchema = z.object({
  recipientId: z.string().max(100).optional().nullable(),
});
export type EnvelopeRemindInput = z.infer<typeof EnvelopeRemindSchema>;

// ---------------------------------------------------------------------------
// E-Signature: Envelope Decline (POST /api/esign/envelopes/[id]/decline)
// ---------------------------------------------------------------------------

export const EnvelopeDeclineSchema = z.object({
  signingToken: z.string().min(1, "Signing token is required").max(500),
  reason: z.string().max(2000).optional().nullable(),
});
export type EnvelopeDeclineInput = z.infer<typeof EnvelopeDeclineSchema>;

// ---------------------------------------------------------------------------
// E-Signature: Envelope Void (POST /api/esign/envelopes/[id]/void)
// ---------------------------------------------------------------------------

export const EnvelopeVoidSchema = z.object({
  reason: z.string().max(2000).optional().nullable(),
});
export type EnvelopeVoidInput = z.infer<typeof EnvelopeVoidSchema>;

// ---------------------------------------------------------------------------
// E-Signature: Sign (POST /api/esign/sign)
// ---------------------------------------------------------------------------

export const EsignSubmitSchema = z.object({
  signingToken: z.string().min(1, "Signing token is required").max(500),
  signatureImage: z.string().max(500 * 1024).optional().nullable(),
  signatureType: z.enum(["draw", "type", "upload"]).optional().nullable(),
  esignConsent: z.literal(true, {
    errorMap: () => ({ message: "ESIGN Act consent is required" }),
  }),
  fieldValues: z.record(z.string(), z.unknown()).optional().nullable(),
});
export type EsignSubmitInput = z.infer<typeof EsignSubmitSchema>;

// ---------------------------------------------------------------------------
// E-Signature: Envelope Update (PATCH /api/esign/envelopes/[id])
// ---------------------------------------------------------------------------

export const EnvelopeUpdateSchema = z.object({
  title: z.string().max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  emailSubject: z.string().max(255).optional().nullable(),
  message: z.string().max(5000).optional().nullable(),
  signingMode: z.enum(["SEQUENTIAL", "PARALLEL", "MIXED"]).optional(),
  status: z.string().max(50).optional(),
  expiresAt: z.string().max(30).optional().nullable(),
  reminderEnabled: z.boolean().optional(),
  reminderDays: z.coerce.number().int().min(1).max(30).optional(),
  fields: z.array(z.object({
    type: z.string().max(50),
    label: z.string().max(200).optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageNumber: z.coerce.number().int().min(1).optional(),
    x: z.coerce.number().min(0),
    y: z.coerce.number().min(0),
    width: z.coerce.number().min(0),
    height: z.coerce.number().min(0),
    required: z.boolean().optional(),
    recipientIndex: z.coerce.number().int().min(0).optional(),
    options: z.array(z.string().max(500)).max(100).optional().nullable(),
    fieldFormat: z.string().max(50).optional().nullable(),
    groupId: z.string().max(100).optional().nullable(),
    minValue: z.coerce.number().optional().nullable(),
    maxValue: z.coerce.number().optional().nullable(),
  })).max(200).optional(),
});
export type EnvelopeUpdateInput = z.infer<typeof EnvelopeUpdateSchema>;

// ---------------------------------------------------------------------------
// E-Signature: Bulk Send (POST /api/esign/bulk-send)
// Creates one envelope per recipient from the same document template.
// ---------------------------------------------------------------------------

const BulkRecipientSchema = z.object({
  name: z.string().min(1, "Recipient name is required").max(255),
  email: z.string().email("Invalid recipient email").max(254),
});

export const BulkSendSchema = z.object({
  title: z.string().min(1, "Document title is required").max(255),
  batchName: z.string().max(255).optional(),
  emailSubject: z.string().max(255).optional().nullable(),
  emailMessage: z.string().max(5000).optional().nullable(),
  expiresAt: z.string().max(30).optional().nullable(),
  // Source document (same for all envelopes)
  sourceFile: z.string().max(2048).optional().nullable(),
  sourceStorageType: z.string().max(50).optional().nullable(),
  sourceFileName: z.string().max(255).optional().nullable(),
  sourceMimeType: z.string().max(100).optional().nullable(),
  sourceFileSize: z.coerce.number().int().min(0).optional().nullable(),
  sourceNumPages: z.coerce.number().int().min(0).optional().nullable(),
  // Fields placed on the document (same layout applied to every envelope)
  fields: z.array(z.object({
    id: z.string(),
    type: z.string(),
    label: z.string().optional(),
    page: z.number().int().min(1),
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().min(0),
    height: z.number().min(0),
    required: z.boolean().optional().default(true),
    recipientIndex: z.number().int().min(0).optional(),
    options: z.array(z.string()).optional(),
  })).optional(),
  // Recipients — one envelope per recipient
  recipients: z.array(BulkRecipientSchema)
    .min(1, "At least one recipient is required")
    .max(500, "Maximum 500 recipients per bulk send"),
});
export type BulkSendInput = z.infer<typeof BulkSendSchema>;

// ---------------------------------------------------------------------------
// Outreach Sequences
// ---------------------------------------------------------------------------

export const SequenceUpdateSchema = z.object({
  name: z.string().max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(["ACTIVE", "PAUSED", "DRAFT", "ARCHIVED"]).optional(),
  isActive: z.boolean().optional(),
  steps: z.array(z.object({
    order: z.coerce.number().int().min(0),
    type: z.string().max(50),
    subject: z.string().max(500).optional(),
    body: z.string().max(50_000).optional(),
    delayDays: z.coerce.number().int().min(0).max(365).optional(),
    templateId: z.string().max(100).optional().nullable(),
    aiPrompt: z.string().max(5000).optional().nullable(),
    condition: z.string().max(50).optional().nullable(),
  })).max(20).optional(),
});
export type SequenceUpdateInput = z.infer<typeof SequenceUpdateSchema>;

// ---------------------------------------------------------------------------
// Outreach Templates
// ---------------------------------------------------------------------------

export const OutreachTemplateUpdateSchema = z.object({
  name: z.string().max(200).optional(),
  subject: z.string().max(500).optional(),
  body: z.string().max(50_000).optional(),
  category: z.string().max(100).optional().nullable(),
});
export type OutreachTemplateUpdateInput = z.infer<typeof OutreachTemplateUpdateSchema>;

// ---------------------------------------------------------------------------
// Marketplace Deals
// ---------------------------------------------------------------------------

export const DealUpdateSchema = z.object({
  name: z.string().max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  stage: z.string().max(50).optional(),
  targetAmount: z.coerce.number().min(0).max(MAX_AMOUNT).optional(),
  minimumInvestment: z.coerce.number().min(0).max(MAX_AMOUNT).optional(),
  industry: z.string().max(100).optional().nullable(),
  geography: z.string().max(100).optional().nullable(),
  closingDate: z.string().max(30).optional().nullable(),
  tags: z.array(z.string().max(100)).max(50).optional(),
});
export type DealUpdateInput = z.infer<typeof DealUpdateSchema>;

// ---------------------------------------------------------------------------
// Deal Allocations
// ---------------------------------------------------------------------------

export const DealAllocationSchema = z.object({
  investorId: z.string().max(100).optional(),
  contactId: z.string().max(100).optional(),
  amount: z.coerce.number().min(0).max(MAX_AMOUNT),
  status: z.string().max(50).optional(),
  notes: z.string().max(2000).optional().nullable(),
});
export type DealAllocationInput = z.infer<typeof DealAllocationSchema>;

// ---------------------------------------------------------------------------
// Deal Documents
// ---------------------------------------------------------------------------

export const DealDocumentSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  documentType: z.string().max(50).optional(),
  url: z.string().max(2048).optional(),
  storageKey: z.string().max(500).optional(),
  notes: z.string().max(2000).optional().nullable(),
});
export type DealDocumentInput = z.infer<typeof DealDocumentSchema>;

// ---------------------------------------------------------------------------
// Deal Interest
// ---------------------------------------------------------------------------

export const DealInterestSchema = z.object({
  investorId: z.string().max(100).optional(),
  contactId: z.string().max(100).optional(),
  amount: z.coerce.number().min(0).max(MAX_AMOUNT).optional(),
  interestLevel: z.string().max(50).optional(),
  notes: z.string().max(2000).optional().nullable(),
});
export type DealInterestInput = z.infer<typeof DealInterestSchema>;

// ---------------------------------------------------------------------------
// Deal Listing (Marketplace)
// ---------------------------------------------------------------------------

export const DealListingSchema = z.object({
  title: z.string().max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  category: z.string().max(100).optional(),
  minimumInvestment: z.coerce.number().min(0).max(MAX_AMOUNT).optional(),
  targetAmount: z.coerce.number().min(0).max(MAX_AMOUNT).optional(),
  isPublic: z.boolean().optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
});
export type DealListingInput = z.infer<typeof DealListingSchema>;

// ---------------------------------------------------------------------------
// Deal Notes
// ---------------------------------------------------------------------------

export const DealNoteSchema = z.object({
  content: z.string().min(1, "Note content is required").max(5000),
  isInternal: z.boolean().optional(),
});
export type DealNoteInput = z.infer<typeof DealNoteSchema>;

// ---------------------------------------------------------------------------
// Offering
// ---------------------------------------------------------------------------

export const OfferingSchema = z.object({
  title: z.string().max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  fundId: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  minimumInvestment: z.coerce.number().min(0).max(MAX_AMOUNT).optional(),
  targetAmount: z.coerce.number().min(0).max(MAX_AMOUNT).optional(),
  category: z.string().max(100).optional().nullable(),
  imageUrl: z.string().max(2048).optional().nullable(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  isPublic: z.boolean().optional(),
  highlights: z.array(z.string().max(500)).max(20).optional(),
});
export type OfferingInput = z.infer<typeof OfferingSchema>;

// ---------------------------------------------------------------------------
// LP Wizard Progress
// ---------------------------------------------------------------------------

export const WizardProgressUpdateSchema = z.object({
  currentStep: z.coerce.number().int().min(0).max(20),
  completedSteps: z.array(z.coerce.number().int().min(0).max(20)).optional(),
  formData: z.record(z.string(), z.unknown()).optional(),
});
export type WizardProgressUpdateInput = z.infer<typeof WizardProgressUpdateSchema>;

// NOTE: EntityConfigSchema lives in admin.ts (the canonical location).

// ---------------------------------------------------------------------------
// Admin Pricing Tiers (batch operations)
// ---------------------------------------------------------------------------

export const PricingTierBatchSchema = z.object({
  tiers: z.array(z.object({
    id: z.string().max(100).optional(),
    tranche: z.string().max(100),
    name: z.string().max(200).optional().nullable(),
    pricePerUnit: z.coerce.number().positive().max(MAX_AMOUNT),
    unitsTotal: z.coerce.number().int().positive().max(1_000_000),
    isActive: z.boolean().optional(),
  })).min(1).max(20),
});
export type PricingTierBatchInput = z.infer<typeof PricingTierBatchSchema>;

// ---------------------------------------------------------------------------
// Outreach: Send Email (POST /api/outreach/send)
// ---------------------------------------------------------------------------

export const OutreachSendSchema = z.object({
  contactId: z.string().min(1, "contactId is required").max(100),
  subject: z.string().min(1, "subject is required").max(500),
  body: z.string().min(1, "body is required").max(50_000),
  trackOpens: z.boolean().optional(),
  templateId: z.string().max(100).optional().nullable(),
});
export type OutreachSendInput = z.infer<typeof OutreachSendSchema>;

// ---------------------------------------------------------------------------
// Outreach: Bulk Send (POST /api/outreach/bulk)
// ---------------------------------------------------------------------------

export const OutreachBulkSchema = z.object({
  contactIds: z.array(z.string().min(1).max(100)).min(1, "At least one contact is required").max(50, "Maximum 50 recipients per bulk send"),
  subject: z.string().min(1, "subject is required").max(500),
  body: z.string().min(1, "body is required").max(50_000),
  trackOpens: z.boolean().optional(),
  templateId: z.string().max(100).optional().nullable(),
});
export type OutreachBulkInput = z.infer<typeof OutreachBulkSchema>;

// ---------------------------------------------------------------------------
// Contact Notes (POST /api/contacts/[id]/notes)
// ---------------------------------------------------------------------------

export const ContactNoteSchema = z.object({
  content: z.string().min(1, "Note content is required").max(10_000),
  isPinned: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
});
export type ContactNoteInput = z.infer<typeof ContactNoteSchema>;

// ---------------------------------------------------------------------------
// AI Draft Email (POST /api/ai/draft-email)
// ---------------------------------------------------------------------------

export const DraftEmailSchema = z.object({
  contactId: z.string().min(1, "contactId is required").max(100),
  purpose: z.enum([
    "follow_up",
    "introduction",
    "commitment_check",
    "thank_you",
    "update",
    "re_engagement",
  ]),
  additionalContext: z.string().max(5000).optional().nullable(),
});
export type DraftEmailInput = z.infer<typeof DraftEmailSchema>;

// ---------------------------------------------------------------------------
// Email Domain (POST/PATCH /api/teams/[teamId]/email-domain)
// ---------------------------------------------------------------------------

export const EmailDomainCreateSchema = z.object({
  domain: z
    .string()
    .min(1, "domain is required")
    .max(253)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Invalid domain format"),
  region: z.string().max(20).optional(),
});
export type EmailDomainCreateInput = z.infer<typeof EmailDomainCreateSchema>;

export const EmailDomainUpdateSchema = z.object({
  fromName: z.string().max(200).optional(),
  fromAddress: z.string().email().max(254).optional(),
  replyTo: z.string().email().max(254).optional(),
});
export type EmailDomainUpdateInput = z.infer<typeof EmailDomainUpdateSchema>;

// ---------------------------------------------------------------------------
// Deal Stage Transition (POST /api/teams/[teamId]/marketplace/deals/[dealId]/stage)
// ---------------------------------------------------------------------------

export const DealStageTransitionSchema = z.object({
  toStage: z.string().min(1, "toStage is required").max(50),
  reason: z.string().max(2000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type DealStageTransitionInput = z.infer<typeof DealStageTransitionSchema>;

// ---------------------------------------------------------------------------
// Startup Raise Create (POST /api/funds/create-startup-raise)
// ---------------------------------------------------------------------------

export const StartupRaiseCreateSchema = z.object({
  teamId: z.string().min(1, "teamId is required").max(100),
  // The remaining raise-specific fields are validated by startupRaiseSchema
  // after extracting teamId — this schema only validates the wrapper.
}).passthrough();
export type StartupRaiseCreateInput = z.infer<typeof StartupRaiseCreateSchema>;

// ---------------------------------------------------------------------------
// Sequence Enroll/Unenroll (POST/DELETE /api/outreach/sequences/[id]/enroll)
// ---------------------------------------------------------------------------

export const SequenceEnrollSchema = z.object({
  contactId: z.string().max(100).optional(),
  contactIds: z.array(z.string().min(1).max(100)).max(50, "Maximum 50 contacts per enrollment batch").optional(),
}).refine(
  (data) => data.contactId || (data.contactIds && data.contactIds.length > 0),
  { message: "contactId or contactIds is required" },
);
export type SequenceEnrollInput = z.infer<typeof SequenceEnrollSchema>;

export const SequenceUnenrollSchema = z.object({
  contactId: z.string().min(1, "contactId is required").max(100),
});
export type SequenceUnenrollInput = z.infer<typeof SequenceUnenrollSchema>;

// NOTE: DataroomCreateSchema and DataroomUpdateSchema live in teams.ts
// (the canonical location for team-scoped schemas).

// ---------------------------------------------------------------------------
// Offering CRUD (POST/PATCH /api/teams/[teamId]/offering)
// ---------------------------------------------------------------------------

export const OfferingCreateSchema = z.object({
  fundId: z.string().min(1, "fundId is required").max(100),
  slug: z.string().max(255).optional(),
  isPublic: z.boolean().optional(),
  heroHeadline: z.string().max(500).optional(),
  heroSubheadline: z.string().max(1000).optional(),
  heroImageUrl: z.string().max(2048).optional(),
  heroBadgeText: z.string().max(100).optional(),
  offeringDescription: z.string().max(10_000).optional(),
  keyMetrics: z.unknown().optional(),
  highlights: z.unknown().optional(),
  dealTerms: z.unknown().optional(),
  timeline: z.unknown().optional(),
  leadership: z.unknown().optional(),
  gallery: z.unknown().optional(),
  dataroomDocuments: z.unknown().optional(),
  financialProjections: z.unknown().optional(),
  advantages: z.unknown().optional(),
  ctaText: z.string().max(200).optional(),
  ctaSecondary: z.string().max(200).optional(),
  emailGateEnabled: z.boolean().optional(),
  brandColor: z.string().max(50).optional(),
  accentColor: z.string().max(50).optional(),
  logoUrl: z.string().max(2048).optional(),
  customCss: z.string().max(50_000).optional(),
  disclaimerText: z.string().max(10_000).optional(),
  removeBranding: z.boolean().optional(),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(500).optional(),
  metaImageUrl: z.string().max(2048).optional(),
});
export type OfferingCreateInput = z.infer<typeof OfferingCreateSchema>;

export const OfferingPatchSchema = z.object({
  offeringId: z.string().min(1, "offeringId is required").max(100),
  isPublic: z.boolean().optional(),
  heroHeadline: z.string().max(500).optional(),
  heroSubheadline: z.string().max(1000).optional(),
  heroImageUrl: z.string().max(2048).optional(),
  heroBadgeText: z.string().max(100).optional(),
  offeringDescription: z.string().max(10_000).optional(),
  keyMetrics: z.unknown().optional(),
  highlights: z.unknown().optional(),
  dealTerms: z.unknown().optional(),
  timeline: z.unknown().optional(),
  leadership: z.unknown().optional(),
  gallery: z.unknown().optional(),
  dataroomDocuments: z.unknown().optional(),
  financialProjections: z.unknown().optional(),
  advantages: z.unknown().optional(),
  ctaText: z.string().max(200).optional(),
  ctaSecondary: z.string().max(200).optional(),
  emailGateEnabled: z.boolean().optional(),
  brandColor: z.string().max(50).optional(),
  accentColor: z.string().max(50).optional(),
  logoUrl: z.string().max(2048).optional(),
  customCss: z.string().max(50_000).optional(),
  disclaimerText: z.string().max(10_000).optional(),
  removeBranding: z.boolean().optional(),
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(500).optional(),
  metaImageUrl: z.string().max(2048).optional(),
});
export type OfferingPatchInput = z.infer<typeof OfferingPatchSchema>;

// ---------------------------------------------------------------------------
// Follow-Up Schedule (POST /api/outreach/follow-ups)
// ---------------------------------------------------------------------------

export const FollowUpScheduleSchema = z.object({
  contactId: z.string().min(1, "contactId is required").max(100),
  followUpAt: z.string().min(1, "followUpAt date is required").max(50),
  notes: z.string().max(5000).optional().nullable(),
});
export type FollowUpScheduleInput = z.infer<typeof FollowUpScheduleSchema>;

// ---------------------------------------------------------------------------
// Interest Status Update (PATCH /api/teams/[teamId]/marketplace/deals/[dealId]/interest)
// ---------------------------------------------------------------------------

export const InterestStatusUpdateSchema = z.object({
  interestId: z.string().min(1, "interestId is required").max(100),
  status: z.string().min(1, "status is required").max(50),
  gpNotes: z.string().max(5000).optional().nullable(),
});
export type InterestStatusUpdateInput = z.infer<typeof InterestStatusUpdateSchema>;

// ---------------------------------------------------------------------------
// Allocation Response (PATCH /api/teams/[teamId]/marketplace/deals/[dealId]/allocations)
// ---------------------------------------------------------------------------

export const AllocationResponseSchema = z.object({
  allocationId: z.string().min(1, "allocationId is required").max(100),
  accept: z.boolean({ required_error: "accept (boolean) is required" }),
  confirmedAmount: z.coerce.number().min(0).max(MAX_AMOUNT).optional(),
});
export type AllocationResponseInput = z.infer<typeof AllocationResponseSchema>;

// ---------------------------------------------------------------------------
// Deal Activity Create (POST /api/teams/[teamId]/marketplace/deals/[dealId]/activities)
// ---------------------------------------------------------------------------

export const DealActivityCreateSchema = z.object({
  activityType: z.string().min(1, "activityType is required").max(50),
  title: z.string().min(1, "title is required").max(500),
  description: z.string().max(5000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type DealActivityCreateInput = z.infer<typeof DealActivityCreateSchema>;

// ---------------------------------------------------------------------------
// Proof Review (POST /api/teams/[teamId]/manual-investments/[investmentId]/proof)
// ---------------------------------------------------------------------------

export const ProofReviewSchema = z.object({
  action: z.enum(["verify", "reject"], {
    errorMap: () => ({ message: "action must be 'verify' or 'reject'" }),
  }),
  rejectionReason: z.string().max(2000).optional(),
}).refine(
  (data) => data.action !== "reject" || (data.rejectionReason && data.rejectionReason.length > 0),
  { message: "rejectionReason is required when rejecting", path: ["rejectionReason"] },
);
export type ProofReviewInput = z.infer<typeof ProofReviewSchema>;

// ---------------------------------------------------------------------------
// Funding Rounds — MOVED to lib/validations/fund.ts
// FundingRoundCreateSchema & FundingRoundUpdateSchema are canonical in fund.ts
// ---------------------------------------------------------------------------
