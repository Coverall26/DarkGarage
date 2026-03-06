# FundRoom AI — Help Center Plan

> **Status:** Phase 2 (post-launch)
> **Owner:** Product
> **Last Updated:** March 1, 2026

---

## 1. Overview

A self-service help center for GPs, LPs, and platform administrators. Reduces support load, improves onboarding completion rates, and satisfies SEC documentation requirements for investor education.

---

## 2. Architecture

| Component | Technology | Notes |
|-----------|-----------|-------|
| Content CMS | Markdown files in `/docs/help/` | Version-controlled, PR-reviewed |
| Search | Client-side full-text (Fuse.js) | No external service needed for V1 |
| Route | `/help` (public), `/admin/help` (GP) | Shared content, role-aware navigation |
| AI Integration | Lara AI chat widget | Context-aware answers sourced from help articles |

---

## 3. Content Categories

### GP Articles (Fund Managers)
| Category | Articles | Priority |
|----------|----------|----------|
| Getting Started | Account setup, first fund, invite team | P0 |
| Fund Management | Create fund, set economics, close rounds | P0 |
| Investor Pipeline | Add investors, approval queue, stage management | P0 |
| Wire Transfers | Configure instructions, confirm receipts, reconcile | P0 |
| E-Signatures (SignSuite) | Upload docs, place fields, send for signing, bulk send | P1 |
| Dataroom | Create rooms, manage access, analytics | P1 |
| CRM (RaiseCRM) | Contacts, sequences, engagement scoring | P1 |
| Billing | Plans, upgrade/downgrade, invoices | P1 |
| Settings | Organization, branding, team roles, integrations | P2 |
| Compliance | SEC exemptions, Form D, accreditation methods | P2 |

### LP Articles (Investors)
| Category | Articles | Priority |
|----------|----------|----------|
| Getting Started | Accept invite, complete onboarding | P0 |
| Signing Documents | NDA, subscription agreement, side letters | P0 |
| Wire Transfer | View instructions, upload proof | P0 |
| Dashboard | View investment status, documents, transactions | P1 |
| Profile | Update entity info, accreditation, address | P2 |

### Platform Admin Articles
| Category | Articles | Priority |
|----------|----------|----------|
| Tenant Management | Create orgs, manage activations | P1 |
| Platform Settings | Paywall, maintenance mode, registration | P1 |
| Monitoring | Health checks, deployment readiness, audit logs | P2 |

---

## 4. Article Template

```markdown
# [Article Title]

**Suite:** [RaiseRoom | SignSuite | RaiseCRM | DataRoom | FundRoom]
**Role:** [GP | LP | Admin]
**Difficulty:** [Beginner | Intermediate | Advanced]

## Overview
Brief description of what this article covers.

## Prerequisites
- List of things the user needs before starting

## Steps
1. Step one with screenshot placeholder
2. Step two with screenshot placeholder

## Common Issues
- Issue → Resolution

## Related Articles
- [Link to related article]
```

---

## 5. Lara AI Integration

When Lara receives a question matching help center content:
1. Search help articles by keyword (Fuse.js index)
2. Return relevant article summary + link
3. If no match, fall back to intent-based canned response (V1) or Claude API (V2)

**Implementation:** Add `helpArticles` context to `/api/lara/chat` route. Lara checks article index before intent detection.

---

## 6. Implementation Phases

### Phase 2A: Foundation (Post-Launch Week 2-3)
- [ ] Create `/app/(marketing)/help/` route with layout
- [ ] Build article renderer (Markdown → React)
- [ ] Add Fuse.js client-side search
- [ ] Write P0 GP articles (8-10 articles)
- [ ] Write P0 LP articles (3-4 articles)

### Phase 2B: Polish (Post-Launch Week 4-6)
- [ ] Add breadcrumb navigation
- [ ] Add "Was this helpful?" feedback widget
- [ ] Write P1 articles (10-12 articles)
- [ ] Wire Lara AI to article search
- [ ] Add contextual help tooltips in admin UI

### Phase 2C: Scale (Post-Launch Month 2-3)
- [ ] Write P2 articles (8-10 articles)
- [ ] Video walkthroughs for complex flows
- [ ] Localization support (if needed)
- [ ] Analytics: most-viewed articles, search miss rate
- [ ] Community forum consideration

---

## 7. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Support ticket reduction | 30% decrease | Compare pre/post help center launch |
| Onboarding completion rate | 85%+ | Track LP wizard completion with help center available |
| Article helpfulness | 80%+ positive | "Was this helpful?" widget feedback |
| Search success rate | 70%+ | Searches that result in article click |
| Lara AI deflection | 40%+ | Questions answered by article reference vs escalation |

---

## 8. Content Guidelines

- **Tone:** Professional but approachable. Use "you" for the reader.
- **Length:** 300-800 words per article. Break longer content into multiple articles.
- **Screenshots:** Required for UI-dependent steps. Use 2x resolution, annotate with arrows/highlights.
- **Updates:** Review all articles on each major release. Mark stale articles for revision.
- **Legal review:** All compliance/SEC articles must be reviewed by legal counsel before publishing.
