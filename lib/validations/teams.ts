import { z } from "zod";

/**
 * Teams / Document / Dataroom / CRM Validation Schemas
 *
 * Shared Zod schemas for team management, document CRUD, dataroom CRUD,
 * contact management, and related operations.
 */

const MAX_AMOUNT = 100_000_000_000;

// ---------------------------------------------------------------------------
// Team Management
// ---------------------------------------------------------------------------

export const TeamCreateSchema = z.object({
  name: z.string().min(1, "Team name is required").max(200),
});
export type TeamCreateInput = z.infer<typeof TeamCreateSchema>;

/** Schema matching the actual body shape of POST /api/teams (Pages Router) */
export const TeamCreateBodySchema = z.object({
  team: z.string().min(1, "Team name is required").max(200),
});
export type TeamCreateBodyInput = z.infer<typeof TeamCreateBodySchema>;

export const TeamUpdateNameSchema = z.object({
  name: z.string().min(1, "Team name is required").max(200),
});
export type TeamUpdateNameInput = z.infer<typeof TeamUpdateNameSchema>;

export const TeamInviteSchema = z.object({
  email: z.string().email().max(254),
  role: z.string().max(50).optional(),
});
export type TeamInviteInput = z.infer<typeof TeamInviteSchema>;

export const TeamChangeRoleSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
  role: z.enum(["OWNER", "ADMIN", "MANAGER", "MEMBER"]),
});
export type TeamChangeRoleInput = z.infer<typeof TeamChangeRoleSchema>;

/** Schema matching the actual body shape of PUT /api/teams/:teamId/change-role */
export const ChangeRoleBodySchema = z.object({
  userToBeChanged: z.string().min(1, "User ID is required"),
  role: z.enum(["MEMBER", "MANAGER", "ADMIN"]),
});
export type ChangeRoleBodyInput = z.infer<typeof ChangeRoleBodySchema>;

export const TeamRemoveMemberSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
});
export type TeamRemoveMemberInput = z.infer<typeof TeamRemoveMemberSchema>;

export const CrmRoleUpdateSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  crmRole: z.enum(["VIEWER", "CONTRIBUTOR", "MANAGER"]),
});
export type CrmRoleUpdateInput = z.infer<typeof CrmRoleUpdateSchema>;

// ---------------------------------------------------------------------------
// Contacts / CRM
// ---------------------------------------------------------------------------

export const ContactCreateSchema = z.object({
  email: z.string().email().max(254),
  firstName: z.string().max(200).optional().nullable(),
  lastName: z.string().max(200).optional().nullable(),
  company: z.string().max(255).optional().nullable(),
  title: z.string().max(255).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  source: z.string().max(50).optional().nullable(),
  status: z.string().max(50).optional().nullable(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  notes: z.string().max(5000).optional().nullable(),
  investorId: z.string().max(100).optional().nullable(),
  assignedToId: z.string().max(100).optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional().nullable(),
  referralSource: z.string().max(255).optional().nullable(),
});
export type ContactCreateInput = z.infer<typeof ContactCreateSchema>;

export const ContactUpdateSchema = z.object({
  email: z.string().email().max(254).optional(),
  firstName: z.string().max(200).optional().nullable(),
  lastName: z.string().max(200).optional().nullable(),
  company: z.string().max(255).optional().nullable(),
  title: z.string().max(255).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  source: z.string().max(50).optional().nullable(),
  status: z.string().max(50).optional().nullable(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  notes: z.string().max(5000).optional().nullable(),
  nextFollowUpDate: z.string().max(30).optional().nullable(),
  engagementScore: z.coerce.number().min(0).max(100).optional(),
  assignedToId: z.string().max(100).optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional().nullable(),
  referralSource: z.string().max(255).optional().nullable(),
});
export type ContactUpdateInput = z.infer<typeof ContactUpdateSchema>;

export const ContactStatusUpdateSchema = z.object({
  status: z.string().min(1, "Status is required").max(50),
});
export type ContactStatusUpdateInput = z.infer<typeof ContactStatusUpdateSchema>;

export const ContactFollowUpSchema = z.object({
  nextFollowUpDate: z.string().max(30).nullable(),
});
export type ContactFollowUpInput = z.infer<typeof ContactFollowUpSchema>;

export const ContactNoteCreateSchema = z.object({
  content: z.string().min(1, "Note content is required").max(10000),
  isPinned: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
});
export type ContactNoteCreateInput = z.infer<typeof ContactNoteCreateSchema>;

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const DocumentCreateSchema = z.object({
  name: z.string().min(1, "Document name is required").max(255),
  url: z.string().max(2048).optional(),
  storageType: z.string().max(50).optional(),
  type: z.string().max(50).optional(),
  contentType: z.string().max(100).optional(),
  numPages: z.coerce.number().int().min(0).optional(),
  folderId: z.string().max(100).optional().nullable(),
  teamId: z.string().max(100).optional(),
});
export type DocumentCreateInput = z.infer<typeof DocumentCreateSchema>;

export const DocumentUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  folderId: z.string().max(100).optional().nullable(),
  advancedExcelEnabled: z.boolean().optional(),
  agentsEnabled: z.boolean().optional(),
  description: z.string().max(500).optional().nullable(),
});
export type DocumentUpdateInput = z.infer<typeof DocumentUpdateSchema>;

/** Schema for PUT /api/teams/:teamId/documents/:id — move document to folder */
export const DocumentMoveToFolderSchema = z.object({
  folderId: z.string().min(1, "Folder ID is required").max(100),
  currentPathName: z.string().max(1000),
});
export type DocumentMoveToFolderInput = z.infer<typeof DocumentMoveToFolderSchema>;

export const DocumentMoveSchema = z.object({
  documentIds: z.array(z.string().max(100)).min(1).max(100),
  folderId: z.string().max(100).nullable(),
});
export type DocumentMoveInput = z.infer<typeof DocumentMoveSchema>;

// ---------------------------------------------------------------------------
// Datarooms
// ---------------------------------------------------------------------------

export const DataroomCreateSchema = z.object({
  name: z.string().min(1, "Dataroom name is required").max(255),
  ppiShield: z.boolean().optional(),
});
export type DataroomCreateInput = z.infer<typeof DataroomCreateSchema>;

export const DataroomUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  ppiShield: z.boolean().optional(),
  conversationsEnabled: z.boolean().optional(),
  showLastUpdated: z.boolean().optional(),
  allowBulkDownload: z.boolean().optional(),
  enableChangeNotifications: z.boolean().optional(),
  defaultPermissionStrategy: z.string().max(50).optional(),
  tags: z.array(z.string().max(100)).max(100).optional(),
  agentsEnabled: z.boolean().optional(),
});
export type DataroomUpdateInput = z.infer<typeof DataroomUpdateSchema>;

export const DataroomDocumentAddSchema = z.object({
  documentId: z.string().min(1, "Document ID is required").max(100),
  folderId: z.string().max(100).optional().nullable(),
  folderPathName: z.string().max(1000).optional(),
});
export type DataroomDocumentAddInput = z.infer<typeof DataroomDocumentAddSchema>;

export const DataroomFolderCreateSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(255),
  path: z.string().max(1000).optional(),
  parentId: z.string().max(100).optional().nullable(),
});
export type DataroomFolderCreateInput = z.infer<typeof DataroomFolderCreateSchema>;

export const DataroomGroupCreateSchema = z.object({
  name: z.string().min(1, "Group name is required").max(255),
});
export type DataroomGroupCreateInput = z.infer<typeof DataroomGroupCreateSchema>;

export const DataroomGroupUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  allowAll: z.boolean().optional(),
  domains: z.array(z.string().max(253)).max(100).optional(),
});
export type DataroomGroupUpdateInput = z.infer<typeof DataroomGroupUpdateSchema>;

/** @deprecated Use DataroomGroupMembersBulkAddSchema for the actual route body shape */
export const DataroomGroupMemberAddSchema = z.object({
  email: z.string().email().max(254),
});
export type DataroomGroupMemberAddInput = z.infer<typeof DataroomGroupMemberAddSchema>;

/** Schema matching the actual body shape of POST /api/teams/:teamId/datarooms/:id/groups/:groupId/members */
export const DataroomGroupMembersBulkAddSchema = z.object({
  emails: z.array(z.string().email().max(254)).min(1).max(100),
  domains: z.array(z.string().max(253)).max(100),
  allowAll: z.boolean(),
});
export type DataroomGroupMembersBulkAddInput = z.infer<typeof DataroomGroupMembersBulkAddSchema>;

export const DataroomQuickAddSchema = z.object({
  documentIds: z.array(z.string().max(100)).min(1).max(100).optional(),
  folderPath: z.string().max(1000).optional(),
});
export type DataroomQuickAddInput = z.infer<typeof DataroomQuickAddSchema>;

export const DataroomInviteSchema = z.object({
  emails: z.array(z.string().email().max(254)).min(1).max(100),
  message: z.string().max(2000).optional().nullable(),
});
export type DataroomInviteInput = z.infer<typeof DataroomInviteSchema>;

/** Schema for POST quick-add and quick-add/invite routes — email list */
export const QuickAddEmailsSchema = z.object({
  emails: z.array(z.string().email().max(254)).min(1, "At least one email is required").max(200),
});
export type QuickAddEmailsInput = z.infer<typeof QuickAddEmailsSchema>;

export const DataroomReorderSchema = z.object({
  items: z.array(z.object({
    id: z.string().max(100),
    orderIndex: z.coerce.number().int().min(0),
  })).min(1).max(500),
});
export type DataroomReorderInput = z.infer<typeof DataroomReorderSchema>;

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export const LinkUpdateSchema = z.object({
  name: z.string().max(255).optional(),
  password: z.string().max(100).optional().nullable(),
  emailProtected: z.boolean().optional(),
  allowDownload: z.boolean().optional(),
  enableNotification: z.boolean().optional(),
  enableWatermark: z.boolean().optional(),
  enableAgreement: z.boolean().optional(),
  enableScreenshotProtection: z.boolean().optional(),
  enableFeedback: z.boolean().optional(),
  enableQuestion: z.boolean().optional(),
  allowList: z.array(z.string().max(254)).max(100).optional(),
  denyList: z.array(z.string().max(254)).max(100).optional(),
  expiresAt: z.string().max(30).optional().nullable(),
  metaTitle: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(500).optional().nullable(),
  metaImage: z.string().max(2048).optional().nullable(),
  showBanner: z.boolean().optional(),
  enableAccreditation: z.boolean().optional(),
  accreditationType: z.string().max(50).optional().nullable(),
  accreditationMessage: z.string().max(2000).optional().nullable(),
});
export type LinkUpdateInput = z.infer<typeof LinkUpdateSchema>;

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export const FolderCreateSchema = z.object({
  name: z.string().min(1, "Folder name is required").max(255),
  path: z.string().max(1000).optional(),
  parentId: z.string().max(100).optional().nullable(),
});
export type FolderCreateInput = z.infer<typeof FolderCreateSchema>;

export const FolderMoveSchema = z.object({
  folderId: z.string().min(1).max(100),
  destinationId: z.string().max(100).nullable(),
});
export type FolderMoveInput = z.infer<typeof FolderMoveSchema>;

/** Schema for PATCH /api/teams/:teamId/folders/move — bulk move folders */
export const FoldersBulkMoveSchema = z.object({
  folderIds: z.array(z.string().min(1).max(100)).min(1).max(100),
  selectedFolder: z.string().max(100).nullable(),
  selectedFolderPath: z.string().max(1000),
});
export type FoldersBulkMoveInput = z.infer<typeof FoldersBulkMoveSchema>;

/** Schema for PUT /api/teams/:teamId/folders/manage — rename folder */
export const FolderRenameSchema = z.object({
  folderId: z.string().min(1, "Folder ID is required").max(100),
  name: z.string().min(1, "Folder name is required").max(255),
});
export type FolderRenameInput = z.infer<typeof FolderRenameSchema>;

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const NotificationUpdateSchema = z.object({
  ids: z.array(z.string().max(100)).min(1).max(100).optional(),
  readAll: z.boolean().optional(),
});
export type NotificationUpdateInput = z.infer<typeof NotificationUpdateSchema>;

export const NotificationPreferencesSchema = z.object({
  emailDocumentViewed: z.boolean().optional(),
  emailSignatureComplete: z.boolean().optional(),
  emailCapitalCall: z.boolean().optional(),
  emailDistribution: z.boolean().optional(),
  emailNewDocument: z.boolean().optional(),
  emailWeeklyDigest: z.boolean().optional(),
  pushDocumentViewed: z.boolean().optional(),
  pushSignatureComplete: z.boolean().optional(),
  pushCapitalCall: z.boolean().optional(),
  pushDistribution: z.boolean().optional(),
  pushNewDocument: z.boolean().optional(),
  emailDigestFrequency: z.enum(["REALTIME", "DAILY", "WEEKLY", "NEVER"]).optional(),
});
export type NotificationPreferencesInput = z.infer<typeof NotificationPreferencesSchema>;

export const NotificationSubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2048),
    keys: z.object({
      p256dh: z.string().max(500),
      auth: z.string().max(500),
    }),
  }),
});
export type NotificationSubscribeInput = z.infer<typeof NotificationSubscribeSchema>;

/** Flat push subscription schema matching the actual body of POST /api/notifications/subscribe */
export const PushSubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  p256dh: z.string().min(1, "p256dh key is required").max(500),
  auth: z.string().min(1, "Auth key is required").max(500),
  userAgent: z.string().max(500).optional(),
});
export type PushSubscribeInput = z.infer<typeof PushSubscribeSchema>;

/** Schema for DELETE /api/notifications/subscribe */
export const PushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});
export type PushUnsubscribeInput = z.infer<typeof PushUnsubscribeSchema>;

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export const FeedbackCreateSchema = z.object({
  message: z.string().min(1, "Message is required").max(5000),
  page: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
});
export type FeedbackCreateInput = z.infer<typeof FeedbackCreateSchema>;

/** Schema for viewer feedback responses (answer to a link-attached question) */
export const FeedbackResponseSchema = z.object({
  answer: z.string().min(1, "Answer is required").max(5000),
  feedbackId: z.string().min(1, "Feedback ID is required").max(100),
  viewId: z.string().min(1, "View ID is required").max(100),
});
export type FeedbackResponseInput = z.infer<typeof FeedbackResponseSchema>;

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------

export const BrandingUpdateSchema = z.object({
  logo: z.string().max(2048).optional().nullable(),
  banner: z.string().max(2048).optional().nullable(),
  brandColor: z.string().max(20).optional().nullable(),
  accentColor: z.string().max(20).optional().nullable(),
  welcomeMessage: z.string().max(5000).optional().nullable(),
});
export type BrandingUpdateInput = z.infer<typeof BrandingUpdateSchema>;

// ---------------------------------------------------------------------------
// Investor Stage
// ---------------------------------------------------------------------------

export const InvestorStageUpdateSchema = z.object({
  stage: z.string().min(1, "Stage is required").max(50),
  reason: z.string().max(1000).optional().nullable(),
});
export type InvestorStageUpdateInput = z.infer<typeof InvestorStageUpdateSchema>;

// ---------------------------------------------------------------------------
// Settings Toggles
// ---------------------------------------------------------------------------

export const AdvancedModeToggleSchema = z.object({
  advancedModeEnabled: z.boolean(),
});
export type AdvancedModeToggleInput = z.infer<typeof AdvancedModeToggleSchema>;

export const EnableExcelAdvancedModeSchema = z.object({
  enableExcelAdvancedMode: z.boolean(),
});
export type EnableExcelAdvancedModeInput = z.infer<typeof EnableExcelAdvancedModeSchema>;

export const EncryptionSettingsSchema = z.object({
  enforceNda: z.boolean().optional(),
  encryptDocuments: z.boolean().optional(),
});
export type EncryptionSettingsInput = z.infer<typeof EncryptionSettingsSchema>;

// ---------------------------------------------------------------------------
// Domain & Email
// ---------------------------------------------------------------------------

export const DomainCreateSchema = z.object({
  domain: z.string().min(1, "Domain is required").max(253),
});
export type DomainCreateInput = z.infer<typeof DomainCreateSchema>;

export const EmailDomainSetupSchema = z.object({
  domain: z.string().min(1).max(253).optional(),
  emailFromName: z.string().max(200).optional().nullable(),
  emailFromAddress: z.string().email().max(254).optional().nullable(),
  emailReplyTo: z.string().email().max(254).optional().nullable(),
});
export type EmailDomainSetupInput = z.infer<typeof EmailDomainSetupSchema>;

// ---------------------------------------------------------------------------
// Tokens / Webhooks
// ---------------------------------------------------------------------------

export const TokenCreateSchema = z.object({
  name: z.string().min(1, "Token name is required").max(200),
});
export type TokenCreateInput = z.infer<typeof TokenCreateSchema>;

export const WebhookCreateSchema = z.object({
  url: z.string().url().max(2048),
  events: z.array(z.string().max(100)).min(1).max(50).optional(),
  secret: z.string().max(200).optional(),
});
export type WebhookCreateInput = z.infer<typeof WebhookCreateSchema>;

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const ReportGenerateSchema = z.object({
  templateId: z.string().max(100).optional(),
  fundId: z.string().max(100).optional(),
  dateRange: z.object({
    start: z.string().max(30),
    end: z.string().max(30),
  }).optional(),
  format: z.enum(["pdf", "csv", "json"]).optional(),
});
export type ReportGenerateInput = z.infer<typeof ReportGenerateSchema>;

export const ReportTemplateCreateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  config: z.record(z.string(), z.unknown()).optional(),
});
export type ReportTemplateCreateInput = z.infer<typeof ReportTemplateCreateSchema>;

// ---------------------------------------------------------------------------
// Agreements
// ---------------------------------------------------------------------------

export const AgreementCreateSchema = z.object({
  name: z.string().min(1, "Agreement name is required").max(255),
  content: z.string().min(1, "Content is required").max(100_000),
});
export type AgreementCreateInput = z.infer<typeof AgreementCreateSchema>;

// ---------------------------------------------------------------------------
// Signature Documents (Pages Router)
// ---------------------------------------------------------------------------

export const SignatureDocumentCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(2000).optional().nullable(),
  file: z.string().min(1, "File is required").max(2048),
  storageType: z.string().max(50).optional(),
  emailSubject: z.string().max(500).optional().nullable(),
  emailMessage: z.string().max(5000).optional().nullable(),
  recipients: z.array(z.object({
    name: z.string().max(200).optional(),
    email: z.string().email().max(254).optional(),
    role: z.string().max(50).optional(),
    signingOrder: z.coerce.number().int().min(1).optional(),
  })).max(100).optional(),
  status: z.string().max(50).optional(),
  expirationDate: z.string().max(30).optional().nullable(),
  fundId: z.string().max(100).optional().nullable(),
  documentType: z.string().max(50).optional().nullable(),
  requiredForOnboarding: z.boolean().optional(),
});
export type SignatureDocumentCreateInput = z.infer<typeof SignatureDocumentCreateSchema>;

export const SignatureDocumentUpdateSchema = z.object({
  title: z.string().max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  emailSubject: z.string().max(500).optional().nullable(),
  emailMessage: z.string().max(5000).optional().nullable(),
  status: z.string().max(50).optional(),
  expirationDate: z.string().max(30).optional().nullable(),
  voidedReason: z.string().max(2000).optional().nullable(),
  documentType: z.string().max(50).optional().nullable(),
  requiredForOnboarding: z.boolean().optional(),
});
export type SignatureDocumentUpdateInput = z.infer<typeof SignatureDocumentUpdateSchema>;

export const SignatureFieldsSchema = z.object({
  fields: z.array(z.object({
    id: z.string().max(100).optional(),
    type: z.string().max(50),
    pageNumber: z.coerce.number().int().min(1),
    x: z.coerce.number().min(0),
    y: z.coerce.number().min(0),
    width: z.coerce.number().min(0),
    height: z.coerce.number().min(0),
    label: z.string().max(200).optional(),
    required: z.boolean().optional(),
    recipientId: z.string().max(100).optional().nullable(),
    recipientIndex: z.coerce.number().int().min(0).optional(),
    value: z.string().max(5000).optional().nullable(),
    options: z.array(z.string().max(500)).max(100).optional().nullable(),
    fieldFormat: z.string().max(50).optional().nullable(),
    groupId: z.string().max(100).optional().nullable(),
    minValue: z.coerce.number().optional().nullable(),
    maxValue: z.coerce.number().optional().nullable(),
  })).max(200),
});
export type SignatureFieldsInput = z.infer<typeof SignatureFieldsSchema>;

export const SignatureBulkCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(2000).optional().nullable(),
  file: z.union([
    z.string().min(1).max(2048),
    z.object({
      url: z.string().max(2048).optional(),
      key: z.string().max(2048).optional(),
      numPages: z.coerce.number().int().min(1).optional(),
    }),
  ]),
  storageType: z.string().max(50).optional().nullable(),
  emailSubject: z.string().max(500).optional().nullable(),
  emailMessage: z.string().max(5000).optional().nullable(),
  recipients: z.array(z.object({
    name: z.string().min(1).max(200),
    email: z.string().email().max(254),
  })).min(1, "At least one recipient is required").max(100),
});
export type SignatureBulkCreateInput = z.infer<typeof SignatureBulkCreateSchema>;

export const SignatureTemplateCreateSchema = z.object({
  name: z.string().min(1, "Template name is required").max(255),
  description: z.string().max(2000).optional().nullable(),
  file: z.string().min(1, "File is required").max(2048),
  storageType: z.string().max(50).optional(),
  numPages: z.coerce.number().int().min(1).optional(),
  defaultRecipients: z.unknown().optional(),
  fields: z.unknown().optional(),
  defaultEmailSubject: z.string().max(500).optional().nullable(),
  defaultEmailMessage: z.string().max(5000).optional().nullable(),
  defaultExpirationDays: z.coerce.number().int().min(1).max(365).optional().nullable(),
  content: z.string().max(500_000).optional(),
  documentType: z.string().max(50).optional(),
});
export type SignatureTemplateCreateInput = z.infer<typeof SignatureTemplateCreateSchema>;

// ---------------------------------------------------------------------------
// Q&A
// ---------------------------------------------------------------------------

export const QAReplySchema = z.object({
  content: z.string().min(1, "Reply content is required").max(5000),
});
export type QAReplyInput = z.infer<typeof QAReplySchema>;

export const QAStatusSchema = z.object({
  status: z.enum(["OPEN", "ANSWERED", "CLOSED"]),
});
export type QAStatusInput = z.infer<typeof QAStatusSchema>;

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export const AccountUpdateSchema = z.object({
  name: z.string().max(200).optional(),
  image: z.string().max(2048).optional().nullable(),
});
export type AccountUpdateInput = z.infer<typeof AccountUpdateSchema>;

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export const TransactionCreateSchema = z.object({
  investmentId: z.string().min(1, "Investment ID is required").max(100),
  type: z.string().max(50).optional(),
  amount: z.coerce.number().positive().max(MAX_AMOUNT),
  description: z.string().max(2000).optional().nullable(),
  transactionDate: z.string().max(30).optional(),
});
export type TransactionCreateInput = z.infer<typeof TransactionCreateSchema>;

/** Schema for POST /api/transactions (Pages Router) — capital call or distribution initiation */
export const TransactionInitiateSchema = z.object({
  type: z.enum(["CAPITAL_CALL", "DISTRIBUTION"]),
  investorId: z.string().min(1, "Investor ID is required").max(100),
  fundId: z.string().min(1, "Fund ID is required").max(100),
  amount: z.coerce.number().positive("Amount must be positive").max(MAX_AMOUNT),
  description: z.string().max(2000).optional().nullable(),
  capitalCallId: z.string().max(100).optional().nullable(),
  distributionId: z.string().max(100).optional().nullable(),
  bankLinkId: z.string().max(100).optional().nullable(),
});
export type TransactionInitiateInput = z.infer<typeof TransactionInitiateSchema>;

// ---------------------------------------------------------------------------
// Viewer Notes & Questions
// ---------------------------------------------------------------------------

export const ViewerNoteSchema = z.object({
  viewId: z.string().min(1, "View ID is required").max(100),
  content: z.string().min(1, "Note content is required").max(5000),
  pageNumber: z.coerce.number().int().min(0).optional(),
  documentId: z.string().max(100).optional(),
  dataroomId: z.string().max(100).optional(),
  linkId: z.string().max(100).optional(),
  viewerEmail: z.string().max(254).optional(),
  viewerName: z.string().max(200).optional(),
});
export type ViewerNoteInput = z.infer<typeof ViewerNoteSchema>;

export const ViewerQuestionSchema = z.object({
  viewId: z.string().min(1, "View ID is required").max(100),
  content: z.string().min(1, "Question content is required").max(5000),
  pageNumber: z.coerce.number().int().min(0).optional(),
  documentId: z.string().max(100).optional(),
  dataroomId: z.string().max(100).optional(),
  linkId: z.string().max(100).optional(),
  viewerEmail: z.string().max(254).optional(),
  viewerName: z.string().max(200).optional(),
});
export type ViewerQuestionInput = z.infer<typeof ViewerQuestionSchema>;

// ---------------------------------------------------------------------------
// Toggle FundRoom Access
// ---------------------------------------------------------------------------

export const ToggleFundroomAccessSchema = z.object({
  userId: z.string().min(1).max(100),
  hasFundroomAccess: z.boolean(),
  enabled: z.boolean().optional(),
  mode: z.string().max(50).optional().nullable(),
});
export type ToggleFundroomAccessInput = z.infer<typeof ToggleFundroomAccessSchema>;

// ---------------------------------------------------------------------------
// FundRoom Activation Management
// ---------------------------------------------------------------------------

export const FundroomActivationActionSchema = z.object({
  action: z.enum(["activate", "suspend", "deactivate", "reactivate"]),
  reason: z.string().max(1000).optional().nullable(),
  fundId: z.string().max(100).optional().nullable(),
  mode: z.string().max(50).optional().nullable(),
});
export type FundroomActivationActionInput = z.infer<typeof FundroomActivationActionSchema>;

// ---------------------------------------------------------------------------
// Platform Settings (admin)
// ---------------------------------------------------------------------------

export const PlatformSettingsUpdateSchema = z.object({
  paywallEnforced: z.boolean().optional(),
  paywallBypassUntil: z.string().max(30).optional().nullable(),
  registrationOpen: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().max(2000).optional().nullable(),
});
export type PlatformSettingsUpdateInput = z.infer<typeof PlatformSettingsUpdateSchema>;

// ---------------------------------------------------------------------------
// Platform Organizations (admin)
// ---------------------------------------------------------------------------

export const PlatformOrgUpdateSchema = z.object({
  orgId: z.string().min(1, "Organization ID is required"),
  subscriptionTier: z.string().max(50).optional(),
  aiCrmEnabled: z.boolean().optional(),
});
export type PlatformOrgUpdateInput = z.infer<typeof PlatformOrgUpdateSchema>;
