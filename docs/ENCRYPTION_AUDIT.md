# FundRoom.ai — Field-Level Encryption Audit Report

**Date:** February 22, 2026
**Auditor:** Manual code review
**Scope:** All encryption implementations across `lib/`, `app/api/`, `pages/api/`

---

## Summary

**Result: PASS — All sensitive data uses AES-256-GCM encryption with env-sourced keys.**

All PII, financial data, and secrets are encrypted at rest using industry-standard AES-256-GCM. No plaintext storage of sensitive fields was found after the wire instruction fix applied during this audit.

---

## Encryption Implementations

### 1. Tax ID Encryption (SSN/EIN)

| Property | Value |
|----------|-------|
| **Algorithm** | AES-256-GCM |
| **File** | `lib/crypto/secure-storage.ts` |
| **Functions** | `encryptTaxId()`, `decryptTaxId()`, `isEncryptedTaxId()` |
| **Key Source** | `NEXT_PRIVATE_DOCUMENT_PASSWORD_KEY` (required in production) |
| **Fallback** | `NEXTAUTH_SECRET` (dev only — throws in production) |
| **Key Derivation** | SHA-256 with purpose salt `fundroom-document-encryption-v1` |
| **Format** | JSON: `{ ciphertext, iv, authTag, version }` |

**Call Sites:**
- `app/api/setup/complete/route.ts` — EIN encryption during org setup
- `app/api/admin/investors/manual-entry/route.ts` — Tax ID for manual investor entry
- `app/api/lp/investor-details/route.ts` — LP tax ID submission
- `app/api/admin/import/route.ts` — Bulk investor import
- `pages/api/investor-profile/[profileId].ts` — Profile updates (SSN, EIN, custodian EIN)

### 2. Wire Instruction Encryption

| Property | Value |
|----------|-------|
| **Algorithm** | AES-256-GCM (via `encryptTaxId`) |
| **File** | `lib/wire-transfer/instructions.ts` |
| **Fields Encrypted** | `accountNumber`, `routingNumber` |
| **Decryption** | Automatic in `getWireInstructions()` (GP view) |
| **LP View** | Decrypted then masked to last 4 digits via `getWireInstructionsPublic()` |

**Additional encryption in setup wizard:**
- `app/api/setup/complete/route.ts` — Account/routing numbers encrypted during wizard completion

### 3. Document & Signature Encryption

| Property | Value |
|----------|-------|
| **Algorithm** | AES-256-GCM |
| **File** | `lib/signature/encryption-service.ts` |
| **Functions** | `encryptSignatureImage()`, `encryptCompletedDocument()`, `storeEncryptedPassword()` |
| **Key Source** | Same as tax ID (`NEXT_PRIVATE_DOCUMENT_PASSWORD_KEY`) |
| **Audit Trail** | All operations logged to `SignatureAuditLog` |

### 4. Storage Encryption

| Property | Value |
|----------|-------|
| **Algorithm** | AES-256-GCM |
| **File** | `lib/storage/encryption/crypto-service.ts` |
| **Key Source** | `STORAGE_ENCRYPTION_KEY` (64-char hex, strictly enforced in production) |
| **Key Derivation** | HKDF with SHA-256, purpose salt `fundroom-master-key-derivation` |
| **Features** | Object-specific derived keys, versioned encryption headers |

### 5. Plaid Token Encryption

| Property | Value |
|----------|-------|
| **Algorithm** | AES-256-GCM |
| **File** | `lib/plaid.ts` |
| **Functions** | `encryptToken()`, `decryptToken()` |
| **Key Source** | `PLAID_TOKEN_ENCRYPTION_KEY` |
| **Key Derivation** | scrypt with salt |
| **Format** | `iv:authTag:encrypted` (hex-encoded) |

### 6. MFA Secret Encryption

| Property | Value |
|----------|-------|
| **Algorithm** | AES-256-GCM |
| **File** | `lib/auth/mfa.ts` |
| **Functions** | `encryptMfaSecret()`, `decryptMfaSecret()` |
| **Key Source** | `MFA_ENCRYPTION_KEY` |
| **Format** | `iv:authTag:encrypted` (hex-encoded) |
| **TOTP** | HMAC-SHA1 per RFC 6238, 6 digits, 30s window |

### 7. Organization Credential Encryption

| Property | Value |
|----------|-------|
| **Algorithm** | AES-256-GCM |
| **File** | `lib/organization/credential-service.ts` |
| **Key Source** | `STORAGE_ENCRYPTION_KEY` (64-char hex, strictly enforced) |
| **Features** | Credential rotation, integrity verification (SHA-256) |

### 8. Client-Side File Encryption

| Property | Value |
|----------|-------|
| **Algorithm** | AES-256-GCM via Web Crypto API |
| **File** | `lib/files/encrypt-file.ts` |
| **Key** | Random per file, never transmitted to server |
| **PBKDF2** | 100,000 iterations, SHA-256 |

### 9. PDF Encryption

| Property | Value |
|----------|-------|
| **Algorithm** | PDF 2.0 AES-256 |
| **File** | `lib/crypto/pdf-encryption.ts` |
| **Library** | `pdf-lib-plus-encrypt` |
| **Features** | User/owner passwords, permission controls |

---

## Verification Checklist

| Data Type | Encrypted | Algorithm | Key Env Var | Status |
|-----------|-----------|-----------|-------------|--------|
| SSN (Social Security Number) | Yes | AES-256-GCM | `NEXT_PRIVATE_DOCUMENT_PASSWORD_KEY` | ✅ |
| EIN (Employer ID Number) | Yes | AES-256-GCM | `NEXT_PRIVATE_DOCUMENT_PASSWORD_KEY` | ✅ |
| Custodian EIN | Yes | AES-256-GCM | `NEXT_PRIVATE_DOCUMENT_PASSWORD_KEY` | ✅ |
| Wire Account Number | Yes | AES-256-GCM | `NEXT_PRIVATE_DOCUMENT_PASSWORD_KEY` | ✅ |
| Wire Routing Number | Yes | AES-256-GCM | `NEXT_PRIVATE_DOCUMENT_PASSWORD_KEY` | ✅ |
| Plaid Access Tokens | Yes | AES-256-GCM | `PLAID_TOKEN_ENCRYPTION_KEY` | ✅ |
| MFA TOTP Secrets | Yes | AES-256-GCM | `MFA_ENCRYPTION_KEY` | ✅ |
| Signature Images | Yes | AES-256-GCM | `NEXT_PRIVATE_DOCUMENT_PASSWORD_KEY` | ✅ |
| Signed PDFs | Yes | AES-256-GCM | `STORAGE_ENCRYPTION_KEY` | ✅ |
| Document Passwords | Yes | AES-256-GCM | `NEXT_PRIVATE_DOCUMENT_PASSWORD_KEY` | ✅ |
| Integration API Keys | Yes | AES-256-GCM | `STORAGE_ENCRYPTION_KEY` | ✅ |
| User Passwords | Yes | bcrypt (12 rounds) | N/A (one-way hash) | ✅ |
| Auth Tokens | Yes | SHA-256 | `NEXTAUTH_SECRET` | ✅ |
| Magic Link Tokens | Yes | SHA-256 (one-way) | `NEXTAUTH_SECRET` | ✅ |

---

## Required Environment Variables for Encryption

| Env Var | Purpose | Required In Production |
|---------|---------|----------------------|
| `NEXT_PRIVATE_DOCUMENT_PASSWORD_KEY` | Tax IDs, wire instructions, signatures, documents | **Yes** (throws if missing) |
| `STORAGE_ENCRYPTION_KEY` | Storage encryption, org credentials | **Yes** (64-char hex enforced) |
| `PLAID_TOKEN_ENCRYPTION_KEY` | Plaid access tokens | Yes (when Plaid enabled) |
| `MFA_ENCRYPTION_KEY` | TOTP secrets | Yes (when MFA enabled) |
| `SIGNATURE_VERIFICATION_SECRET` | Signature checksums | Yes (HMAC verification) |
| `NEXTAUTH_SECRET` | Auth tokens, session JWTs | **Yes** |

---

## Fix Applied During This Audit

**Wire instruction encryption gap (P0):** `lib/wire-transfer/instructions.ts` was storing account numbers and routing numbers as plaintext JSON in `Fund.wireInstructions`. Fixed by adding `encryptTaxId()` on write and `decryptTaxId()` on read. The GP setup wizard (`app/api/setup/complete/route.ts`) already encrypted these fields, but the standalone wire instruction library did not.

---

## Security Properties

- **Authenticated encryption:** AES-256-GCM provides both confidentiality and integrity
- **Unique IVs:** Random 16-byte IV generated per encryption operation
- **Purpose-specific keys:** Different key derivation salts per use case prevent cross-purpose key reuse
- **Production enforcement:** Key presence validated with hard errors in production mode
- **Timing-safe comparisons:** `crypto.timingSafeEqual()` used for all hash/checksum verification
- **Audit trail:** All signature/document encryption operations logged to `SignatureAuditLog`
