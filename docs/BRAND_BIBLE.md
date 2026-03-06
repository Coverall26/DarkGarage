# FundRoom AI — Brand Bible

> Single-page quick reference for product naming, suite branding, and terminology.
> **Last Updated:** March 1, 2026

---

## Platform Name

**FundRoom AI** — Multi-tenant, security-first fund + investor operations SaaS platform.

- Marketing domain: `fundroom.ai`
- App domain: `app.fundroom.ai`
- Admin domain: `app.admin.fundroom.ai`
- Login domain: `app.login.fundroom.ai`

---

## Product Suites (v3 — Canonical Names)

| Suite | Color | Hex | Icon | Tagline | Admin Route |
|-------|-------|-----|------|---------|-------------|
| **RaiseRoom** | Cyan | `#06B6D4` | TrendingUp | Capital raise vault | `/admin/raiseroom` |
| **SignSuite** | Emerald | `#10B981` | FileSignature | Native e-signatures | `/admin/signsuite` |
| **RaiseCRM** | Amber | `#F59E0B` | Users | Investor CRM pipeline | `/admin/raise-crm` |
| **DataRoom** | Blue | `#2563EB` | FolderLock | Secure document storage & sharing | `/admin/dataroom` |
| **FundRoom** | Purple | `#8B5CF6` | Home | Full fund operations engine | `/admin/dashboard` |

### AI Agent

| Name | Color | Hex | Icon | Description |
|------|-------|-----|------|-------------|
| **Lara** | Purple | `#8B5CF6` | Sparkles | AI concierge — context-aware, tier-gated, persistent chat widget |

---

## Deprecated Names (Do NOT Use)

| Deprecated Name | Replaced By | Context |
|-----------------|-------------|---------|
| FundRoom Sign | **SignSuite** | E-signature product suite |
| FundRoom SignSuite | **SignSuite** | Redundant qualifier — just "SignSuite" |
| PipelineIQ | **RaiseCRM** | Investor CRM pipeline |
| PipelineIQ Lite | **RaiseCRM** (Free tier) | Lite version of CRM |
| InvestorIQ | **RaiseCRM** | Never shipped, abandoned name |
| DocRooms | **DataRoom** | Document vault module |
| BFFund / BF-Fund | **FundRoom AI** | Pre-rebrand platform name |

---

## Prisma Enum Mapping

| Suite | Prisma `ProductModule` | Status |
|-------|----------------------|--------|
| RaiseRoom | `RAISEROOM` | Active |
| SignSuite | `SIGNSUITE` | Active |
| RaiseCRM | `RAISE_CRM` | Active |
| DataRoom | `DATAROOM` | Active |
| FundRoom | `FUNDROOM` | Active |
| ~~DocRooms~~ | `DOCROOMS` | DEPRECATED — folded into DATAROOM |
| ~~PipelineIQ~~ | `PIPELINE_IQ` | LEGACY — replaced by RAISE_CRM |
| ~~PipelineIQ Lite~~ | `PIPELINE_IQ_LITE` | LEGACY — replaced by RAISE_CRM |

---

## Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Deep Navy | `#0A1628` | Backgrounds, headers, navigation |
| Electric Blue | `#0066FF` | Primary CTAs, links, active states |
| Success Green | `#10B981` | Success states, SignSuite accent |
| Warning Amber | `#F59E0B` | Warning states, RaiseCRM accent |
| Error Red | `#EF4444` | Error states, destructive actions |
| Light Gray | `#F3F4F6` | Page backgrounds (light mode) |

---

## Typography

| Font | Role | Weight Range |
|------|------|-------------|
| **Inter** | Primary body font | 400–700 |
| **JetBrains Mono** | Financial data, code, metrics (`font-mono tabular-nums`) | 400–700 |

---

## Naming Conventions

- **Suite names** are always capitalized as one word or two words exactly as listed above (RaiseRoom, SignSuite, RaiseCRM, DataRoom, FundRoom).
- **Lara** is always referred to by first name only — never "Lara AI" in customer-facing copy (though "Lara AI" is acceptable in internal documentation).
- **FundRoom AI** is the platform name. Individual suites do NOT carry the "AI" suffix.
- In the admin sidebar, suites are grouped with `sectionLabel` dividers between suite groups.
- Each suite uses its dedicated `activeColor` for sidebar active states (text, left border, background tint).

---

## Legal Entity

**White Label Hosting Solutions** — Parent company operating FundRoom AI.

- Copyright line: `© 2026 White Label Hosting Solutions`
- SEC compliance: All investor-facing features comply with Regulation D, ESIGN Act, and UETA.
