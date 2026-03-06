# Changelog

All notable changes to FundRoom are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- **L3: Centralized Auth Path Constants** (Mar 5, 2026) — Created `lib/constants/auth.ts` with `AUTH_PATHS` array and `isAuthPath()` helper. Replaced hardcoded auth path checks in all 3 login pages (`app/(auth)/login/page-client.tsx`, `app/admin/login/page-client.tsx`, `app/(auth)/lp/login/page-client.tsx`). Prevents redirect loops when `?next=` points to any login/register/verify page.
- **L2: Vercel Function Config Migration Guide** (Mar 5, 2026) — Added "Vercel Function Config Migration" section to `docs/PAGES-ROUTER-MIGRATION.md` documenting all 6 Pages Router routes with custom `maxDuration` settings and their App Router migration pattern (`export const maxDuration = X`).

### Changed
- **L1: INVESTOR Role Fallback** (Mar 5, 2026) — Updated `app/viewer-redirect/page.tsx` role fallback from `"LP"` to `"INVESTOR"` with backward compatibility (`userRole === "LP" || userRole === "INVESTOR"`).

### Removed
- **L4: Unused Dependencies Cleanup** (Mar 5, 2026) — Removed 8 unused npm packages: `@ai-sdk/react`, `@radix-ui/react-use-controllable-state`, `google-auth-library`, `react-is`, `react-plaid-link`, `react-textarea-autosize`, `shiki`, `zod-validation-error`. npm audit fix reduced vulnerabilities from 14 to 6 (all low severity).
- **L5: Dead Heatmap Code** (Mar 5, 2026) — Removed 31 lines of commented-out heatmap scroll tracking code from `components/view/viewer/notion-page.tsx` (calculateScrollPercentage, handleScroll, scroll event listener, and TODO comment for heatmap.js).

### Fixed
- **L1: Viewer-Redirect Role Fallback** (Mar 5, 2026) — Fixed `app/viewer-redirect/page.tsx` to accept both `"LP"` and `"INVESTOR"` session roles when redirecting to LP dashboard. Prevents redirect loop for sessions with legacy `"LP"` role value.
- **L5: Dead Commented-Out Code** (Mar 5, 2026) — Removed ~30 lines of commented-out heatmap/scroll tracking code from `components/view/viewer/notion-page.tsx`. Dead code from an abandoned feature experiment.
- **Signing Flow Tests** (Mar 5, 2026) — Resolved 8 pre-existing test failures in `__tests__/lib/esign/signing-flow.test.ts`. Root cause: `mockResolvedValueOnce` queue leakage between `recordSignerCompletion` and `getSigningStatus` test groups — `jest.clearAllMocks()` does not clear queued once-values. Fix: removed incorrect first `mockResolvedValueOnce` from 5 tests (authenticateSigner uses `envelopeRecipient.findUnique`, not `envelope.findUnique`) and added targeted `mockReset()` in `getSigningStatus` `beforeEach` as defense-in-depth. All 117 signing-flow tests now pass.

### Added
- **L3: Auth Loop Path Detection Utility** (Mar 5, 2026) — Created `lib/constants/auth-paths.ts` with config-driven `isAuthLoopPath()` function. Detects login/signup/verify paths that should never appear as `callbackUrl` to prevent infinite redirect loops. Applied to all 3 login pages (`app/(auth)/login/page-client.tsx`, `app/(auth)/lp/login/page-client.tsx`, `app/admin/login/page-client.tsx`).
- **L2: Vercel Function Config Migration Pattern** (Mar 5, 2026) — Documented Vercel function config migration pattern in `docs/PAGES-ROUTER-MIGRATION.md`. Pages Router uses `export const config = { api: { bodyParser: false } }` while App Router uses route segment config (`export const maxDuration`, `export const dynamic`).
- **L6: Environment-Driven Webhook IP Allowlist** (Mar 5, 2026) — Made webhook IP allowlist in `app/api/lp/webhooks/investor-updates/route.ts` configurable via `WEBHOOK_ALLOWED_IPS` env var (comma-separated). Falls back to localhost defaults in development. Added `WEBHOOK_ALLOWED_IPS` and `WEBHOOK_SECRET` to `.env.example`.
- **L8: Prisma createdBy Standardization Documentation** (Mar 5, 2026) — Added comprehensive section to `docs/PAGES-ROUTER-MIGRATION.md` documenting the three `createdBy` patterns in the Prisma schema: (A) best practice with FK relation, (B) legacy plain String, (C) partial with `createdById` but no `@relation`. Lists all affected models per pattern.
- **L10: Admin Login Layout JSDoc** (Mar 5, 2026) — Added JSDoc to `app/admin/login/layout.tsx` documenting the standalone auth layout pattern — separate from authenticated admin shell, provides SessionProvider + ThemeProvider + Toaster without sidebar/header.

### Changed
- **L7: Email Template Usage Audit** (Mar 5, 2026) — Traced all 60 email templates through their full chain (template → send helper → API caller). Found 9 templates in 6 orphaned chains where send helpers exist but have no callers. Added "NOT YET WIRED" JSDoc status comments with Phase 2 wiring instructions to: `send-onboarding.ts` (5-day drip), `send-upgrade-six-months-checkin.ts` (6-month milestone), `send-hundred-views-congrats.ts` (100 views), `send-thousand-views-congrats.ts` (1,000 views), `send-custom-domain-setup.ts` (domain verification), `send-lp-wire-proof-confirmation.ts` (wire proof upload).
- **L9: Billing Component Status Comments** (Mar 5, 2026) — Added STATUS comments to all 12 billing component files across CRM and SaaS billing systems. 4 files already had comments (verified): `upgrade-plan-modal.tsx` (Phase 2 stub), `plan-badge.tsx` (Active), `cancellation-modal.tsx` (Phase 2 orchestrator), `billing-crm.tsx` (Active CRM billing). 8 files annotated this session: `reason-base-modal.tsx` (Phase 2 cancellation base modal), `schedule-call-modal.tsx` (Phase 2 Cal.com scheduler), `retention-offer-modal.tsx` (Phase 2 retention offers), `confirm-cancellation-modal.tsx` (Phase 2 final cancellation step), `pause-subscription-modal.tsx` (Phase 2 subscription pause), `feedback-modal.tsx` (Phase 2 cancellation feedback), `pause-resume-reminder.tsx` (Phase 2 SaaS email template), `subscription-renewal-reminder.tsx` (Phase 2 SaaS email template).

### Removed
- **L4: Unused Dependencies** (Mar 5, 2026) — Removed 9 unused production dependencies and 1 unused devDependency identified via depcheck + grep verification: `papaparse`, `@types/papaparse`, `react-email`, `html-to-image`, `@radix-ui/react-hover-card`, `@radix-ui/react-scroll-area`, `node-fetch`, `jszip`, `@react-email/components`, and `@types/negotiator` (dev).

### Changed
- **M4: Verify fund-settings API Consolidation** (Mar 5, 2026) — Confirmed `/api/fund-settings/` directory already deleted, permanent redirects in `next.config.mjs`, zero frontend references remaining. No action needed.
- **M5: Verify Wizard LP Terminology** (Mar 5, 2026) — Confirmed all user-facing wizard labels already say "Investor Onboarding" (WizardProgress, Step7LPOnboarding heading, Step9Launch review cards). Internal code comments and filenames correctly use "LP" per naming convention.
- **M6: Fix Entity Type "LP" Display** (Mar 5, 2026) — Updated `Step1CompanyInfo.tsx` entity type dropdown to use value/label pairs, showing "Limited Partnership" instead of raw "LP". Values aligned with Settings Center (uppercase: LLC, CORPORATION, LP, GP_ENTITY, TRUST, OTHER). Added `ENTITY_TYPE_LABELS` map to `Step9Launch.tsx` for human-readable review display.
- **M7: Verify SUITE_COLORS Key** (Mar 5, 2026) — Confirmed `pipelineiq` is the correct SUITE_COLORS key (matches admin route `/admin/pipelineiq`). Zero `raisecrm` key references. Brand name "RaiseCRM" appears only in UI labels, not object keys.
- **M8: Remove Orphaned /admin/settings/fund Route** (Mar 5, 2026) — Deleted orphaned Fund Threshold Settings page (396+10 lines). Fixed inbound link in `app/admin/fund/[fundId]/page-client.tsx` from `/admin/settings/fund` to `/admin/settings?tab=fundInvestor&fundId=`. Added permanent redirect in `next.config.mjs`.
- **M9: Verify Fund Settings Investor Terminology** (Mar 5, 2026) — Confirmed all toggle descriptions use "Investor can see..." (not "LP can see..."). No changes needed.
- **M10: Verify Notification Labels** (Mar 5, 2026) — Confirmed labels use "Investor Onboarding Started" and "Investor Inactive Alert". No changes needed.
- **M11: Verify Manual Investment Route** (Mar 5, 2026) — Confirmed `/admin/manual-investment` is in sidebar `matchPaths` for both GP_FUND and STARTUP modes. Route files present.
- **M12: Verify Webhook Separation** (Mar 5, 2026) — Confirmed esign and signature webhook routes have explicit "DO NOT merge" JSDoc comments and handle different data models (Envelope vs SignatureDocument). Documented in `docs/SIGNATURE-API-MAP.md`. Fixed missing `reportError()` in signature webhook's `sendCompletionNotification` catch block — was using bare `console.error` without Rollbar reporting.

### Removed
- **M8: Orphaned /admin/settings/fund** (Mar 5, 2026) — Deleted `app/admin/settings/fund/page.tsx` (396 lines) and `layout.tsx` (10 lines). Functionality duplicated by Settings Center fund tab.

### Removed
- **M1: Unused Billing Components Cleanup** (Mar 4, 2026) — Deleted 4 orphaned billing UI components with zero external imports:
  - `components/billing/over-limit-modal.tsx` — Blocking modal at usage limit with upgrade CTA (0 consumers)
  - `components/billing/locked-feature-modal.tsx` — Feature explanation + required tier modal (0 consumers)
  - `components/billing/usage-warning-banner.tsx` — Yellow banner at 80% usage, red at 100% (0 consumers)
  - `components/billing/downgrade-banner.tsx` — Read-only mode banner for over-limit resources (0 consumers)
  - Kept `plan-badge.tsx` and `upgrade-plan-modal.tsx` (actively imported)
  - All email templates audited and confirmed actively used (via static and dynamic imports)

### Changed
- **M2: Remove Papermark References** (Mar 4, 2026) — Removed 3 residual Papermark references from code comments:
  - `app/admin/settings/sections/tags-management.tsx` line 18: Removed "Papermark" from color options comment
  - `components/layouts/app.tsx` lines 23-25: Replaced Papermark-era migration history with current architecture description
  - `scripts/route-inventory.ts` line 190: Changed "core Papermark functionality" to "core DataRoom functionality"

### Security
- **H6: Server-Side Auth on LP Layout** (Mar 4, 2026) — Added `getServerSession()` auth check to `app/lp/layout.tsx`:
  - Unauthenticated users visiting any `/lp/*` page (dashboard, docs, transactions, wire) are now redirected to `/lp/login` at the server level — no protected HTML is server-rendered or indexable
  - `/lp/onboard` and `/lp/onboard/[fundId]` exempted from auth check (investor registration wizard needs unauthenticated access)
  - Pathname injected by `proxy.ts` via `x-lp-pathname` header for reliable server layout path detection
  - LP login page remains at `app/(auth)/lp/login/` (outside LP layout group) — no redirect loop risk

### Added
- **H10: Pages Router Migration Roadmap** (Mar 4, 2026) — Created comprehensive migration roadmap for all 238 Pages Router API routes:
  - Created `docs/PAGES-ROUTER-MIGRATION.md` (548 lines) cataloging every route with status, auth pattern, and App Router equivalent
  - Routes categorized: 99 CRITICAL (Phase 2 migration targets), 109 LEGACY (actively used, no App Router equivalent), 30 DEPRECATED (zero frontend references, deletion candidates)
  - Added 3-line migration status comment headers to all 238 Pages Router `.ts` files (`// MIGRATION STATUS: [STATUS]`, `// App Router equivalent: [path]`, `// See docs/PAGES-ROUTER-MIGRATION.md`)
  - Critical routes: dataroom CRUD/folders/groups/links, signature document management, sign certificate generation
  - Deprecated routes: old contacts/reports/tier APIs, advanced-mode toggles, unused signature endpoints
  - Includes Phase 2 migration priorities, pattern reference (auth, response, body parsing), and deletion candidates

### Changed
- **C1: RaiseCRM → PipelineIQ Brand Rename** (Mar 3, 2026) — Renamed all user-facing "RaiseCRM" references to "PipelineIQ" across the entire codebase:
  - Renamed `components/raise-crm/` directory to `components/pipelineiq/` with 5 component files (upgrade-card, locked-action-tooltip, frosted-kanban, lite-contact-table, activity-timeline)
  - Updated `SUITE_COLORS` key from `raisecrm` to `pipelineiq` in `admin-sidebar.tsx`
  - Updated sidebar section label from "RaiseCRM" to "PipelineIQ" and nav item labels
  - Updated marketing homepage suite card name in `app/(marketing)/page.tsx`
  - Updated pricing page: all 5 suite access references from "RaiseCRM" to "PipelineIQ" in `app/(marketing)/pricing/page.tsx`
  - Updated Lara AI chat widget context detection in `components/lara/lara-chat.tsx`
  - Updated AI chat API route suite references in `app/api/lara/chat/route.ts`
  - Updated module-access middleware display text and comments in `lib/middleware/module-access.ts`
  - Updated provision-engine comments in `lib/modules/provision-engine.ts`
  - Updated activity API comment in `app/api/raise-crm/activity/route.ts`
  - Updated SignSuite send page CRM button label in `app/admin/signsuite/send/page-client.tsx`
  - Updated dashboard activity-nav-grid and stats-pipeline-grid SUITE_COLORS references
  - URL paths (`/admin/raise-crm`, `/api/raise-crm`) preserved for backward compatibility
  - Prisma enum values (`RAISE_CRM`, `PIPELINE_IQ`, `PIPELINE_IQ_LITE`) preserved (DB values)

- **C2: CRM Page Consolidation** (Mar 3, 2026) — Removed duplicate CRM pages, consolidated to single entry point:
  - Deleted orphaned `app/admin/crm/` directory (4 files, ~1,400 lines of dead code)
  - Renamed RaiseRoom page display text to "Raise Dashboard" in `app/admin/raiseroom/page.tsx` and `page-client.tsx`
  - Updated sidebar section label from "RaiseRoom" to "Raise Management"
  - `/admin/raise-crm` (PipelineIQ) is now the sole CRM pipeline page
  - `/admin/raiseroom` retained as "Raise Dashboard" for capital raise management

- **C3: Delete Legacy /admin/esign Page** (Mar 3, 2026) — Removed orphaned legacy esign directory, replaced by SignSuite:
  - Deleted `app/admin/esign/` directory (7 files: `page.tsx`, `page-client.tsx`, `loading.tsx`, `components/compose-envelope.tsx`, `components/status-badges.tsx`, `components/esign-types.ts`, `components/envelope-detail.tsx`)
  - Added permanent redirects in `next.config.mjs`: `/admin/esign` → `/admin/signsuite`, `/admin/esign/:path*` → `/admin/signsuite`
  - Canonical e-signature module lives at `/admin/signsuite` — API routes at `/api/esign/` intentionally preserved

- **C4: Dead API Routes Registry Cleanup** (Mar 3, 2026) — Removed unused route constants file, replaced with documented conventions:
  - Deleted `lib/routes.ts` (509 lines, 0 consumers across entire codebase)
  - Created `lib/api-paths.ts` — Documentation-only file with canonical API route conventions: naming patterns (App Router and Pages Router), 17 domain prefixes, 5 auth patterns, 6 rate limiting tiers, pointer to full inventory at `docs/API_ROUTE_INVENTORY.md`

- **C5: User-Facing LP → Investor Terminology** (Mar 3, 2026) — Replaced all user-facing "LP" labels with "Investor" across 31 files (~70 string replacements):
  - Settings Center: Renamed tab from "LP Visibility" to "Investor Visibility", section headers from "LP Portal Settings" / "LP Onboarding" to "Investor Portal Settings" / "Investor Onboarding", all toggle labels and descriptions
  - Settings API: Added backward-compatible aliases (`lpOnboarding` → `investorOnboarding`, `lpPortal` → `investorPortal`) in update handler
  - GP Setup Wizard: Step labels, progress bar, launch review cards all use "Investor" terminology
  - Admin pages: Document tabs, fund document labels, sidebar labels, pipeline table headers, investor timeline, manual investment modals, approval queue, GP document review
  - Marketing pages: Pricing page feature descriptions and tier labels, homepage suite descriptions and feature lists
  - Email templates: Wire proof received notification
  - CRM components: Contact table, upgrade banner, lite contact table
  - Accessibility: Updated `aria-label` on LP header nav and bottom tab bar to "Investor" wording
  - NOT changed: Internal code identifiers (API paths like `/api/lp/*`, variable names, interface names, enum keys, filenames, database fields) — these remain "LP" as they are internal implementation details

- **H1: Consolidate /admin/fund and /admin/funds Routes** (Mar 3, 2026) — Eliminated overlapping fund route paths across 23 files (386 insertions, 382 deletions):
  - Consolidated `/admin/funds` → `/admin/fund` as the canonical admin fund route
  - Standardized dynamic route parameter from `[fundId]` to `[id]` across all fund-related App Router pages
  - Migrated API consumers from legacy `/api/fund-settings/*` to consolidated `/api/admin/fund/*` endpoints
  - Added backward-compatible permanent redirects in `next.config.mjs` for `/admin/funds`, `/admin/funds/:path*`, `/api/fund-settings/funds`, `/api/fund-settings/update`, `/api/fund-settings/:fundId`

- **H2: Remove or Integrate Orphaned Admin Routes** (Mar 4, 2026) — Audited three potentially orphaned admin routes, removed dead UI code, kept active backends:
  - `/admin/entities` — Frontend DELETED (3 files: `page.tsx`, `page-client.tsx`, `error.tsx`), API backend KEPT (`/api/admin/entities` with GET/POST/PATCH/DELETE + `/api/admin/entities/[id]/config` with GET/PUT), validation schemas (`EntityCreateSchema`, `EntityUpdateSchema`, `EntityConfigSchema`) KEPT. Added permanent redirects `/admin/entities` → `/admin/fund` and `/admin/entities/:path*` → `/admin/fund` in `next.config.mjs`
  - `/admin/quick-add` — KEPT: Actively referenced by `pages/api/request-invite.ts` (email workflow entry point for GP admins). Added JSDoc comment to `page.tsx` documenting intentional sidebar exclusion and email workflow purpose
  - `/admin/subscriptions/new` — Already handled: redirect to `/admin/signsuite` was already in `next.config.mjs` (line 75), directory already deleted in prior session
- **H2: Remove or Integrate Orphaned Admin Routes** (Mar 3, 2026) — Audited three potentially orphaned admin routes, removed dead code (3 files, 533 lines deleted):
  - `/admin/subscriptions/new` — DELETED: Zero references across entire codebase, superseded by SignSuite subscription management. Added permanent redirect to `/admin/signsuite` in `next.config.mjs`
  - `/admin/entities` — INTEGRATED into admin sidebar with Building2 icon. Has full API backend (`/api/admin/entities` with GET/POST/PATCH/DELETE), validation schemas, and test coverage
  - `/admin/quick-add` — KEPT: Actively referenced by `pages/api/request-invite.ts` redirect flow

- **H3: Signature API Namespace Map** (Mar 4, 2026) — Documented all signature API routes across 4 path patterns and added deprecation/status comments:
  - Created `docs/SIGNATURE-API-MAP.md` (171 lines): comprehensive map of all signature routes across `/api/esign/` (App Router, 9 routes), `/api/sign/` (App Router, 1 route), `pages/api/signature/` (Pages Router, 5 routes), `pages/api/signatures/` (Pages Router, 1 route), plus 2 webhook handlers. Includes auth patterns, tier limits, migration priority, and duplicate detection
  - Added deprecation comments to 5 Pages Router signature files: `void-document.ts` → POST /api/esign/envelopes/[id]/void, `webhook-events.ts` → GET /api/esign/envelopes/[id]/audit-trail, `custom-template.ts` → POST /api/esign/templates, `capture.ts` → POST /api/esign/capture (Phase 2). `certificate/[documentId]/download.ts` marked as ACTIVE (unique functionality, no App Router equivalent yet)
  - Added JSDoc documentation to both webhook handlers (`app/api/webhooks/esign/route.ts` and `app/api/webhooks/signature/route.ts`) explaining they handle different data models (Envelope vs SignatureDocument) and must NOT be merged

- **H4: Error Boundaries for All Admin Routes** (Mar 4, 2026) — Created error.tsx files in all 29 admin route directories missing them:
  - 29 new `error.tsx` files across all admin routes: raise-crm, compliance, offering, dataroom, signsuite, signsuite/bulk-send, signsuite/send, raiseroom, audit, quick-add, entities, analytics, fund, fund/[id], fund/[id]/wire, fund/new, reports, transactions, marketplace, marketplace/deals/[dealId], documents, investors/import, investors/[investorId], investors/[investorId]/review, investors/new, outreach, manual-investment, manual-investment/new, login
  - Each file follows the `app/admin/error.tsx` template: "use client", Rollbar error reporting via `useRollbar` hook with unique context string per route, `error.digest` for deduplication, Deep Navy (#0A1628) background, Electric Blue (#0066FF) buttons, "Try Again" + "Return to Dashboard" actions
  - Customized per route: unique function names (e.g., `SignSuiteError`, `InvestorDetailError`), context-specific error titles and descriptions
- **H5: Loading States for All Admin Routes** (Mar 4, 2026) — Added loading.tsx files to all 11 admin route directories missing them:
  - 11 new `loading.tsx` files: compliance, dashboard, dataroom, login, manual-investment, marketplace, offering, quick-add, raise-crm, raiseroom, signsuite
  - Each file uses consistent skeleton pattern with `@/components/ui/skeleton`: header row (title + action button), 3-column stats grid, and full-width content area
  - All 25 admin routes now have loading states (14 pre-existing + 11 new)

- **H8: Align "RaiseRoom" Naming with Product Suite** (Mar 4, 2026) — Updated all remaining user-facing "RaiseRoom" labels to "Raise Dashboard" in admin page metadata titles, and fixed deprecated "PipelineIQ" references on marketing pages:
  - Admin metadata titles: `app/admin/offering/page.tsx`, `app/admin/investors/page.tsx`, `app/admin/fund/page.tsx`, `app/admin/transactions/page.tsx` — all changed from `"… — RaiseRoom | FundRoom AI"` to `"… — Raise Dashboard | FundRoom AI"`
  - Error page: `app/admin/raiseroom/error.tsx` — heading changed from "RaiseRoom Error" to "Raise Dashboard Error"
  - Marketing homepage: `app/(marketing)/page.tsx` — suite card label changed from "PipelineIQ" to "RaiseCRM", description updated to "Investor CRM pipeline"
  - Pricing page: `app/(marketing)/pricing/page.tsx` — all 6 "PipelineIQ" references replaced with "RaiseCRM" (suite access chips across all 4 tiers + competitor comparison footnote)
  - Internal code (variable names, file paths, color keys, Prisma enums) intentionally preserved

- **H9: Rename LP Settings Keys to Investor Keys** (Mar 4, 2026) — Verified already complete from C5 sprint:
  - Settings Center tab keys already use `investorVisibility`, `investorOnboarding`, `investorPortalSettings`
  - Only remaining `lpVisibility` references are internal variable names in LP portal code (correct — internal identifiers stay "LP")

### Added
- **Naming Cleanup Sweep & Brand Standardization** (Mar 1, 2026) — Platform-wide naming audit with canonical brand reference:
  - Created `docs/BRAND_BIBLE.md` (104 lines): v3 suite names table (RaiseRoom/SignSuite/RaiseCRM/DataRoom/FundRoom with hex colors, Lucide icons, taglines, admin routes), deprecated name mapping (PipelineIQ→RaiseCRM, DocRooms→DataRoom, FundRoom Sign→SignSuite, BFFund→FundRoom AI), Prisma enum status reference (active vs deprecated/legacy), brand colors, typography, legal entity
  - Created `components/esign/signsuite-sign.tsx` (23 lines): re-export alias from FundRoomSign.tsx for v3 brand-compliant import paths. JSDoc with deprecation rationale
  - Created `components/esign/signsuite-sign-flow.tsx` (15 lines): re-export alias from FundRoomSignFlow.tsx for v3 brand-compliant import paths
  - Prisma enum audit documented in BRAND_BIBLE: `DOCROOMS` deprecated (folded into DATAROOM), `PIPELINE_IQ`/`PIPELINE_IQ_LITE` legacy (replaced by RAISE_CRM)
  - Codebase naming audit: verified zero remaining PipelineIQ/InvestorIQ/DocRooms occurrences outside documentation. SignSuite correctly branded in all templates

- **Tier Matrix Reference Document** (Mar 1, 2026) — Comprehensive single-source-of-truth for CRM subscription architecture:
  - Created `docs/TIER_MATRIX.md` (335 lines, 10 sections): Architecture Overview (dual billing: CRM Stripe + SaaS ee/stripe), Marketing Tiers (4-tier pricing: FREE $0 / CRM_PRO $20mo / FUNDROOM $79mo / ENTERPRISE custom with 25-feature matrix), CRM Tier Limits (11 limit types across 3 tiers: contacts, e-sigs/mo, templates, storage, envelopes, sequences, bulk recipients, rooms, contacts/day, files/upload, export rows), Module Provisioning (6 ProductModule enums × 4 tiers with add-on overrides), SaaS Plan Capabilities (6 plan slugs × 22 capability flags), AI CRM Add-On ($49/mo with 14-day trial), Gate Enforcement Reference (7 gate functions with file locations and error codes), Type Definitions (3 CrmSubscriptionTier types), Caching Architecture (3 cache systems with TTLs), Known Discrepancies (7 documented gaps)

- **Marketing Homepage Launch-Quality Enhancement** (Mar 1, 2026) — Completed the marketing homepage (`app/(marketing)/page.tsx`) to 9 full sections:
  - Suite cards section: "Five Suites. One Platform." — renders all 5 product suites (RaiseRoom/SignSuite/RaiseCRM/DataRoom/FundRoom) as cards with colored top borders and suite icons
  - Lara AI section: "Meet Lara — Your AI Concierge" — 2-column layout with capability pills (Outreach Drafting, Compliance Flagging, Engagement Insights, Pipeline Summaries, Document Assistance) and interactive chat mockup demonstrating contextual conversation
  - Competitor comparison section: "Replace Your Entire Stack" — Deep Navy (#0A1628) background, 5 competitor costs (DocuSign $25/mo, Dropbox Business $20/mo, DocSend $45/mo, HubSpot CRM $45/mo, Carta $100/mo) with strikethrough styling vs FundRoom $79/mo in emerald
  - Lifecycle timeline section: "Your Raise Ends. FundRoom Doesn't." — 4-phase connected timeline (Pre-Raise → Active Raise → Post-Close → Ongoing Ops) with per-phase bullet lists and blue connecting dots
  - JSON-LD structured data: Schema.org Organization markup in both Next.js metadata `other` field and inline `<script type="application/ld+json">` tag for crawler compatibility
  - SEC disclaimer added to marketing footer: "FundRoom AI is not a broker-dealer, investment adviser, or funding portal..."
  - Compliance link added to footer Company column
  - Copyright updated to "White Label Hosting Solutions"
  - New Lucide icon imports: DollarSign, Clock, Rocket, Building
  - Homepage grew from 246 lines (6 sections) to 548 lines (9 sections)

- **Phase 5.1: Lara AI Chat Widget (Foundation)** (Feb 28, 2026) — Persistent AI concierge widget across the entire admin platform:
  - `components/lara/lara-chat.tsx` — Full chat widget with floating FAB button (56px circle, purple #8B5CF6), expandable chat panel (380px x 500px desktop, full-screen mobile), context-aware greetings per suite, quick action chips, typing indicator (three animated dots), user/lara message bubbles, keyboard shortcuts (Escape to close)
  - `app/api/lara/chat/route.ts` — POST endpoint with intent detection (12 patterns: greetings, capabilities, email drafting, signatures, viewer activity, pipeline, compliance, deadlines, documents, capital calls, settings, upgrade). Context-aware responses based on current suite. Auth-gated via `getServerSession`
  - `app/admin/layout.tsx` — Replaced `AIAssistantFAB` with `LaraChat` for persistent widget across all admin pages
  - Tier gating: Free (quick actions only, canned responses), Pro (outreach drafts + reminders), Business (full intelligence), FundRoom (compliance + fund insights)
  - State management: React state (not persisted v1), widget persists across navigation via layout placement

- **Phase 6.1: Stripe Billing + Module Provisioning Integration** (Feb 28, 2026) — Connected module provisioning to billing webhooks:
  - `app/api/webhooks/stripe-crm/route.ts` — Integrated `provisionModulesForTier()` calls into all webhook handlers: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Modules now auto-provision on tier changes
  - `components/billing/usage-warning-banner.tsx` — Inline warning banner at 80% usage threshold (yellow) with upgrade CTA
  - `components/billing/over-limit-modal.tsx` — Blocking modal at 100% limit with upgrade CTA and reset date info
  - `components/billing/locked-feature-modal.tsx` — Feature explanation modal for locked features showing required tier and price
  - `components/billing/downgrade-banner.tsx` — Read-only mode banner for over-limit resources after downgrade (data preserved, additions blocked)
  - Graceful downgrades: Data never deleted on downgrade, existing records preserved, read-only mode for over-limit features

- **Phase 7.1: Product Suite Branding Sweep** (Feb 28, 2026) — Complete branding pass across all 5 suites + Lara:
  - Page titles: Updated 14 admin pages to `"Page Name — Suite Name | FundRoom AI"` format (SignSuite, RaiseRoom, RaiseCRM, DataRoom, Dashboard, Analytics, Reports, Audit, Investors, Transactions, Outreach, Offering, Compliance, Send for Signature)
  - Pricing page: Updated to 4-tier layout (Free/Pro/Business/FundRoom) with competitive comparison section (DocuSign $35 + Dropbox $25 + DocSend $45 + HubSpot $50 + Carta $5K/yr = $565/mo → FundRoom AI $79/mo), suite access chips per plan, "Start Free" CTA, FAQ section
  - Email templates: Updated 18 email templates footer from "Powered by FundRoom" to "Powered by FundRoom AI"
  - Internal code: Updated DocRooms comments to "DataRoom engine (DOCROOMS)" in provision-engine.ts and module-access.ts
  - Naming audit: No PipelineIQ/InvestorIQ occurrences remain. SignSuite already correctly branded in all templates

- **Prompt 8.2: Security Audit Checklist** (Feb 28, 2026) — Comprehensive automated security audit test suite:
  - `__tests__/security/security-audit.test.ts` (539 lines, 37 tests) — Automated security verification: rate limiting on all endpoints, CSRF protection, error sanitization, auth coverage, encryption configuration, CORS headers, CSP headers, input validation patterns, session management, webhook signature verification
  - `docs/security_audit_report.md` — Generated security audit report documenting all findings, coverage metrics, and recommendations

- **Prompt 9.1: 6-Digit Code Auth for External Viewers** (Feb 28, 2026) — OTP-based authentication for DataRoom/RaiseRoom external viewers:
  - `lib/verification/viewer-auth.ts` (~273 lines) — `sendViewerOTP()` generates 6-digit code via `generateOTP()`, stores in Prisma `ViewerVerification` model (10-min expiry, max 3 attempts), sends via Resend. `verifyViewerOTP()` validates code with timing-safe comparison, marks verified, returns viewer session token. `isViewerVerified()` checks active verification status
  - `lib/utils/generate-otp.ts` — Cryptographically secure 6-digit OTP generation using `crypto.randomInt()`
  - `__tests__/lib/verification/viewer-auth.test.ts` (408 lines, 29 tests) — Full coverage: OTP generation, send flow (rate limiting, email delivery), verify flow (valid/expired/max attempts/wrong code), timing-safe comparison, session token generation
  - `prisma/schema.prisma` — New `ViewerVerification` model: email, code (hashed), expiresAt, attempts, verified, verifiedAt, ipAddress, userAgent. Indexes on `(email, code)` and `(email, expiresAt)`
  - Views API integration: `app/api/views/route.ts` and `app/api/views-dataroom/route.ts` updated with viewer OTP verification flow

- **Prompt 9.2: Auto-Contact Creation — Legacy Viewer Capture Consolidation** (Feb 28, 2026) — Consolidated legacy contact auto-capture into inline view route logic:
  - `app/api/views/route.ts`, `app/api/views-dataroom/route.ts` — Contact auto-capture logic moved inline: on view creation with email, upserts Contact record with source DATAROOM, updates engagement score. Fire-and-forget pattern with `reportError()` on failure
  - `__tests__/e2e/module-provisioning-e2e.test.ts` (223 lines, 13 tests) — End-to-end module provisioning tests: tier-based module access, contact limits, e-sig limits, add-on overrides, upgrade/downgrade flows
  - `jest.setup.ts` — Added `viewerVerification` mock (findUnique, findFirst, findMany, create, update, delete, count) to global Prisma mock

- **Prompt 9.3: Document DOCX/XLSX Auto-Convert to PDF** (Feb 28, 2026) — Pure JS/TS document conversion library for serverless environments, fully wired into all upload endpoints:
  - `lib/documents/file-conversion.ts` (419 lines) — Converts DOCX and XLSX files to PDF. `needsConversion(filename)` checks extension, `convertToPdf(fileBuffer, filename)` returns `ConversionOutcome`. DOCX→HTML via mammoth + text→PDF via pdf-lib. XLSX→parsed rows via xlsx + text→PDF via pdf-lib. Graceful fallback: if conversion fails, `acceptOriginal: true` signals original file should still be stored. US Letter PDF (612×792), embedded fonts (Helvetica, HelveticaBold, Courier), word-wrap, page breaks
  - `package.json` — Added `mammoth` dependency for DOCX→HTML conversion
  - `__tests__/lib/documents/file-conversion.test.ts` (341 lines, 28 tests) — Full test coverage: `getExtension` (5 tests), `needsConversion` (7 tests), DOCX conversion (4 tests), XLSX conversion (5 tests), unsupported formats (3 tests), PDF output validation (2 tests), error handling (2 tests). Mocks: mammoth, xlsx, logger
  - Upload endpoint wiring (both LP and GP flows):
    - `pages/api/documents/upload.ts` — Wired conversion in both GP upload (lines 170-197) and LP upload (lines 299-326) flows. Pattern: `needsConversion(fileName)` → `convertToPdf(fileBuffer, fileName)` → swap `uploadBuffer/uploadFilename/uploadMimeType` on success, log warning and use original on failure
    - `app/api/lp/documents/upload/route.ts` — Same conversion wiring for App Router LP upload endpoint
    - `lib/storage/investor-storage.ts` — Updated `uploadInvestorDocument()` to accept converted filenames (no storage key changes needed)
  - Frontend MIME type updates:
    - `components/lp/upload-document-modal.tsx` — Added `.docx,.xlsx,.xls,.doc` to accepted MIME types
    - `components/documents/ExternalDocUpload.tsx` — Added DOCX/XLSX MIME types to accepted file list
    - `components/documents/GPDocUpload.tsx` — Added DOCX/XLSX MIME types to accepted file list
  - Pre-existing TypeScript error fixes (3 files):
    - `lib/signature/flatten-pdf.ts` — Fixed `recipient.metadata` → `recipient.signatureChecksum` (SignatureRecipient model has no `metadata` field)
    - `app/api/esign/envelopes/[id]/audit-trail/route.ts` — Wrapped `result.pdfBytes` (Uint8Array) in `Buffer.from()` for NextResponse compatibility
    - `lib/esign/audit-trail-pdf.ts` — Fixed null timestamp handling: `event.timestamp ? formatShortDate(new Date(event.timestamp)) : "N/A"`

- **Prompt 10: JSX Demo Artifact — FundRoom_v5_Demo.jsx** (Mar 2, 2026) — Polished single-file React JSX demo artifact for investor presentations:
  - `docs/FundRoom_v5_Demo.jsx` (NEW, ~1,685 lines, 75.2KB) — Complete interactive demo with 15 clearly documented sections:
    - Section 1: BRAND_COLORS + TYPOGRAPHY constants matching `lib/design-tokens.ts` (WCAG 2.1 AA verified colors, Inter/JetBrains Mono)
    - Section 2: PRODUCT_SUITES array — 5 suites (RaiseRoom/SignSuite/RaiseCRM/DataRoom/FundRoom) with v3 names, hex colors, Lucide icon names, taglines, 4-5 features each, admin routes
    - Section 3: CRM_PRICING_TIERS — 4 tiers matching `lib/stripe/crm-products.ts` (Free $0, CRM Pro $29/$23yr, Business $39/$32yr, FundRoom $79/$63yr) + AI_CRM_ADDON ($49/$39yr, 14-day trial, 5 features)
    - Section 4: LARA_SUITE_CONTEXTS — 5 suite-specific AI concierge contexts with greetings, quick actions, and canned responses
    - Section 5: LP_WIZARD_VISIBLE_STEPS — 6-step interactive wizard (Account→Entity→Accreditation→Commit→Sign→Fund) with per-step fields, entityTypes, accreditation categories, SEC representations, signing modes, payment methods
    - Section 6: GP_WIZARD_STEPS — 9 steps with descriptions and DATAROOM_ONLY skip note
    - Section 7: Shared UI components — Badge (7 variants), DemoButton (4 variants, 44px minHeight), Card, MetricCard (font-mono tabular-nums), ProgressBar (role="progressbar")
    - Section 8: SuiteOverviewSection — responsive grid with colored top borders per suite
    - Section 9: PricingSection — monthly/yearly toggle (role="radiogroup"), "Most Popular" Business tier badge, AI CRM add-on banner
    - Section 10: LaraAISection — interactive chat with suite selector, message bubbles, typing indicator, follow-up suggestions, sessionStorage persistence
    - Section 11: LPWizardSection — 6-step tabbed wizard with role="tablist", step-specific dynamic content rendering
    - Section 12: GPWizardSection — 9-step numbered grid with descriptions
    - Section 13: GPDashboardPreview — 4 MetricCards with tabular-nums, ProgressBars, pipeline stacked bar chart (6 stages with legend)
    - Section 14: SecuritySection — 6 security features (AES-256-GCM, SHA-256 Audit, Multi-Tenant, RBAC, ESIGN/UETA, CSRF+HSTS+CSP)
    - Section 15: Main FundRoomDemo — 7 navigation tabs, sticky header, "Interactive Demo" badge, maxWidth 1440px, SEC disclaimer footer, © 2026 White Label Hosting Solutions
  - Full WCAG 2.1 AA accessibility: ARIA roles (tablist, tab, radiogroup, progressbar, banner, navigation, main, contentinfo, log, alert), aria-selected, aria-checked, aria-live="polite", aria-hidden decorative icons, 44px minimum touch targets throughout
  - All data verified against authoritative sources: `lib/stripe/crm-products.ts` (pricing), `lib/design-tokens.ts` (colors/typography), `docs/BRAND_BIBLE.md` (naming), `components/lara/lara-chat.tsx` (AI contexts)
  - Descriptive variable names throughout (no single-letter abbreviations)
  - `docs/GP_LP_Wizard_Reference.md` — Added deprecation header and cross-reference to new demo artifact. Original JSX artifact preserved for historical reference only

- **Prompt 8: Pages Router Migration Acceleration** (Mar 1, 2026) — Audited and categorized all 257 remaining Pages Router routes into A/B/C priority tiers:
  - `docs/PAGES_TO_APP_ROUTER_MIGRATION.md` (updated) — Current state: 257 Pages Router + 295 App Router = 552 total routes. Category A (23 routes): auth, sign, documents, approvals, transactions, investor-profile. Category B (200 routes): teams/ (170, broken into 12 sub-batches), file, signature, webhooks, branding, view, viewer. Category C (34 routes): jobs, mupdf, notifications, misc standalone files. Added teams/ sub-batch migration plan (12 batches of 10-15 routes) and webhook migration notes

- **Prompt 9: GTM Final Checks** (Mar 1, 2026) — Go-to-market readiness verification and gap closure:
  - GTM audit verified 5/6 core items production-ready: cookie consent banner (`lib/tracking/cookie-consent.ts` + `components/tracking/cookie-consent-banner.tsx`), legal pages (`app/(marketing)/privacy/page.tsx` + `terms/page.tsx` with substantive content), Bermuda Club seed data (`prisma/seed-bermuda.ts` with FundroomActivation, PlatformSettings, demo LPs), email drip templates (56 components + 45 sender functions covering full investor lifecycle)
  - `docs/HELP_CENTER_PLAN.md` (NEW, 142 lines) — Help center roadmap: architecture (Markdown CMS + Fuse.js search + Lara AI integration), 3 content categories (GP 10 categories, LP 5, Admin 3), article template, 3 implementation phases (2A foundation, 2B polish, 2C scale), success metrics (5 KPIs), content guidelines

- **Prompt 7: Investor Packet Alignment** (Mar 1, 2026) — Investor-facing document with aligned pricing, verified codebase metrics, market sizing, and competitive savings analysis:
  - `docs/INVESTOR_PACKET.md` (281 lines) — Complete investor packet with 9 sections + 2 appendices: Executive Summary (verified metrics: 373K+ LOC, 144 models, 552 routes, 269 test files), Product Suite Overview (5 modules + Lara AI), Pricing (3 CRM tiers + AI add-on matching Stripe config), Competitive Savings ($572/mo → $79/mo, 86% reduction), Market Opportunity (TAM 70K+, SAM 35K, $330K Y1 ARR target), Security Posture (9-area table), Technical Architecture, Product Roadmap (3 phases), Appendix A (suite naming reference), Appendix B (Stripe product configuration with env vars and webhook events)

### Removed
- `lib/contact-autocapture.ts` (deleted) — Legacy contact auto-capture module. Logic consolidated inline into `app/api/views/route.ts` and `app/api/views-dataroom/route.ts` as part of Prompt 9.2

### Fixed
- **RaiseRoom Fund Summary API TypeScript errors** (Feb 26, 2026) — Fixed 8 TypeScript errors in Phase 1 suite files:
  - `app/api/admin/raiseroom/fund-summary/route.ts`: Fixed `enabledEmailProtection` → `emailProtected` (non-existent Prisma field), fixed Investment→Investor query to traverse `investor.user` relation for `name`/`email` (Investor model has no `firstName`/`lastName` — those are on User), updated activity feed builder to use `inv.investor?.user?.name` access pattern
  - `app/admin/raiseroom/page-client.tsx`: Fixed StatCard icon type to accept `style` prop alongside `className` for Lucide icon color theming

### Added
- **Phase 1 Suite Build-Out: FundRoom AI Complete Build Prompts v3** (Feb 26, 2026) — 5-prompt sequential build implementing the modular suite architecture with per-suite color branding:

  **Prompt 1.1: SignSuite Standalone Send Flow**
  - `app/admin/signsuite/send/page-client.tsx` — Full envelope compose flow: recipient management (add/remove/reorder), file upload, field placement, email customization (subject/body), signing mode (sequential/parallel/mixed), expiry date. Emerald (#10B981) suite color
  - `app/api/esign/standalone/send/route.ts` — POST endpoint creating envelope with recipients, validating e-sig tier limits, and sending via envelope service
  - 7 SignSuite sub-components: `envelope-detail.tsx`, `envelope-list.tsx`, `field-placement.tsx`, `template-list.tsx`, `usage-meter.tsx`, `status-badges.tsx`, `signsuite-types.ts`

  **Prompt 1.2: SignSuite Dashboard & Sidebar Nav**
  - `app/admin/signsuite/page-client.tsx` — Dashboard with 5 tabs (All, Active, Completed, Templates, Drafts). View modes: list → compose → detail → fieldPlacement. Usage meter showing e-sig quota per tier. Emerald (#10B981) active states
  - Admin sidebar: Added `activeColor` property to `NavItem` interface for per-suite active state styling. Dynamic inline styles using `item.activeColor ?? "#0066FF"` for link text, left border, and background tint

  **Prompt 1.3: RaiseRoom Module (Capital Raise Vault)**
  - `app/admin/raiseroom/page-client.tsx` (1,943 lines) — Full capital raise management dashboard with 4 tabs (Overview, Pipeline, Documents, Activity). Cyan (#06B6D4) suite color. Raise progress bar, 4 stat cards, quick actions, fund details with Reg D exemption display, offering page status, pipeline bar chart (6 stages), NDA Gate via SignSuite section, activity timeline, fund selector for multi-fund orgs
  - `app/api/admin/raiseroom/fund-summary/route.ts` — GET endpoint returning fund summary with investor stats, pipeline distribution, and offering page data

  **Prompt 1.4: RaiseCRM Rebrand & Module Extraction**
  - Amber (#F59E0B) theming applied across all RaiseCRM components: `app/admin/raise-crm/page-client.tsx` (tab active states, badges), `components/raise-crm/frosted-kanban.tsx` (upgrade overlay CTA), `components/raise-crm/upgrade-card.tsx` (alert styling)
  - Sidebar `activeColor` entries for all 4 suites: RaiseRoom (#06B6D4 Cyan), RaiseCRM (#F59E0B Amber), SignSuite (#10B981 Emerald), DataRoom (#2563EB Blue)
  - `sectionLabel` property on NavItem for visual section dividers between suites

  **Prompt 1.5: DataRoom Separation (Secure Folders)**
  - Blue (#2563EB) suite color verified across all 8 DataRoom module files (1,125 lines total)
  - `page-client.tsx` — Upload button styled with suite blue: `bg-[#2563EB] hover:bg-[#1D4ED8] text-white`
  - `storage-meter.tsx` — Fixed `text-blue-500` → `text-blue-600` for consistency with rest of module

  **Suite Color Reference:**
  | Suite | Color | Hex |
  |-------|-------|-----|
  | RaiseRoom | Cyan | #06B6D4 |
  | SignSuite | Emerald | #10B981 |
  | RaiseCRM | Amber | #F59E0B |
  | DataRoom | Blue | #2563EB |
  | FundRoom | Purple | #8B5CF6 |

- **RaiseCRM Lite UI + Upgrade Gates (Prompt 4)** (Feb 26, 2026) — Tier-aware CRM pipeline module:
  - `app/admin/pipelineiq/page-client.tsx` (335 lines): Dashboard with 3 tabs (Contacts, Pipeline, Activity). FREE tier shows simplified `LiteContactTable` + `FrostedKanban` (disabled overlay); FUNDROOM tier shows full `ContactKanban`. Mode-aware labels (Leads vs Investors). Contact search, cap counter, upgrade card. Dynamic imports for heavy CRM components
  - `app/api/pipelineiq/activity/route.ts` (162 lines): GET endpoint returning dataroom viewer events (PAGE_VIEW, DOWNLOAD, NDA_SIGNED). Aggregates from View records with pagination (default 30, max 50). Rate limited, auth required
  - Module access: PIPELINE_IQ_LITE for FREE tier (20-contact limit), PIPELINE_IQ for paid tiers (unlimited)

- **SignSuite Standalone Send + Dashboard (Prompt 5)** (Feb 26, 2026) — E-signature envelope management module:
  - `app/admin/signsuite/page-client.tsx` (262 lines): Dashboard with 4 tabs (Active, Completed, Templates, Drafts). View modes: list → compose → detail → fieldPlacement. Usage meter, search, refresh. Status filter by tab. Template pre-fill for envelope creation
  - `app/api/esign/templates/route.ts` (153 lines): GET (list with search) + POST (create with validation). Module access check for SIGNSUITE. Returns template metadata including defaultRecipients, fields, defaultEmailSubject/Message
  - `app/api/esign/templates/[id]/route.ts` (159 lines): GET (detail) + PATCH (update) + DELETE. Team-scoped with `createdByUser` relation
  - Tier limits: FREE=10 e-sigs/mo, CRM_PRO=25/mo, FUNDROOM=unlimited

- **DataRoom Module + Auto-Filing (Prompt 6)** (Feb 26, 2026) — Document filing and contact vault module:
  - `app/admin/docrooms/page-client.tsx` (327 lines): 3-tab dashboard (Filed Documents, Contact Vaults, Activity Log). Folder tree sidebar, file search, storage meter, upload dialog. Source type labels (manual upload, wire proof, tax form, identity doc, shared doc)
  - `app/api/docrooms/upload/route.ts` (114 lines): POST endpoint for manual org vault upload. Validates file + sourceType, 25MB limit. Calls `fileToOrgVault()`. Audit logged
  - `app/api/docrooms/activity/route.ts` (86 lines): GET endpoint listing 50 most recent DocumentFiling records with user email enrichment
  - `app/api/docrooms/vaults/route.ts` (99 lines): GET endpoint listing ContactVault records with per-vault stats (document count, total size, expiry)
  - Module access: DOCROOMS (always available across all tiers)

- **DataRoom NDA Gate → SignSuite Integration (Prompt 7)** (Feb 26, 2026) — Consolidated NDA e-signing via SignSuite:
  - **Schema**: `NdaSigningRecord` model (linkId, envelopeId, signerEmail, signedAt, ipAddress, userAgent, filingId, viewId). Link model: `enableSignSuiteNda` (Boolean), `signSuiteNdaDocumentId` (FK to SignatureDocument). LinkPreset mirrors same fields. Migration `20260226_add_signsuite_nda_gate`
  - **API**: `app/api/esign/nda-sign/route.ts` (295 lines) — GET: check signing status (signed/pending/not-started). POST: initiate NDA signing → creates envelope from template, tracks e-sig usage, creates NdaSigningRecord. Resume logic prevents duplicate envelopes. Audit logged
  - **Visitor Component**: `components/view/access-form/signsuite-nda-section.tsx` (263 lines) — 6-state machine (idle → checking → not_signed → signing → signed → error). Auto-checks status on email change, embedded iframe signing, completion confirmation
  - **Access Form Integration**: `components/view/access-form/index.tsx` — Conditionally renders SignSuiteNdaSection, form validation blocks submission until NDA complete
  - **Views Wiring**: `app/api/views/route.ts` and `app/api/views-dataroom/route.ts` — Both enforce SignSuite NDA gate validation, pass link fields to AccessForm
  - **Viewer Props**: `components/view/document-view.tsx` and `components/view/dataroom/dataroom-view.tsx` — Pass SignSuite NDA props through to AccessForm
  - **Tests**: `__tests__/api/esign/nda-sign.test.ts` (559 lines, 23 tests) — Full coverage: GET (7 tests: params, status states, email normalization, errors) + POST (16 tests: validation, link checks, NDA enabled, existing records, happy path, envelope creation, usage tracking, audit, errors)
  - **Jest Setup**: Added `ndaSigningRecord` mock to `jest.setup.ts` (findUnique, findFirst, findMany, create, update, delete, count)

### Fixed
- **TypeScript Errors from Prompts 4-6** (Feb 26, 2026) — 8 pre-existing TS errors fixed across 6 files:
  - `app/api/esign/templates/route.ts` + `[id]/route.ts`: Fixed `createdBy` → `createdByUser` (Prisma relation name mismatch)
  - `app/api/pipelineiq/activity/route.ts`: Removed non-existent `duration` field from View select (belongs to ViewPage model); removed dead dwell event code block
  - `app/api/esign/nda-sign/route.ts`: Fixed `fileUrl`/`fileType`/`fileName` → `file`/`storageType` (SignatureDocument field names); added null guard for `link.teamId`
  - `app/admin/pipelineiq/page-client.tsx`: Fixed `onContactClick` → `onCardClick` (ContactKanban prop name)
  - `app/admin/signsuite/page-client.tsx`: Added missing `onCreateTemplate` prop on TemplateList; fixed `onSelect` type

- **Product Module Access Control System** (Feb 26, 2026) — Three-prompt build implementing feature-level access control:
  - **Prompt 1: Schema** — `ProductModule` enum (DATAROOM, SIGNSUITE, DOCROOMS, PIPELINE_IQ_LITE, PIPELINE_IQ, FUNDROOM), `AddOnType` enum, `OrgProductModule` model (org-module-level feature flags with `limitValue`/`limitType`), `OrgAddOn` model (active add-ons). `sourceModule` field on Contact and Envelope models. Migration `20260226_add_product_module_schema`
  - **Prompt 2: Provisioning Engine** — `lib/modules/provision-engine.ts` (~450 lines): tier-to-module mapping (FREE/CRM_PRO/FUNDROOM), add-on override system (PIPELINE_IQ replaces PIPELINE_IQ_LITE), `hasModule()`, `getModuleLimit()`, `isOverLimit()` helpers. 22 unit tests in `__tests__/lib/modules/provision-engine.test.ts`
  - **Prompt 3: Middleware + Route Integration** — `lib/middleware/module-access.ts` (~309 lines): `checkModuleAccess()` and `checkModuleLimit()` inline checks, `withModuleAccess()` and `withModuleLimit()` HOF wrappers, `resolveOrgIdFromTeam()` helper. SIGNSUITE check on 7 esign routes (envelopes CRUD, send, remind, void, status, filings). PIPELINE_IQ check on 3 contacts routes (import, engagement, recalculate-engagement). PIPELINE_IQ_LITE MAX_CONTACTS limit on POST /api/contacts. 22 middleware tests in `__tests__/lib/middleware/module-access.test.ts`

- **Design System & Component Library (PROMPT 6.1)** (Feb 26, 2026) — Centralized design tokens and missing UI components:
  - `lib/design-tokens.ts`: TypeScript constants for colors, typography, spacing, breakpoints, shadows, animations, radius, zIndex, chartColors, touchTargets
  - 7 new UI components: `MetricCard`, `EmptyState`, `ConfirmDialog`, `UploadZone`, `PipelineBar`, `ActionQueue`, `DataTable`
  - `components/ui/wizard.tsx`: Multi-step wizard shell with progress bar, step validation, skip logic, async validation, prefers-reduced-motion support
  - Fixed `input.tsx` (bg-white → bg-background) and `table.tsx` (hover:bg-gray-100 → hover:bg-muted/50) for proper dark mode
  - Enhanced `globals.css` with slide, fade, scale-in, shimmer, and progress-bar animations

- **Marketing Homepage & Public Pages (PROMPT 6.2)** (Feb 26, 2026) — Complete marketing site:
  - Marketing layout with sticky nav (Logo, Features, Pricing, Security, Login, Get Started) and 4-column footer (Product, Company, Legal, Connect)
  - Homepage: hero section, stats bar (500+ Funds, 10K+ Investors, $2B+ Tracked, 99.9% Uptime), 6-feature grid, 3-step how-it-works, trust section, CTA
  - Pricing page: monthly/annual toggle (17% savings), 3 plan cards (Free/CRM Pro/FundRoom), AI CRM add-on, 4 FAQ items
  - Terms of Service: 12 sections covering acceptance, service description, accounts, acceptable use, e-signatures, data security, IP, billing, liability, disclaimer, governing law (Delaware), contact
  - Privacy Policy: 13 sections covering data collection, sensitive financial data (AES-256-GCM), usage, multi-tenant isolation, sharing, third-party services, cookies, retention (7yr SEC), rights, security, children, changes, contact
  - Security page: 6 areas (encryption, auth, multi-tenant isolation, compliance, infrastructure, incident response) with vulnerability reporting

- **Playwright E2E Test Suite (PROMPT 7.1)** (Feb 26, 2026) — 10 critical E2E test flows (5 existing + 5 new):
  - `flow-lp-investment.spec.ts`: LP investment end-to-end (18 tests)
  - `flow-lp-resume.spec.ts`: LP resume & auto-save (12 tests)
  - `flow-external-doc-upload.spec.ts`: External document upload (19 tests)
  - `flow-mobile-responsive.spec.ts`: Mobile responsive verification (21 tests)
  - `flow-rbac-enforcement.spec.ts`: RBAC access control (38 tests)

- **Jest Unit & Integration Tests (PROMPT 7.2)** (Feb 26, 2026) — Critical domain test suites:
  - `waterfall.test.ts`: European/American waterfall calculations, hurdle rates, carry splits
  - `form-d-validation.test.ts`: SEC Form D data validation, field mapping, export format
  - `multi-tenant-isolation.test.ts`: RBAC enforcement, cross-tenant prevention, role hierarchy
  - `signing-flow.test.ts`: E-signature signing session, sequential/parallel/mixed modes
  - `dataroom-analytics.test.ts`: Engagement scoring, view tracking, analytics aggregation

- **Pre-Launch Verification Script (PROMPT 8.2)** (Feb 26, 2026) — `scripts/pre-launch-checks.ts`:
  - Validates 12 required env vars + 8 recommended env vars
  - Security checks (NEXTAUTH_SECRET ≥64 chars, ENCRYPTION_KEY ≥32 chars, PAYWALL_BYPASS state)
  - Critical file presence (16 files) and forbidden file absence (middleware.ts)
  - Prisma schema validation (model/enum counts, tenant isolation on 5 critical models)
  - Security headers in vercel.json (5 headers)
  - Build readiness (Node 22.x, PROPRIETARY license)
  - Supports --env-only and --verbose flags, exits 1 on failures

- **Bermuda Club Fund Tenant Verification (PROMPT 8.3)** (Feb 26, 2026) — Verified seed-bermuda.ts (1,844 lines):
  - Organization + Team + Brand + Fund ($9.55M target, 506(c), European waterfall)
  - 6 pricing tiers (90 total units), FundAggregate ($720K committed, $180K funded)
  - 6 demo LP investors at various pipeline stages (APPLIED through FUNDED)
  - 4 LP documents at various review states (APPROVED, PENDING, REVISION_REQUESTED)
  - Signature documents (NDA + Sub Ag with fields and recipients)
  - Document templates, funding rounds, custom domains, offering page
  - FundroomActivation (ACTIVE) + PlatformSettings (paywall bypassed 90 days)
  - Clean function with dependency-ordered cascading deletes

- **SEC Compliance Engine (PROMPT 5.3)** (Feb 26, 2026) — Full SEC compliance dashboard and export system:
  - **Compliance Overview API** (`app/api/admin/compliance-overview/route.ts`, 381 lines): Parallel Prisma queries for organization, funds, investors, audit stats, signature stats. Builds accreditation breakdown (6 statuses: selfCertified, thirdPartyVerified, kycVerified, pending, expired, expiringSoon), representations tracking, Form D timeline per fund with filing status (not_filed/filed/amendment_due/overdue), 8-item compliance checklist, compliance score
  - **Compliance Package Export API** (`app/api/admin/compliance-package/route.ts`, 335 lines): JSON export with org certification, Form D data, per-investor accreditation report with 8 SEC representations, signature compliance stats, immutable audit log with SHA-256 hash chain verification. Masked EIN. Audit logged as DATA_EXPORT
  - **5 Dashboard Tab Components**: OverviewTab (checklist + score ring + stats), FormDTab (timeline + exemption cards + filing status badges), AccreditationTab (stacked bar chart + verification methods + expiring warning), RepresentationsTab (donut chart + investor rep tracking), AuditTrailTab (chain integrity + export metadata + retention)
  - **Compliance Dashboard Page** (`app/admin/compliance/page-client.tsx`, 305 lines): 5-tab navigation (Overview, Form D, Accreditation, Representations, Audit Trail) with refresh, loading skeletons, error state
  - **Sidebar Navigation**: Added "SEC Compliance" with ShieldCheck icon to COMMON_BOTTOM nav between Audit Log and Settings
  - **TypeScript fixes**: Fixed Prisma relation path (`team?.organization?.defaults`), replaced invalid `REJECTED` AccreditationStatus with `EXPIRED`, fixed `expired` field increment logic

### Fixed
- **LP Portal Verification + Magic Link (PROMPT 1.5)** (Feb 26, 2026) — Comprehensive verification of the LP portal and authentication flow:
  - **All 9 LP portal pages verified**: `dashboard/page-client.tsx` (1,201 lines), `docs/page-client.tsx` (612 lines), `transactions/page-client.tsx` (434 lines), `wire/page-client.tsx` (557 lines), `onboard/page-client.tsx`, plus login, settings, and layout files
  - **All 26 LP components verified present**: `lp-header`, `bottom-tab-bar`, `dashboard-summary`, `fund-card`, `activity-timeline`, `capital-calls-section`, `dashboard-skeleton`, `documents-vault`, `empty-state`, `kyc-verification`, `manual-investments-card`, `notes-card`, `nda-accreditation-dialog`, `signature-pad`, `staged-commitment-wizard`, `subscription-modal`, `upload-document-modal`, `welcome-banner`, plus 5 dashboard sub-components
  - **Magic link authentication flow verified end-to-end**: LP login → `LPSignIn` triggers NextAuth `signIn("email")` → magic link email → `/api/auth/verify-link` validates token via checksum + atomic `$transaction` → creates NextAuth JWT → sets session cookie → redirects to `/lp/dashboard`
  - **All 35+ LP API routes verified in App Router**: fund-context, fund-details, pending-counts, pending-signatures, me, docs, wire-instructions, wire-proof, subscription-status, offering-documents, complete-gate, transactions, documents, staged-commitment, notes, and more
  - **All fetch URLs in LP pages resolve**: Dashboard (14 fetch calls), Docs (3), Wire (2), Transactions (1) — all confirmed to route to existing App Router endpoints
  - **LP layout architecture verified**: `app/lp/layout.tsx` with gradient background + `LPHeader` (desktop nav) + `LPBottomTabBar` (mobile nav)
  - **Zero route conflicts**: No dual Pages/App Router conflicts for any LP or auth endpoint
  - **E2E happy path test**: 23/23 tests passing covering full LP onboarding + GP review + wire flow

- **LP Onboarding End-to-End Verification (PROMPT 1.4)** (Feb 26, 2026) — Full verification of LP onboarding flow:
  - **All 9 onboarding steps verified**: Personal Info → Entity Type → Address → Accreditation → NDA → Commitment → Document Signing → Funding → Completion
  - **All 13 component files verified present and imported correctly**: `page-client.tsx`, 5 step files (`PersonalInfoStep`, `AddressStep`, `AccreditationStep`, `NDAStep`, `CommitmentStep`), `FundingStep`, `InvestorTypeStep`, `FundRoomSignFlow`, `FundRoomSign`, `shared-types.ts`, `StepSkeleton`, `kyc-verification`
  - **All 8 API fetch URLs verified**: `/api/lp/fund-context`, `/api/branding/tenant`, `/api/lp/current-tranche`, `/api/lp/register`, `/api/auth/lp-token-login`, `/api/lp/sign-nda`, `/api/lp/subscribe`, `/api/lp/accreditation-audit` — all route to working App Router endpoints
  - **Zero route conflicts**: No dual Pages/App Router conflicts for LP endpoints
  - **TypeScript fixes (5 errors → 0)**: Added `DISTRIBUTION_UPDATED` and `DISTRIBUTION_DELETED` to `AuditEventType` in `lib/audit/audit-logger.ts`. Fixed `targetSize` → `targetRaise` (2 occurrences), `hurdleRatePct` → `hurdleRate`, `fundedAt` → `subscriptionDate` in fund metrics route

### Added
- **Distribution Management System (PROMPT 1.3)** (Feb 26, 2026) — Full CRUD + execution pipeline for fund distributions:
  - **API Routes** (3 files): `app/api/teams/[teamId]/funds/[fundId]/distributions/route.ts` (GET list with pagination/status filter + POST create with auto-increment), `distributions/[distributionId]/route.ts` (GET detail + PATCH update with status transition validation + DELETE for DRAFT only), `distributions/[distributionId]/execute/route.ts` (POST atomic execution with FundAggregate sync)
  - **UI Components** (4 files): `DistributionsTab` (summary cards + filter + list view), `DistributionCreateWizard` (3-step dialog: Type & Amount → Date & Notes → Review), `DistributionStatusBadge` / `DistributionTypeBadge` (7 statuses + 4 types), barrel exports via `index.ts`
  - **Fund Metrics Card**: `FundMetricsCard` component displaying IRR (Newton's method), TVPI, DPI, RVPI, MOIC with capital flow summary
  - **Fund Overview Integration**: Wired `DistributionsTab` + `FundMetricsCard` into `fund-overview-tab.tsx`, replacing Phase 2 placeholder
  - **Tests**: 24 tests covering all 6 endpoints — auth, validation, status transitions, atomic execution, audit logging (`__tests__/api/teams/funds/distributions.test.ts`)
  - **Status Lifecycle**: DRAFT → PENDING → APPROVED → PROCESSING → DISTRIBUTED → COMPLETED (also CANCELLED)

- **Phase 0: Codebase Health & Security Hardening Audit** (Feb 25, 2026) — Comprehensive 4-phase audit with results in `audit/` directory:
  - **P1 Security Gaps** (`audit/P1-security.txt`): 0 unprotected routes across 500 scanned. 5-layer defense-in-depth verified. 10 rate limiter tiers operational. 0 hardcoded secrets. 9 AES-256-GCM encryption implementations verified. RBAC spot-check: 15/15 routes PASS (10 GP + 5 LP)
  - **P2 Duplicate Routes** (`audit/P2-duplicates.txt`): 51 Pages Router files that duplicate App Router routes identified as dead code (App Router takes priority in Next.js 16). Safe to delete post-production-verification
  - **P3 TypeScript** (`audit/P3-broken-refs.txt`): 0 errors (prior 178 were phantom from missing node_modules). 0 @ts-ignore/@ts-nocheck directives
  - **P4 Code Quality** (`audit/P4-cleanup.txt`): 0 executable console.log, 0 `any` in critical paths (auth/security/audit/crypto), 78 eslint-disable all legitimate
  - **Middleware verification**: proxy.ts → edge-auth → admin-auth → route handler chain verified operational
  - **Route auth check**: `scripts/check-route-auth.sh` reports 0 violations across 500 routes (62 allowlisted)
  - **Broken reference fix**: Removed dead `activateOrRedirectAssistant` and `activateOrDeactivateAssistant` functions from `document-header.tsx` — legacy Papermark AI assistant code calling non-existent `/api/assistants` endpoint. FundRoom uses `DocumentAIDialog` via `(ee)` route group

### Removed
- **Dead Code Removal (Prompt 17)** — Deleted 5 files (426 lines) with zero external consumers: `lib/utils/use-at-bottom.ts` (dead hook), `lib/utils/use-enter-submit.ts` (dead hook), `lib/emails/send-lp-wire-proof-confirmation.ts` (dead email sender), `components/emails/lp-wire-proof-confirmation.tsx` (orphaned email template), `pages/api/teams/[teamId]/datarooms/[id]/users/index.ts` (dead endpoint returning 404). Removed `sendViewerInvitation` from `lib/api/notification-helper.ts` (sole consumer deleted). Removed unnecessary `export` on `getTabsForMode` in `fund-tab-nav.tsx` (internal-only usage)

### Added
- **Centralized RBAC Permission Matrix** (`lib/auth/rbac.ts`) — 47 permissions across 12 domains (fund, investor, investment, wire, document, esign, dataroom, team, settings, reports, marketplace, audit, platform, approval). New exports: `Permission` const, `PermissionKey` type, `PERMISSION_MATRIX` record, `checkPermission()`, `getPermissionsForRole()`, `getMinimumRole()`, `enforcePermissionAppRouter()`, `enforcePermission()`. Role hierarchy enforced: OWNER > SUPER_ADMIN > ADMIN > MANAGER > MEMBER. Comprehensive test suite (`__tests__/lib/auth/permission-matrix.test.ts`, 7 describe blocks)
- **Team-Scoped Route RBAC Standardization (Prompt 7)** — Migrated 9 routes under `app/api/teams/[teamId]/` from inline `getServerSession()` + manual `userTeam.findFirst()` to `enforceRBACAppRouter()`. Routes: billing, crm-role, datarooms (list + detail), documents, fundroom-activation, funds, offering, toggle-fundroom-access. Fixed broken `fundroom-activation/route.ts` PATCH handler (stale `owner.userId` and bare `teamId` references). 130 insertions, 330 deletions
- **E-Signature Route Auth Standardization (Prompt 8)** — Migrated 5 esign envelope sub-routes from inline `getServerSession()` + manual `userTeam.findFirst()` + separate `user.findUnique()` to `requireAuthAppRouter()`. Uses `auth.userId` and `auth.teamId` instead of 3 separate Prisma lookups. Routes: envelopes/[id] (GET/PATCH/DELETE), send (POST), remind (POST), void (POST), status (GET). 41 insertions, 158 deletions

### Security
- **Defense-in-Depth Auth on ALL Admin API Routes** (Feb 25, 2026) — Added `requireAdminAppRouter()` handler-level RBAC to all 40 admin App Router route files (43 handlers total). Ensures admin API routes are protected at both edge middleware (proxy.ts JWT validation) and handler level (Prisma-backed team role check). Covers OWNER/SUPER_ADMIN/ADMIN roles
- **Defense-in-Depth Auth on Sensitive LP API Routes** (Feb 25, 2026) — Added `requireLPAuthAppRouter()` to sensitive LP routes (bank/connect, bank/link-token, bank/status, manual-investments/proof). Added `INTENTIONALLY_PUBLIC` JSDoc markers to register, express-interest, fund-context, and webhooks/investor-updates documenting why auth is deliberately absent
- **CSRF Custom Header Enforcement** (Feb 25, 2026) — Fixed CSRF fallthrough vulnerability where all 3 validators (Pages Router, App Router, Edge middleware) allowed requests through when both Origin and Referer headers were missing. Now requires `X-Requested-With: FundRoom` custom header in that case — cross-origin attackers cannot set custom headers without CORS preflight. Exported `CSRF_HEADER_NAME`/`CSRF_HEADER_VALUE` constants. Updated `lib/utils.ts` fetcher. Created `lib/fetch-client.ts` with `apiFetch`/`apiMutate` helpers. 22 CSRF tests added
- **Auth Coverage Audit: Already-Secured Routes** (Feb 25, 2026) — Comprehensive audit of all API routes confirmed 5-layer defense-in-depth architecture is operational:
  - **Layer 1 — Edge middleware** (`proxy.ts`): JWT validation for ALL `/api/` routes via `enforceEdgeAuth()`. Public routes explicitly allowlisted in `route-config.ts`
  - **Layer 2 — Admin edge auth** (`lib/middleware/admin-auth.ts`): LP blocking + admin-specific JWT checks for `/admin/*` and `/api/admin/*`
  - **Layer 3 — Handler-level RBAC**: `requireAdminAppRouter()` on 43 admin handlers, `authenticateGP()` on 20+ marketplace/team routes, `enforceRBAC()`/`enforceRBACAppRouter()` on team-scoped routes, `enforceCrmRole()` on CRM routes
  - **Layer 4 — Domain middleware** (`lib/middleware/domain.ts`): Domain-level gating for `app.admin.fundroom.ai`
  - **Layer 5 — Business logic auth**: Team-scoped Prisma queries with `teamId` filtering, fund ownership verification
  - **Admin routes (40 files, 43 handlers)**: 100% coverage via `requireAdminAppRouter()`
  - **Team-scoped routes (51 routes)**: 94% use `authenticateGP()` or `enforceRBAC()`; remaining 3 use functionally correct inline auth
  - **E-signature routes (9 routes)**: All protected — 7 via `requireAuthAppRouter()`/`getServerSession()`, 1 via token-based signer auth, 1 via `authenticateSigner()`
  - **CRM/Contact routes (8 routes)**: All protected via `enforceCrmRole()` with VIEWER/CONTRIBUTOR/MANAGER hierarchy
  - **Outreach routes (10 routes)**: 8 authenticated via CRM roles, 2 intentionally public (email tracking pixel, unsubscribe link)
  - **Setup wizard routes (4 routes)**: All protected via `requireAuthAppRouter()`
  - **File upload routes (11 routes)**: All protected via `getServerSession()` + rate limiting + team membership
  - **Blanket rate limiting**: 200 req/min/IP on ALL `/api/` routes via Upstash Redis in proxy.ts middleware

### Changed
- **Deep Code Quality Audit & Test Expansion** (Feb 24, 2026) — Comprehensive codebase quality verification and test coverage expansion:
  - **Error handling audit**: Verified 100% catch-block coverage — all API routes use `reportError()` directly or via `errorhandler()` which calls `reportError()` internally
  - **Console.error cleanup**: Replaced `console.error` with `reportError` in 80 API route files across 3 commits
  - **Test expansion**: Added comprehensive tests for setup wizard routes (3 routes), e-signature envelope system (9 routes), and LP API routes (9 routes)
  - **Library tests**: Added 169 tests for 4 critical untested libraries (RBAC, error handler, merge fields, engagement scoring)
  - **Quality verification**: Zero silent catch blocks, zero H-06 violations, zero console.log in APIs, all 240 App Router routes have `force-dynamic`
  - **README.md metrics**: Updated test counts to match actual (195 suites, 5,582 tests)
- **Deep Code Review Sprint** (Feb 24, 2026) — Comprehensive multi-session code review covering 13 workstreams:
  - **Auth hardening**: Added auth checks to 6 unprotected LP API routes (fund-context, fund-details, wire-instructions, signing-documents, subscription-status, bank/status)
  - **Dead code removal**: Deleted 3 deprecated files (`.deprecated.ts` suffixed files)
  - **Console.log cleanup**: Removed 39 debug console.log statements from production API routes
  - **TS suppression fixes**: Regenerated Prisma client, fixed 5 `@ts-ignore` suppressions with proper type casts
  - **Zod validation**: Added input validation schemas to 10 critical routes (wire/confirm, documents/upload, signatures/capture, approve-with-changes, request-changes, lp/register, lp/subscribe, staged-commitment, admin-login, setup-admin)
  - **Multi-tenant isolation audit**: Verified org_id scoping across all critical routes
  - **`any` type reduction**: Replaced `any` types in 3 critical files (tranches.ts, advance-on-doc-approval.ts, utils.ts) with proper Prisma types
  - **Large file splitting**: Split 1000+ line components into sub-components
  - **TypeScript errors**: Fixed 10 errors (6 in subscriptions/create.ts from Zod transform, 4 pre-existing in annotate-document.ts, selection-tree.tsx, sidebar-folders.tsx, links-table.tsx)
  - **Test fixes**: Fixed 22 failing tests across 4 suites (crm-billing mock gaps, wire-confirm Zod assertions, production-smoke/verification health endpoint mocks)
  - **Zero TypeScript errors** confirmed via `npx tsc --noEmit`
  - **192 test suites / 5,444 tests** all passing

### Added
- **Admin Auth Edge Middleware** (`lib/middleware/admin-auth.ts`) — Edge-compatible JWT session validation for `/admin/*` and `/api/admin/*` routes. Defense-in-depth layer with LP blocking, unauthenticated redirect, user context headers. 30+ tests
- **Edge Auth Expansion to ALL API Routes** (`lib/middleware/edge-auth.ts`, `lib/middleware/route-config.ts`, `lib/middleware/cron-auth.ts`) — Expanded edge-level authentication from admin-only to ALL API routes. Centralized route classification (PUBLIC/CRON/AUTHENTICATED/TEAM_SCOPED/ADMIN), JWT validation for all non-public routes, cron secret verification, user context header injection (`x-middleware-user-id/email/role`). `getMiddlewareUser()` helper for downstream route handlers
- **Secrets Audit Report** (`docs/SECRETS_AUDIT.md`) — Comprehensive secrets scan: 10 pattern checks (Stripe keys, Resend keys, webhook secrets, bearer tokens, hardcoded passwords, private keys, JWT tokens, API keys, committed .env files, encryption keys). Result: PASS — no exposed secrets. Encryption architecture table documenting all 7 encryption purposes and env vars
- **Encryption Audit Report** (`docs/ENCRYPTION_AUDIT.md`) — Full audit of all 9 encryption implementations: AES-256-GCM for tax IDs/wire instructions/Plaid tokens/MFA/signatures, SHA-256 checksums, HMAC verification. Verification checklist for 14 sensitive data types. Documents required env vars for production encryption
- **Proprietary LICENSE file** — FundRoom AI, Inc. proprietary software license. All rights reserved. Contact: legal@fundroom.ai
- **Document Template HTML Merge Field System** — 23-field merge engine (`lib/documents/merge-fields.ts`), template renderer, entity auto-fill for 8 entity types, default NDA/Subscription Agreement HTML templates, DocumentTemplate Prisma model + migration + seed data. 28 tests
- **Funding Round / Tranche Configuration** — FundingRound Prisma model with PLANNED/ACTIVE/COMPLETED lifecycle, CRUD APIs, FundingRoundsConfig management UI, StartupRoundsChart visualization, FundingStructurePreview inline chart, setup wizard integration for both STARTUP (rounds) and GP_FUND (pricing tiers) modes. 66 tests across 4 test files
- **Documentation Consolidation** — Archived 28 session summaries to `docs/archive/sessions/`, cleaned CLAUDE.md reference section (removed 14 stale file references), updated CONTRIBUTING.md/SECURITY.md/CHANGELOG.md

### Changed
- **LP signing consolidated to FundRoomSign** — Replaced SequentialSigningFlow with FundRoomSignFlow wrapper (`components/esign/FundRoomSignFlow.tsx`) in LP onboarding. Pre-fetches sign data for all unsigned docs in parallel via `Promise.allSettled`. Public signing page kept separate (single-doc, decline support, external signer branding)
- **proxy.ts refactored** — API section now uses `enforceEdgeAuth()` from centralized edge-auth module instead of inline admin-only checks. Route classification delegated to `classifyRoute()`. Cron routes verified via `verifyCronAuth()`. All authenticated routes receive user context headers
- `.env.example` updated with ~20 new env vars across 10+ categories (CRON_SECRET, GP_SEED_PASSWORD, LP_SEED_PASSWORD, ADMIN_SEED_PASSWORD, SVIX_SECRET, MFA_ENCRYPTION_KEY, etc.)
- Demo credentials removed from CLAUDE.md — now reference env vars only (GP_SEED_PASSWORD, LP_SEED_PASSWORD, ADMIN_TEMP_PASSWORD)
- `package.json` — set `"license": "PROPRIETARY"` field
- CLAUDE.md REFERENCE DOCUMENTS section condensed from ~65 lines to ~20 lines
- CLAUDE.md MANDATORY DOCUMENTATION UPDATE PROCEDURE: removed stale file references
- CONTRIBUTING.md: updated test counts, fixed stale doc reference
- SECURITY.md: updated test counts
- README.md: full enterprise SaaS rewrite (completed prior session)

### Fixed
- **Wire instruction encryption gap** (P0 security fix) — `lib/wire-transfer/instructions.ts` stored account/routing numbers as plaintext while setup wizard encrypted them. Added `encryptTaxId()` on write and `decryptTaxId()` on read for consistent AES-256-GCM encryption across all code paths
- **Pre-existing TypeScript error** in `app/api/admin/investors/bulk-import/route.ts` — removed invalid `investorCount` field from FundAggregate upsert (field doesn't exist on model)
- **Outreach public routes misclassified** (P0 security fix) — `/api/outreach/unsubscribe` and `/api/outreach/track/` were classified as TEAM_SCOPED (inherited from `/api/outreach/` parent path) causing edge auth to block email tracking pixels and unsubscribe links with 401. Fixed by adding specific sub-paths to PUBLIC_PATHS which is evaluated first in `classifyRoute()`
- **Job routes misclassified in CRON_PATHS** — `/api/jobs/` was in CRON_PATHS which requires `CRON_SECRET`, but job handlers use `INTERNAL_API_KEY` (a different secret). Edge middleware would reject legitimate job requests. Fixed by moving to PUBLIC_PATHS (handler-level INTERNAL_API_KEY auth provides security). `/api/internal/` similarly moved for consistency
- **Comprehensive API route auth audit** — Audited all 205+ App Router routes and 293 Pages Router routes. Confirmed zero critical auth gaps — all "unprotected" routes are intentionally public (webhooks with signature verification, tracking pixels, health checks) or use handler-level auth (INTERNAL_API_KEY, validateApiToken, viewId-based)

### Security
- Edge auth expansion: ALL API routes now validated at edge level (was admin-only). Public routes explicitly allowlisted, cron routes verified via `CRON_SECRET`, authenticated routes require valid JWT
- Wire instruction encryption: account numbers and routing numbers now encrypted at rest with AES-256-GCM via `encryptTaxId()`/`decryptTaxId()`
- Demo credentials removed from all documentation — env var references only
- Secrets audit confirms zero exposed secrets in source code
- Admin auth edge middleware provides 4th defense-in-depth layer (edge JWT → app middleware → domain middleware → route handlers)

## [0.9.14] - 2026-02-20

**Launch Sprint — Testing Infrastructure, Performance Optimization & Visual Regression (Prompts 10-14)**

### Added
- **Critical Path Integration Tests** (`__tests__/integration/critical-path-integration.test.ts`) — Comprehensive E2E integration test suite covering LP registration, NDA signing, commitment with SEC representations, wire proof upload, GP wire confirmation, GP document review, approval queue, Form D export, and data consistency verification
- **Unit Test Suite: Fund Calculations** (`__tests__/lib/funds/fund-calculations.test.ts`, 29 tests) — AUM calculation, fee computation, snapshot persistence, scheduled calculations, capital call threshold checking/enforcement, threshold notification marking
- **Unit Test Suite: Wire Transfer Processing** (`__tests__/lib/wire-transfer/wire-processing.test.ts`, 11 tests) — Wire proof upload/review, pending proof listing, proof requirement setting, wire instructions CRUD, account number masking
- **Unit Test Suite: RBAC Enforcement** (`__tests__/lib/auth/rbac-enforcement.test.ts`, 18 tests) — Cross-team access denial, unauthenticated access, role hierarchy (OWNER through MEMBER), team ID extraction from query/body, hasRole utility, requireTeamMember, requireGPAccess
- **Unit Test Suite: Encryption Roundtrip** (`__tests__/lib/crypto/encryption-roundtrip.test.ts`, 38 tests) — AES-256-GCM encrypt/decrypt, tax ID encryption idempotency, SSN/EIN masking/validation, document integrity checksums, secure token generation
- **Visual Regression: Critical Flows** (`e2e/visual-critical-flows.spec.ts`, 22 tests) — CRM page (3 viewports), outreach center, fund detail/list, GP wire, GP documents (3 viewports), LP wire instructions (3 viewports), LP docs vault tablet, LP transactions tablet, e-signature error states
- **Visual Regression: Tablet Viewport** — Added iPad Mini tablet project (768×1024) to Playwright config for tablet-specific visual regression testing
- **Memory Cache Utility** (`lib/cache/memory-cache.ts`) — Reusable in-memory cache with TTL support for database query optimization

### Changed
- **Bundle Optimization** — Dynamic imports (`next/dynamic`) for heavy admin components (approvals, audit, CRM, documents), reducing initial JS bundle for faster page loads
- **Database Query Optimization** — Added select clauses to limit fetched columns in fund-dashboard and capital-tracking APIs, pagination guards, memory caching for repeated queries
- **Prisma Connection Hardening** — Enhanced connection pool settings with `connection_limit` parameter in database URL
- **Server Event Tracking** — Added `fund_dashboard_loaded` event to Tinybird analytics

### Fixed
- **36 integration test failures** in critical-path suite — Fixed mock setup for dual auth patterns (`next-auth` + `next-auth/next`), Prisma `$transaction` callback mocks, fire-and-forget promise resolution, and multi-model mock chains
- **Wire transfer test alignment** — Corrected field names (`proofStatus` not `transferStatus`, `proofDocumentKey` not `proofStorageKey`), default pageSize (25 not 20), wire instructions stored as objects not JSON strings
- **Crypto test alignment** — `decryptTaxId` returns original string for non-encrypted input, `createDocumentIntegrityRecord` uses `aes-256-gcm` algorithm, `verifyDocumentChecksum` throws `RangeError` on length mismatch
- **LP bank status test** — Updated mock to include `fundId` field on investor for status lookup
- **Admin fund dashboard** — Fixed TypeScript import for `reportError`, added proper error handling

## [0.9.13] - 2026-02-18

**Production Polish Sprint — 18-prompt build (P1-1 through P3-6)**

### Added
- **Production Smoke Test Suite** (`__tests__/deployment/production-smoke.test.ts`) — 20 tests across 8 critical domains: health, LP registration, commitment/wire, GP wire confirmation, SEC Form D export, auth guards, dashboard stats, H-06 response format
- **Deployment Readiness Endpoint** (`pages/api/admin/deployment-readiness.ts`) — Pre-flight checklist with 27 verification tests
- **E2E Email Notification Tests** — Integration tests verifying all email send functions fire correctly from their trigger endpoints
- **Document Template Merge Field Engine** (`lib/documents/merge-field-engine.ts`) — Entity-aware auto-fill for document templates
- **Reports & Analytics** — Wire reconciliation, document metrics, SLA tracking with CSV export
- **Audit Log Dashboard** — Polished viewer with 36 API tests

### Changed
- **GP Dashboard** — Skeleton loading states, empty state illustrations, mode-aware sidebar (GP_FUND/STARTUP/DATAROOM_ONLY), real-time data refresh
- **LP Dashboard** — Investment status banner, skeleton loading, mobile touch targets (44px), fund card progress bars
- **Settings Center** — 6 tab groups, global search/filter, unsaved changes tracking with discard prompt
- **Investor Detail Page** — Summary cards, compliance tab, entity details, investment timeline
- **Responsive Design** — Fixed mobile breakpoints across admin dashboard, investor list, fund detail, settings
- **Accessibility** — WCAG 2.1 AA improvements: ARIA labels, keyboard navigation, focus management, color contrast
- **Performance** — Dynamic imports for heavy components, query limits, AbortController for unmount cleanup
- **Wire Transfer** — Race condition prevention via `$transaction`, input validation tightening
- **Seed Data** — Expanded demo walkthrough data with investors at multiple stages, sample transactions, documents

### Fixed
- Email notification send functions wired to actual API triggers (were dead/disconnected)
- Orphaned email templates deleted
- SEC accreditation expiry enforcement in subscribe endpoint
- Form D export field validation
- Error handling standardization — all 500 responses return generic "Internal server error"
- Admin-login test assertion aligned with error sanitization

### Security
- Error handling final pass ensuring no error message leakage in 500 responses
- SEC compliance verification across LP and admin endpoints

## [0.9.12] - 2026-02-17

**V2 Wizard Completion, Signup Flow Unification, Settings Consolidation, LP Mobile Nav, LP Portal UX Polish**

### Added
- **LP Mobile Bottom Tab Bar** (`components/lp/bottom-tab-bar.tsx`) — Fixed bottom nav for mobile (<768px) with 4 tabs: Home, Docs, Payments, Account. Touch targets 44px, amber badge dots for pending items, iOS safe area support, dark theme matching LP portal
- **LP Layout wrapper** (`app/lp/layout.tsx`) — Shared layout for all LP pages with gradient background, LPHeader (desktop), LPBottomTabBar (mobile), and bottom padding clearance (pb-20 md:pb-0)
- **Viewport meta with safe area** — Added `viewport-fit: cover` to root layout for iOS notch/safe area padding via `env(safe-area-inset-bottom)`
- **Advanced Settings section** in admin settings center — "Advanced Settings" collapsible card with 12 quick links to legacy settings sub-pages (Dataroom Settings, Team Members, API Tokens, Webhooks, Custom Domains, Agreements, Signature Templates, Signature Audit Log, Link Presets, Tags, Data Export/Import, Incoming Webhooks)
- **QuickLink component** in admin settings — Reusable link row with label, description, and ChevronRight icon

### Changed
- **GP Setup Wizard upgraded to V2 content** — Replaced 3 V1 step files with V2 versions: Step5FundDetails (612→1,072 lines, adds advanced fund settings + SPV + Priced Round governance), Step6LPOnboarding (312→545 lines, adds document template management + drag-drop + notification toggles), Step8Launch (305→651 lines, adds comprehensive review with validation gate + 8-9 summary cards + progress checklist)
- **GP Setup Wizard expanded to 9 steps** — Added Step4TeamInvites (email + role invite management, 136 lines) as step 4. TOTAL_STEPS changed from 8 to 9. Renumbered all switch cases, validation, and DATAROOM_ONLY skip logic (now skips steps 5,6 instead of 4,5)
- **WizardProgress updated to 9 steps** — Added "Team" step with UserPlus icon. DATAROOM_ONLY skip indicators updated to steps 5,6. Min-width increased to 700px for 9 items
- **Signup flow unified to V2 wizard** — `/welcome?type=org-setup` now redirects to `/admin/setup` (was `/org-setup`). New users go through V2 wizard (9 steps, auto-save, modular) instead of V1 monolith
- **V1 org-setup replaced with redirect stub** — `app/(saas)/org-setup/page-client.tsx` reduced from 2,229 lines to 17-line redirect to `/admin/setup`
- **Onboarding-complete fallback redirect** — Changed from `/documents` to `/admin/dashboard`
- **Settings top-level redirect** — `/settings` now redirects to `/admin/settings` (was `/settings/general`) in next.config.mjs
- **LPHeader rewritten as self-contained component** — `components/lp/lp-header.tsx` now uses `useSession`, `usePathname`, `useRouter` internally. 4-tab branded nav (Home, Documents, Transactions, Account). Fetches branding from `/api/lp/fund-context`. Desktop only (`hidden md:flex`), content `max-w-[800px]`
- **LP Layout provides shared gradient + navigation** — All LP child pages inherit gradient background, LPHeader, and LPBottomTabBar from `app/lp/layout.tsx` instead of duplicating them
- **All LP pages standardized to `max-w-[800px]`** — Dashboard (was 7xl), Transactions (was 5xl), Docs (was 4xl), Wire (was 2xl) — consistent narrow content column
- **LP Dashboard progress tracker** — Updated from 4 stages to 5 stages: Applied → NDA Signed → Accredited → Committed → Funded. Uses `completedSet` pattern mapping from investor/investment model data

### Removed
- **5 orphaned V2 duplicate files** — Step5Dataroom.tsx (identical md5 to Step4Dataroom), Step8Integrations.tsx (identical md5 to Step7Integrations), Step6FundDetails.tsx (renamed to Step5FundDetails), Step7LPOnboarding.tsx (renamed to Step6LPOnboarding), Step9Launch.tsx (renamed to Step8Launch)
- **7 orphaned V1 components** — `components/setup/raise-style-step.tsx`, `components/setup/onboarding-settings-step.tsx`, `components/setup/fund-details-step.tsx`, `components/raise/startup-raise-wizard.tsx`, `components/raise/instrument-type-selector.tsx`, `components/raise/startup-raise-terms.tsx`, `components/raise/startup-raise-documents.tsx`
- **2 empty directories** — `components/setup/`, `components/raise/`
- **Duplicate gradient wrappers and inline nav** removed from individual LP pages (dashboard, transactions, docs, wire) — now provided by shared layout

### Fixed
- GP Setup Wizard was importing V1 step files (smaller, fewer features) while V2 files with advanced settings sat orphaned — now uses V2 content throughout
- Step4TeamInvites.tsx existed but was not wired into the wizard — now properly integrated as step 4
- LP navigation links (Documents, Sign) were hidden on mobile (hidden md:flex) — bottom tab bar provides mobile navigation
- New user signup flow reached V1 org-setup monolith instead of V2 modular wizard — now correctly routes to V2
- LP pages had inconsistent max-widths (2xl/4xl/5xl/7xl) — standardized to `max-w-[800px]` matching LPHeader width
- LP Dashboard progress tracker showed 4 wire-centric stages — updated to 5 onboarding-centric stages matching actual LP journey

## [0.9.11] - 2026-02-16

**GP Setup Wizard V1→V2 Final Cleanup — File renames, orphan deletion, review enhancements**

### Added
- Integrations summary card in Step9Launch review (5 active integrations: SignSuite, Secure Storage, Audit Logging, Email, Wire Transfer)
- Expanded startup instrument details in Step9Launch review: SAFE (val cap, discount, type), Convertible Note (interest, maturity), Priced Round (pre-money, liq pref, option pool), SPV (target, carry, mgmt fee)
- Marketplace opt-in badge in Fund Terms review card

### Changed
- Step files renamed to match actual step numbers: `Step4Dataroom→Step5Dataroom`, `Step5FundDetails→Step6FundDetails`, `Step6LPOnboarding→Step7LPOnboarding`, `Step7Integrations→Step8Integrations`, `Step8Launch→Step9Launch`
- Updated all imports in `page.tsx` to match renamed files
- GP Setup Wizard now 9 steps (canonical): Company Info → Branding → Raise Style → Team Invites → Dataroom → Fund Details → LP Onboarding → Integrations → Launch

### Removed
- 7 orphaned V1 components with zero imports: `components/setup/raise-style-step.tsx`, `components/setup/onboarding-settings-step.tsx`, `components/setup/fund-details-step.tsx`, `components/raise/startup-raise-wizard.tsx`, `components/raise/instrument-type-selector.tsx`, `components/raise/startup-raise-terms.tsx`, `components/raise/startup-raise-documents.tsx`
- Empty directories: `components/setup/`, `components/raise/`

## [0.9.10] - 2026-02-15

**Gap Analysis Verification — Schema Fixes, Advanced Fund Settings, Full Codebase Audit**

### Added
- `Organization.relatedPersons` (Json) — Form D Section 3 related persons data (executive officers, directors, promoters)
- `Investor.accreditationDocumentIds` (String[]) — 506(c) third-party verification document references
- Advanced Fund Settings in V2 GP Wizard (`Step5FundDetails.tsx`): GP Commitment, Investment Period, Recycling Provisions, Key Person Clause, No-Fault Divorce Threshold, Preferred Return Method, Clawback Provision, Management Fee Offset — collapsed section
- WizardData type extended with 9 new advanced fund fields + defaults
- `setup/complete` API persistence for all advanced fund settings (gpCommitmentAmount, gpCommitmentPct, investmentPeriodYears, recyclingEnabled, keyPersonEnabled, keyPersonName, noFaultDivorceThreshold, preferredReturnMethod, clawbackProvision, mgmtFeeOffsetPct)
- Migration `20260215_add_schema_gap_fields` for new schema fields

### Fixed
- Form D export API (`form-d.ts`) — removed `phone` from User select query (field doesn't exist on User model; phone is on Organization)
- Form D export now uses `Organization.relatedPersons` when populated, with fallback to team admins
- `regulationDExemption` comment in schema updated to include all 4 exemption types

### Changed
- Schema lines: 4,235 → 4,276
- Test count: 5,095 → 5,191 (136 suites)
- Platform completion: ~98% → ~99% (all P0-P2 items verified complete or Phase 2/3)

## [0.9.9] - 2026-02-15

**Gap Analysis Completion Sprint + RBAC Migration + Form D Export + GP Notifications**

### Added
- SEC Form D data export endpoint (`GET /api/admin/reports/form-d`) — JSON and CSV output mapping to SEC Form D sections (OMB 3235-0076), investor counts by accreditation method, filing deadlines, fund economics
- GP commitment notification email — Tier 2 org-branded email to GP admins when LP commits (`gp-new-commitment.tsx`, `send-gp-commitment-notification.ts`)
- GP wire proof upload notification email — Tier 2 org-branded email to GP admins when LP uploads wire proof (`gp-wire-proof-uploaded.tsx`, `send-gp-wire-proof-notification.ts`)
- Fire-and-forget GP notification wiring in `subscribe.ts` and `wire-proof.ts`

### Changed
- Migrated 9 critical admin routes to centralized `enforceRBAC()`/`requireAdmin()` middleware (engagement, reports, reports/export, activate-fundroom, settings/update, form-d-reminders, documents/confirm, documents/reject, documents/request-reupload, pending-review)
- RBAC follow-up item severity downgraded from Medium to Low (remaining routes use functionally equivalent inline auth)
- Platform completion estimate updated to ~98%

---

## [0.9.8] - 2026-02-15

**GP Onboarding Wizard V2 + Security Hardening** (~14 hours, 25 new files, 5,515 lines)

### Added
- GP Setup Wizard V2 at `/admin/setup` — 8 modular steps with auto-save (3s debounce)
  - Step 1: Company Info (entity type, EIN with Bad Actor 506(d) cert)
  - Step 2: Branding (logo, colors, custom domain, live preview)
  - Step 3: Raise Style (GP Fund / Startup / Dataroom Only + Reg D)
  - Step 4: Dataroom (name, policies, shareable link)
  - Step 5: Fund Details (GP economics or startup instrument terms + wire instructions)
  - Step 6: LP Onboarding (step config, drag-reorder, doc templates, notifications)
  - Step 7: Integrations (active services, compliance settings)
  - Step 8: Launch (review summary, progress checklist, activation)
- 4 LP API routes (App Router): sign-nda, investor-details, commitment, upload-signed-doc
- GP Investor Review page (999 lines) with approve/reject/revision actions
- LP onboard dynamic route (`/lp/onboard/[fundId]`)
- Dedicated document reject endpoint (`/api/documents/{docId}/reject`)
- Session cookie centralization (`lib/constants/auth-cookies.ts`)
- Prisma migration: 27 new fields (Organization, Fund, OrganizationDefaults)

### Changed
- Wire proof status: `PENDING` changed to `PROOF_UPLOADED` for clearer LP-to-GP handoff
- All GP dashboard queries updated to include `PROOF_UPLOADED` in status filters
- Fund transactions API now supports multiple status values via `getAll("status")`
- SEC exemption expansion: added Regulation A+ and Rule 504 to selectors
- OnboardingSettingsStep: Preview button now functional, file upload notes updated
- Dark mode fixes: DocumentTemplateManager, ExternalDocUpload, GPDocReview, GPDocUpload
- ExternalDocUpload: document type includes "SAFE / SPA" label for startup raises

### Fixed
- Verify-link race condition: wrapped user upsert + token consumption in `$transaction()`
- Engagement API multi-tenant bypass: investors with no fund now require direct team linkage
- Silent error swallowing: 11 `.catch(() => {})` replaced with `reportError()` across document and wire endpoints
- FundingStep wire instructions: added `fundId` query param for multi-fund scoping + AbortController cleanup

### Security
- Session cookie name centralized (eliminates 6 duplicate computations)
- Verify-link atomicity fix prevents concurrent token reuse
- Engagement scoring API enforces team access for all investor lookups

---

## [0.9.7] - 2026-02-14

**Investor Entity Architecture + Wire Transfer MVP + Manual Entry Rewrite** (6+ hours, 13 commits, 18 new files)

### Added
- Investor Entity Architecture: 7 entity types (Individual, Joint, Trust/Estate, LLC/Corporation, Partnership, IRA/Retirement, Charity/Foundation) with dynamic forms, Zod validation, SEC-compliant accreditation criteria per type
- Wire Transfer Payment MVP: FundingStep component (22KB) with wire instructions display, proof upload, copy-to-clipboard, pay-later option
- Manual Document Upload + GP Confirmation: ExternalDocUpload, GPDocReview, GPDocUpload components + 4 API routes
- GP/LP SEC Compliance: 506(c) enhanced accreditation (source of funds, occupation), 8 investor representations with timestamps
- Manual Investor Entry Wizard rewrite: 5-step wizard with lead matching, payment persistence, document upload, FundAggregate sync
- FundTypeSelector: card-based visual fund type selection + PATCH fund endpoint
- Regulation D Exemption Selector: 506(b), 506(c), Reg A+, Rule 504
- Document Template Manager: admin integration with preview, upload, and fund-mode awareness
- Deep repository analysis document (`docs/DEEP_REPO_ANALYSIS_FEB14_2026.md`)
- Prisma migration: investor entity fields, SEC compliance fields, GP document types
- 6 composite indexes for common query patterns

### Fixed
- Role type error in fund route (Prisma `Role[]` type mismatch)
- EntityFormState type error in LP onboarding
- npm audit: 0 vulnerabilities (fixed markdown-it ReDoS, qs arrayLimit bypass)
- INITIALS PDF flattening: now uses `field.value` instead of `recipient.signatureImage`
- Next.js 16 middleware conflict: deleted `middleware.ts` (proxy.ts is the entry point)
- 3 missing component files synced from GitHub

### Changed
- Dev dependencies moved to `devDependencies` (reduces production bundle)
- Org-setup API error responses standardized to `{ error: }` format
- Empty file cleanup: removed `app/api/conversations/api/conversations-route.ts`

---

## [0.9.6] - 2026-02-13

**FundRoomSign E-Signature + GP Approval Queue + Startup Raise Wizard** (3 sessions)

### Added
- FundRoomSign consolidated e-signature component (1,266 lines): split-screen signing with PDF viewer + auto-filled fields + signature capture (Draw/Type/Upload)
- GP Approval Queue dashboard (1,039 lines): tabs (All/Pending/Approved/Rejected/Changes Requested), 4 approval actions with modals, side-by-side change comparison
- Startup Raise Wizard: 4-step instrument selector (SAFE, Convertible Note, Priced Equity, SPV) with dynamic term forms
- Raise Style Selection: 3-card selector in Org Setup Wizard Step 3 with skip logic for Dataroom Only mode
- LP Onboarding Settings step: 5 collapsible sections (steps config, doc templates, wire, notifications, compliance)
- Document Template Manager with 13 document types, merge fields, custom upload
- One-time login token system for LP registration gap fix
- Subscribe API auto-heal for NDA/accreditation false rejections

### Fixed
- LP Registration auth gap: one-time token replaces unreliable credentials flow
- Subscribe API: defensive auto-heal checks OnboardingFlow before rejecting
- Dataroom → Invest → LP parameter chain: fund-team validation, multi-fund disambiguation
- Production DB schema sync: 8 missing tables, 36+ missing columns aligned
- signedFileUrl column added to SignatureDocument (was only in metadata JSON)
- GP pending actions: inline resolution with quick-wire-confirm modal
- LP document upload E2E: ProofUploadCard uses presigned URL flow

### Changed
- Org Setup Wizard reduced from 9 to 8 steps (Wire + Compliance consolidated into LP Onboarding)
- ee/features error standardization: 41 responses across 15 files (H-06 third pass, ~333 files total)
- Prisma schema: +11 OrganizationDefaults columns, signedFileUrl/signedFileType/signedAt on SignatureDocument

---

## [0.9.5] - 2026-02-12

**Mobile LP Audit + Paywall Logic + Settings Center** (full day session)

### Added
- Paywall logic: free dataroom vs paid FundRoom with `FundroomActivation` model
- Org Setup Wizard V11: entity type, EIN (masked), business address, company profile, fund economics
- Settings Center: 7 collapsible sections with per-section save, dirty tracking, inheritance tier badges
- DOCS_APPROVED investor stage (7th stage between COMMITTED and FUNDED)
- Pending Actions API + inline action card on GP fund overview
- Mobile LP Onboarding audit: touch targets >= 44px, iOS zoom prevention, camera capture, responsive signature pad

### Fixed
- 3 test assertion fixes (error sanitization alignment + PR #90 pricing tier logic)
- 59 TypeScript errors from PR #90 merge (Prisma client regeneration)
- LinkedIn OAuth conditional rendering (buttons only shown when credentials configured)
- Auth error messages standardized across all login pages

### Changed
- Error response standardization second pass: 175 missed responses across 63 files
- Rollbar test noise fix for code audit marathon merge (65 files)

---

## [0.9.4] - 2026-02-11

**Gap Analysis Sprint + Document Signing Pipeline** (3 sessions)

### Added
- Password Strength Indicator with 5-rule checker
- User Registration API (bcrypt, Zod, rate-limited, audit logged)
- Engagement Scoring System (Hot/Warm/Cool tiers, weighted scoring)
- "I Want to Invest" button with 4-state machine
- GP Approval Gates API (approve, approve-with-changes, request-changes, reject)
- Reports & Analytics page with CSV export
- Manual Investor Entry Wizard (5 steps) + Bulk Import (CSV, up to 500 rows)
- RBAC middleware (`lib/auth/rbac.ts`)
- Express Interest API with rate-limited lead capture
- MarketplaceWaitlist and MarketplaceEvent models
- Org Setup Wizard complete (8 steps, mode selector)
- Dataroom `?ref=` referral tracking (end-to-end)
- Settings Inheritance API + visual UI
- SignatureDocument fund association (`fundId`, `requiredForOnboarding`)
- Auto-advance on signing completion (COMMITTED → DOCS_APPROVED)
- Fund Signature Documents API and GP Fund Documents tab

### Changed
- Platform completion: ~70-75% → ~90-95%

---

## [0.9.3] - 2026-02-10

**Security Hardening + E-Signature Pipeline + Custom Branding**

### Added
- PDF Signature Viewer with 10 field types
- Flatten-signature-onto-PDF pipeline (pdf-lib, Certificate of Completion)
- Sequential Signing Flow (NDA → Sub Ag → LPA → Side Letter priority)
- LP Onboarding auto-save/resume (OnboardingFlow model, 3s debounce)
- LP Onboarding document signing step (Step 6)
- GP Wire Confirmation workflow (atomic Transaction + Investment update)
- Wire Confirmed email (Tier 2, org-branded)
- Multi-tenant email domain system (Resend Domains API)
- Email domain setup wizard (4-step)

### Fixed
- 48 API routes: error leakage fixed (generic 500 responses)
- 165 API routes: `reportError()` added to all catch blocks
- 16 final endpoint sanitization (100% complete)
- requireAdminAccess() role check (was allowing any team member)
- AuditLog cascade → Restrict (protects SEC compliance records)
- authenticateGP() now includes SUPER_ADMIN
- isAdminEmail() replaced with DB-backed isUserAdminAsync()
- Dynamic CORS middleware (replaced broken static CORS)

### Security
- Rate limiting on auth endpoints (10/hr auth, 3/hr password setup)
- HSTS header added (63072000 max-age, includeSubDomains, preload)
- Vercel memory settings removed (deprecated on Active CPU billing)
- Node.js pinned to 22.x (prevents auto-upgrade to 24.x)

---

## [0.9.2] - 2026-02-09

**Domain Architecture + Integration Audit + Fund-Aware LP Onboarding**

### Added
- Domain routing: 4 platform subdomains with host-based middleware
- 20-service integration test (all passing)
- Fund-aware LP onboarding (scoped to specific fund from invite)
- Investor invite system (GP → LP via email)
- Admin password login (NextAuth CredentialsProvider, bcrypt)
- 158-endpoint API smoke tests
- Tranche data persistence (InvestmentTranche + FundClose models)
- Platform-wide API audit (12 endpoints, RBAC standardization)
- LP auth cookie fix (4 endpoints migrated from orphan cookies to getServerSession)

### Fixed
- BFG reference removal (platform is now fully env-driven)
- Vercel production environment: 15+ missing env vars configured
- Google OAuth restored (was missing credentials on Vercel)
- 48 files: error leakage in 500 responses
- Notion proxy + progress-token: authentication added
- Deep code review fixes (input bounds, Prisma schema hardening, org scoping)

### Changed
- Naming migration: BFFund → FundRoom (codebase-wide)
- 6 encryption salts updated for FundRoom branding

---

## [0.9.1] - 2026-02-08

**Foundation + Core MVP**

### Added
- Prisma schema: 117 models, 40 enums, ~4,274 lines
- NextAuth authentication (email/password, Google OAuth, magic links)
- RBAC middleware (OWNER / SUPER_ADMIN / ADMIN / MANAGER / MEMBER)
- Audit logging (39 event types, SHA-256 hash-chained immutable log)
- Settings inheritance (org_defaults → fund_overrides → object_overrides)
- Entity architecture (Individual/LLC/Trust/401k-IRA/Other)
- Bermuda tenant seed (full production-ready: org, team, fund, users)
- GP Setup Flow (signup → verify → org setup wizard → dashboard)
- Dataroom system (CRUD, public viewer, shareable links, analytics)
- SignSuite (native e-signature, HTML5 Canvas, pdf-lib)
- LP Journey (6-step onboarding, dashboard, document vault, wire page)
- Manual Document Upload + GP Confirmation
- GP Management Tools (pipeline, investor profiles, fund wire config)
- Wire Transfer & Proof system
- Email notifications (investor welcome, approved, wire, document review)
- KYC provider system (Persona, Plaid, Parallel Markets, VerifyInvestor)
- Marketplace framework (V2 pipeline, 11-stage deals)
- Monitoring (Rollbar, Tinybird, PostHog, GDPR consent)
- CI/CD (GitHub Actions: test, production, preview, integration)

---

## Version Legend

| Version | Status | Date |
|---------|--------|------|
| 0.9.14 | Current | 2026-02-20 |
| 0.9.13 | Released | 2026-02-18 |
| 0.9.12 | Released | 2026-02-17 |
| 0.9.11 | Released | 2026-02-16 |
| 0.9.10 | Released | 2026-02-15 |
| 0.9.9 | Released | 2026-02-15 |
| 0.9.8 | Released | 2026-02-15 |
| 0.9.7 | Released | 2026-02-14 |
| 0.9.6 | Released | 2026-02-13 |
| 0.9.5 | Released | 2026-02-12 |
| 0.9.4 | Released | 2026-02-11 |
| 0.9.3 | Released | 2026-02-10 |
| 0.9.2 | Released | 2026-02-09 |
| 0.9.1 | Released | 2026-02-08 |
| 1.0.0 | Target | Launch week |
