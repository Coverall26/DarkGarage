# FundRoom.ai — Secrets Audit Report

**Date:** February 22, 2026
**Auditor:** Automated scan + manual review
**Scope:** All `.ts`, `.tsx`, `.js`, `.mjs` files (excluding `node_modules/`, `.next/`, `__tests__/`)

---

## Summary

**Result: PASS — No exposed secrets found in source code.**

All credentials, API keys, and encryption material are sourced from environment variables via `process.env.*`. No hardcoded secrets are committed to the repository.

---

## Scans Performed

| Scan | Pattern | Result |
|------|---------|--------|
| Stripe API keys | `sk_live_*`, `sk_test_*`, `pk_live_*`, `pk_test_*` | CLEAN — no matches |
| Resend API keys | `re_[a-zA-Z0-9]{20,}` | CLEAN — no matches |
| Webhook secrets | `whsec_*` | SAFE — only code that generates/validates webhook secret prefixes (not hardcoded values) |
| Bearer tokens | `Bearer [a-zA-Z0-9_-]{20,}` | CLEAN — no hardcoded tokens |
| Hardcoded passwords | `password[:=] "value"` (excluding env refs) | CLEAN — no matches |
| Private keys | `BEGIN RSA`, `BEGIN EC`, `PRIVATE KEY`, `BEGIN CERTIFICATE` | CLEAN — no matches |
| JWT tokens | `eyJ[a-zA-Z0-9_-]{30,}` | CLEAN — no hardcoded JWTs |
| Hardcoded API keys | `api_key[:=] "value"` (excluding env refs) | CLEAN — no matches |
| Hardcoded secrets | `secret[:=] "value"` (excluding env refs) | CLEAN — no matches |
| Committed .env files | `.env`, `.env.local`, `.env.production` | CLEAN — only `.env.example` tracked by git |
| Encryption keys | `ENCRYPTION_KEY`, `MASTER_KEY` (excluding env refs) | CLEAN — all sourced from `process.env.*` |
| AWS access keys | `AKIA*`, `ASIA*` (IAM key patterns) | CLEAN — no matches |

---

## Credential Management

### Seed Scripts
All demo credentials in `prisma/seed-bermuda.ts` use the `process.env.VAR || "fallback"` pattern:
- `GP_SEED_PASSWORD` — GP demo account password
- `LP_SEED_PASSWORD` — LP demo account password
- `ADMIN_SEED_PASSWORD` — Admin account password

Fallback defaults are only used in local development when env vars are not set.

### E2E Test Fixtures
`e2e/fixtures/auth.ts` uses the same env var pattern for test credentials.

### Documentation
All documentation files (`CLAUDE.md`, `replit.md`, `LAUNCH_CHECKLIST.md`, `DATABASE_SETUP.md`) reference env var names instead of actual credential values.

---

## .gitignore Coverage

The following sensitive files are excluded from version control:
- `.env` — local environment variables
- `.env*.local` — local overrides
- `*.pem` — TLS certificates and private keys
- `.vercel` — Vercel deployment config
- `.posthog` — PostHog CLI config

---

## Encryption Architecture

All sensitive data encryption uses environment-sourced keys:

| Purpose | Env Var | Algorithm |
|---------|---------|-----------|
| Tax IDs (SSN/EIN) | `DOCUMENT_ENCRYPTION_SALT` | AES-256 |
| Wire instructions | `STORAGE_ENCRYPTION_KEY` | AES-256 |
| Plaid tokens | `PLAID_TOKEN_ENCRYPTION_KEY` | AES-256 via scrypt |
| Document passwords | `NEXT_PRIVATE_DOCUMENT_PASSWORD_KEY` | AES-256 |
| MFA secrets | `MFA_ENCRYPTION_KEY` | HMAC-SHA256 |
| Signature verification | `SIGNATURE_VERIFICATION_SALT` | SHA-256 |
| Auth token hashing | `AUTH_TOKEN_HASHING_SALT` | HKDF |

---

## Recommendations

1. **GitHub Secret Scanning:** Enable in repository settings (Settings → Code security → Secret scanning). This is a GitHub-provided feature that automatically detects committed secrets.
2. **GitHub Push Protection:** Enable push protection to block pushes containing detected secrets.
3. **Periodic audits:** Run this scan before each release or quarterly at minimum.
4. **Rotate credentials:** If any credential is suspected of exposure, rotate immediately via the provider dashboard and update Vercel env vars.

---

## GitHub Secret Scanning Setup

To enable on the `Darkroom4/darkroom` repository:

1. Go to **Settings → Code security and analysis**
2. Enable **Secret scanning** (alerts)
3. Enable **Push protection** (blocks commits containing secrets)
4. Enable **Secret scanning for partners** (notifies API providers of exposed keys)

These features are available on GitHub Enterprise and public repositories. For private repos on Team/Enterprise plans, they're included at no extra cost.
