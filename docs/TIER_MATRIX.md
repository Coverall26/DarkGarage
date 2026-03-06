# FundRoom AI — Tier & Feature Matrix

> Single source of truth for subscription tiers, feature limits, module provisioning, and billing architecture.
> Last updated: 2026-03-02

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Marketing Tiers (Pricing Page)](#marketing-tiers-pricing-page)
3. [CRM Tier Limits (Organization-Scoped)](#crm-tier-limits-organization-scoped)
4. [Module Provisioning (Product Modules)](#module-provisioning-product-modules)
5. [SaaS Plan Capabilities (Team-Scoped)](#saas-plan-capabilities-team-scoped)
6. [AI CRM Add-On](#ai-crm-add-on)
7. [Gate Enforcement Reference](#gate-enforcement-reference)
8. [Type Definitions & Aliases](#type-definitions--aliases)
9. [Caching Architecture](#caching-architecture)
10. [Known Discrepancies](#known-discrepancies)

---

## Architecture Overview

FundRoom has a **dual billing architecture** with two independent subscription systems:

| System | Scope | Source File | Plans |
|--------|-------|-------------|-------|
| **CRM Billing** | Organization-scoped | `lib/tier/crm-tier.ts`, `lib/stripe/crm-products.ts` | FREE, CRM_PRO, BUSINESS, FUNDROOM + AI_CRM add-on |
| **SaaS Billing** | Team-scoped | `lib/tier/resolver.ts`, `ee/limits/constants.ts` | free, pro, business, datarooms, datarooms-plus, datarooms-premium |

**Module Provisioning** (`lib/modules/provision-engine.ts`) maps CRM tiers to product modules (RAISEROOM, SIGNSUITE, RAISE_CRM, DATAROOM, DOCROOMS, FUNDROOM).

**Gate Enforcement** (`lib/tier/gates.ts`) checks resource limits before mutations (contacts, e-signatures, signer storage, templates, features).

**Paywall Bypass**: Set `PAYWALL_BYPASS=true` to skip all tier checks during development or MVP launch.

---

## Marketing Tiers (Pricing Page)

Source: `app/(marketing)/pricing/page.tsx`

| Feature | Free ($0) | Pro ($29/mo · $23 annual) | Business ($39/mo · $32 annual) | FundRoom ($79/mo · $63 annual) |
|---------|-----------|---------------------------|-------------------------------|-------------------------------|
| **Suite Access** | DataRoom, RaiseCRM (basic), SignSuite (10/mo) | DataRoom, RaiseCRM, SignSuite (25/mo), RaiseRoom (5 rooms) | DataRoom, RaiseCRM (analytics), SignSuite (75/mo), RaiseRoom (unlimited) | All 5 suites + Lara AI |
| Secure dataroom | ✅ | ✅ | ✅ | ✅ |
| Shareable links with analytics | ✅ | ✅ | ✅ | ✅ |
| CRM contacts | 20 | Unlimited | Unlimited | Unlimited |
| E-signatures/month | 10 | 25 | 75 | Unlimited |
| Signer storage | 40 | 100 | Unlimited | Unlimited |
| Email gate & NDA gate | ✅ | ✅ | ✅ | ✅ |
| Lara AI | Quick actions | Outreach drafts | Analytics + insights | Compliance + insights |
| Kanban pipeline view | ❌ | ✅ | ✅ | ✅ |
| Outreach & email tracking | ❌ | ✅ | ✅ | ✅ |
| Custom branding | ❌ | ✅ | ✅ | ✅ |
| API access | ❌ | ✅ | ✅ | ✅ |
| Bulk document download | ❌ | ❌ | ✅ | ✅ |
| Advanced analytics | ❌ | ❌ | ✅ | ✅ |
| LP onboarding wizard | ❌ | ❌ | ❌ | ✅ |
| Wire transfer tracking | ❌ | ❌ | ❌ | ✅ |
| 7-stage investor pipeline | ❌ | ❌ | ❌ | ✅ |
| GP approval workflows | ❌ | ❌ | ❌ | ✅ |
| SEC Form D export | ❌ | ❌ | ❌ | ✅ |
| Compliance dashboard | ❌ | ❌ | ❌ | ✅ |
| Capital calls & distributions | ❌ | ❌ | ❌ | ✅ |
| White-label LP portal | ❌ | ❌ | ❌ | ✅ |
| Priority support | ❌ | ❌ | ❌ | ✅ |

**Competitor comparison** (shown on pricing page): DocuSign ($35/mo) + Dropbox ($25/mo) + DocSend ($45/mo) + HubSpot CRM ($50/mo) + Carta ($5K/yr) = $572/mo vs FundRoom $79/mo.

---

## CRM Tier Limits (Organization-Scoped)

Source: `lib/tier/crm-tier.ts` (181 lines)

| Limit | FREE | CRM_PRO | BUSINESS | FUNDROOM |
|-------|------|---------|----------|----------|
| `maxContacts` | 20 | null (unlimited) | null (unlimited) | null (unlimited) |
| `maxEsigsPerMonth` | 10 | 25 | 75 | null (unlimited) |
| `maxSignerStorage` | 40 | 100 | null (unlimited) | null (unlimited) |
| `emailTemplateLimit` | 2 | 5 | 10 | null (unlimited) |
| `signatureTemplateLimit` | 2 | 5 | 10 | null (unlimited) |
| `hasKanban` | false | true | true | true |
| `hasOutreachQueue` | false | true | true | true |
| `hasEmailTracking` | false | true | true | true |
| `hasLpOnboarding` | false | false | false | true |
| `hasAiFeatures` | false | false | false* | false* |
| `pipelineStages` | Lead → Contacted → Interested → Converted | Lead → Contacted → Interested → Converted | Lead → Contacted → Interested → Converted | Lead → NDA Signed → Accredited → Committed → Funded |

\* AI features are enabled via the AI CRM add-on, not by tier. See [AI CRM Add-On](#ai-crm-add-on).

**PAST_DUE subscriptions** are auto-downgraded to FREE config.

---

## Module Provisioning (Product Modules)

Source: `lib/modules/provision-engine.ts` (728 lines)

The provision engine maps CRM tiers to six `ProductModule` values. The engine uses 4 canonical tiers internally: FREE, PRO, BUSINESS, FUNDROOM (with `CRM_PRO` normalized to `PRO`).

| Module | FREE | PRO (CRM_PRO) | BUSINESS | FUNDROOM |
|--------|------|---------------|----------|----------|
| **RAISEROOM** | 1 room (MAX_ROOMS) | 5 rooms (MAX_ROOMS) | Unlimited | Unlimited |
| **SIGNSUITE** | 10/mo (MONTHLY_ESIGN) | 25/mo (MONTHLY_ESIGN) | 75/mo (MONTHLY_ESIGN) | Unlimited |
| **RAISE_CRM** | 20 contacts (MAX_CONTACTS) | Unlimited | Unlimited + analytics | Unlimited |
| **DATAROOM** | Basic | Full | Full + bulk download | Full + bulk download |
| **DOCROOMS** | Basic | Full | Full | Full |
| **FUNDROOM** | Disabled | Disabled | Disabled | Enabled (all features) |

### Usage Counting Types

| Type | Description | Enforcement |
|------|-------------|-------------|
| `MONTHLY_ESIGN` | E-signatures used this calendar month | Resets monthly via `EsigUsage` model |
| `MAX_CONTACTS` | Total CRM contacts across all teams in org | Absolute cap |
| `MAX_ROOMS` | Active raise rooms | Absolute cap |
| `MAX_STORAGE_MB` | Signer document storage (~2 MB per document estimate) | Absolute cap |

### Add-On Overrides

Add-ons can override module defaults:

| Add-On | Effect |
|--------|--------|
| `PIPELINE_IQ` | Replaces PIPELINE_IQ_LITE with full pipeline module |
| `PIPELINE_IQ_LITE_RESET` | Legacy: resets lite pipeline contact count |
| `AI_CRM` | Handled via `crm-tier.ts` AI override (see below) |

---

## SaaS Plan Capabilities (Team-Scoped)

Source: `lib/tier/resolver.ts` (494 lines)

The SaaS billing system (separate from CRM billing) uses 6 plan slugs and 10 feature plan sets. This is the **Team-scoped** tier system inherited from the Papermark codebase.

### Plan Slugs

| Slug | Display Name |
|------|-------------|
| `free` | Free |
| `pro` | Pro |
| `business` | Business |
| `datarooms` | Data Rooms |
| `datarooms-plus` | Data Rooms Plus |
| `datarooms-premium` | Data Rooms Premium |

### Feature Plan Sets

| Feature | free | pro | business | datarooms | datarooms-plus | datarooms-premium |
|---------|------|-----|----------|-----------|---------------|-------------------|
| E-signatures | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Custom branding | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Webhooks | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| NDA / agreements | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Granular permissions | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| API access | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| SSO | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| White-label | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Watermark | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Screenshot protection | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |

### Capability Flags (22 total)

The `ResolvedTier` interface exposes these capabilities:

**Free-tier features** (always available unless subscription restricted):
- `canCreateDataroom`, `canShareLinks`, `canViewAnalytics`

**Resource limits** (usage vs limits):
- `canAddDocuments`, `canAddLinks`, `canAddUsers`, `canAddDomains`

**FundRoom premium features** (require FundroomActivation + plan):
- `canSign`, `canManageFund`, `canOnboardLP`, `canTrackWire`, `canUseApprovalQueue`, `canExportFormD`

**Plan-level feature flags**:
- `canUseBranding`, `canUseCustomDomain`, `canUseWatermark`, `canUseScreenshotProtection`, `canUseWebhooks`, `canUseNDA`, `canUseGranularPermissions`, `canUseAPI`, `canUseSSO`, `canUseWhitelabel`

### Trial Users

Trial users on the free plan (`plan.includes("drtrial")`) get a reduced users limit of 3.

---

## AI CRM Add-On

Source: `lib/stripe/crm-products.ts`, `lib/tier/crm-tier.ts`

| Property | Value |
|----------|-------|
| Name | AI CRM Engine |
| Slug | `AI_CRM` |
| Monthly price | $49/mo |
| Annual price | $39/mo ($468/yr) |
| Trial | 14-day free trial |
| Requires | Active CRM_PRO, BUSINESS, or FUNDROOM subscription |

### AI CRM Overrides (applied on top of base tier)

| Override | Value |
|----------|-------|
| `hasAiFeatures` | `true` |
| `emailTemplateLimit` | `null` (unlimited) |
| `hasOutreachQueue` | `true` |

### AI CRM Features

- AI email drafts
- AI outreach sequences
- Weekly investor digest
- Contact enrichment
- Unlimited email templates

---

## Gate Enforcement Reference

Source: `lib/tier/gates.ts` (314 lines)

All gate functions return `{ allowed: boolean, error?: string, meta?: Record<string, unknown> }`.

| Gate Function | Checks | Error Code | Tier Limits |
|---------------|--------|------------|-------------|
| `checkContactLimit(orgId)` | Contact count vs `maxContacts` | `CONTACT_LIMIT_REACHED` | FREE: 20, Paid: unlimited |
| `checkEsigLimit(orgId)` | Monthly e-sig count vs `maxEsigsPerMonth` | `ESIG_LIMIT_REACHED` | FREE: 10, CRM_PRO: 25, BUSINESS: 75, FUNDROOM: unlimited |
| `incrementEsigUsage(orgId)` | Post-signature counter increment | N/A | Upserts `EsigUsage` record |
| `checkSignerStorage(orgId)` | Signer count vs `maxSignerStorage` | `SIGNER_STORAGE_LIMIT_REACHED` | FREE: 40, CRM_PRO: 100, BUSINESS: unlimited, FUNDROOM: unlimited |
| `checkFeatureAccess(orgId, feature)` | Boolean feature flag | `FEATURE_GATED` | Per-tier boolean flags |
| `getTemplateLimit(orgId)` | Email template count vs `emailTemplateLimit` | N/A (returns canCreate) | FREE: 2, CRM_PRO: 5, BUSINESS: 10, FUNDROOM: unlimited, AI_CRM: unlimited |
| `checkSignatureTemplateLimit(orgId)` | Sig template count vs `signatureTemplateLimit` | `SIGNATURE_TEMPLATE_LIMIT_REACHED` | FREE: 2, CRM_PRO: 5, BUSINESS: 10, FUNDROOM: unlimited |

### Feature Key → Tier Limit Mapping

| Feature Key | Maps To | Description |
|-------------|---------|-------------|
| `kanban` | `hasKanban` | Kanban pipeline view |
| `outreach_queue` | `hasOutreachQueue` | Outreach queue |
| `email_tracking` | `hasEmailTracking` | Email open/click tracking |
| `lp_onboarding` | `hasLpOnboarding` | LP onboarding wizard |
| `ai_features` | `hasAiFeatures` | AI drafts, insights, digest |
| `sequences` | `hasOutreachQueue` | Email sequences (alias) |
| `ai_digest` | `hasAiFeatures` | AI weekly digest (alias) |

All upgrade paths point to: `/admin/settings?tab=billing`

---

## Type Definitions & Aliases

### Three Separate `CrmSubscriptionTier` Definitions

There are **three distinct type definitions** across the codebase:

| File | Type Values | Count |
|------|-------------|-------|
| `lib/modules/provision-engine.ts` | `"FREE" \| "CRM_PRO" \| "PRO" \| "BUSINESS" \| "FUNDROOM"` | 5 |
| `lib/tier/crm-tier.ts` | `"FREE" \| "CRM_PRO" \| "BUSINESS" \| "FUNDROOM"` | 4 |
| `lib/stripe/crm-products.ts` | `"FREE" \| "CRM_PRO" \| "BUSINESS" \| "FUNDROOM"` (as `CrmPlanSlug`) | 4 |

### Tier Normalization

The provision engine normalizes tier names:

```
CRM_PRO → PRO (internal canonical form)
Unknown → FREE (fallback)
```

### SaaS Plan Slugs (Team-Scoped)

| File | Type Values |
|------|-------------|
| `lib/tier/resolver.ts` | `"free" \| "pro" \| "business" \| "datarooms" \| "datarooms-plus" \| "datarooms-premium"` |

Note: SaaS plan slugs use **lowercase**, CRM tier slugs use **UPPERCASE**.

### BUSINESS Tier — Fully Implemented

The **BUSINESS** tier ($39/$32/mo) is implemented across all layers:
- `lib/modules/provision-engine.ts` — module provisioning
- `lib/tier/crm-tier.ts` — CRM tier limits (unlimited contacts, 75 e-sigs/mo, unlimited signers, 10 templates, Kanban, outreach, email tracking)
- `lib/stripe/crm-products.ts` — Stripe product + price IDs (env-driven)
- `app/(marketing)/pricing/page.tsx` — marketing pricing page
- `docs/INVESTOR_PACKET.md` — investor-facing documentation

Added in commit `12c766d` (PR #270).
### BUSINESS Tier — RESOLVED

The **BUSINESS** tier now exists across all three CRM billing files:
- `lib/modules/provision-engine.ts` (module provisioning)
- `lib/tier/crm-tier.ts` (CRM tier limits — 75 e-sigs/mo, 10 templates, unlimited contacts/signers)
- `lib/stripe/crm-products.ts` (Stripe products — $39/mo, $32/mo annual)
- `app/(marketing)/pricing/page.tsx` (marketing pricing page)

All four tiers (FREE, CRM_PRO, BUSINESS, FUNDROOM) are fully wired end-to-end.

---

## Caching Architecture

| System | TTL | Cache Type | Invalidation |
|--------|-----|-----------|-------------|
| CRM Tier (`crm-tier.ts`) | 60 seconds | In-memory Map | `invalidateTierCache(orgId?)` |
| Module Provisioning (`provision-engine.ts`) | 60 seconds | In-memory Map | `setCachedModules()` / expiry |
| SaaS Resolver (`resolver.ts`) | 30 seconds | In-memory Map | `clearTierCache(teamId?)` |

All caches are per-process (not shared across Vercel serverless instances). Cache keys are team/org IDs.

---

## Known Discrepancies

| Issue | Status | Resolution |
|-------|--------|------------|
| FundRoom annual price | ✅ RESOLVED | Both pricing page and crm-products.ts show $63/mo annual |
| AI CRM annual price | ✅ RESOLVED | Both pricing page and crm-products.ts show $39/mo annual |
| Free signer storage | ✅ RESOLVED | Both pricing page ("40 signers storage") and crm-tier.ts (`maxSignerStorage: 40`) aligned. Unit is signer count, not MB |
| BUSINESS tier | ✅ RESOLVED | BUSINESS added to `crm-tier.ts` (75 e-sigs/mo, 10 templates, unlimited contacts/signers) and `crm-products.ts` ($39/mo, $32/mo annual) |
| CrmSubscriptionTier type | ✅ RESOLVED | `crm-tier.ts` and `crm-products.ts` both have 4 values (FREE/CRM_PRO/BUSINESS/FUNDROOM). `provision-engine.ts` has 5 (adds PRO as normalization alias for CRM_PRO) — expected |
| E-sig limits | ✅ RESOLVED | BUSINESS tier has 75/mo in crm-tier.ts, matching pricing page |
| emailTemplateLimit | ✅ RESOLVED | FUNDROOM now has `null` (unlimited) in crm-tier.ts, matching pricing page. `signatureTemplateLimit` also `null` for FUNDROOM |

---

## Stripe Product Configuration

Source: `lib/stripe/crm-products.ts`

| Product | Monthly (USD cents) | Yearly (USD cents/mo) | Price ID Env Var |
|---------|--------------------|-----------------------|-----------------|
| CRM_PRO | 2900 ($29) | 2300 ($23) | `STRIPE_CRM_PRO_MONTHLY_PRICE_ID`, `STRIPE_CRM_PRO_YEARLY_PRICE_ID` |
| BUSINESS | 3900 ($39) | 3200 ($32) | `STRIPE_BUSINESS_MONTHLY_PRICE_ID`, `STRIPE_BUSINESS_YEARLY_PRICE_ID` |
| FUNDROOM | 7900 ($79) | 6300 ($63) | `STRIPE_FUNDROOM_MONTHLY_PRICE_ID`, `STRIPE_FUNDROOM_YEARLY_PRICE_ID` |
| AI_CRM | 4900 ($49) | 3900 ($39) | `STRIPE_AI_CRM_MONTHLY_PRICE_ID`, `STRIPE_AI_CRM_YEARLY_PRICE_ID` |

Upgrade path: `FREE → CRM_PRO → BUSINESS → FUNDROOM`

Downgrade detection: `isDowngrade(from, to)` uses tier ordering: FREE=0, CRM_PRO=1, BUSINESS=2, FUNDROOM=3.

Setup script: `scripts/setup-stripe-crm-products.ts` (use `--live` flag for production).
