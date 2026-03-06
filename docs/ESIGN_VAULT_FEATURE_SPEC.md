# SignSuite & Document Vault — Feature Specification v1.0

> **Status:** Phase 2 In Progress (Standalone Envelope System shipped Feb 20, 2026)
> **Author:** FundRoom Engineering
> **Date:** February 20, 2026 (updated)
> **Category:** Product Expansion — E-Signature Platform + Document Vault
>
> ### Phase 2 Implementation Status (Feb 20, 2026)
>
> The following Phase 2 features have been **implemented**:
>
> | Feature | Files | Status |
> |---------|-------|--------|
> | Standalone Envelope System | `lib/esign/envelope-service.ts` (561 lines) | ✅ SHIPPED |
> | 16 Field Types (incl. Dropdown, Radio, Numeric, Currency, Attachment, Formula) | `lib/esign/field-types.ts` (489 lines) | ✅ SHIPPED |
> | Document Filing Service (Org Vault + Contact Vault + Email) | `lib/esign/document-filing-service.ts` (568 lines) | ✅ SHIPPED |
> | Signing Session (token auth, group ordering, ESIGN/UETA consent) | `lib/esign/signing-session.ts` (479 lines) | ✅ SHIPPED |
> | 9 API Routes (`/api/esign/*`) | `app/api/esign/` (9 route files) | ✅ SHIPPED |
> | Sequential/Parallel/Mixed Signing Modes | Envelope model + service | ✅ SHIPPED |
> | Contact Vault Auto-Provisioning | DocumentFiling + ContactVault models | ✅ SHIPPED |
> | SHA-256 Audit Trail for Filed Documents | DocumentFiling model | ✅ SHIPPED |
> | 5 New Prisma Models | Envelope, EnvelopeRecipient, ContactVault, DocumentFiling, VerificationCode | ✅ SHIPPED |
> | 6 New Prisma Enums | SigningMode, EnvelopeStatus, EnvelopeRecipientRole/Status, DocumentFilingSourceType/DestType | ✅ SHIPPED |
>
> **Remaining Phase 2 (not yet built):**
> - Drag-drop field editor UI
> - Bulk send UI
> - Template library UI
> - Reminder email automation (API exists, email sends are TODO)
> - Analytics dashboard for envelopes
> - External signer landing page UI

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [Vision & Strategy](#vision--strategy)
- [Part 1: SignSuite — E-Signature Platform](#part-1-fundroom-sign--e-signature-platform)
  - [Current State (MVP)](#current-state-mvp)
  - [Phase 2: Full E-Signature Platform](#phase-2-full-e-signature-platform)
  - [Phase 3: DocuSign Competitor Features](#phase-3-docusign-competitor-features)
- [Part 2: Secure Document Vault](#part-2-secure-document-vault)
  - [Investor Document Vault (Current)](#investor-document-vault-current)
  - [External Partner Vault](#external-partner-vault)
  - [Phase 2: Advanced Vault Features](#phase-2-advanced-vault-features)
- [Part 3: UI/UX Flows](#part-3-uiux-flows)
  - [GP Document Preparation Flow](#gp-document-preparation-flow)
  - [LP Signing Experience](#lp-signing-experience)
  - [External Signer Flow](#external-signer-flow)
  - [Vault Access Flow](#vault-access-flow)
- [Part 4: Technical Architecture](#part-4-technical-architecture)
  - [Data Models](#data-models)
  - [Storage Architecture](#storage-architecture)
  - [Security & Encryption](#security--encryption)
  - [API Design](#api-design)
- [Part 5: Competitive Analysis](#part-5-competitive-analysis)
- [Part 6: Pricing & Monetization](#part-6-pricing--monetization)
- [Part 7: Roadmap & Milestones](#part-7-roadmap--milestones)
- [Appendix: Key Files](#appendix-key-files)

---

## Executive Summary

SignSuite is FundRoom's **native, zero-external-cost** e-signature platform purpose-built for fund operations. Unlike generic e-signature tools (DocuSign, PandaDoc), SignSuite deeply integrates with the investor lifecycle — auto-filling subscription agreements from investor profiles, enforcing SEC compliance fields, and feeding signed documents directly into the investor vault.

This spec outlines the evolution from the current MVP (functional but basic e-signature for LP onboarding) to a full-featured e-signature platform that can:

1. **Replace DocuSign/PandaDoc** for fund managers (zero per-envelope cost)
2. **Serve as a standalone product** for non-fund document signing
3. **Power a Secure Document Vault** for investor records, external partners, and compliance archival
4. **Offer API access** for third-party integrations and white-label embedding

**Key differentiators over DocuSign/PandaDoc:**
- Zero per-envelope cost (native, not API-based)
- Deep SEC compliance integration (accreditation fields, Form D auto-fill, audit trails)
- Investor profile auto-fill (entity details, addresses, tax IDs flow into documents)
- Fund-specific document types (subscription agreements, side letters, K-1s, capital call notices)
- Integrated investor vault (signed documents automatically stored in LP's secure vault)
- White-label ready (GP branding on signing experience)

---

## Vision & Strategy

### Three-Horizon Strategy

```
Horizon 1 (Current MVP):
  Native e-signature for LP onboarding
  - Sequential signing (NDA → Sub Ag → LPA → Side Letter)
  - Canvas signature capture (draw/type/upload)
  - PDF flattening with Certificate of Completion
  - Auto-advancement on signing completion
  - Fund-scoped document management

Horizon 2 (Phase 2 — Q2 2026):
  Full e-signature platform
  - Drag-and-drop field placement editor
  - Bulk send with mail merge
  - Template library with merge fields
  - Signing reminders & expiration
  - External signer support (outside FundRoom)
  - Document analytics (view time, completion rate)
  - API access for third-party integration

Horizon 3 (Phase 3 — Q3-Q4 2026):
  DocuSign competitor + Document Vault SaaS
  - Standalone signing (no fund required)
  - Secure vault for any organization
  - Workflow automation (conditional routing, approval chains)
  - Payment collection on signature
  - Notarization integration
  - Advanced compliance (HIPAA BAA, SOC 2)
  - White-label / embed SDK
  - Marketplace for document templates
```

### Target Users

| User Type | Use Case | Priority |
|-----------|----------|----------|
| **GP Fund Managers** | LP onboarding documents, side letters, capital calls | P0 (current) |
| **Startup Founders** | SAFE agreements, convertible notes, SPA/IRA | P0 (current) |
| **LP Investors** | Signing + vault access for their investment documents | P0 (current) |
| **Law Firms** | Client document execution, engagement letters | P1 (Phase 2) |
| **Accountants** | Tax documents (K-1 distribution), engagement letters | P1 (Phase 2) |
| **External Signers** | Anyone sent a document link (no account needed) | P1 (Phase 2) |
| **API Developers** | Embed signing into their own applications | P2 (Phase 3) |

---

## Part 1: SignSuite — E-Signature Platform

### Current State (MVP)

The current e-signature system is production-ready for LP onboarding. Here's what exists today:

#### Components (~5,200+ lines)

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| FundRoomSign (consolidated) | `components/esign/FundRoomSign.tsx` | 1,266 | Split-screen signing: PDF viewer (left) + auto-filled fields + signature capture (right). Multi-doc queue with sequential locking |
| EnhancedSignaturePad | `components/signature/enhanced-signature-pad.tsx` | 612 | Canvas drawing with Pointer Events, typed signatures (3 cursive fonts), image upload (PNG/JPG, 2MB max) |
| PDFSignatureViewer | `components/signature/pdf-signature-viewer.tsx` | 382 | PDF rendering via react-pdf with clickable signature field overlays, zoom (50-250%), mobile-responsive |
| SequentialSigningFlow | `components/signature/sequential-signing-flow.tsx` | 552 | Document queue (NDA → Sub Ag → LPA → Side Letter), sequential locking, progress bar |
| Public Signing Page | `app/view/sign/[token]/page-client.tsx` | 926 | Token-based signing (no auth required), field overlays on PDF pages |
| Internal Signing Page | `app/sign/[id]/page-client.tsx` | 828 | Authenticated signing for team members |

#### API Routes

| Endpoint | File | Purpose |
|----------|------|---------|
| GET/POST `/api/sign/[token]` | `pages/api/sign/[token].ts` (846 lines) | Token-based signing: GET returns document + fields, POST submits signatures. Rate limited (GET: 30/min, POST: 10/min). Auto-flattens on completion |
| GET `/api/documents/[docId]/sign-data` | `pages/api/documents/[docId]/sign-data.ts` | Returns document + fields + recipient info + auto-fill data |
| GET `/api/documents/[docId]/signed-pdf` | `pages/api/documents/[docId]/signed-pdf.ts` | Returns signed PDF URL for completed documents |
| POST `/api/signatures/capture` | `pages/api/signatures/capture.ts` | Stores base64 signature for reuse across documents |
| GET `/api/lp/signing-documents` | `pages/api/lp/signing-documents.ts` | LP's assigned documents filtered by fund, with progress tracking |

#### Libraries

| Library | File | Purpose |
|---------|------|---------|
| PDF Flattener | `lib/signature/flatten-pdf.ts` (366 lines) | Embeds signatures + text onto PDF pages using pdf-lib. Appends Certificate of Completion. Maintains aspect ratio |
| Checksum/Consent | `lib/signature/checksum.ts` (139 lines) | SHA-256 checksums + ESIGN/UETA consent records |
| Encryption Service | `lib/signature/encryption-service.ts` | AES-256 encryption for signed document storage |

#### Schema Models

| Model | Fields | Purpose |
|-------|--------|---------|
| `SignatureDocument` | 30+ fields | Document lifecycle (DRAFT→SENT→COMPLETED), fund association, signed PDF output, audit trail |
| `SignatureRecipient` | 20+ fields | Per-signer tracking: signing order, token, status, IP, consent records, signature image |
| `SignatureField` | 15+ fields | Field placement (page, x, y, width, height), 10 field types, values |
| `SignatureTemplate` | 15+ fields | Reusable templates with default recipients and field configurations |
| `SignatureAuditLog` | 20+ fields | Per-action audit: IP, user-agent, browser, OS, device, session, geolocation |
| `EsigUsageRecord` | 10 fields | Per-team monthly usage counters (created/sent/complete) |
| `EsigUsage` | 5 fields | Per-org monthly counter for tier enforcement |

#### Current Capabilities

| Feature | Status | Notes |
|---------|--------|-------|
| Canvas signature capture (draw) | ✅ Done | Touch-optimized with Pointer Events |
| Typed signature (3 fonts) | ✅ Done | Dancing Script, Caveat, Homemade Apple |
| Upload signature image | ✅ Done | PNG/JPG, 2MB max, drag-drop |
| PDF viewing with field overlays | ✅ Done | react-pdf, zoom 50-250%, mobile responsive |
| Sequential multi-doc signing | ✅ Done | Priority order with locking |
| Auto-fill from investor profile | ✅ Done | Name, entity, amount, email, address, company |
| ESIGN/UETA consent modal | ✅ Done | Legal language, checkbox confirmation |
| PDF flattening with signatures | ✅ Done | pdf-lib, aspect ratio preserved |
| Certificate of Completion | ✅ Done | Appended to PDF with SHA-256, signer details |
| Token-based signing (no auth) | ✅ Done | Secure URL with rate limiting |
| Fund-scoped documents | ✅ Done | `requiredForOnboarding` flag |
| Auto-advance on completion | ✅ Done | Investment COMMITTED → DOCS_APPROVED |
| Signing reminders | ✅ Partial | `lastReminderSentAt` + `reminderCount` tracked, no automated scheduler |
| Template system | ✅ Partial | `SignatureTemplate` model exists, CRUD APIs built, no drag-drop editor |
| Bulk send | ❌ Not built | Model supports it, UI not built |
| External signer (non-LP) | ✅ Partial | Token-based signing works, no standalone send flow |
| Field placement editor | ❌ Not built | Fields currently placed programmatically or via seed data |

### Phase 2: Full E-Signature Platform

#### 2.1 Drag-and-Drop Field Placement Editor

**The single most important missing feature.** Currently, signature fields are placed programmatically (via seed data or API). GPs need a visual editor to place fields on any PDF.

**UI/UX:**
```
┌─────────────────────────────────────────────────────────┐
│  SignSuite — Prepare Document                       │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ FIELDS   │     ┌────────────────────────────┐          │
│          │     │                            │          │
│ [Sig]    │     │     PDF Document           │          │
│ [Init]   │     │                            │          │
│ [Date]   │     │     Drag fields from       │          │
│ [Text]   │     │     left panel onto        │          │
│ [Check]  │     │     document pages         │          │
│ [Name]   │     │                            │          │
│ [Email]  │     │  ┌──────────────────────┐  │          │
│ [Company]│     │  │ [Signature Field]    │  │          │
│ [Title]  │     │  │ Signer 1 — Required  │  │          │
│ [Address]│     │  └──────────────────────┘  │          │
│          │     │                            │          │
│ SIGNERS  │     │  ┌──────┐                  │          │
│          │     │  │[Date]│                  │          │
│ + Add    │     │  └──────┘                  │          │
│ Signer 1 │     │                            │          │
│ Signer 2 │     └────────────────────────────┘          │
│          │     < Page 1 of 12 >                        │
│ SETTINGS │                                              │
│          │  [Save Draft]  [Preview]  [Send for Signing] │
│ Expire   │                                              │
│ Remind   │                                              │
└──────────┴──────────────────────────────────────────────┘
```

**Technical approach:**
- PDF rendered via react-pdf at actual resolution
- Fields placed as absolute-positioned divs over the PDF canvas
- Drag-and-drop using HTML5 Drag API (same pattern as LP Onboarding step reorder)
- Field positions stored as percentages (x, y, width, height) — already in schema
- Each field assigned to a signer (color-coded by signer)
- Resize handles on fields (min size enforced for touch targets)
- Page navigation with field count per page
- Snap-to-grid optional alignment

**Key files to create:**
- `components/esign/field-placement-editor.tsx` — Main editor component
- `components/esign/draggable-field.tsx` — Individual draggable field
- `components/esign/signer-manager.tsx` — Add/remove/reorder signers
- `components/esign/document-prepare-page.tsx` — Full page with editor + settings

#### 2.2 Bulk Send with Mail Merge

Send the same document to multiple recipients with personalized field values.

**Flow:**
```
GP uploads PDF → Places fields → "Bulk Send" →
Select recipients (from CRM contacts / investor list / CSV) →
Map merge fields to recipient data →
Preview per-recipient → Confirm → Send all
```

**Merge fields:**
- `{{investor_name}}` — Full name from profile
- `{{investor_entity}}` — Entity name
- `{{investment_amount}}` — Commitment amount
- `{{fund_name}}` — Fund name
- `{{gp_entity}}` — GP organization name
- `{{date}}` — Current date
- `{{commitment_units}}` — Number of units
- `{{investor_address}}` — Full address
- `{{investor_email}}` — Email
- `{{investor_ssn_last4}}` — Last 4 of SSN (masked)
- `{{custom_field_N}}` — Custom fields from CSV

**Technical:**
- Each bulk send creates N individual `SignatureDocument` records
- Shared `SignatureTemplate` reference for audit
- Status tracking per recipient (pending/sent/viewed/signed)
- Batch email via Resend (tier 2, org-branded)
- Dashboard showing bulk send progress

#### 2.3 Enhanced Template Library

**Current state:** `SignatureTemplate` model exists with CRUD APIs. The `DocumentTemplateManager` component provides management UI.

**Phase 2 enhancements:**
- **Template categories:** NDA, Subscription Agreement, LPA, Side Letter, SAFE, Convertible Note, Board Consent, Custom
- **FundRoom-provided templates:** Pre-built templates for common fund documents with best-practice field placement
- **Template marketplace:** GPs can share templates (Phase 3)
- **Template versioning:** Track changes across template updates
- **Smart defaults by fund type:** When creating a new template, auto-suggest field placements based on document type

#### 2.4 Signing Reminders & Expiration

**Current state:** `lastReminderSentAt` and `reminderCount` fields exist on `SignatureRecipient`. No automated scheduler.

**Phase 2:**
- Cron job (daily) checks for unsigned documents past reminder threshold
- Configurable reminder schedule: 3 days, 7 days, 14 days (default)
- Maximum reminder count: configurable per org (default 3)
- Expiration: auto-void document after configurable period (30/60/90 days)
- Reminder email template (tier 2, org-branded)
- GP dashboard: "Awaiting Signature" queue with manual "Send Reminder" button

#### 2.5 Document Analytics

Track how recipients interact with documents before signing.

| Metric | Description | Implementation |
|--------|-------------|---------------|
| View time | Total time document was open | SignatureAuditLog `actionDuration` |
| Page dwell | Time per page | SignatureAuditLog `pageNumber` + duration |
| Completion rate | % of recipients who sign vs total sent | Aggregate from SignatureRecipient |
| Time to sign | Duration from sent to signed | `sentAt` vs `signedAt` |
| Decline rate | % of recipients who decline | SignatureRecipientStatus counts |
| Device breakdown | Desktop vs mobile vs tablet | SignatureAuditLog `device` |

#### 2.6 External Signer Support

Allow sending documents to anyone (not just LPs/team members).

**Current state:** Token-based signing already works without authentication. The gap is a **send flow** for GPs to initiate signing with external parties.

**Phase 2 flow:**
```
GP opens "New Document" → Uploads PDF → Places fields →
Adds signers: "External" tab →
  Name + Email (required)
  Access code (optional, for extra security)
  Signing order (sequential or parallel)
→ Send →
  Email with signing link → Recipient opens link →
  Token-based signing (no account needed) →
  Completed document stored in GP's vault
```

### Phase 3: DocuSign Competitor Features

#### 3.1 Standalone Signing (No Fund Required)

Remove the fund/investor dependency. Any FundRoom user can send any document for signature.

**Use cases:**
- Employment agreements
- Vendor contracts
- Client engagement letters
- Board resolutions
- Consulting agreements

#### 3.2 Workflow Automation

Conditional routing based on document content or signer actions.

```
IF signer.role === "APPROVER" AND action === "APPROVED"
  THEN route to next signer in sequence
ELSE IF action === "DECLINED"
  THEN notify sender + void remaining
ELSE IF field.value("investment_amount") > 1000000
  THEN add "Compliance Review" step before final execution
```

#### 3.3 Payment Collection on Signature

Integrate Stripe checkout into the signing flow. LP signs subscription agreement → immediately prompted to wire or pay.

#### 3.4 Notarization Integration

Partner with remote online notarization (RON) providers:
- Notarize.com
- Pavaso
- DocVerify

For documents requiring notarization (real estate closings, certain state filings).

#### 3.5 White-Label / Embed SDK

```javascript
// Third-party embed example
import { FundRoomSign } from '@fundroom/sign-sdk';

const signer = new FundRoomSign({
  apiKey: 'sk_live_...',
  branding: {
    logo: 'https://acmecapital.com/logo.png',
    primaryColor: '#1a365d',
  },
});

// Create and embed signing session
const session = await signer.createSession({
  documentUrl: 'https://storage.example.com/contract.pdf',
  signers: [
    { name: 'John Doe', email: 'john@example.com', role: 'SIGNER' },
  ],
  fields: [
    { type: 'SIGNATURE', page: 1, x: 0.1, y: 0.85, width: 0.3, height: 0.05 },
    { type: 'DATE_SIGNED', page: 1, x: 0.5, y: 0.85, width: 0.2, height: 0.03 },
  ],
  webhooks: {
    onComplete: 'https://myapp.com/api/signing-complete',
    onDecline: 'https://myapp.com/api/signing-declined',
  },
});

// Embed in iframe
document.getElementById('sign-container').innerHTML =
  `<iframe src="${session.signingUrl}" />`;
```

#### 3.6 Advanced Compliance

| Compliance | Phase | Notes |
|-----------|-------|-------|
| ESIGN Act | ✅ MVP | Consent modal, audit trail |
| UETA | ✅ MVP | Attribution, effect, record |
| SEC 506(c) | ✅ MVP | Immutable hash-chained audit log |
| eIDAS (EU) | Phase 3 | For EU fund operations |
| HIPAA BAA | Phase 3 | Healthcare fund compliance |
| SOC 2 Type II | Phase 3 | Enterprise security certification |
| 21 CFR Part 11 | Phase 3 | FDA-regulated documents |

---

## Part 2: Secure Document Vault

### Investor Document Vault (Current)

The LP Document Vault is production-ready in the current MVP.

#### Current Capabilities

| Feature | Status | Key Files |
|---------|--------|-----------|
| LP document upload | ✅ Done | `components/lp/upload-document-modal.tsx` (342 lines) |
| LP document vault view | ✅ Done | `app/lp/docs/page-client.tsx` |
| GP document review | ✅ Done | `components/documents/GPDocReview.tsx` (16KB) |
| GP upload for LP | ✅ Done | `components/documents/GPDocUpload.tsx` (14KB) |
| Status lifecycle | ✅ Done | UPLOADED → APPROVED / REJECTED / REVISION_REQUESTED |
| Auto-advance on approve | ✅ Done | `lib/investors/advance-on-doc-approval.ts` |
| Signed PDF auto-storage | ✅ Done | Flattened PDFs stored in vault after signing |
| Client-side encryption | ✅ Done | AES-256, `isClientEncrypted`, `encryptionKeyHash`, `encryptionIv` |
| 10 document types | ✅ Done | NDA, Sub Ag, LPA, Side Letter, K-1, Capital Call, etc. |
| Review history | ✅ Done | `LPDocumentReview` model with reviewer + notes |
| Offline-signed support | ✅ Done | `isOfflineSigned`, `externalSigningDate` fields |

#### Document Types (LPDocumentType enum)

```
SUBSCRIPTION_AGREEMENT
NDA
ACCREDITATION_PROOF
TAX_DOCUMENT
IDENTITY_VERIFICATION
WIRE_PROOF
SIDE_LETTER
OPERATING_AGREEMENT
FINANCIAL_STATEMENT
OTHER
```

### External Partner Vault

**Phase 2 — New capability for non-LP users.**

A secure document vault accessible to external partners (lawyers, accountants, co-GPs, advisors) without requiring fund investment.

#### Use Cases

| User | Documents | Access Level |
|------|-----------|-------------|
| Fund counsel | LPA drafts, opinion letters, regulatory filings | Read/write for fund docs |
| Auditors | Financial statements, tax returns, K-1 packages | Read-only for compliance docs |
| Co-GPs | Operating agreements, management company docs | Full access to co-GP folder |
| Placement agents | Marketing materials, DDQ, track record | Read-only + watermarked |
| Board advisors | Board minutes, resolutions, quarterly reports | Read-only per meeting |

#### Access Model

```
External Partner Vault Access:
  1. GP invites partner via email
  2. Partner receives OTP (6-digit code) — no account needed
  3. Partner enters OTP → vault opens
  4. Access scoped to specific folder(s) only
  5. All views logged in audit trail
  6. Session expires after configurable timeout (default 4 hours)
  7. Re-authentication required for each session
```

**This aligns with the user's directive:** "by default, the dataroom you do not need to sign NDA, and you should be able to access the Dataroom with just an approved email, and a verified magic link or a 6 digit code emailed to you when you try to get in. No ACCOUNT needed."

#### Partner Vault Schema (Phase 2)

```prisma
model VaultPartner {
  id        String   @id @default(cuid())
  teamId    String
  team      Team     @relation(fields: [teamId], references: [id])

  name      String
  email     String
  role      VaultPartnerRole // COUNSEL, AUDITOR, CO_GP, PLACEMENT_AGENT, ADVISOR, OTHER
  company   String?

  // Access control
  accessLevel  VaultAccessLevel // READ_ONLY, READ_WRITE, FULL
  folders      String[]  // Array of folder IDs they can access
  expiresAt    DateTime? // Access expiration

  // NDA requirement
  ndaRequired    Boolean @default(false)
  ndaSignedAt    DateTime?
  ndaDocumentId  String?

  // Auth (OTP-based, no account)
  lastOtpSentAt  DateTime?
  otpAttempts    Int @default(0)

  // Audit
  lastAccessedAt DateTime?
  accessCount    Int @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([teamId, email])
  @@index([teamId])
}

enum VaultPartnerRole {
  COUNSEL
  AUDITOR
  CO_GP
  PLACEMENT_AGENT
  ADVISOR
  OTHER
}

enum VaultAccessLevel {
  READ_ONLY
  READ_WRITE  // Can upload documents
  FULL        // Can manage folders + upload + download
}
```

### Phase 2: Advanced Vault Features

#### 2.1 Folder Structure

```
Fund Vault/
├── Formation Documents/
│   ├── LPA (executed).pdf
│   ├── Operating Agreement.pdf
│   └── Side Letters/
│       ├── Side Letter — LP Smith.pdf
│       └── Side Letter — LP Jones.pdf
├── Investor Documents/
│   ├── Subscription Agreements/
│   ├── Accreditation Proofs/
│   └── Wire Proofs/
├── Compliance/
│   ├── Form D Filing.pdf
│   ├── Blue Sky Notices/
│   └── Audit Reports/
├── Tax/
│   ├── 2025 K-1 Package/
│   └── 2024 K-1 Package/
├── Financial/
│   ├── Quarterly Reports/
│   └── Capital Account Statements/
└── External Access/
    ├── Counsel/ (shared with fund counsel)
    ├── Auditor/ (shared with auditors)
    └── Board/ (shared with advisory board)
```

#### 2.2 Document Versioning

Track revisions across document versions:

```
Subscription Agreement v3 (current)
  ├── v3 — Final (Feb 15, 2026) — signed by GP + LP
  ├── v2 — Legal review (Feb 12, 2026) — comments from counsel
  └── v1 — Draft (Feb 10, 2026) — initial template
```

#### 2.3 Watermarking

Dynamic PDF watermarking for downloaded documents:

- **Viewer watermark:** Diagonal text with viewer's name + date + "CONFIDENTIAL"
- **Download watermark:** Same as viewer + unique document ID for leak tracking
- **Configurable:** Per-folder or per-document watermark policies
- **Existing support:** `components/links/` already has watermark policies for dataroom links

#### 2.4 Document Requests

GP can request specific documents from LPs/partners:

```
GP creates "Document Request" →
  Document type (Accreditation Proof, Financial Statement, etc.)
  Due date
  Instructions
  Recipient(s)
→ Email sent with upload link →
LP/partner uploads document →
GP reviews → Approve/Request Revision
```

#### 2.5 Bulk K-1 Distribution

Annual K-1 tax document distribution flow:

```
GP uploads K-1 PDFs (bulk) →
  Auto-match to investors by name/SSN-last-4 →
  Review matching → Confirm →
  Send K-1 notification emails →
  Each LP sees K-1 in their vault →
  Track: viewed, downloaded, acknowledged
```

---

## Part 3: UI/UX Flows

### GP Document Preparation Flow

```
Step 1: Upload or Select Template
  ┌──────────────────────────────────────────┐
  │  Create New Document                      │
  │                                           │
  │  [Upload PDF]  or  [Use Template]         │
  │                                           │
  │  Templates:                               │
  │  ┌────────┐ ┌────────┐ ┌────────┐       │
  │  │  NDA   │ │ Sub Ag │ │  LPA   │       │
  │  │        │ │        │ │        │       │
  │  └────────┘ └────────┘ └────────┘       │
  │  ┌────────┐ ┌────────┐ ┌────────┐       │
  │  │ SAFE   │ │ Side   │ │ Custom │       │
  │  │        │ │ Letter │ │        │       │
  │  └────────┘ └────────┘ └────────┘       │
  └──────────────────────────────────────────┘

Step 2: Place Fields (drag-and-drop editor)
  [See Section 2.1 wireframe above]

Step 3: Add Recipients
  ┌──────────────────────────────────────────┐
  │  Who needs to sign?                       │
  │                                           │
  │  [+ From CRM] [+ From Investors] [+ New] │
  │                                           │
  │  ┌─ Signer 1 (blue) ─────────────────┐  │
  │  │ Jane Smith — jane@example.com       │  │
  │  │ Role: Signer  Order: 1             │  │
  │  └────────────────────────────────────┘  │
  │  ┌─ Signer 2 (green) ────────────────┐  │
  │  │ John Doe — john@acme.com           │  │
  │  │ Role: Signer  Order: 2             │  │
  │  └────────────────────────────────────┘  │
  │                                           │
  │  ☑ Sequential signing (recommended)       │
  │  ☐ Parallel (all sign at once)            │
  │                                           │
  │  Expiration: [30 days ▼]                  │
  │  Reminders: [Every 3 days ▼]              │
  │                                           │
  │  [Preview]  [Send for Signing]            │
  └──────────────────────────────────────────┘

Step 4: Send
  Email notification (tier 2, org-branded) →
  Recipient receives signing link →
  No account needed
```

### LP Signing Experience

Current flow (already implemented, documented here for completeness):

```
LP reaches Step 6 (Sign Documents) in onboarding →
  ┌─────────────────────────────────────────────────┐
  │  Sign Your Documents                   2 of 3    │
  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░  │
  │                                                   │
  │  ┌──────────────────────────────────────────────┐│
  │  │ ✅ NDA — Signed                              ││
  │  ├──────────────────────────────────────────────┤│
  │  │ 🔵 Subscription Agreement — Sign Now         ││
  │  ├──────────────────────────────────────────────┤│
  │  │ 🔒 LPA — Locked (complete previous first)   ││
  │  └──────────────────────────────────────────────┘│
  │                                                   │
  │  ┌─ PDF Viewer (60%) ──┬─ Fields (40%) ────────┐│
  │  │                      │ Name: Jane Smith      ││
  │  │  [PDF Document]     │ Entity: Smith LLC      ││
  │  │                      │ Amount: $100,000       ││
  │  │                      │ Date: Feb 20, 2026    ││
  │  │                      │                       ││
  │  │  🟡 Sign Here ──────│ ┌─────────────────┐   ││
  │  │                      │ │ [Draw Signature] │   ││
  │  │                      │ │  Draw | Type | ↑  │   ││
  │  │                      │ └─────────────────┘   ││
  │  │                      │                       ││
  │  │                      │ ☑ I agree to sign     ││
  │  │                      │   electronically      ││
  │  │                      │                       ││
  │  │                      │ [Sign Document]       ││
  │  └─────────────────────┴───────────────────────┘│
  └─────────────────────────────────────────────────┘
```

### External Signer Flow

```
External signer receives email →
  "You have a document to sign from [GP Company]"
  [Review & Sign] button →

Opens signing page (no login required):
  ┌─────────────────────────────────────────┐
  │  [GP Logo]  SignSuite               │
  │                                          │
  │  Access Code Required (if set):          │
  │  Enter the code sent to your email:      │
  │  [_ _ _ _ _ _]  [Verify]               │
  │                                          │
  │  ─── After verification ───              │
  │                                          │
  │  [PDF Viewer + Fields — same as above]   │
  │                                          │
  │  ESIGN Consent: ☑ I agree...             │
  │  [Sign Document]                         │
  └─────────────────────────────────────────┘
```

### Vault Access Flow

```
LP Investor Vault:
  ┌─────────────────────────────────────────┐
  │  My Documents                            │
  │                                          │
  │  Filter: [All ▼] [Status ▼] [Search...] │
  │                                          │
  │  ┌─ Subscription Agreement ────────────┐│
  │  │ ✅ Approved  •  Signed Feb 15       ││
  │  │ [View] [Download]                    ││
  │  ├─ NDA ───────────────────────────────┤│
  │  │ ✅ Approved  •  Signed Feb 14       ││
  │  │ [View] [Download]                    ││
  │  ├─ K-1 (2025) ───────────────────────┤│
  │  │ 📄 New  •  Added Feb 20            ││
  │  │ [View] [Download] [Acknowledge]      ││
  │  ├─ Wire Proof ────────────────────────┤│
  │  │ ⚠️ Revision Requested              ││
  │  │ GP Notes: "Please upload clearer..." ││
  │  │ [Upload Revised Document]            ││
  │  └────────────────────────────────────┘│
  │                                          │
  │  [+ Upload Document]                     │
  └─────────────────────────────────────────┘

External Partner Vault:
  ┌─────────────────────────────────────────┐
  │  [GP Logo]  Document Vault              │
  │                                          │
  │  Welcome, Sarah (Fund Counsel)           │
  │  Access expires: Feb 28, 2026           │
  │                                          │
  │  ┌─ Formation Documents ───────────────┐│
  │  │ 📁 3 documents                       ││
  │  │ LPA Final (v3).pdf                   ││
  │  │ Operating Agreement.pdf              ││
  │  │ Side Letter Template.docx            ││
  │  ├─ Compliance ────────────────────────┤│
  │  │ 📁 2 documents                       ││
  │  │ Form D Filing.pdf                    ││
  │  │ Blue Sky — Delaware.pdf              ││
  │  └────────────────────────────────────┘│
  │                                          │
  │  [Upload Document] (if READ_WRITE)       │
  └─────────────────────────────────────────┘
```

---

## Part 4: Technical Architecture

### Data Models

The e-signature system uses 6 core models (already in schema) plus 2 proposed additions:

#### Existing Models

```
SignatureDocument (30+ fields)
  → SignatureRecipient[] (per-signer tracking)
    → SignatureField[] (per-field values)
  → SignatureAuditLog[] (per-action audit)

SignatureTemplate (15+ fields)
  → Reusable document templates

EsigUsageRecord (per-team monthly counters)
EsigUsage (per-org monthly counters)

LPDocument (30+ fields)
  → LPDocumentReview[] (review history)
```

#### Proposed Additions (Phase 2)

```prisma
// Signing reminder schedule
model SigningReminder {
  id            String   @id @default(cuid())
  documentId    String
  recipientId   String
  scheduledAt   DateTime
  sentAt        DateTime?
  reminderType  ReminderType // FIRST, SECOND, THIRD, FINAL, EXPIRATION_WARNING

  @@index([scheduledAt])
  @@index([documentId])
}

// Bulk send batch tracking
model BulkSigningBatch {
  id          String   @id @default(cuid())
  teamId      String
  templateId  String?

  title       String
  totalCount  Int
  sentCount   Int @default(0)
  signedCount Int @default(0)

  status      BulkBatchStatus // PREPARING, SENDING, IN_PROGRESS, COMPLETED, CANCELLED

  // Merge field mapping
  mergeFieldMap Json? // { "investor_name": "column_A", ... }

  documents SignatureDocument[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([teamId])
  @@index([status])
}
```

### Storage Architecture

```
Document Storage (multi-provider):
  ├── S3 + CloudFront (primary, KMS-encrypted, per-org prefixes)
  │   └── {teamId}/{docId}/{filename}
  ├── Vercel Blob (fallback)
  └── Local filesystem (dev)

Encryption layers:
  1. Storage-level: S3 SSE-KMS or Vercel Blob encryption
  2. Application-level: AES-256 for sensitive fields (tax IDs, SSNs)
  3. Client-side: Optional client-side encryption (LPDocument.isClientEncrypted)
  4. Transport: HTTPS + HSTS (max-age=63072000)

Signed PDF pipeline:
  PDF uploaded → fields placed → sent to signers →
  signatures captured → pdf-lib flattens signatures onto pages →
  Certificate of Completion appended →
  AES-256 encrypted → stored in vault →
  signedFileUrl + signedAt updated on SignatureDocument
```

### Security & Encryption

| Layer | Technology | Implementation |
|-------|-----------|----------------|
| Token-based signing | 64-char hex token | `SignatureRecipient.signingToken` (unique) |
| Access codes | 6-digit numeric | Optional per-recipient, bcrypt hashed |
| ESIGN consent | JSON record | IP, timestamp, consent text version, user-agent |
| SHA-256 checksums | Per-document | Document hash at signing time for tamper detection |
| Immutable audit | Hash-chained log | `AuditLog` with `previousHash` → `currentHash` chain |
| Rate limiting | Tiered | GET: 30/min, POST: 10/min on signing endpoints |
| Anomaly detection | `lib/security/anomaly-detection.ts` | IP-based suspicious activity detection |

### API Design

#### Current Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/sign/[token]` | Token | Get document for signing |
| POST | `/api/sign/[token]` | Token | Submit signatures |
| GET | `/api/documents/[docId]/sign-data` | Session | Get document + auto-fill data |
| GET | `/api/documents/[docId]/signed-pdf` | Session | Get signed PDF URL |
| POST | `/api/signatures/capture` | Session | Store reusable signature |
| GET | `/api/lp/signing-documents` | Session | LP's assigned documents |
| GET/POST | `/api/teams/[teamId]/signature-documents` | Team auth | List/create signature docs |
| GET/POST | `/api/teams/[teamId]/funds/[fundId]/signature-documents` | Team auth | Fund-scoped docs |

#### Phase 2 API Additions

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/esign/documents` | API key / Session | Create new document for signing |
| GET | `/api/esign/documents/[id]` | API key / Session | Get document status + details |
| PUT | `/api/esign/documents/[id]/fields` | Session | Save field placements |
| POST | `/api/esign/documents/[id]/send` | Session | Send document for signing |
| POST | `/api/esign/documents/[id]/void` | Session | Void/cancel document |
| POST | `/api/esign/documents/[id]/remind` | Session | Send reminder to unsigned recipients |
| POST | `/api/esign/bulk` | Session | Bulk send with merge fields |
| GET | `/api/esign/templates` | Session | List available templates |
| POST | `/api/esign/templates` | Session | Create template from document |
| POST | `/api/vault/partners/invite` | Session | Invite external partner to vault |
| POST | `/api/vault/partners/[id]/otp` | Public | Request vault OTP |
| POST | `/api/vault/partners/[id]/verify` | Public | Verify OTP + start session |
| GET | `/api/vault/[partnerId]/documents` | Partner token | List accessible documents |

#### Webhook Events (Phase 2)

```json
{
  "event": "document.completed",
  "timestamp": "2026-02-20T10:30:00Z",
  "data": {
    "documentId": "clxyz...",
    "title": "Subscription Agreement",
    "completedAt": "2026-02-20T10:30:00Z",
    "signers": [
      {
        "name": "Jane Smith",
        "email": "jane@example.com",
        "signedAt": "2026-02-20T10:28:00Z"
      }
    ],
    "signedPdfUrl": "https://..."
  }
}
```

Events:
- `document.sent` — Document sent to first/next signer
- `document.viewed` — Signer opened the document
- `document.signed` — A signer completed their fields
- `document.completed` — All signers completed
- `document.declined` — A signer declined
- `document.voided` — Sender voided the document
- `document.expired` — Document expired without completion
- `document.reminder_sent` — Reminder email sent

---

## Part 5: Competitive Analysis

### SignSuite vs DocuSign vs PandaDoc

| Feature | SignSuite (Phase 2) | DocuSign | PandaDoc |
|---------|------------------------|----------|----------|
| **Cost per envelope** | $0 (native) | $0.50-2.00+ | $0.50-1.50+ |
| **Fund document types** | Built-in (Sub Ag, LPA, SAFE, K-1) | Generic | Generic |
| **Investor auto-fill** | Deep (entity, accreditation, tax ID) | Basic (name, email) | Basic |
| **SEC compliance fields** | Native (506(b)/506(c) audit trail) | None | None |
| **Accreditation verification** | Integrated | None | None |
| **Investor vault** | Integrated (auto-store signed docs) | Separate product | None |
| **CRM integration** | Native (FundRoom CRM) | Salesforce, HubSpot | Native CRM |
| **Payment collection** | Wire + ACH (Phase 2) | DocuSign Payments | Built-in |
| **Template marketplace** | Phase 3 | DocuSign Marketplace | PandaDoc Templates |
| **API** | Phase 2 | Mature | Mature |
| **White-label** | Phase 3 | Enterprise only | Not available |
| **Mobile signing** | Optimized (touch, iOS zoom prevention) | Good | Good |
| **Bulk send** | Phase 2 | Yes | Yes |
| **Drag-drop editor** | Phase 2 | Yes | Yes (advanced) |
| **Offline/notarization** | Phase 3 | DocuSign Notary | None |

### Key Competitive Advantages

1. **Zero per-envelope cost:** DocuSign charges $0.50-2.00+ per envelope depending on plan. SignSuite is native — unlimited envelopes at no marginal cost. For a GP sending 100+ subscription agreements, this saves $50-200+ per fund raise.

2. **Deep investor data integration:** DocuSign treats every signer as a blank slate. SignSuite auto-fills from the investor profile — entity name, address, tax ID, commitment amount, accreditation status all pre-populated. LPs sign faster, GPs get fewer errors.

3. **SEC compliance built-in:** No other e-signature platform understands Regulation D. SignSuite enforces 506(c) accreditation fields, captures Form D data, and maintains immutable audit trails. Compliance is automatic, not manual.

4. **Investor vault integration:** Signed documents flow directly into the LP's vault. No manual downloading from DocuSign and re-uploading to a fund admin system. GPs see signing status on their dashboard. LPs see documents in their portal.

5. **Fund-specific document intelligence:** The system knows what a Subscription Agreement is, what a Side Letter is, what a K-1 is. It can auto-suggest field placements, enforce required fields per document type, and track document completion as part of the investor lifecycle (not just a generic signing event).

---

## Part 6: Pricing & Monetization

### E-Signature Tier Integration

SignSuite is included in the existing CRM tier system:

| Tier | Monthly Price | E-Sig Envelopes/Month | Signer Storage | Features |
|------|--------------|----------------------|----------------|----------|
| FREE | $0 | 10 | 50 MB | Basic signing, 2 templates |
| CRM_PRO | $29/mo | 25 | 500 MB | Custom branding, API access, 5 templates |
| FUNDROOM | $79/mo | Unlimited | Unlimited | Everything, deal pipeline, white-label |
| AI_CRM add-on | +$49/mo | — | — | AI-powered document analysis |

### Phase 3 Standalone Pricing (if offered separately)

| Plan | Monthly | Envelopes | Templates | Features |
|------|---------|-----------|-----------|----------|
| Starter | $10/mo | 50 | 5 | Basic signing, 1 user |
| Professional | $30/mo | 200 | 25 | Bulk send, analytics, 5 users |
| Business | $60/mo | Unlimited | Unlimited | API, webhooks, 15 users |
| Enterprise | Custom | Unlimited | Unlimited | White-label, SSO, dedicated support |

---

## Part 7: Roadmap & Milestones

### Phase 2 — Q2 2026 (8-10 weeks)

| Week | Milestone | Key Deliverables |
|------|-----------|-----------------|
| 1-2 | Field Placement Editor | Drag-drop editor, signer management, field configuration |
| 3-4 | Template Library Enhancement | Template CRUD with editor, FundRoom defaults, categories |
| 5-6 | Bulk Send + External Signers | Mail merge, CSV import, external signing flow |
| 7 | Reminders + Analytics | Automated reminders, document analytics dashboard |
| 8 | External Partner Vault | OTP access, folder scoping, partner management |
| 9-10 | API + Webhooks | REST API, webhook events, API key management |

### Phase 3 — Q3-Q4 2026

| Quarter | Milestone | Key Deliverables |
|---------|-----------|-----------------|
| Q3 W1-4 | Standalone Signing | No-fund document signing, standalone pricing |
| Q3 W5-8 | Workflow Automation | Conditional routing, approval chains |
| Q4 W1-4 | White-Label SDK | Embed SDK, iframe mode, custom branding |
| Q4 W5-8 | Advanced Compliance | eIDAS, HIPAA BAA, SOC 2 prep |

### Success Metrics

| Metric | Target (Phase 2) | Target (Phase 3) |
|--------|------------------|------------------|
| Documents signed/month | 500+ | 5,000+ |
| GP adoption rate | 80% of GPs use Sign vs external | 95% |
| Time to sign (median) | < 5 minutes | < 3 minutes |
| Completion rate | > 90% | > 95% |
| Mobile signing rate | > 30% | > 40% |
| API integrations | 5+ | 20+ |
| DocuSign replacement rate | 50% of GPs migrate off DocuSign | 80% |

---

## Appendix: Key Files

### E-Signature Components
| File | Lines | Purpose |
|------|-------|---------|
| `components/esign/FundRoomSign.tsx` | 1,266 | Consolidated split-screen signing experience |
| `components/signature/enhanced-signature-pad.tsx` | 612 | Canvas/type/upload signature capture |
| `components/signature/pdf-signature-viewer.tsx` | 382 | PDF viewer with field overlays |
| `components/signature/sequential-signing-flow.tsx` | 552 | Multi-document signing queue |

### Signing Pages
| File | Lines | Purpose |
|------|-------|---------|
| `app/view/sign/[token]/page-client.tsx` | 926 | Public token-based signing page |
| `app/sign/[id]/page-client.tsx` | 828 | Authenticated internal signing |

### API Routes
| File | Lines | Purpose |
|------|-------|---------|
| `pages/api/sign/[token].ts` | 846 | Core signing endpoint (GET/POST) |
| `pages/api/documents/[docId]/sign-data.ts` | ~150 | Document + auto-fill data |
| `pages/api/documents/[docId]/signed-pdf.ts` | ~100 | Signed PDF retrieval |
| `pages/api/signatures/capture.ts` | ~100 | Save reusable signature |
| `pages/api/lp/signing-documents.ts` | ~200 | LP's assigned documents |

### Libraries
| File | Lines | Purpose |
|------|-------|---------|
| `lib/signature/flatten-pdf.ts` | 366 | Flatten signatures onto PDF + Certificate of Completion |
| `lib/signature/checksum.ts` | 139 | SHA-256 checksums + ESIGN consent |
| `lib/signature/encryption-service.ts` | ~100 | AES-256 document encryption |
| `lib/esig/usage-service.ts` | 356 | E-sig usage tracking + tier enforcement |

### Document Vault
| File | Lines | Purpose |
|------|-------|---------|
| `app/lp/docs/page-client.tsx` | ~400 | LP document vault page |
| `components/lp/upload-document-modal.tsx` | 342 | LP document upload modal |
| `components/lp/documents-vault.tsx` | 278 | LP vault view component |
| `components/documents/ExternalDocUpload.tsx` | ~400 | LP document upload with type selection |
| `components/documents/GPDocReview.tsx` | ~500 | GP document review dashboard |
| `components/documents/GPDocUpload.tsx` | ~450 | GP upload on behalf of LP |
| `components/documents/DocumentTemplateManager.tsx` | ~678 | Template management UI |
| `lib/storage/investor-storage.ts` | 183 | Investor document storage utilities |

### Schema Models
| Model | Purpose |
|-------|---------|
| `SignatureDocument` | Document lifecycle, fund association, signed output |
| `SignatureRecipient` | Per-signer tracking, tokens, consent |
| `SignatureField` | Field placement and values (10 types) |
| `SignatureTemplate` | Reusable templates |
| `SignatureAuditLog` | Per-action compliance audit |
| `EsigUsageRecord` | Per-team monthly usage |
| `EsigUsage` | Per-org monthly counter |
| `LPDocument` | Investor vault documents |
| `LPDocumentReview` | GP review history |

### Tests
| File | Tests | Purpose |
|------|-------|---------|
| `__tests__/api/sign/sign-token.test.ts` | 10 | Signing endpoint tests |
| `__tests__/e2e/esign-wizard-flow.test.ts` | ~20 | E2E signing flow tests |
| `__tests__/e2e/esign-webhook.test.ts` | ~10 | Webhook event tests |
| `__tests__/e2e/gp-doc-review-flow.test.ts` | 16 | GP document review flow |
| `__tests__/e2e/lp-upload-flow.test.ts` | 15 | LP document upload flow |

---

*This document is a living specification. It will be updated as features are implemented and user feedback is gathered.*
