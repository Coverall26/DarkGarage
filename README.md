# FundRoom AI

[![Tests](https://github.com/Darkroom4/darkroom/actions/workflows/test.yml/badge.svg)](https://github.com/Darkroom4/darkroom/actions/workflows/test.yml)
[![Deploy](https://github.com/Darkroom4/darkroom/actions/workflows/production.yml/badge.svg)](https://github.com/Darkroom4/darkroom/actions/workflows/production.yml)

Multi-tenant fund operations platform for GPs and LPs. Secure document sharing, native e-signatures, investor onboarding, wire confirmation, and SEC compliance — all in one place.

## Platform Overview

### GP (Fund Manager) Tools
- **9-step Setup Wizard** — Company info, branding, raise style (GP Fund / Startup / Dataroom Only), team invites, fund details, LP onboarding config, integrations, and launch
- **Investor Pipeline** — 7-stage pipeline (Applied → Funded), approval queue with inline editing, manual investor entry, bulk import
- **Fund Management** — Mode-aware dashboards (GP Fund / Startup / Dataroom Only), financial aggregates, tranche pricing, capital tracking
- **Document Review** — Approve/reject/request-revision on LP documents, GP upload on behalf of LP, side-by-side comparison
- **Wire Confirmation** — Confirm wire receipts, review proof-of-payment uploads, auto-advance investor stages
- **Reports & Analytics** — Pipeline distribution, conversion funnels, Form D export, engagement scoring, dataroom analytics
- **Settings Center** — 21 sections across 7 tabs with per-section save, settings inheritance (System → Org → Team → Fund), team CRUD

### LP (Investor) Portal
- **Guided Onboarding** — Account → NDA → Accreditation → Entity Details → Commitment → Document Signing → Verification
- **7 Entity Types** — Individual, Joint, Trust/Estate, LLC/Corporation, Partnership, IRA/Retirement, Charity/Foundation with SEC-compliant accreditation criteria per type
- **Dashboard** — Investment status, document vault, transaction history, 5-stage progress tracker
- **Wire Transfers** — Wire instructions with copy-to-clipboard, proof-of-payment upload, status tracking

### Product Suites

FundRoom is organized into 5 branded product modules, each with a dedicated suite color:

| Suite | Color | Purpose |
|-------|-------|---------|
| **RaiseRoom** | Cyan (#06B6D4) | Capital raise management — pipeline, offering pages, fund overview |
| **SignSuite** | Emerald (#10B981) | Native e-signature — envelopes, templates, field placement, NDA gate |
| **RaiseCRM** | Amber (#F59E0B) | Contact pipeline — Kanban, engagement scoring, outreach, AI insights |
| **DataRoom** | Blue (#2563EB) | Secure document filing — org vault, contact vaults, activity log |
| **FundRoom** | Purple (#8B5CF6) | Full platform — all modules combined |

### RaiseRoom (Capital Raise Vault)
- 4-tab dashboard: Overview, Pipeline, Documents, Activity
- Raise progress bar with investor stats and quick actions
- Pipeline visualization (6 stages: Applied → Funded)
- Fund details with Reg D exemption, offering page status, NDA Gate via SignSuite
- Fund selector for multi-fund organizations

### SignSuite (Native E-Signature)
- Split-screen signing: PDF viewer + auto-filled investor fields + signature capture (draw/type/upload)
- Sequential, parallel, and mixed signing modes
- Standalone envelope compose flow — send to any email, not just onboarded LPs
- Template library with merge field preview and usage meter
- 16 field types, document filing to org vault and contact vaults
- NDA gate integration for dataroom links (real e-signature, not checkbox)
- ESIGN/UETA compliance with SHA-256 audit trail

### RaiseCRM (Contact Pipeline)
- **4-tier model** — FREE (20 contacts, 10 e-sig/mo) → CRM_PRO ($29/mo) → FUNDROOM ($79/mo) → AI CRM add-on ($49/mo)
- FREE tier: simplified contact list + frosted Kanban overlay; paid tiers: full Kanban drag-drop
- Contact pipeline with engagement scoring (Hot/Warm/Cool), AI insights
- Outreach center with sequences, templates, bulk send, CAN-SPAM compliance
- 3-level CRM roles (Viewer / Contributor / Manager)

### DataRoom (Secure Folders)
- 3-tab dashboard: Filed Documents, Contact Vaults, Activity Log
- Virtual folder tree navigation (Signed Documents/YYYY-MM structure)
- Storage meter showing usage per destination (org vault, contact vaults, email)
- Contact vault management with 90-day magic link access
- Manual upload dialog with source type classification
- Document filing audit trail with SHA-256 content hashing

### SEC Compliance
- Regulation D exemptions: Rule 506(b), 506(c), Reg A+, Rule 504
- Accredited investor verification with entity-type-specific criteria
- Form D data capture and export (OMB 3235-0076)
- Bad Actor 506(d) certification
- 8 SEC investor representations
- Immutable SHA-256 hash-chained audit log

### Dataroom (Public Sharing)
- Secure document sharing with custom links and policies
- Password protection, expiry, download/print controls, watermark
- Per-link accreditation gate (self-certification, qualified purchaser, accredited only)
- Per-link SignSuite NDA gate (real e-signature requirement)
- Engagement scoring and page-by-page analytics
- Custom domain support

### Marketing Pages
- **Homepage** (`app/(marketing)/page.tsx`, 548 lines) — 9-section landing page: Hero with gradient text, Stats bar (4 metrics), 6 feature cards, 5 branded product suite cards (RaiseRoom/SignSuite/RaiseCRM/DataRoom/FundRoom with per-suite colors), Lara AI concierge section, competitor comparison table (5 tools replaced), 4-stage investor lifecycle timeline, How It Works (3 steps), Trust section with CTA
- **Pricing Page** — Four-tier pricing grid (Free $0, CRM Pro $29/mo, FundRoom $79/mo, Enterprise custom), feature comparison, FAQ accordion, annual discount toggle
- **Security Page** — AES-256 encryption, SOC 2 readiness, RBAC, audit logging, infrastructure details
- **Terms of Service** — Service description, user obligations, IP rights, liability, termination
- **Privacy Policy** — GDPR/CCPA-aligned with data collection, usage, sharing, retention, rights
- **Marketing Layout** (139 lines) — Shared nav with Pricing/Security/Docs links, mobile hamburger menu, 4-column footer grid, SEC disclaimer, White Label Hosting Solutions copyright
- **SEO** — Next.js Metadata API (OpenGraph, Twitter cards), JSON-LD Schema.org Organization structured data

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router + Pages Router) |
| UI | React 19, Tailwind CSS, shadcn/ui |
| Database | PostgreSQL (Supabase), Prisma ORM |
| Auth | NextAuth.js (email/password, Google OAuth, magic links) |
| Email | Resend (platform + org-branded) |
| E-Signature | SignSuite (native, zero external cost) |
| Billing | Stripe (CRM subscriptions + marketplace) |
| Analytics | PostHog, Rollbar, Vercel Analytics |
| Storage | AWS S3, Cloudflare R2, Vercel Blob |
| KYC/AML | Persona (Phase 2) |
| CI/CD | GitHub Actions, Vercel |

## Architecture

```
app/                          # Next.js App Router
├── admin/                    # GP dashboard, setup wizard, settings
├── api/                      # App Router API routes (277 routes)
├── lp/                       # LP portal (dashboard, docs, wire, onboarding)
├── view/                     # Public document/dataroom viewer
├── (auth)/                   # Auth pages
└── (marketing)/              # Public marketing pages (homepage, pricing, security, terms, privacy)

pages/api/                    # Pages Router API routes (257 routes)

components/                   # React components
├── admin/                    # GP dashboard, pipeline, sidebar
├── crm/                      # CRM contacts, kanban, outreach
├── esign/                    # SignSuite consolidated signing
├── lp/                       # LP portal components
├── onboarding/               # LP onboarding steps
└── ui/                       # shadcn/ui primitives

lib/                          # Shared utilities
├── auth/                     # RBAC, paywall, CRM roles, getMiddlewareUser
├── audit/                    # Immutable audit logging
├── esign/                    # Envelope service, field types, filing
├── middleware/                # Edge auth, route classification, cron auth
├── security/                 # Rate limiting (7 tiers), bot protection
├── tier/                     # CRM tier resolution + pay gates
└── prisma.ts                 # Database client

prisma/
├── schema.prisma             # 140 models, 90 enums, 5,869 lines
└── migrations/               # 34 migrations
```

## Development

### Prerequisites
- Node.js 22+
- PostgreSQL database
- Required API keys (see `.env.example`)

### Setup

```bash
npm install
npx prisma db push
npx prisma db seed          # Seeds demo tenant
npm run dev
```

### Testing

```bash
npm test                     # Run all tests
npm run test:coverage        # With coverage
```

238 test files — all passing.

### Environment Variables

See `.env.example` for the complete list. Key variables:

```env
SUPABASE_DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://app.fundroom.ai
RESEND_API_KEY=...
STRIPE_SECRET_KEY=...
ROLLBAR_SERVER_TOKEN=...
```

See [docs/ENV_VARS.md](docs/ENV_VARS.md) for the full reference (~200 variables across 20 categories).

## Deployment

Deployed on Vercel with host-based middleware routing for multi-tenant domain handling.

| Domain | Purpose |
|--------|---------|
| `app.fundroom.ai` | Main application |
| `app.login.fundroom.ai` | Standard login |
| `app.admin.fundroom.ai` | Admin-only login |

Health check: `GET /api/health`

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full deployment guide.

## Security

- **Authentication** — NextAuth.js with JWT sessions, edge middleware enforcement on ALL API routes (5-layer defense-in-depth), RBAC
- **Rate Limiting** — 7-tier system from blanket (200/min) to strict (3/hr), Redis-backed with in-memory fallback
- **Encryption** — AES-256-GCM for sensitive data (SSN, EIN, API keys, wire instructions, Plaid tokens, MFA secrets). See [docs/ENCRYPTION_AUDIT.md](docs/ENCRYPTION_AUDIT.md) for the full field-level encryption audit
- **Multi-tenant Isolation** — Every query scoped by teamId/orgId, edge middleware blocks cross-tenant access
- **Audit Trail** — Immutable SHA-256 hash-chained log for SEC 506(c) compliance
- **Security Headers** — HSTS, CSP, X-Frame-Options, Permissions-Policy
- **Secret Scanning** — Enable GitHub secret scanning and push protection in repository Settings → Code security and analysis. All API keys should be rotated if they ever appeared in git history. See [docs/SECRETS_AUDIT.md](docs/SECRETS_AUDIT.md) for the full secrets audit

See [SECURITY.md](SECURITY.md) for vulnerability reporting and security architecture.

### Demo Credentials

For demo/staging credentials, all passwords are configured via environment variables (`GP_SEED_PASSWORD`, `LP_SEED_PASSWORD`, `ADMIN_SEED_PASSWORD`). See `.env.example` for the full list. **Never commit real passwords, API keys, or tokens.**

## Payment Architecture

| Service | Purpose |
|---------|---------|
| Manual Wire | Capital movements (wire instructions + proof upload + GP confirmation) |
| Stripe | CRM billing (FREE / CRM_PRO / FUNDROOM + AI add-on) |
| Plaid ACH | Capital calls and distributions (Phase 2) |

## Documentation

| Document | Description |
|----------|-------------|
| [CLAUDE.md](CLAUDE.md) | System prompt, implementation status, build notes |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, data flows, multi-tenant design |
| [docs/SEC_COMPLIANCE.md](docs/SEC_COMPLIANCE.md) | Regulation D, accreditation, Form D, audit trail |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel deployment, env vars, health checks |
| [docs/ENV_VARS.md](docs/ENV_VARS.md) | Complete environment variable reference |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | API route index (~500 routes) |
| [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md) | Database setup, migrations, seeding |
| [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) | Pre-launch verification checklist |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Operational runbook (12 procedures) |
| [docs/BRAND_BIBLE.md](docs/BRAND_BIBLE.md) | Platform naming conventions, v3 suite names, deprecated name mapping |
| [docs/TIER_MATRIX.md](docs/TIER_MATRIX.md) | 4-tier CRM subscription matrix, module provisioning, gate enforcement |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development guide, conventions, PR process |
| [SECURITY.md](SECURITY.md) | Security policy, vulnerability reporting |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

## CI/CD

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | Push to main, PRs | Tests, linting, type-checking |
| `production.yml` | Main branch push | Vercel production deploy |
| `preview.yml` | Pull requests | PR preview deployments |
| `integration.yml` | Weekly schedule | Sandbox API tests |

## License

Proprietary. All rights reserved. See [LICENSE](LICENSE) for details.
