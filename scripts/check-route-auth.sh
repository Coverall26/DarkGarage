#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# check-route-auth.sh — Verify that every API route file has auth protection
#
# Scans app/api/ and pages/api/ route files for recognised auth patterns.
# Routes that are intentionally public (webhooks, health, auth, tracking)
# are allowlisted and skipped.
#
# Exit code 0 = all routes covered, 1 = violations found.
# ---------------------------------------------------------------------------

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ---------------------------------------------------------------------------
# Auth patterns to look for (grep -E pattern)
# ---------------------------------------------------------------------------
AUTH_PATTERNS=(
  # Standard session auth
  "getServerSession"
  "getToken"

  # RBAC middleware (Pages Router)
  "enforceRBAC"
  "requireAdmin"
  "requireGPAccess"
  "requireTeamMember"
  "requireAuth"
  "requireLPAuth"

  # RBAC middleware (App Router)
  "enforceRBACAppRouter"
  "requireAdminAppRouter"
  "requireGPAccessAppRouter"
  "requireTeamMemberAppRouter"
  "requireAuthAppRouter"
  "requireLPAuthAppRouter"

  # GP/team auth
  "authenticateGP"
  "authenticateUser"
  "withTeamAuth"
  "getUserWithRole"

  # CRM role enforcement
  "enforceCrmRole"
  "enforceCrmRoleAppRouter"

  # Tier/paywall checks
  "withTierCheck"
  "requireFundroomActive"

  # Edge middleware user context
  "getMiddlewareUser"

  # Cron/webhook secret verification
  "verifyCronAuth"
  "verifyCronSecret"
  "verifySignature"
  "validateSignature"
  "timingSafeEqual"
  "CRON_SECRET"
  "WEBHOOK_SECRET"
  "STRIPE_WEBHOOK_SECRET"
  "SVIX_SECRET"
  "INTERNAL_API_KEY"
  "REVALIDATE_TOKEN"

  # API token validation (e-signature, internal)
  "validateApiToken"
  "verifyDataroomSession"

  # QStash signature verification
  "receiver\\.verify"
  "Receiver"

  # Rate limiters (indicate protected endpoint)
  "apiRateLimiter"
  "authRateLimiter"
  "strictRateLimiter"
  "uploadRateLimiter"
  "appRouterRateLimit"
  "appRouterAuthRateLimit"
  "appRouterStrictRateLimit"
  "appRouterUploadRateLimit"
  "appRouterMfaRateLimit"

  # Delegated handler pattern (ee/ features)
  "handleRoute"
  "from \"@/ee/"

  # Jobs auth (Bearer token verification)
  "verifyToken"

  # Viewer-based auth (link viewers, signed URLs)
  "viewId"
  "verifySignedUrl"

  # Link-based document access (validates link existence/expiry)
  "fetchDataroomDocumentLinkData"
  "checkGlobalBlockList"
)

# Build a single grep -E alternation pattern
AUTH_REGEX=$(IFS='|'; echo "${AUTH_PATTERNS[*]}")

# ---------------------------------------------------------------------------
# Allowlisted path patterns (intentionally public or exempt routes)
# These match against the file path relative to REPO_ROOT.
# ---------------------------------------------------------------------------
ALLOWLIST_PATTERNS=(
  # Auth endpoints (NextAuth, magic link, registration, token exchange)
  "pages/api/auth/"
  "app/api/auth/"

  # Webhook handlers (signature-verified externally)
  "pages/api/webhooks/"
  "app/api/webhooks/"
  "pages/api/stripe/webhook"

  # Health checks
  "pages/api/health"
  "app/api/health"
  "pages/api/admin/deployment-readiness"
  "pages/api/admin/db-health"
  "app/api/admin/deployment-readiness"

  # Tracking / analytics (fire-and-forget, no PII)
  "pages/api/record_click"
  "pages/api/record_view"
  "pages/api/record_video_view"
  "app/api/record_click"
  "app/api/record_view"
  "app/api/record_video_view"
  "pages/api/record_reaction"

  # CSP violation reports (browser-sent)
  "pages/api/csp-report"
  "app/api/csp-report"

  # Public views (token-based access, not session-based)
  "pages/api/views"
  "app/api/views"
  "pages/api/views-dataroom"
  "app/api/views-dataroom"

  # Open Graph image generation
  "pages/api/og/"
  "app/api/og/"

  # Public marketplace
  "pages/api/marketplace/public"
  "app/api/marketplace/public"
  "pages/api/marketplace/waitlist"
  "app/api/marketplace/waitlist"

  # Branding (public for LP portal theming)
  "pages/api/branding/"
  "app/api/branding/"

  # Feature flags (public read)
  "pages/api/feature-flags"
  "app/api/feature-flags"

  # Help / unsubscribe
  "pages/api/help/"
  "app/api/help/"
  "pages/api/unsubscribe"
  "app/api/unsubscribe"

  # Public offering pages (investor-facing, no auth required)
  "app/api/offering/"

  # Outreach tracking pixels and unsubscribe (loaded by email clients)
  "app/api/outreach/track/"
  "app/api/outreach/unsubscribe"

  # GDPR cookie consent (public)
  "app/api/tracking/consent"

  # LP bank endpoints (Phase 2 stubs, return 503)
  "app/api/lp/bank/"

  # LP registration (public, rate-limited, bot-protected)
  "app/api/lp/register"

  # Public link access endpoints (viewer access)
  "pages/api/links/[id]/request-access"
  "pages/api/links/domains/"

  # Abuse/feedback reporting (viewer access, rate-limited)
  "pages/api/report.ts"
  "pages/api/feedback/"

  # ISR revalidation (secret-verified via REVALIDATE_TOKEN)
  "pages/api/revalidate"

  # Marketplace browse (uses authenticateUser from marketplace/auth)
  "app/api/marketplace/browse"
  "app/api/marketplace/listings"

  # Public certificate verification (validates by certificateId, no PII)
  "pages/api/sign/certificate/"
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
is_allowlisted() {
  local file="$1"
  for pattern in "${ALLOWLIST_PATTERNS[@]}"; do
    if [[ "$file" == *"$pattern"* ]]; then
      return 0
    fi
  done
  return 1
}

# ---------------------------------------------------------------------------
# Scan route files
# ---------------------------------------------------------------------------
violations=0
scanned=0
skipped=0

# App Router: route.ts files under app/api/
while IFS= read -r file; do
  rel="${file#$REPO_ROOT/}"

  if is_allowlisted "$rel"; then
    ((skipped++))
    continue
  fi

  ((scanned++))

  if ! grep -qE "$AUTH_REGEX" "$file" 2>/dev/null; then
    echo "VIOLATION: $rel — no auth pattern found"
    ((violations++))
  fi
done < <(find "$REPO_ROOT/app/api" -name "route.ts" -type f 2>/dev/null || true)

# Pages Router: .ts files directly under pages/api/ (not in __tests__)
while IFS= read -r file; do
  rel="${file#$REPO_ROOT/}"

  # Skip non-route files (utils, helpers, types)
  basename=$(basename "$file")
  if [[ "$basename" == "types.ts" || "$basename" == "index.d.ts" || "$basename" == "*.d.ts" ]]; then
    continue
  fi

  if is_allowlisted "$rel"; then
    ((skipped++))
    continue
  fi

  ((scanned++))

  if ! grep -qE "$AUTH_REGEX" "$file" 2>/dev/null; then
    echo "VIOLATION: $rel — no auth pattern found"
    ((violations++))
  fi
done < <(find "$REPO_ROOT/pages/api" -name "*.ts" -type f ! -path "*/__tests__/*" ! -path "*/node_modules/*" 2>/dev/null || true)

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Route Auth Lint Summary ==="
echo "  Scanned:    $scanned route files"
echo "  Skipped:    $skipped (allowlisted/public)"
echo "  Violations: $violations"
echo ""

if (( violations > 0 )); then
  echo "FAIL: $violations route(s) missing auth patterns."
  echo ""
  echo "Fix: Add authentication to the flagged routes, or add the path"
  echo "to the allowlist in scripts/check-route-auth.sh if intentionally public."
  exit 1
fi

echo "PASS: All scanned routes have auth patterns."
exit 0
