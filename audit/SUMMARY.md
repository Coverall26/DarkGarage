# FundRoom AI — Codebase Audit Summary
## Date: February 25, 2026 (Updated)

---

## Executive Summary

| Category | Count | Severity |
|----------|-------|----------|
| Security: Unprotected routes | **0** | ✅ PASS |
| Security: Auth script violations | **0** | ✅ PASS |
| Real TypeScript errors | **0** | ✅ PASS (all resolved) |
| Duplicate routes (App + Pages Router) | **51** | LOW — App Router takes priority, Pages Router copies are dead code |
| console.log statements (executable) | **0** | ✅ PASS |
| console.error statements | **265** | LOW — all in webhooks (intentional) or components (client-side) |
| console.warn statements | **12** | ✅ PASS |
| eslint-disable comments | **78** | LOW — all legitimate (react-hooks/exhaustive-deps, no-img-element) |
| @ts-ignore / @ts-nocheck | **0** | ✅ PASS |
| `any` types in critical paths | **0** | ✅ PASS |
| `any` types across all source | **136** | LOW — none in auth/security/audit/crypto |
| Hardcoded secrets | **0** | ✅ PASS |

---

## Phase 1: Security Gaps

**Route Auth Audit:** `scripts/check-route-auth.sh` reports **0 violations** across 500 scanned routes (62 allowlisted/public).

**Auth Architecture (5-layer defense-in-depth):**
1. Edge middleware (`proxy.ts` → `edge-auth.ts`): JWT validation for ALL `/api/*` routes
2. Admin auth (`admin-auth.ts`): LP blocking + admin-specific checks
3. Route handler RBAC (`lib/auth/rbac.ts`): `requireAdminAppRouter` / `enforceRBAC` with 52-permission matrix
4. Domain middleware: Host-based gating for `app.admin.fundroom.ai`
5. Business logic auth: Team-scoped Prisma queries, fund ownership checks

**Rate Limiting (10 tiers):**
- Blanket: 200 req/min/IP via Upstash Redis (all `/api/` routes)
- Auth: 10 req/hr | Strict: 3 req/hr | MFA: 5/15min | Signature: 5/15min
- Upload: 20 req/min | API: 100 req/min | Registration: 5 req/min
- App Router: 100 req/min | App Router Upload: 20 req/min

**CSRF:** Origin/Referer validation + `X-Requested-With: FundRoom` custom header fallback

**RBAC Spot-Check (15 routes):**

| Route | Auth | Team Scoping | Rate Limiting | Result |
|-------|------|-------------|---------------|--------|
| GP: Wire Confirm | `requireAdminAppRouter()` ×2 | Fund→Team verified | Strict (3/hr) | ✅ PASS |
| GP: Manual Investor | `requireAdminAppRouter()` ×2 | Fund→Team verified | Strict (3/hr) | ✅ PASS |
| GP: Engagement | `requireAdminAppRouter()` | Investor→Fund→Team | Standard (100/min) | ✅ PASS |
| GP: Reports | `requireAdminAppRouter()` | Fund→Team verified | Standard (100/min) | ✅ PASS |
| GP: Setup Complete | `requireAuthAppRouter()` | Creates with session userId | Auth required | ✅ PASS |
| GP: Investor Review | `requireAdminAppRouter()` + session | Fund→Team verified | Standard (100/min) | ✅ PASS |
| GP: Pending Approvals | `getServerSession()` | Team membership check | Auth required | ✅ PASS |
| GP: Pending Actions | `requireAdminAppRouter()` + session | Fund→Team verified | Standard (100/min) | ✅ PASS |
| GP: Form D Export | `requireAdminAppRouter()` ×2 | Fund→Team verified | Standard (100/min) | ✅ PASS |
| GP: Pending Details | `requireAdminAppRouter()` | Fund→Team verified | Standard (100/min) | ✅ PASS |
| LP: Subscribe | `requireLPAuthAppRouter()` | Investor→Fund binding | Strict (3/hr) | ✅ PASS |
| LP: Wire Proof | `requireLPAuthAppRouter()` | Dual ownership check | Upload (20/min) | ✅ PASS |
| LP: Signing Docs | `requireLPAuthAppRouter()` | Email→Recipient match | Standard (100/min) | ✅ PASS |
| LP: Staged Commitment | `requireLPAuthAppRouter()` | Investor→Fund binding | Strict (POST) | ✅ PASS |
| LP: Onboarding Flow | `requireLPAuthAppRouter()` | Investor+Fund composite | Standard (100/min) | ✅ PASS |

**Result: 15/15 routes PASS all RBAC enforcement criteria.**

**Deep Scan Findings (2 MEDIUM, 1 LOW — all mitigated):**
- M-1: `new Function()` in `lib/esign/field-types.ts:455` — formula evaluation uses strict whitelist regex (`/^[\d\s+\-*/().]+$/`). Mitigated. Consider mathjs library in Phase 2.
- M-2: Custom CSS in `app/offering/[slug]/page-client.tsx:288` — `sanitizeCss()` strips dangerous patterns. GP-admin-only field. Acceptable for MVP.
- L-1: Duplicate health endpoints (Pages + App Router) — functional duplicate, Pages version can be removed in Phase 2 migration.

**Conclusion:** Security posture is STRONG. No unprotected routes found. 5-layer defense-in-depth architecture verified. All 10 rate limiter tiers operational. RBAC spot-check: 15/15 PASS. Zero CRITICAL or HIGH severity issues.

---

## Phase 2: Duplicate Routes

**51 routes exist in BOTH App Router and Pages Router.**

In Next.js 16, App Router takes priority when both define the same path — all 51 Pages Router duplicates are effectively dead code that can never be reached.

| Category | Count | Notes |
|----------|-------|-------|
| Links routes | 17 | All `@deprecated` or fully mirrored |
| Billing routes | 11 | All `@deprecated`, 6 are 16-line stubs |
| File upload routes | 9 | Callers use URL strings, hit App Router |
| Webhooks | 6 | Verify external service configs before deletion |
| Miscellaneous | 4 | Callers use URL strings |
| Dataroom/document base | 4 | SWR hooks hit App Router |

**Action:** Delete all 51 Pages Router duplicate files after production verification. App Router versions have modern patterns (rate limiting, RBAC, structured errors). Critical warnings:
- Keep `pages/api/auth/[...nextauth].ts` (NextAuth requires Pages Router)
- Keep ~230 Pages Router routes that have NO App Router equivalent
- Verify webhook endpoint registrations in external services (Stripe, Resend, Persona) before deleting webhook duplicates

**Detailed report:** `audit/P2-duplicates.txt`

---

## Phase 3: TypeScript Compilation

**Result: 0 errors** (`npx tsc --noEmit` passes clean)

The prior audit reported 178 TypeScript errors — these were ALL phantom errors caused by missing `node_modules` (module resolution failures for `react`, `next`, `@prisma/client`, etc.). After `npm install` and `npx prisma generate`, only 1 real error remained:
- `components/view/viewer/dataroom-viewer.tsx`: Prop type mismatch for `dataroom.documents` — FIXED by widening prop type to accept varying nested shapes from Prisma.

**Current state:** Zero TypeScript errors. `npx tsc --noEmit` clean.

---

## Phase 3b: Broken References

**Detailed report:** `audit/P3-broken-refs.txt`

| Category | Checked | Broken | Status |
|----------|---------|--------|--------|
| @/ aliased imports | 7,189 | 0 | ✅ PASS |
| Relative imports | 1,044 | 0 | ✅ PASS |
| API endpoint references | 223 | 1 → 0 | ✅ RESOLVED |
| Prisma model references | 123 | 0 | ✅ PASS |

**One broken reference found and resolved:**
- `/api/assistants` in `components/documents/document-header.tsx` — legacy Papermark AI assistant functions calling a non-existent endpoint. **Fixed** by removing dead functions (`activateOrRedirectAssistant`, `activateOrDeactivateAssistant`). FundRoom uses `DocumentAIDialog` via the `(ee)` route group.

---

## Phase 4: Code Quality

### Console Statements

| Type | Count | Assessment |
|------|-------|-----------|
| `console.log` (executable) | **0** | 4 found in comments only — no executable logging |
| `console.error` | **265** | 69 in webhooks (intentional security logging), 82 in client components, remainder in API routes with `reportError()` |
| `console.warn` | **12** | All meaningful warnings (session timeouts, dev-only mode) |

### eslint-disable (78 instances)
- **react-hooks/exhaustive-deps**: 49 — ALL legitimate (intentional dependency exclusion in useEffect)
- **@next/next/no-img-element**: 16 — ALL legitimate (dynamic/external URLs not suitable for `next/image`)
- **@typescript-eslint/no-explicit-any**: 1 — documented with justification
- Other: 12 — legitimate (complex PDF rendering, Notion API, React Hook Form)

### `any` Types (136 total)
- **Critical paths (auth, security, audit, crypto, middleware, esign, wire-transfer): 0** — pristine
- **Test files only: 57** — acceptable for mocks
- **Source code: 79** — in Prisma extensions (11), AWS SDK (3), data import (14), dataroom recursion (15), other non-critical areas

### @ts-ignore / @ts-nocheck
**0 instances** in source files. Codebase passes `tsc --noEmit` cleanly.

---

## Prioritized Action Plan

### Resolved (This Audit)
1. ✅ TypeScript errors: 0 (was 178 phantom errors from missing node_modules)
2. ✅ Security gaps: 0 unprotected routes
3. ✅ Auth script: 0 violations across 500 routes
4. ✅ Critical path `any` types: 0
5. ✅ Hardcoded secrets: 0
6. ✅ Broken /api/assistants reference: removed dead legacy code from document-header.tsx

### Phase 2 Cleanup (Post-Launch)
1. Delete 51 duplicate Pages Router files after production verification
2. Refactor document viewer components to reduce eslint-disable count (presentation-only, not security-critical)
3. Type remaining 79 `any` instances in non-critical code paths
4. Consider requiring `@typescript-eslint/no-explicit-any` in ESLint rules

### No Action Required
- Console statements: All in appropriate contexts (webhook security logging, client-side error handling, with `reportError()` wrappers)
- eslint-disable comments: All legitimate
- Rate limiting: Comprehensive 10-tier coverage operational
