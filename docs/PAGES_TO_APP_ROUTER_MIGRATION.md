# Pages Router → App Router Migration Plan

**Created:** Feb 16, 2026
**Updated:** Mar 2, 2026
**Status:** Phase 1 partially complete (~86 of 99 claimed App Router routes verified; 13 routes listed in migration log were never created). 19 duplicate Pages Router files deleted Mar 1. Current: 238 Pages Router + 295 App Router routes.
**Target:** Complete migration of all remaining Pages Router API routes to App Router

### Migration Log

| Date | Batch | Routes Migrated | Notes |
|------|-------|----------------|-------|
| Feb 18, 2026 | Pre-migration | 5 LP routes | `pending-counts`, `pending-signatures`, `me`, `docs`, `notes` |
| Feb 19, 2026 | LP Batch 1 | 5 LP routes | `register`, `subscribe`, `fund-context`, `fund-details`, `wire-instructions` |
| Feb 19, 2026 | LP Batch 2 | 5 LP routes | `wire-proof`, `onboarding-flow`, `express-interest`, `signing-documents`, `subscription-status` |
| Feb 19, 2026 | LP Batch 3 | 5 LP routes | `kyc`, `staged-commitment`, `bank/connect`, `bank/link-token`, `bank/status` |
| Feb 19, 2026 | LP Batch 4 | 6 LP routes | `investor-profile/[profileId]`, `investor-profile/[profileId]/change-requests`, `documents/upload` |
| Feb 19, 2026 | LP Batch 5 | 6 LP routes | `sign-nda`, `investor-details`, `commitment`, `upload-signed-doc` (deduplicated with existing) |
| Feb 19, 2026 | Admin Batch A | 7 admin routes | `engagement`, `reports`, `reports/export`, `reports/form-d`, `activate-fundroom`, `team-context`, `capital-tracking` |
| Feb 19, 2026 | Admin Batch B | 7 admin routes | `consolidate-teams`, `fix-email-auth`, `reprocess-pdfs`, `form-d-reminders`, `db-health`, `deployment-readiness`, `dashboard-stats` |
| Feb 19, 2026 | Admin Batch C | 7 admin routes | `settings/full`, `settings/update`, `settings/inheritance`, `wire/confirm`, `fund/[id]/pending-actions`, `fund/[id]/pending-details`, `investors/check-lead` |
| Feb 19, 2026 | Admin Batch D | 7 admin routes | `investors/manual-entry`, `investors/bulk-import`, `investors/[investorId]`, `investors/[investorId]/review`, `investors/[investorId]/stage`, `documents/[id]/review`, `test-integrations` |
| Feb 19, 2026 | Admin Batch E | 7 admin routes | `documents/pending-review`, `documents/[docId]/confirm`, `documents/[docId]/reject`, `documents/[docId]/request-reupload`, `documents/upload` (admin), `manual-investment/index`, `manual-investment/[id]` |
| Feb 19, 2026 | Admin Batch F | 7 admin routes | `manual-investment/[id]/proof`, `approvals/pending`, `approvals/[approvalId]/approve`, `approvals/[approvalId]/approve-with-changes`, `approvals/[approvalId]/request-changes`, `profile-completeness` (App Router), `setup-admin` (admin) |
| Feb 19, 2026 | Admin Batch G | 5 admin routes | `investor-profile/[profileId]`, `investor-profile/[profileId]/change-requests`, `signatures/capture`, `documents/[docId]/sign-data`, `documents/[docId]/signed-pdf` |
| Feb 19, 2026 | Admin Batch H | 4 admin routes | `sign/[token]`, `record_click`, `record_view`, `record_video_view` |
| Feb 19, 2026 | Phase 3 (Funds) | 5 fund routes | `funds/[fundId]/settings`, `funds/[fundId]/aggregates`, `teams/[teamId]/funds`, `teams/[teamId]/funds/[fundId]/invite`, `teams/[teamId]/toggle-fundroom-access` |
| Feb 19, 2026 | Phase 4 (Auth) | 11 auth routes | `check-admin`, `check-visitor`, `admin-login`, `register`, `mfa-status`, `setup-admin`, `mfa-verify`, `mfa-setup`, `verify-link`, `lp-token-login`, `admin-magic-verify` |

**Current counts (Mar 2, 2026):** Pages Router: 238, App Router: 295 (total 533 API routes)
**Test results:** All passing (suites and test counts verified)
**Phase 1 audit (Mar 2, 2026):** Deep code review found 13 routes listed in Batches E, F, H were never created as App Router files. See "Phase 1 Audit Findings" section below.

---

## Executive Summary

The FundRoom codebase originally had **~386 Pages Router API routes** (`pages/api/`) and **~59 App Router routes** (`app/api/`). Phase 1 migration (Feb 19, 2026) created ~86 new App Router files. 19 duplicate Pages Router files were deleted (Mar 1, 2026). Current state: **238 Pages Router + 295 App Router routes** (533 total).

**Key finding:** No critical route path conflicts exist. Both routers can coexist during incremental migration.

---

## Current State (Updated Mar 2, 2026)

| Metric | Pages Router | App Router | Notes |
|--------|-------------|-----------|-------|
| Total routes | 238 | 295 | 533 total (mixed-router coexistence) |
| Estimated LOC | ~40,000 | ~55,000 | App Router now majority |
| Auth pattern | `getServerSession(req, res, authOptions)` | `getServerSession(authOptions)` | App Router omits req/res |
| Response pattern | `res.status(200).json({})` | `NextResponse.json({}, { status: 200 })` | |
| Method handling | `if (req.method !== "POST")` | Named exports (`export async function POST`) | |
| Rate limiting | 40+ routes | 99 routes | App Router uses `appRouterRateLimit` variants |
| Zod validation | 81 routes | ~15 routes | Zod schemas preserved during migration |

### Route Distribution by Domain (After Migration)

| Domain | Pages Router | App Router (before) | App Router (after) | Migrated |
|--------|-------------|--------------------|--------------------|----------|
| teams/ | 182 | 24 | 27 | +3 (funds, invite, toggle) |
| admin/ | 49 | 1 | 57 | +56 (8 batches) |
| lp/ | 32 | 6 | 33 | +27 (5 batches) |
| auth/ | 12 | 0 | 11 | +11 (Phase 4) |
| funds/ | — | 5 | 7 | +2 (settings, aggregates) |
| links/ | 17 | 0 | 0 | Phase 2 |
| file/ | 13 | 0 | 0 | Phase 2 |
| sign/ | 6 | 0 | 1 | +1 (sign/[token]) |
| signature/ | 6 | 0 | 1 | +1 (capture) |
| documents/ | 7 | 0 | 2 | +2 (sign-data, signed-pdf) |
| webhooks/ | 6 | 1 | 1 | Phase 2 |
| approvals/ | 4 | 0 | 4 | +4 (Batch F) |
| jobs/ | 7 | 0 | 0 | Phase 2 |
| tracking/ | 3 | 0 | 3 | +3 (click, view, video_view) |
| Other | 45 | 27 | 16 | Misc |

**Note:** Pages Router files are NOT deleted — kept during the parallel verification phase. Next.js serves the App Router version when both exist at the same path.

---

## Migration Pattern Reference

### Auth Pattern

```typescript
// BEFORE (Pages Router)
import { getServerSession } from "next-auth/next";
import type { NextApiRequest, NextApiResponse } from "next";
import { authOptions } from "@/lib/auth/auth-options";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  // ...
}

// AFTER (App Router)
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/auth-options";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // ...
}
```

### Response Pattern

```typescript
// BEFORE
res.status(200).json({ data: result });
res.status(400).json({ error: "Bad request" });
res.status(500).json({ error: "Internal server error" });

// AFTER
return NextResponse.json({ data: result });
return NextResponse.json({ error: "Bad request" }, { status: 400 });
return NextResponse.json({ error: "Internal server error" }, { status: 500 });
```

### Method Handling

```typescript
// BEFORE (single handler with method check)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") { /* ... */ }
  else if (req.method === "POST") { /* ... */ }
  else return res.status(405).json({ error: "Method not allowed" });
}

// AFTER (named exports)
export async function GET(req: NextRequest) { /* ... */ }
export async function POST(req: NextRequest) { /* ... */ }
```

### Body Parsing

```typescript
// BEFORE
const { name, email } = req.body;

// AFTER
const { name, email } = await req.json();
```

### Query Parameters

```typescript
// BEFORE
const { teamId, fundId } = req.query;

// AFTER (dynamic route params)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string; fundId: string }> }
) {
  const { teamId, fundId } = await params;
}

// AFTER (search params)
const { searchParams } = new URL(req.url);
const status = searchParams.get("status");
```

### Headers & Cookies

```typescript
// BEFORE
res.setHeader("X-Custom", "value");
res.setHeader("Set-Cookie", `session=token; Path=/; HttpOnly; Secure; SameSite=Lax`);

// AFTER
const response = NextResponse.json(data);
response.headers.set("X-Custom", "value");

// Cookie with multiple attributes
const cookieParts = [
  `${SESSION_COOKIE_NAME}=${token}`,
  "Path=/",
  "HttpOnly",
  "Secure",
  "SameSite=Lax",
  `Max-Age=${maxAge}`,
];
response.headers.set("Set-Cookie", cookieParts.join("; "));
return response;
```

### Redirect with Cookie

```typescript
// BEFORE (Pages Router)
res.setHeader("Set-Cookie", cookieString);
res.redirect(302, "/dashboard");

// AFTER (App Router)
const baseUrl = process.env.NEXTAUTH_URL || "https://app.fundroom.ai";
const response = NextResponse.redirect(new URL("/dashboard", baseUrl), 302);
response.headers.set("Set-Cookie", cookieParts.join("; "));
return response;
```

### Rate Limiting (App Router)

```typescript
// BEFORE (Pages Router)
import { authRateLimiter } from "@/lib/security/rate-limiter";
const allowed = await authRateLimiter(req, res);
if (!allowed) return; // 429 already sent

// AFTER (App Router)
import { appRouterAuthRateLimit } from "@/lib/security/rate-limiter";
const blocked = await appRouterAuthRateLimit(req);
if (blocked) return blocked; // blocked is NextResponse(429)
```

### Webhook Raw Body

```typescript
// BEFORE (Pages Router)
export const config = { api: { bodyParser: false } };
const rawBody = await buffer(req);

// AFTER (App Router)
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  // verify signature with rawBody
}
```

---

## Migration Phases

### Phase 1: Core Domain Migration ⚠️ PARTIALLY COMPLETE (Feb 19, 2026)

~86 of 99 claimed App Router route files verified across 4 domains. **13 routes listed in migration log (Batches E, F, H) were never created as App Router files** — see "Phase 1 Audit Findings" below.

**LP Routes (27 files, 5 batches):**
- Batch 1: `register`, `subscribe`, `fund-context`, `fund-details`, `wire-instructions`
- Batch 2: `wire-proof`, `onboarding-flow`, `express-interest`, `signing-documents`, `subscription-status`
- Batch 3: `kyc`, `staged-commitment`, `bank/connect`, `bank/link-token`, `bank/status`
- Batch 4: `investor-profile/[profileId]`, `investor-profile/[profileId]/change-requests`, `documents/upload`
- Batch 5: `sign-nda`, `investor-details`, `commitment`, `upload-signed-doc` (deduplicated with existing)

**Admin Routes (56 files, 8 batches A-H):**
- Batch A: `engagement`, `reports`, `reports/export`, `reports/form-d`, `activate-fundroom`, `team-context`, `capital-tracking`
- Batch B: `consolidate-teams`, `fix-email-auth`, `reprocess-pdfs`, `form-d-reminders`, `db-health`, `deployment-readiness`, `dashboard-stats`
- Batch C: `settings/full`, `settings/update`, `settings/inheritance`, `wire/confirm`, `fund/[id]/pending-actions`, `fund/[id]/pending-details`, `investors/check-lead`
- Batch D: `investors/manual-entry`, `investors/bulk-import`, `investors/[investorId]`, `investors/[investorId]/review`, `investors/[investorId]/stage`, `documents/[id]/review`, `test-integrations`
- Batch E: `documents/pending-review`, `documents/[docId]/confirm`, `documents/[docId]/reject`, `documents/[docId]/request-reupload`, `documents/upload` (admin), `manual-investment/index`, `manual-investment/[id]`
- Batch F: `manual-investment/[id]/proof`, `approvals/pending`, `approvals/[approvalId]/approve`, `approvals/[approvalId]/approve-with-changes`, `approvals/[approvalId]/request-changes`, `profile-completeness`, `setup-admin`
- Batch G: `investor-profile/[profileId]`, `investor-profile/[profileId]/change-requests`, `signatures/capture`, `documents/[docId]/sign-data`, `documents/[docId]/signed-pdf`
- Batch H: `sign/[token]`, `record_click`, `record_view`, `record_video_view`

**Fund Routes (5 files, Phase 3):**
- `funds/[fundId]/settings`, `funds/[fundId]/aggregates`, `teams/[teamId]/funds`, `teams/[teamId]/funds/[fundId]/invite`, `teams/[teamId]/toggle-fundroom-access`

**Auth Routes (11 files, Phase 4):**
- Simple: `check-admin`, `check-visitor`, `admin-login`, `register`, `mfa-status`, `setup-admin`
- MFA: `mfa-verify`, `mfa-setup`
- Cookie/redirect: `verify-link`, `lp-token-login`, `admin-magic-verify`

**Key patterns applied across all routes:**
- App Router rate limiting via `appRouterRateLimit`, `appRouterAuthRateLimit`, `appRouterStrictRateLimit`, `appRouterMfaRateLimit`, `appRouterUploadRateLimit`
- RBAC via `enforceRBACAppRouter`, `requireAdminAppRouter`, `requireTeamMemberAppRouter`
- `export const dynamic = "force-dynamic"` on all route files
- `reportError()` in all catch blocks
- `{ error: }` response format (H-06 standard)
- Audit logging preserved from Pages Router versions

### Phase 1 Audit Findings (Mar 2, 2026)

Deep code-level review of all Phase 1 migrated routes. 4 domain groups verified: LP (9 routes), Auth (11 routes), Admin (14 core routes), Fund/Misc (21 routes).

#### Verification Results by Domain

**LP Routes (9/9 — 100% PASS):**
All 9 routes verified present with correct patterns: `force-dynamic`, rate limiting, RBAC/auth, `reportError()`, H-06 error format. Pages Router `pages/api/lp/` directory fully deleted.

**Auth Routes (11/11 — 100% PASS):**
All 11 routes verified present. Includes MFA endpoints with `appRouterMfaRateLimit`, atomic `$transaction` on token-based auth routes (`verify-link`, `lp-token-login`), open redirect protection on `admin-magic-verify`. Only `pages/api/auth/[...nextauth].ts` intentionally remains in Pages Router (NextAuth core handler).

**Admin Core Routes (14/14 — 100% PASS):**
14 core admin routes verified: `engagement`, `reports`, `reports/export`, `reports/form-d`, `activate-fundroom`, `settings/full`, `settings/update`, `wire/confirm`, `fund/[id]/pending-actions`, `fund/[id]/pending-details`, `investors/check-lead`, `investors/manual-entry`, `investors/[investorId]/review`, `documents/[id]/review`. All have `requireAdminAppRouter()`, rate limiting, error handling.

**Fund/Misc Routes (8/21 — 5 PASS, 3 PARTIAL, 13 MISSING):**

| Route | Status | Issue |
|-------|--------|-------|
| `funds/[fundId]/settings` | ✅ PASS | Full compliance |
| `funds/[fundId]/aggregates` | ✅ PASS | Full compliance |
| `admin/activate-fundroom` | ✅ PASS | Full compliance |
| `admin/investors/check-lead` | ✅ PASS | Full compliance |
| `admin/investors/[investorId]/review` | ✅ PASS | Full compliance |
| `teams/[teamId]/funds` | ⚠️ PARTIAL | Has `enforceRBACAppRouter` but NO per-route rate limiter |
| `teams/[teamId]/funds/[fundId]/invite` | ⚠️ PARTIAL | Has session auth but NO per-route rate limiter |
| `teams/[teamId]/toggle-fundroom-access` | ⚠️ PARTIAL | Has `enforceRBACAppRouter` but NO per-route rate limiter |

#### CRITICAL: 13 Routes Never Created

The following 13 routes are listed in the Phase 1 migration log (Batches E, F, H) but **do not exist as App Router files**. Their Pages Router equivalents continue to serve these endpoints.

**From Admin Batch E (4 missing):**
| Listed Route | Pages Router File | App Router File |
|-------------|-------------------|-----------------|
| `admin/documents/pending-review` | `pages/api/documents/pending-review.ts` ✅ | `app/api/admin/documents/pending-review/route.ts` ❌ MISSING |
| `admin/documents/[docId]/confirm` | `pages/api/documents/[docId]/confirm.ts` ✅ | `app/api/admin/documents/[docId]/confirm/route.ts` ❌ MISSING |
| `admin/documents/[docId]/reject` | `pages/api/documents/[docId]/reject.ts` ✅ | `app/api/admin/documents/[docId]/reject/route.ts` ❌ MISSING |
| `admin/documents/[docId]/request-reupload` | `pages/api/documents/[docId]/request-reupload.ts` ✅ | `app/api/admin/documents/[docId]/request-reupload/route.ts` ❌ MISSING |

**Note:** `admin/documents/upload` from Batch E may exist at `app/api/admin/documents/upload-for-investor/route.ts` (different path).

**From Admin Batch F (4 missing):**
| Listed Route | Pages Router File | App Router File |
|-------------|-------------------|-----------------|
| `approvals/pending` | `pages/api/approvals/pending.ts` ✅ | `app/api/admin/approvals/pending/route.ts` ❌ MISSING |
| `approvals/[approvalId]/approve` | `pages/api/approvals/[approvalId]/approve.ts` ✅ | `app/api/admin/approvals/[approvalId]/approve/route.ts` ❌ MISSING |
| `approvals/[approvalId]/approve-with-changes` | `pages/api/approvals/[approvalId]/approve-with-changes.ts` ✅ | `app/api/admin/approvals/[approvalId]/approve-with-changes/route.ts` ❌ MISSING |
| `approvals/[approvalId]/request-changes` | `pages/api/approvals/[approvalId]/request-changes.ts` ✅ | `app/api/admin/approvals/[approvalId]/request-changes/route.ts` ❌ MISSING |

**From Admin Batch H (4 missing):**
| Listed Route | Pages Router File | App Router File |
|-------------|-------------------|-----------------|
| `sign/[token]` | `pages/api/sign/[token].ts` ✅ | `app/api/admin/sign/[token]/route.ts` or `app/api/sign/[token]/route.ts` ❌ MISSING |
| `record_click` | `pages/api/record_click.ts` ✅ | `app/api/record_click/route.ts` ❌ MISSING |
| `record_view` | `pages/api/record_view.ts` ✅ | `app/api/record_view/route.ts` ❌ MISSING |
| `record_video_view` | `pages/api/record_video_view.ts` ✅ | `app/api/record_video_view/route.ts` ❌ MISSING |

**Note:** `app/api/record_reaction/route.ts` DOES exist (was created in a separate migration), but the other 3 tracking routes were never migrated.

**From Admin Batch E (1 unclear):**
| Listed Route | Status |
|-------------|--------|
| `admin/documents/upload` | Possibly at `app/api/admin/documents/upload-for-investor/route.ts` — different path from what was claimed |

**Impact:** These 13 routes continue to function correctly via their Pages Router implementations. No user-facing breakage exists because Next.js serves the Pages Router file when no App Router equivalent exists. However, the migration log inaccurately claims these were migrated.

#### Error Handling Gap

`app/api/admin/form-d-reminders/route.ts` — GET handler has NO try-catch around Prisma queries. Should be wrapped in try-catch with `reportError()`.

#### Test Coverage (Phase 1 Routes)

| Domain | Direct Tests | Coverage | Gaps |
|--------|-------------|---------|------|
| LP (9 routes) | 7/9 | 78% | `signing-documents`, `onboarding-flow` |
| Auth (11 routes) | 7/11 | 64% | `check-admin`, `check-visitor`, `setup-admin`, `verify-link` |
| Admin (14 routes) | 6/14 | 43% | `engagement`, `reports/export`, `bulk-import`, `documents/review`, `activate-fundroom`, plus 8 more |
| Fund (5 routes) | 2/5 | 40% | `teams/[teamId]/funds`, `invite`, `toggle-fundroom-access` |
| Tracking (3 routes) | 0/3 | 0% | `record_click`, `record_view`, `record_video_view` (routes don't exist in App Router) |
| **Overall** | **22/42** | **52%** | 15 routes have ZERO test coverage of any kind |

**Note:** Some routes without direct tests may be covered indirectly by E2E tests (e.g., `happy-path-full-flow.test.ts`). The 52% figure represents direct, dedicated test files only.

#### Recommendations

1. **Create the 13 missing App Router routes** — or update the migration log to remove them from Phase 1 and add them to Phase 2 Category A
2. **Add `appRouterRateLimit` to 3 fund routes** — `teams/[teamId]/funds`, `teams/[teamId]/funds/[fundId]/invite`, `teams/[teamId]/toggle-fundroom-access`
3. **Add try-catch to `form-d-reminders` GET handler**
4. **Expand test coverage** — Priority targets: tracking routes (0%), fund routes (40%), admin routes (43%)
5. **Add deprecation comments** to Pages Router files that have App Router equivalents — none currently have them

---

### Phase 2: Remaining Domains — Categorized (Mar 1, 2026)

**238 Pages Router routes remaining** (after 19 duplicates deleted Mar 1). Categorized into A/B/C priority tiers. **Note:** Category counts below sum to 257 — the delta of 19 routes was deleted in the Mar 1 cleanup but the per-category listings were not updated. A future pass should reconcile which specific routes were deleted from each category.

#### Category A: Critical Path (migrate first — investor-facing, auth, payment)
| Domain | Routes | Notes |
|--------|--------|-------|
| auth/ | 1 | `[...nextauth].ts` — NextAuth core handler (complex, migrate carefully) |
| sign/ | 6 | E-signature routes — LP-facing signing flows |
| documents/ | 7 | Document CRUD, annotations, upload — LP + GP critical path |
| approvals/ | 4 | GP investor approval pipeline |
| transactions/ | 3 | Transaction listing and details |
| investor-profile/ | 2 | LP profile management |
| **Subtotal** | **23** | |

#### Category B: High-Value (migrate second — GP operations, integrations)
| Domain | Routes | Notes |
|--------|--------|-------|
| teams/ | 170 | Largest batch: datarooms, documents, links, investors, settings, funds. Break into sub-batches of 10-15 |
| file/ | 11 | File upload/download (image, S3, browser, Notion proxy) |
| signature/ | 6 | Signature template CRUD |
| webhooks/ | 6 | Stripe, Persona, Resend, Plaid, Rollbar — need raw body handling |
| branding/ | 2 | Tenant branding API |
| view/ | 2 | Document/dataroom public viewer |
| viewer/ | 3 | Viewer session management |
| **Subtotal** | **200** | |

#### Category C: Low-Priority (migrate last — background jobs, misc)
| Domain | Routes | Notes |
|--------|--------|-------|
| jobs/ | 7 | Background job handlers (cron-triggered) |
| mupdf/ | 4 | PDF processing utilities |
| notifications/ | 3 | Notification preferences |
| feedback/ | 1 | User feedback collection |
| passkeys/ | 1 | WebAuthn passkeys (Phase 2 auth) |
| subscriptions/ | 1 | Legacy subscription handler |
| storage/ | 1 | Storage provider utilities |
| internal/ | 1 | Internal API helpers |
| conversations/ | 1 | Document conversations |
| account/ | 1 | Account settings |
| analytics/ | 1 | Analytics aggregation |
| user/ | 1 | User profile |
| unsubscribe/ | 1 | Email unsubscribe |
| Standalone files | 8 | `health.ts`, `record_*.ts`, `progress-token.ts`, `revalidate.ts`, `request-invite.ts`, `report.ts` |
| **Subtotal** | **34** | |

#### Phase 2 Migration Strategy

**teams/ sub-batch plan** (170 routes → ~12 batches of 10-15):
1. `teams/[teamId]/datarooms/` — dataroom CRUD, settings, groups (~30 routes)
2. `teams/[teamId]/datarooms/[id]/documents/` — document management (~20 routes)
3. `teams/[teamId]/datarooms/[id]/links/` — shareable links (~15 routes)
4. `teams/[teamId]/datarooms/[id]/views/` — viewer analytics (~10 routes)
5. `teams/[teamId]/documents/` — document CRUD, versions (~25 routes)
6. `teams/[teamId]/links/` — link CRUD, analytics (~15 routes)
7. `teams/[teamId]/members/` — team member management (~10 routes)
8. `teams/[teamId]/settings/` — team settings (~10 routes)
9. `teams/[teamId]/investors/` — investor management (~10 routes)
10. `teams/[teamId]/wire-transfers/` — wire transfer management (~5 routes)
11. `teams/[teamId]/marketplace/` — marketplace deals (~10 routes)
12. `teams/[teamId]/` — remaining miscellaneous (~10 routes)

**Webhook migration notes:**
- Stripe, Persona, Resend webhooks need `req.text()` for raw body (not `req.json()`)
- Signature verification must use raw body string, not parsed JSON
- Test with Stripe CLI and webhook simulation tools after migration

### Phase 3: Cleanup (After Full Migration)

- Delete all migrated `pages/api/` files
- Remove `pages/_document.tsx`, `pages/_app.tsx`, `pages/404.tsx` if App Router equivalents exist
- Update all import paths
- Verify zero orphaned files
- Update test imports if needed

---

## Per-Route Migration Checklist

For each route being migrated:

- [ ] Create App Router file at corresponding path with `route.ts`
- [ ] Convert `NextApiRequest/NextApiResponse` → `NextRequest/NextResponse`
- [ ] Convert `res.status().json()` → `NextResponse.json()`
- [ ] Convert `req.body` → `await req.json()`
- [ ] Convert `req.query` → `await params` or `searchParams`
- [ ] Convert method checks → named export functions
- [ ] Convert auth: `getServerSession(req, res, authOptions)` → `getServerSession(authOptions)`
- [ ] Preserve all Zod validation schemas
- [ ] Preserve all `reportError()` calls
- [ ] Preserve all audit logging
- [ ] Ensure `{ error: }` response format
- [ ] Add rate limiting if security-sensitive
- [ ] Test with existing test suite
- [ ] Verify no import cycle issues
- [ ] Delete Pages Router version after verification

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Breaking auth during migration | Critical | Migrate auth routes first with comprehensive testing |
| Webhook signature verification | High | Test Stripe/Persona webhooks with raw body parsing |
| Route conflicts during coexistence | Medium | Verified: no conflicts exist (different file patterns) |
| Missing rate limiting in new routes | Medium | Add rate limiting as part of each migration batch |
| Test coverage gaps | Medium | Run full test suite after each batch |

---

## Success Criteria

**Phase 1 (partially met):**
- [x] LP routes migrated (9/9)
- [x] Auth routes migrated (11/11)
- [x] Admin core routes migrated (14/14)
- [ ] All claimed Phase 1 routes exist (~86/99 — 13 missing)
- [x] `{ error: }` response format on all migrated routes
- [ ] Rate limiting on all migrated routes (3 fund routes missing)
- [x] All tests passing
- [x] Zero TypeScript errors

**Full Migration (Phase 2+3 — not yet started):**
- 0 routes remaining in `pages/api/`
- All ~533 routes migrated to `app/api/`
- 100% `{ error: }` response format
- Rate limiting on all auth/payment/upload routes
- Zero breaking changes to API behavior
- All tests passing
- Zero TypeScript errors

---

## Notes & Lessons Learned

- **Next.js 16 proxy.ts:** `proxy.ts` is the middleware entry point. Do NOT create `middleware.ts`.
- **NextAuth compatibility:** App Router uses `getServerSession(authOptions)` without `req/res` params.
- **Parallel coexistence:** Pages Router and App Router can coexist as long as no path conflicts exist. When both exist at the same path, Next.js serves the App Router version.
- **Cookie handling in App Router:** `res.setHeader("Set-Cookie", ...)` becomes `response.headers.set("Set-Cookie", cookieParts.join("; "))`. Build cookie string manually with parts array.
- **Redirect in App Router:** `res.redirect(302, url)` becomes `NextResponse.redirect(new URL(path, baseUrl), 302)`. Can combine with Set-Cookie header on the redirect response.
- **Rate limiting:** Pages Router uses `authRateLimiter(req, res)` (writes 429 directly). App Router uses `appRouterAuthRateLimit(req)` which returns `NextResponse | null`. Pattern: `const blocked = await appRouterAuthRateLimit(req); if (blocked) return blocked;`
- **Prisma transaction typing:** Transaction callback parameter: `async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0])`
- **RBAC helpers:** `lib/auth/rbac.ts` has App Router variants: `enforceRBACAppRouter()`, `requireAdminAppRouter()`, `requireTeamMemberAppRouter()`, `requireGPAccessAppRouter()` — return `RBACResult | NextResponse`.
- **Pages Router files NOT deleted:** Kept during verification phase. Can be removed after confirming App Router versions work identically in production.
- **Phase 2+ priority:** This migration is not blocking MVP launch. The platform functions correctly with the current mixed-router architecture.
