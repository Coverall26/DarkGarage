# LP Onboarding Flow

Complete documentation of the LP (Limited Partner) onboarding wizard, including all steps, edge cases, decision trees, paywall gates, and auto-heal mechanisms.

---

## Table of Contents

- [Flow Overview](#flow-overview)
- [Entry Points](#entry-points)
- [Step-by-Step Walkthrough](#step-by-step-walkthrough)
- [Parameter Chain](#parameter-chain)
- [Paywall Gates](#paywall-gates)
- [Auto-Heal Mechanisms](#auto-heal-mechanisms)
- [Authentication Flow](#authentication-flow)
- [Post-Onboarding Lifecycle](#post-onboarding-lifecycle)
- [Edge Cases](#edge-cases)
- [Key Files](#key-files)

---

## Flow Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    LP ONBOARDING WIZARD                           │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │ Step 1  │  │ Step 2  │  │ Step 3  │  │ Step 4  │           │
│  │ Account │─►│  NDA    │─►│ Accred. │─►│ Entity  │           │
│  │ Creation│  │ Signing │  │ Verify  │  │ Details │           │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │
│                                              │                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │                   │
│  │ Step 7  │  │ Step 6  │  │ Step 5  │◄────┘                   │
│  │ Wire /  │◄─│  Sign   │◄─│ Commit  │                         │
│  │ Fund    │  │  Docs   │  │  Amount │                         │
│  └─────────┘  └─────────┘  └─────────┘                         │
│                                                                  │
│  Auto-save: 3s debounce ─► OnboardingFlow model                │
│  Resume: loads last step + form data on return                   │
└──────────────────────────────────────────────────────────────────┘
```

### Investment Stage Progression

```
LEAD ─► INVITED ─► ONBOARDING ─► COMMITTED ─► DOCS_APPROVED ─► FUNDED
                       │              │              │             │
                    LP starts      LP submits    All required    GP confirms
                    wizard         commitment    docs signed     wire receipt
                                                (auto-advance)
```

---

## Entry Points

### 1. Dataroom "I Want to Invest" Button

```
Dataroom View (/view/{linkId})
       │
       ▼
InvestButton component checks fund state:
  ├── NO_FUND: Shows "Express Interest" dialog → MarketplaceWaitlist
  ├── NOT_ACTIVATED: Shows "Opening Soon" message
  ├── PREVIEW: Button disabled
  └── LIVE: Navigate to /lp/onboard?fundId=xxx&teamId=yyy
```

### 2. Direct Fund Invite (Email)

```
GP sends invite via /api/teams/{teamId}/funds/{fundId}/invite
       │
       ▼
LP receives email with link:
  /lp/onboard?fundId=xxx&teamId=yyy
```

### 3. Direct URL

```
/lp/onboard?fundId=xxx
  OR
/lp/onboard?fundId=xxx&teamId=yyy
```

---

## Step-by-Step Walkthrough

### Step 1: Account Creation

**Purpose**: Register LP user account and create investor profile.

**Fields**:
- First Name (required)
- Last Name (required)
- Email (required, validated)
- Password (not collected — one-time token flow)

**API Call**: `POST /api/lp/register`

**What Happens**:
1. Creates or finds existing User record
2. Creates or updates Investor profile linked to fund
3. Creates Investment record (status: ONBOARDING)
4. Generates one-time login token (64-char hex, 5-min expiry)
5. Returns `loginToken` in response

**Authentication**: Client exchanges `loginToken` via `POST /api/auth/lp-token-login` to establish a NextAuth JWT session. Falls back to magic link email if token exchange fails.

**Decision Tree**:
```
Email submitted
  ├── New user → Create User + Investor + Investment → token → session
  └── Existing user
       ├── Has investor profile → Update (never downgrade flags) → token → session
       └── No investor profile → Create Investor + Investment → token → session
```

---

### Step 2: NDA Signing

**Purpose**: LP acknowledges NDA / confidentiality agreement.

**Fields**:
- NDA agreement checkbox (required)

**API Call**: `POST /api/lp/sign-nda`

**What is Recorded**:
- IP address
- User-agent
- Timestamp
- Audit log entry: `NDA_SIGNED`

**Configurability**: GP can enable/disable NDA requirement in LP Onboarding Settings (Org Setup Step 6). When disabled, step is skipped.

---

### Step 3: Accreditation Verification

**Purpose**: Verify LP meets SEC accreditation requirements.

**Standard Flow (506(b) or no Reg D)**:
- Accreditation method selection (matches entity type)
- Confirmation checkboxes per SEC Rule 501(a) criteria
- Risk awareness confirmation

**Enhanced Flow (506(c))**:
When `fundContext.regulationDExemption === "506C"`, additional fields:
- `noThirdPartyFinancing` checkbox (required)
- `sourceOfFunds` dropdown: SALARY, INVESTMENT_RETURNS, BUSINESS_INCOME, INHERITANCE, SAVINGS, OTHER (required)
- `occupation` / employer text field (required)

**API Call**: `POST /api/lp/investor-details` (accreditation data)

**Decision Tree**:
```
Fund Reg D exemption?
  ├── 506B / REG_A_PLUS / RULE_504 / none
  │    └── Standard: entity-specific criteria checkboxes
  │         └── confirmAccredited + confirmRiskAware → proceed
  │
  └── 506C
       └── Enhanced: standard + no-3rd-party + source of funds + occupation
            └── All required fields → proceed
```

---

### Step 4: Entity Details (Investor Type)

**Purpose**: Collect entity information, tax ID, and authorized signer details.

**7 Entity Types** (selected via card UI):
1. **Individual**: Full name, DOB, SSN (masked XXX-XX-XXXX)
2. **Joint**: Both names, DOBs, SSN
3. **Trust/Estate**: Trust name, trustee name, formation date, EIN
4. **LLC/Corporation**: Entity name, state of formation, EIN, authorized signer
5. **Partnership**: Partnership name, type (General/Limited/LLP), EIN, authorized signer
6. **IRA/Retirement**: Plan name, custodian, plan type, EIN
7. **Charity/Foundation**: Org name, EIN, 501(c)(3) status

**Common Fields** (all types):
- Address (line 1, line 2, city, state, ZIP, country)
- Tax ID (SSN or EIN, encrypted AES-256)

**API Call**: `POST /api/lp/investor-details`

**Tax ID Encryption**: `encryptTaxId()` via AES-256-GCM before database storage. Displayed masked in UI after entry.

**Implementation**: `components/onboarding/InvestorTypeStep.tsx` (69KB) with Zod validation from `lib/validations/investor-entity.ts`.

---

### Step 5: Commitment

**Purpose**: LP commits investment amount and acknowledges 8 SEC representations.

**Fields**:
- Investment amount (USD, validated against fund minimum)
- 8 SEC investor representations (all required, see `docs/SEC_COMPLIANCE.md`)

**API Call**: `POST /api/lp/commitment`
- Also calls `POST /api/lp/subscribe` to create/update the subscription

**What Happens**:
1. Validates amount >= fund minimum investment
2. Stores commitment amount on Investment record
3. Stores 8 representations in `Investor.fundData.representations` with timestamp
4. Investment status: ONBOARDING → COMMITTED
5. Investor `onboardingStep` updated

**Decision Tree**:
```
Amount entered
  ├── Below fund minimum → validation error, cannot proceed
  ├── All 8 representations checked?
  │    ├── No → Submit button disabled
  │    └── Yes → Submit enabled
  └── Submit
       ├── Fund fully subscribed? → "fully subscribed" error
       └── Success → COMMITTED status
```

---

### Step 6: Sign Documents

**Purpose**: LP signs required legal documents (NDA, Subscription Agreement, LPA, etc.) via SignSuite.

**Component**: `SequentialSigningFlow` → `FundRoomSign`

**Document Priority Order**:
1. NDA / Confidentiality Agreement
2. Subscription Agreement
3. Limited Partnership Agreement (LPA) / SAFE
4. Side Letter (if applicable)

**API Calls**:
- `GET /api/lp/signing-documents` — Fetches documents filtered by fundId
- `POST /api/sign/{token}` — Submits signed fields per document

**Flow**:
```
Load signing documents (filtered by fundId)
  │
  ▼
FundRoomSign renders (split-screen):
  Left (60%): PDF viewer with yellow field overlays
  Right (40%): Auto-filled fields + SignatureCapture
  │
  ▼
LP fills fields → captures signature (draw/type/upload)
  │
  ▼
Consent checkbox → ESIGN/UETA modal → confirm
  │
  ▼
POST /api/sign/{token}
  ├── Flatten signatures onto PDF (pdf-lib)
  ├── Generate SHA-256 checksum
  ├── Encrypt signed PDF (AES-256)
  ├── Store signedFileUrl/signedFileType/signedAt
  │
  ├── All requiredForOnboarding docs signed?
  │    ├── No → Auto-advance to next unsigned document
  │    └── Yes → advanceInvestorOnSigningComplete()
  │              Investment: COMMITTED → DOCS_APPROVED
  │              Send investor approved email
  │
  └── Sequential lock: next doc unlocked only after current is signed
```

---

### Step 7: Wire / Funding

**Purpose**: Display wire instructions and allow proof-of-payment upload.

**Component**: `FundingStep`

**What LP Sees**:
- Bank name, routing number, account number
- Wire reference format: `LP-[LastName]-[FundName]`
- Copy-to-clipboard buttons
- Proof upload (drag-drop, PDF/image, camera capture on mobile)
- "Pay Later" option

**API Calls**:
- `GET /api/lp/wire-instructions?fundId=xxx` — Fetch wire instructions
- `POST /api/lp/wire-proof` — Upload proof → Transaction (status: PROOF_UPLOADED)

**What Happens After Upload**:
```
LP uploads wire proof
  │
  ▼
Transaction created (status: PROOF_UPLOADED)
  │
  ▼
GP sees in dashboard:
  ├── Pending Actions card: "X wires awaiting confirmation"
  ├── Wire Transfers > Confirm Receipt tab
  └── Inline quick-confirm modal
  │
  ▼
GP confirms wire (POST /api/admin/wire/confirm)
  ├── Transaction.status → COMPLETED
  ├── Investment.fundedAmount updated
  ├── Investment.status → FUNDED (if fully funded)
  ├── FundAggregate recalculated
  └── LP receives wire-confirmed email
```

---

## Parameter Chain

The parameter chain ensures fund context flows correctly from dataroom view through onboarding.

```
Dataroom View
  │  DataroomView extracts teamId from dataroom/link
  │
  ▼
GET /api/lp/fund-context?teamId=xxx
  │
  ├── Team has 1 active fund → returns fundId
  │
  ├── Team has multiple active funds → returns 400 + fund list
  │    └── Client retries with first fund: GET /api/lp/fund-context?teamId=xxx&fundId=yyy
  │
  └── Team has no active funds → returns 404
  │
  ▼
InvestButton receives fundId
  │  LIVE state → /lp/onboard?fundId=xxx&teamId=yyy
  │
  ▼
LP Onboard Client reads searchParams
  │  Calls GET /api/lp/fund-context?teamId=yyy&fundId=xxx
  │
  ├── Fund belongs to team? → Yes → returns full context
  │                         → No → 400 "Fund does not belong to team"
  │
  ├── FundroomActivation active? → Yes → wizard renders
  │                              → No → "Not Yet Accepting Investments" message
  │
  └── Fund context has fundId? → Yes → wizard renders
                               → No → "No Active Fund" message
```

**Key finding**: Dataroom model has NO `fundId` field. Fund association is indirect through `teamId`. The fund-context API resolves the fund from the team.

---

## Paywall Gates

Paywall checks occur at multiple points. Bypass via `PAYWALL_BYPASS=true` env var.

```
┌─────────────────────────────────────────────────────┐
│                PAYWALL CHECK FLOW                    │
│                                                      │
│  API request                                         │
│    │                                                 │
│    ├── PAYWALL_BYPASS=true? → Allow                  │
│    │                                                 │
│    ├── FundroomActivation exists?                     │
│    │    ├── Team-level (fundId=null) → Allow          │
│    │    ├── Fund-specific activation → Allow          │
│    │    └── Neither → 402 Payment Required            │
│    │                                                 │
│    └── GP created during Org Setup? → Activation     │
│         exists (created in $transaction)             │
└─────────────────────────────────────────────────────┘
```

**Routes with paywall checks**:

| Route | Check |
|-------|-------|
| `POST /api/lp/register` | Fund/team activation (when fundId or teamId present) |
| `POST /api/lp/staged-commitment` | Investor's fund activation |
| `GET/POST /api/sign/{token}` | Document's fund activation (fund-linked docs only) |
| `POST /api/lp/wire-proof` | Investment's fund activation |
| LP onboard client | `fundContext.fundroomActive === false` → blocked |

---

## Auto-Heal Mechanisms

### Subscribe API Auto-Heal (P0-2)

**Problem**: `subscribe.ts` checks `investor.ndaSigned` and `investor.accreditationStatus`, but these flags may not be set in edge cases (page refresh, existing user, GP-added investor).

**Solution** (belt-and-suspenders):

```
LP calls POST /api/lp/subscribe
  │
  ▼
Investor loaded → ndaSigned=false or accreditation=PENDING?
  │
  ├── Check: onboardingStep >= 6?
  │    └── Yes → auto-heal: investor.ndaSigned = true
  │
  ├── Check: OnboardingFlow.stepsCompleted.accreditation?
  │    └── Yes → auto-heal: accreditationStatus = SELF_CERTIFIED
  │
  ├── Both healed? → Proceed with subscription
  └── No evidence? → 403 error + specific message
       └── Client shows "Go Back to [step]" button
```

### Register API Flag Upgrade (P0-2 Option B)

When existing investor profile is found during registration:
- `ndaSigned`: false → true (never downgrades)
- `accreditationStatus`: PENDING → SELF_CERTIFIED (never downgrades KYC_VERIFIED)
- `onboardingStep`: only upgraded if higher (never lowered)

### LP One-Time Token (Registration Gap Fix)

**Problem**: LP registration generated a random password, then `signIn("credentials")` failed if user already existed with a different password.

**Solution**:
```
POST /api/lp/register
  ├── User created/updated
  ├── Generate 64-char hex token → VerificationToken (5-min expiry)
  └── Return loginToken in response

Client:
  POST /api/auth/lp-token-login with loginToken
  ├── Token validated (exists, not expired, lp-onetime:* prefix)
  ├── Token deleted (one-time use)
  ├── NextAuth JWT created → session cookie set
  └── LP has active session → remaining steps work
```

---

## Post-Onboarding Lifecycle

### Auto-Save and Resume

Wizard state is auto-saved to the `OnboardingFlow` model via `PUT /api/lp/onboarding-flow` with a 3-second debounce. On return:

1. `GET /api/lp/onboarding-flow` fetches saved state
2. Wizard resumes from the last completed step
3. Form fields are pre-populated from saved data
4. Cleared on completion via `DELETE /api/lp/onboarding-flow`

### Post-Approval Change Detection

After an investor is approved (APPROVED/COMMITTED/DOCS_APPROVED/FUNDED), if LP updates profile fields:

```
PATCH /api/investor-profile/{id}
  │
  ├── Stage is APPROVED or later?
  │    └── Yes → Create ProfileChangeRequest (old value preserved)
  │              New value NOT applied immediately
  │              GP sees change request in Approval Queue
  │              GP can approve (new value becomes active) or reject
  │
  └── Stage is before APPROVED?
       └── Direct update applied
```

**20 trackable fields**: name, email, phone, entityType, entityName, authorizedSignerName, authorizedSignerTitle, addressLine1, addressLine2, addressCity, addressState, addressZip, addressCountry, taxIdType, accreditationStatus, commitmentAmount, and more.

---

## Edge Cases

### 1. Multi-Fund Team

When a team has multiple active funds and LP arrives without a `fundId`:
- `GET /api/lp/fund-context?teamId=xxx` returns 400 with fund list
- Client extracts first fund and retries with explicit `fundId`
- Prevents ambiguous fund assignment

### 2. Fund Not Yet Activated

When `FundroomActivation` doesn't exist for the fund/team:
- LP onboard client shows "Not Yet Accepting Investments" message
- "Return to Login" button provided
- No wizard steps render

### 3. No Fund Context

When fund-context API returns but `fundId` is null:
- LP onboard client shows "No Active Fund" message
- Defense-in-depth: InvestButton also guards against null fundId in LIVE state

### 4. Existing User with Different Password

Handled by one-time token system. Registration creates a token regardless of user's password state. Token exchange bypasses credentials entirely.

### 5. Page Refresh During Wizard

Auto-save (OnboardingFlow) persists form data. On return:
- Last step is restored
- Form fields are pre-populated
- No data loss

### 6. GP-Added Investor (Manual Entry)

GP creates investor via `/api/admin/investors/manual-entry`. If LP later goes through onboarding:
- Register API finds existing user/investor profile
- Flags are upgraded (never downgraded)
- Subscribe API auto-heals NDA/accreditation from onboardingStep evidence

### 7. Fund Fully Subscribed

When fund reaches target:
- `POST /api/lp/subscribe` returns "fully subscribed" error
- Step 5 shows specific error message
- LP cannot proceed past commitment step

### 8. Mobile-Specific

- All touch targets >= 44px
- Text inputs use `text-base` (16px) to prevent iOS auto-zoom
- File upload inputs accept `image/*` for camera capture
- Signature pad uses PointerEvents with `touch-none` CSS
- Step indicator scrolls horizontally on small screens

---

## Key Files

### Client Components

| File | Purpose |
|------|---------|
| `app/lp/onboard/page-client.tsx` | Main wizard orchestrator (~1,700 lines) |
| `components/onboarding/InvestorTypeStep.tsx` | Entity type forms (69KB, 7 entity types) |
| `components/onboarding/FundingStep.tsx` | Wire instructions + proof upload (22KB) |
| `components/esign/FundRoomSign.tsx` | Split-screen signing (1,266 lines) |
| `components/signature/sequential-signing-flow.tsx` | Document queue with sequential locking |
| `components/lp/accreditation-wizard.tsx` | Accreditation verification |
| `components/lp/staged-commitment-wizard.tsx` | Staged commitment flow |
| `components/view/invest-button.tsx` | 4-state invest button |

### API Routes

| File | Purpose |
|------|---------|
| `pages/api/lp/register.ts` | LP registration + one-time token generation |
| `pages/api/lp/subscribe.ts` | Commitment subscription + auto-heal |
| `pages/api/lp/fund-context.ts` | Fund context with multi-fund disambiguation |
| `pages/api/lp/onboarding-flow.ts` | Auto-save/resume (GET/PUT/DELETE) |
| `pages/api/lp/wire-instructions.ts` | Wire instructions (fund-scoped) |
| `pages/api/lp/wire-proof.ts` | Proof upload → PROOF_UPLOADED status |
| `pages/api/lp/signing-documents.ts` | Signature documents (fund-filtered) |
| `pages/api/auth/lp-token-login.ts` | One-time token → session exchange |
| `pages/api/sign/[token].ts` | Signature submission + flatten + advance |
| `app/api/lp/sign-nda/route.ts` | NDA signing with audit trail |
| `app/api/lp/investor-details/route.ts` | Entity + tax ID persistence |
| `app/api/lp/commitment/route.ts` | Commitment + 8 SEC representations |

### Business Logic

| File | Purpose |
|------|---------|
| `lib/investors/advance-on-signing-complete.ts` | Auto-advance COMMITTED → DOCS_APPROVED |
| `lib/investors/advance-on-doc-approval.ts` | Auto-advance on GP document approval |
| `lib/auth/paywall.ts` | FundroomActivation paywall checks |
| `lib/validations/investor-entity.ts` | 7 entity type Zod schemas |
| `lib/signature/flatten-pdf.ts` | PDF flattening with Certificate of Completion |
| `lib/engagement/scoring.ts` | Engagement scoring (Hot/Warm/Cool) |
