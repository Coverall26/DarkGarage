# Pages Router → App Router Migration Strategy

**Generated:** February 23, 2026
**Target:** Complete Phase 1 before V2 features
**Tool:** `npx tsx scripts/route-inventory.ts` for live inventory

---

## Executive Summary

| Metric | Count |
|--------|-------|
| **Total API Routes** | 533 |
| **Pages Router** | 293 |
| **App Router** | 240 |
| **Duplicate Pairs** | 21 |
| **Already Migrated** | 240 (App Router) |
| **Keep in Pages** | 124 (complex/legacy) |
| **Deprecate** | 22 (duplicates + deprecated) |
| **Pending Migration** | 147 |

---

## Route Categories

### DEPRECATE (22 routes) — Remove after verification

These routes either have App Router equivalents or are explicitly deprecated:

| Route | Reason |
|-------|--------|
| `pages/api/file/s3/get-presigned-get-url.deprecated.ts` | Deprecated file marker |
| `pages/api/file/s3/get-presigned-post-url.deprecated.ts` | Deprecated file marker |
| `pages/api/account/index.deprecated.ts` | Deprecated file marker |
| `pages/api/stripe/webhook.deprecated.ts` | Deprecated file marker |
| `pages/api/links/index.ts` | App Router: `app/api/links/route.ts` |
| `pages/api/links/[id]/index.ts` | App Router: `app/api/links/[id]/route.ts` |
| `pages/api/links/download/index.ts` | App Router: `app/api/links/download/route.ts` |
| `pages/api/file/s3/get-presigned-get-url-proxy.ts` | App Router: `app/api/file/s3/get-presigned-get-url/route.ts` |
| `pages/api/teams/[teamId]/billing/*.ts` (11 routes) | App Router: `app/api/teams/[teamId]/billing/*/route.ts` |
| `pages/api/teams/[teamId]/datarooms/index.ts` | App Router: `app/api/teams/[teamId]/datarooms/route.ts` |
| `pages/api/teams/[teamId]/datarooms/[id]/index.ts` | App Router: `app/api/teams/[teamId]/datarooms/[id]/route.ts` |
| `pages/api/teams/[teamId]/documents/index.ts` | App Router: `app/api/teams/[teamId]/documents/route.ts` |
| `pages/api/teams/[teamId]/documents/[id]/index.ts` | App Router: `app/api/teams/[teamId]/documents/[id]/route.ts` |

**Action:** Add deprecation header comments, redirect to App Router equivalents, remove in Phase 3.

### KEEP (124 routes) — Stay in Pages Router

These routes should remain in Pages Router for now due to complexity, special requirements, or deep integration with the Papermark codebase:

**NextAuth (1 route):**
- `auth/[...nextauth]` — NextAuth catch-all handler, must stay in Pages Router per NextAuth docs

**File Upload Handlers (10 routes):**
- `file/browser-upload.ts` — Vercel Blob upload with special body parsing
- `file/image-upload.ts` — Image processing pipeline
- `file/notion/index.ts` — Notion proxy with special auth
- `file/replit-*.ts` — Replit-specific handlers
- `file/tus/*` — TUS resumable upload protocol (special middleware)
- `file/upload-config.ts` — Upload configuration

**PDF Processing (4 routes):**
- `mupdf/*` — MuPDF binary processing (annotate, convert, get-pages, process-pdf-local)

**Background Jobs (7 routes):**
- `jobs/*` — Async job handlers with special execution context

**Dataroom Management (~50 routes):**
- `teams/[teamId]/datarooms/[id]/*` — Deep dataroom CRUD (folders, groups, permissions, views, stats)
- Complex Papermark-inherited routes with extensive PostHog analytics integration

**Document Management (~25 routes):**
- `teams/[teamId]/documents/[id]/*` — Document CRUD, analytics, version management
- Deep analytics integration with PostHog

**Signature Routes (8 routes):**
- `sign/*` — E-signature token-based signing with special auth
- `signature/*` — Legacy signature handling
- `signatures/capture.ts` — Signature image storage

**Team/Folder/Link Routes (~15 routes):**
- Various team management, folder management, and link management routes

**Webhook Routes (6 routes):**
- `webhooks/*` — Provider-specific signature verification

**Viewer/View Auth (5 routes):**
- `view/*`, `viewer/*` — Viewer portal and session management

### PENDING (147 routes) — Migrate in Phases 2-4

**Phase 2 Priority (High — fund/investor operations):**
- `approvals/*` (4 routes) — Approval queue actions
- `documents/*` (7 routes) — Document confirm/reject/upload
- `investor-profile/*` (2 routes) — Investor profile CRUD
- `transactions/*` (2 routes) — Transaction processing

**Phase 3 (Medium — team operations):**
- `teams/[teamId]/contacts/*` (4 routes) — CRM contacts
- `teams/[teamId]/agreements/*` (3 routes) — Agreement management
- `teams/[teamId]/domains/*` (3 routes) — Domain management
- `teams/[teamId]/settings.ts` — Team settings
- `teams/[teamId]/tags/*` (2 routes) — Tag management
- `teams/[teamId]/presets/*` (2 routes) — Link presets
- `teams/[teamId]/webhooks/*` (3 routes) — Webhook management

**Phase 4 (Low — utility routes):**
- `branding/*` (2 routes) — Manifest and tenant branding
- `notifications/*` (3 routes) — Notification handlers
- `record_*` (4 routes) — Tracking event ingestion
- `report.ts`, `feedback/index.ts`, `health.ts` — Misc utilities
- `links/[id]/*` (10+ routes) — Link sub-operations

---

## Migration Patterns

### App Router Standard Pattern

```typescript
// app/api/[resource]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { appRouterRateLimit } from "@/lib/security/rate-limiter";
import { requireAdminAppRouter } from "@/lib/auth/rbac";
import { reportError } from "@/lib/error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = await appRouterRateLimit(req);
  if (blocked) return blocked;

  const authResult = await requireAdminAppRouter(req);
  if (authResult instanceof NextResponse) return authResult;
  const { userId, teamId } = authResult;

  try {
    // ... handler logic
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    reportError(error as Error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### Deprecation Header Pattern

```typescript
// pages/api/[resource]/index.ts (deprecated)
/**
 * @deprecated Use App Router equivalent: app/api/[resource]/route.ts
 * This route will be removed in Phase 3. All new features should use the App Router version.
 */
```

---

## Phase 1 Completed (Feb 19, 2026)

99 routes migrated to App Router:
- 27 LP routes
- 56 Admin routes
- 5 Fund routes
- 11 Auth routes

See `docs/PAGES_TO_APP_ROUTER_MIGRATION.md` for details.

---

## Verification Process

Before removing any Pages Router route:
1. Confirm App Router equivalent handles all HTTP methods
2. Verify all frontend `fetch()` calls updated to new path
3. Run `npx tsx scripts/route-inventory.ts` to confirm no orphaned references
4. Test in staging environment
5. Monitor Rollbar for 404 errors after deployment

---

## Running the Inventory

```bash
# Text report
npx tsx scripts/route-inventory.ts

# JSON output (for processing)
npx tsx scripts/route-inventory.ts --json

# CSV output (for spreadsheets)
npx tsx scripts/route-inventory.ts --csv
```
