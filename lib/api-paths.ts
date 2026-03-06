/**
 * API Route Path Conventions — FundRoom AI
 *
 * This file documents the canonical URL patterns for API routes.
 * It does NOT re-export every route as a constant (that approach bloated
 * `lib/routes.ts` to 509 lines with 0 consumers). Instead, routes are
 * co-located with their handlers and follow the conventions below.
 *
 * ─── Naming Conventions ──────────────────────────────────────────────
 *
 * App Router (preferred for new routes):
 *   app/api/{domain}/{resource}/route.ts          — collection (GET list, POST create)
 *   app/api/{domain}/{resource}/[id]/route.ts     — item (GET detail, PATCH update, DELETE)
 *
 * Pages Router (legacy, migrating to App Router):
 *   pages/api/{domain}/{resource}/index.ts        — collection
 *   pages/api/{domain}/{resource}/[id]/index.ts   — item
 *
 * ─── Domain Prefixes ─────────────────────────────────────────────────
 *
 * /api/lp/*           — LP (investor) portal endpoints
 * /api/admin/*        — GP admin endpoints (requires ADMIN+ role)
 * /api/teams/[teamId]/*  — Team-scoped resources (requires team membership)
 * /api/esign/*        — E-signature envelope system
 * /api/billing/*      — CRM billing (Stripe checkout, portal, usage)
 * /api/ai/*           — AI features (draft-email, insights, digest)
 * /api/contacts/*     — CRM contact management
 * /api/outreach/*     — Email outreach sequences
 * /api/pipelineiq/*   — RaiseCRM pipeline features
 * /api/docrooms/*     — DataRoom filing and vaults
 * /api/tier/*         — Subscription tier resolution
 * /api/setup/*        — GP onboarding wizard
 * /api/auth/*         — Authentication (login, verify, MFA)
 * /api/webhooks/*     — Inbound webhooks (Stripe, Resend, Persona)
 * /api/cron/*         — Scheduled jobs (CRON_SECRET auth)
 * /api/health         — Health check
 * /api/sse            — Server-sent events stream
 *
 * ─── Auth Patterns ───────────────────────────────────────────────────
 *
 * All /api/ routes pass through edge auth in proxy.ts (JWT validation).
 * Route handlers add defense-in-depth RBAC:
 *   - requireAdminAppRouter()       — ADMIN/OWNER/SUPER_ADMIN
 *   - requireLPAuthAppRouter()      — Authenticated investor
 *   - enforceCrmRoleAppRouter()     — CRM role hierarchy
 *   - withTeamAuth()                — Team membership (Pages Router)
 *   - enforceRBAC()                 — Generic RBAC (Pages Router)
 *
 * ─── Rate Limiting Tiers ─────────────────────────────────────────────
 *
 * Blanket: 200 req/min/IP (proxy.ts middleware, all /api/ routes)
 * Auth:    10 req/hr      (login, verify, check-admin)
 * Strict:  3 req/hr       (subscribe, process-payment)
 * Upload:  20 req/min     (document uploads, wire proof)
 * API:     100 req/min    (standard endpoints)
 * MFA:     5 req/15min    (TOTP verification)
 *
 * ─── Full inventory: docs/API_ROUTE_INVENTORY.md ─────────────────────
 */

export {};
