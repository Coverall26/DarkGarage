# FundRoom AI — Investor Packet

> **Confidential** — Prepared by FundRoom AI, Inc. (d/b/a White Label Hosting Solutions)
> Last updated: March 2026

---

## 1. Executive Summary

**FundRoom AI** is a vertically integrated, multi-tenant SaaS platform that bundles five purpose-built modules — **RaiseRoom**, **SignSuite**, **RaiseCRM**, **DataRoom**, and **FundRoom** — into a single subscription, replacing five or more point solutions that fund managers currently pay for separately.

An AI concierge (**Lara AI**) threads through every module, providing context-aware assistance, outreach drafting, compliance guidance, and pipeline intelligence.

### Phase 1 MVP: Code-Complete

| Metric | Value |
|--------|-------|
| Lines of code | 373K+ |
| Prisma models | 144 |
| Prisma enums | 93 |
| Schema lines | 6,020 |
| API routes | 533 (295 App Router + 238 Pages Router) |
| Test files | 269 |
| Source files | 2,129 |
| Security layers | 5-layer defense-in-depth |

**Stack:** Next.js 16 (App Router), TypeScript, Prisma ORM, PostgreSQL (Supabase), Vercel, NextAuth, shadcn/ui, Tailwind CSS.

---

## 2. Product Suite Overview

FundRoom AI is organized into **5 branded product modules** plus an AI layer:

| Suite | Color | Purpose |
|-------|-------|---------|
| **RaiseRoom** | Cyan `#06B6D4` | Capital raise management — pipeline, offering pages, fund overview |
| **SignSuite** | Emerald `#10B981` | Native e-signature — envelopes, templates, field placement, NDA gate, bulk send |
| **RaiseCRM** | Amber `#F59E0B` | Contact pipeline — Kanban, engagement scoring, outreach, AI insights |
| **DataRoom** | Blue `#2563EB` | Secure document filing — org vault, contact vaults, activity log |
| **FundRoom** | Purple `#8B5CF6` | Full GP/LP platform — all modules combined, compliance, fund ops |
| **Lara AI** | Purple `#8B5CF6` | AI concierge — context-aware chat, outreach drafts, compliance checks |

### Key Differentiators

- **Zero external API cost for e-signatures.** SignSuite is fully native (HTML5 Canvas + pdf-lib), eliminating per-envelope fees charged by DocuSign/HelloSign.
- **SEC compliance built-in.** Rule 506(b), 506(c), Regulation A+, Rule 504 support with Form D export, accreditation tracking, and SHA-256 hash-chained immutable audit logs.
- **Multi-tenant isolation.** Every database table includes `org_id`; every query is org-scoped. Cross-tenant data access is architecturally impossible.
- **Wire-to-close workflow.** Manual wire instructions → LP proof upload → GP confirmation → auto-advance investor stage → compliance audit trail. No Plaid dependency (Phase 2).

---

## 3. Pricing

### Subscription Tiers

| | **Free** | **Pro** | **Business** | **FundRoom** |
|---|---------|---------|------------|-------------|
| **Monthly** | $0 | $29/mo | $39/mo | $79/mo |
| **Annual** | $0 | $23/mo | $32/mo | $63/mo |
| **Savings** | — | 21% | 18% | 20% |

### Suite Access by Tier

| Suite | Free | Pro | Business | FundRoom |
|-------|------|-----|----------|----------|
| DataRoom | ✅ | ✅ | ✅ | ✅ |
| RaiseCRM | Basic (20 contacts) | Full (unlimited) | Full (unlimited) | Full (unlimited) |
| SignSuite | 10 e-sigs/mo | 25 e-sigs/mo | 75 e-sigs/mo | Unlimited |
| RaiseRoom | — | ✅ | ✅ | ✅ |
| FundRoom | — | — | — | ✅ |
| Lara AI | Quick actions | Outreach drafts | Analytics + insights | Full (compliance + insights) |

### Feature Breakdown

| Feature | Free | Pro | Business | FundRoom |
|---------|------|-----|----------|----------|
| Secure dataroom | ✅ | ✅ | ✅ | ✅ |
| Shareable links with analytics | ✅ | ✅ | ✅ | ✅ |
| CRM contacts | 20 | Unlimited | Unlimited | Unlimited |
| E-signatures/month | 10 | 25 | 75 | Unlimited |
| Signer storage | 40 | 100 | Unlimited | Unlimited |
| Email gate & NDA gate | ✅ | ✅ | ✅ | ✅ |
| Email templates | 2 | 5 | 10 | Unlimited |
| Kanban pipeline view | — | ✅ | ✅ | ✅ |
| Outreach & email tracking | — | ✅ | ✅ | ✅ |
| Custom branding | — | ✅ | ✅ | ✅ |
| API access | — | ✅ | ✅ | ✅ |
| LP onboarding wizard | — | — | — | ✅ |
| Wire transfer tracking | — | — | — | ✅ |
| 7-stage investor pipeline | — | — | — | ✅ |
| GP approval workflows | — | — | — | ✅ |
| SEC Form D export | — | — | — | ✅ |
| Compliance dashboard | — | — | — | ✅ |
| Capital calls & distributions | — | — | — | ✅ |
| White-label LP portal | — | — | — | ✅ |
| Priority support | — | — | — | ✅ |

### AI Add-On

| | **AI CRM Engine** |
|---|-------------------|
| **Monthly** | +$49/mo |
| **Annual** | +$39/mo |
| **Trial** | 14-day free trial |
| **Features** | AI-powered email drafts, investor insights, engagement scoring, daily digest |

---

## 4. Competitive Savings Analysis

Fund managers currently pay for 5+ separate tools:

| Tool | Monthly Cost |
|------|-------------|
| DocuSign (e-signatures) | $35/mo |
| Dropbox (file storage) | $25/mo |
| DocSend (document sharing) | $45/mo |
| HubSpot CRM (pipeline) | $50/mo |
| Carta (cap table / fund admin) | ~$417/mo¹ |
| **Total** | **$572/mo** |

**FundRoom AI replaces all five for $79/mo** — an 86% cost reduction.

> ¹ Carta pricing based on $5,000/year annual plan, annualized to monthly equivalent ($5,000 ÷ 12 ≈ $417/mo).

---

## 5. Market Opportunity

### Total Addressable Market (TAM)

| Segment | Estimated Count | Source |
|---------|----------------|--------|
| US venture capital firms | ~5,200 | NVCA 2024 Yearbook |
| US private equity firms | ~7,500 | PitchBook 2024 PE Report |
| US real estate fund managers | ~4,800 | NCREIF / Preqin |
| US hedge fund managers | ~3,700 | SEC IAPD |
| US search funds & micro-PE | ~2,000 | Stanford GSB |
| US SPV / syndicate leads | ~8,000 | AngelList / Republic data |
| Startup founders raising capital | ~40,000+ | Crunchbase / PitchBook |
| **Total TAM** | **70,000+** | |

### Serviceable Addressable Market (SAM)

Targeting emerging managers (Fund I–III) and startup founders raising pre-seed through Series B:

| Segment | SAM Estimate |
|---------|-------------|
| Emerging fund managers (Fund I–III) | ~15,000 |
| Active startup founders (raising) | ~20,000 |
| **Total SAM** | **~35,000** |

### Revenue Model Assumptions

| Assumption | Value | Rationale |
|-----------|-------|-----------|
| Monthly churn | 5% | Industry SaaS average for SMB vertical tools² |
| Average revenue per account (ARPA) | $55/mo | Blended: 55% Free, 20% Pro, 15% Business, 10% FundRoom |
| Annual contract value (ACV) | $660 | ARPA × 12 |
| Year 1 target | 500 paying accounts | Conservative market penetration |
| Year 1 ARR target | $330K | 500 × $660 |

> ² 5% monthly churn is consistent with Recurly's 2024 SaaS Churn Benchmarks for B2B SMB vertical tools in the $20–$100/mo price range.

---

## 6. Security Posture

| Area | Implementation |
|------|---------------|
| **Encryption** | AES-256-GCM for sensitive data (SSN, EIN, wire details, signatures); TLS 1.3 in transit |
| **Authentication** | NextAuth (email/password + Google OAuth); edge-level JWT validation on ALL API routes |
| **Authorization** | 5-layer defense-in-depth: edge auth → admin auth → RBAC → domain middleware → business logic |
| **Rate Limiting** | Blanket 200/min + per-route tiers (auth 10/hr, strict 3/hr, MFA 5/15min, upload 20/min) |
| **Multi-Tenant Isolation** | Every table has `org_id`; every query is org-scoped; RBAC with 5 role levels |
| **Compliance** | SEC Rule 506(b/c), ESIGN Act, UETA; SHA-256 hash-chained immutable audit logs |
| **Infrastructure** | Vercel (DDoS protection), Supabase PostgreSQL, HSTS (2-year preload), CSP headers |
| **Incident Response** | Rollbar monitoring, PagerDuty alerting, anomaly detection, structured JSON logging |
| **CSRF** | Origin/Referer validation + `X-Requested-With: FundRoom` custom header fallback |

---

## 7. Technical Architecture

### Database

- **144 Prisma models**, 93 enums, 6,020 schema lines
- PostgreSQL on Supabase with connection pooling
- AES-256-GCM encryption for 14 sensitive data types
- SHA-256 hash-chained immutable audit logs for SEC compliance

### API

- **533 API routes** (295 App Router + 238 Pages Router)
- Edge-level JWT authentication on all routes
- Centralized rate limiting (10 tiers)
- H-06 standardized error responses across entire codebase

### Testing

- **269 test files** with comprehensive coverage
- Jest 30 + React Testing Library
- Playwright E2E test suite (5 visual regression specs, 5 flow specs)
- Security audit test suite (37 automated checks)
- Pre-launch verification script (12 env vars, 16 file checks, schema audit)

### Billing

- Stripe Billing integration with 4 CRM tiers + AI add-on
- Module provisioning engine (tier → feature mapping with numeric limits)
- Graceful downgrades (data never deleted, over-limit features become read-only)
- `PAYWALL_BYPASS` env var for controlled rollout

---

## 8. Product Roadmap

### Phase 1 — MVP (Complete)

- Full GP setup wizard (9 steps)
- LP onboarding wizard (9 steps with auto-save/resume)
- Native e-signature system (SignSuite) with 16 field types
- Wire transfer tracking with GP confirmation workflow
- SEC compliance (Form D export, accreditation tracking, audit trail)
- CRM with Kanban pipeline, engagement scoring, outreach
- AI concierge (Lara) with context-aware intent detection
- Multi-tenant billing with Stripe integration

### Phase 2 — Planned

- Stripe ACH / direct debit payment integration
- Persona KYC/AML identity verification
- QuickBooks financial integration
- Wolters Kluwer compliance integration
- Real-time SSE → Redis pub/sub for multi-instance support
- AI CRM engine with GPT-4o-mini powered drafts and insights
- Marketplace listing and discovery

### Phase 3 — Future

- K-1 tax document automation
- Advanced waterfall calculation engine
- White-label mobile app
- Multi-currency support
- Advanced analytics and reporting dashboard

---

## 9. Team & Contact

**FundRoom AI, Inc.** (d/b/a White Label Hosting Solutions)

- Website: [fundroom.ai](https://fundroom.ai)
- Security: security@fundroom.ai
- Support: support@fundroom.ai

---

## Appendix A: Suite Naming Reference

| Correct Name | Incorrect / Deprecated |
|-------------|----------------------|
| SignSuite | FundRoom SignSuite, FundRoom Sign, e-Sign |
| RaiseCRM | PipelineIQ, Pipeline IQ, Raise CRM |
| DataRoom | DocRooms, Data Room, Dataroom (one word OK in code) |
| RaiseRoom | Raise Room |
| FundRoom | Fund Room |
| Lara AI | LARA, Lara, AI Assistant |

## Appendix B: Stripe Product Configuration

| Product | Monthly Price ID Env Var | Annual Price ID Env Var |
|---------|------------------------|----------------------|
| CRM Pro ($29/$23) | `STRIPE_CRM_PRO_MONTHLY_PRICE_ID` | `STRIPE_CRM_PRO_YEARLY_PRICE_ID` |
| Business ($39/$32) | `STRIPE_BUSINESS_MONTHLY_PRICE_ID` | `STRIPE_BUSINESS_YEARLY_PRICE_ID` |
| FundRoom ($79/$63) | `STRIPE_FUNDROOM_MONTHLY_PRICE_ID` | `STRIPE_FUNDROOM_YEARLY_PRICE_ID` |
| AI CRM ($49/$39) | `STRIPE_AI_CRM_MONTHLY_PRICE_ID` | `STRIPE_AI_CRM_YEARLY_PRICE_ID` |

Webhook endpoint: `/api/webhooks/stripe-crm` (separate from SaaS billing at `/api/stripe/webhook`)

Events handled: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`, `customer.subscription.created`
