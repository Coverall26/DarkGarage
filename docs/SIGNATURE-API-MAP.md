# Signature API Route Mapping

> **Created:** March 4, 2026
> **Purpose:** Canonical reference for all e-signature API routes across the platform.
> **Rule:** All NEW signature features MUST use App Router `/api/esign/*` routes.

---

## Canonical Routes (App Router — use these for new features)

### Envelope Management

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/esign/envelopes` | GET | List envelopes for team (paginated, status filter) |
| `/api/esign/envelopes` | POST | Create new standalone e-signature envelope |
| `/api/esign/envelopes/[id]` | GET | Get envelope details with recipients |
| `/api/esign/envelopes/[id]` | PATCH | Update envelope (title, message, recipients — DRAFT only) |
| `/api/esign/envelopes/[id]` | DELETE | Delete envelope (DRAFT) or void (sent) |
| `/api/esign/envelopes/[id]/send` | POST | Send envelope to recipients (DRAFT → SENT) |
| `/api/esign/envelopes/[id]/status` | GET | Check signing progress (current group, signed count, waiting) |
| `/api/esign/envelopes/[id]/remind` | POST | Send reminder to pending signers |
| `/api/esign/envelopes/[id]/void` | POST | Void (cancel) an in-flight envelope |
| `/api/esign/envelopes/[id]/decline` | POST | Recipient declines to sign |
| `/api/esign/envelopes/[id]/cancel-schedule` | POST | Cancel scheduled send (SCHEDULED → DRAFT) |
| `/api/esign/envelopes/[id]/audit-trail` | GET | Download audit trail PDF |

### Signing & Submission

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/esign/sign` | GET | Validate signing token, return session info |
| `/api/esign/sign` | POST | Record signature completion (token-based auth for external signers) |

### Templates

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/esign/templates` | GET | List signature templates (search, module access check) |
| `/api/esign/templates` | POST | Create new signature template (tier-limited) |
| `/api/esign/templates/[id]` | GET | Template detail |
| `/api/esign/templates/[id]` | PATCH | Update template |
| `/api/esign/templates/[id]` | DELETE | Delete template |
| `/api/esign/templates/[id]/duplicate` | POST | Duplicate a signature template |

### NDA Signing (DataRoom Integration)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/esign/nda-sign` | GET | Check if signer has already signed NDA for a link |
| `/api/esign/nda-sign` | POST | Initiate NDA signing for dataroom/document visitor |
| `/api/esign/nda-sign/complete` | POST | Completion callback after NDA signing |

### Bulk Send

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/esign/bulk-send` | GET | List batches or get batch detail (?batchId=) |
| `/api/esign/bulk-send` | POST | Bulk send document to 1–500 recipients |

### Standalone Send

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/esign/standalone/send` | POST | One-step envelope create + send |

### Document Filing

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/esign/filings` | GET | List document filings with stats |

---

## Legacy Routes (Pages Router — DO NOT add new features here)

### Token-Based Signing (`pages/api/sign/`)

| Route | Method | Status | Notes |
|-------|--------|--------|-------|
| `/api/sign/[token]` | GET/POST | **ACTIVE** | Public signing page endpoint. GET authenticates signer by token, POST records signature. Critical for LP onboarding signing flow |
| `/api/sign/status` | GET | **ACTIVE** | Check signing status |
| `/api/sign/verify/[token]` | GET | **ACTIVE** | Verify signing token |
| `/api/sign/certificate/verify` | GET | **ACTIVE** | Verify completion certificate (HMAC-SHA256) |
| `/api/sign/certificate/[documentId]` | GET | **ACTIVE** | Get certificate for a document |
| `/api/sign/certificate/[documentId]/info` | GET | **ACTIVE** | Get certificate metadata/info |

### Signature Document Management (`pages/api/signature/`)

| Route | Method | Status | Canonical Equivalent |
|-------|--------|--------|---------------------|
| `/api/signature/documents` | GET | **ACTIVE — migrate to App Router** | Use `/api/esign/envelopes` |
| `/api/signature/create-document` | POST | **ACTIVE — migrate to App Router** | Use `/api/esign/envelopes` + `/api/esign/envelopes/[id]/send` |
| `/api/signature/custom-template` | POST | **ACTIVE — migrate to App Router** | Use `/api/esign/templates` |
| `/api/signature/void-document` | POST | **ACTIVE — migrate to App Router** | Use `/api/esign/envelopes/[id]/void` |
| `/api/signature/webhook-events` | GET | **ACTIVE — migrate to App Router** | Query audit trail via `/api/esign/envelopes/[id]/audit-trail` |
| `/api/signature/certificate/[documentId]/download` | GET | **ACTIVE** | Certificate download (server-side session auth) |

### Signature Capture (`pages/api/signatures/`)

| Route | Method | Status | Notes |
|-------|--------|--------|-------|
| `/api/signatures/capture` | POST | **ACTIVE — migrate to App Router** | Stores base64 signature image for reuse. Max 500KB. Associates with investor profile |

### Document Signing Data (`pages/api/documents/`)

| Route | Method | Status | Notes |
|-------|--------|--------|-------|
| `/api/documents/[docId]/sign-data` | GET | **ACTIVE** | Returns document + pre-filled field data for signing. Used by FundRoomSign component |
| `/api/documents/[docId]/signed-pdf` | GET | **ACTIVE** | Returns signed PDF URL for completed documents |

---

## Webhooks

Both webhook handlers process events from the **same internal platform** but handle different event systems:

| Route | Event Source | Event Format | Header | Secret Env Var | Notes |
|-------|-------------|-------------|--------|---------------|-------|
| `/api/webhooks/esign` | Envelope system (App Router) | `signature.recipient_signed`, `signature.document_completed`, `signature.document_declined`, `signature.document_viewed` | `x-esign-signature` | `ESIGN_WEBHOOK_SECRET` | **Primary** — handles envelope lifecycle events. Includes audit trail appending, status transitions, completion emails |
| `/api/webhooks/signature` | Legacy SignatureDocument system | `document.signed`, `document.completed`, `document.viewed`, `document.declined` | `x-signature` | `SIGNATURE_WEBHOOK_SECRET` | **Legacy** — handles document completion events. Includes subscription status updates, investor notifications, audit logging via `logAuditEventFromRequest` |

**Why two handlers?** They serve different event producers within the platform:
- **`/api/webhooks/esign`** — Triggered by the standalone envelope system (`lib/esign/envelope-service.ts`). Processes Envelope + EnvelopeRecipient model events.
- **`/api/webhooks/signature`** — Triggered by the legacy signature event system (`lib/webhook/triggers/signature-events.ts`). Processes SignatureDocument + SignatureRecipient model events. Also handles subscription document completion (LP onboarding).

**Do NOT merge these handlers.** They handle events from different internal data models (Envelope vs SignatureDocument) with different schemas. Consolidation is a Phase 2 task that requires unifying the data models first.

---

## Authentication Patterns

| Pattern | Used By | Notes |
|---------|---------|-------|
| **Token-based** (signing token) | `/api/esign/sign`, `/api/sign/[token]` | External signers — no session required |
| **Session-based** (NextAuth) | `/api/signatures/capture`, `/api/documents/[docId]/sign-data` | Authenticated platform users only |
| **API Token** (`validateApiToken`) | `/api/signature/documents`, `/api/signature/create-document` | Server-to-server API access |
| **HMAC Webhook** | `/api/webhooks/esign`, `/api/webhooks/signature` | Webhook signature verification |
| **Team RBAC** | All `/api/esign/*` routes | `requireAdminAppRouter()` + `checkModuleAccess("SIGNSUITE")` |

---

## Module Access Control

All `/api/esign/*` routes enforce SIGNSUITE module access via `checkModuleAccess()` from `lib/middleware/module-access.ts`.

**Tier Limits (enforced via `lib/esig/usage-service.ts`):**
| Tier | E-Signatures/Month | Signer Storage |
|------|-------------------|----------------|
| FREE | 10 | 50 MB |
| CRM_PRO | 25 | 500 MB |
| BUSINESS | 75 | 2 GB |
| FUNDROOM | Unlimited | Unlimited |

---

## Migration Priority (Pages Router → App Router)

**Phase 2 candidates (safe to migrate):**
1. `pages/api/signature/documents.ts` → `/api/esign/documents`
2. `pages/api/signature/create-document.ts` → Already covered by `/api/esign/envelopes`
3. `pages/api/signature/custom-template.ts` → Already covered by `/api/esign/templates`
4. `pages/api/signature/void-document.ts` → Already covered by `/api/esign/envelopes/[id]/void`
5. `pages/api/signatures/capture.ts` → `/api/esign/capture`

**Keep as-is (unique functionality):**
1. `pages/api/sign/[token].ts` — Critical for LP onboarding signing flow
2. `pages/api/sign/certificate/*` — Certificate generation and verification
3. `pages/api/signature/webhook-events.ts` — Event query interface
4. `pages/api/signature/certificate/[documentId]/download.ts` — Certificate download
