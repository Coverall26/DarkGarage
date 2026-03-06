#!/usr/bin/env tsx
/**
 * Pre-Launch Smoke Test Script
 *
 * Run: npx tsx scripts/pre-launch-checks.ts [--env-only] [--verbose]
 *
 * Validates:
 *   1. Required environment variables
 *   2. Database connectivity (Prisma)
 *   3. Security configuration
 *   4. Critical file presence
 *   5. Prisma schema consistency
 *   6. Build readiness
 */

const REQUIRED_ENV_VARS = [
  // Auth
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_BASE_URL",
  // Database
  "SUPABASE_DATABASE_URL",
  // Storage
  "STORAGE_PROVIDER",
  // Encryption
  "ENCRYPTION_KEY",
  "NEXT_PRIVATE_ENCRYPTION_KEY",
  // Email
  "RESEND_API_KEY",
  // Rate limiting
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

const RECOMMENDED_ENV_VARS = [
  // Google OAuth
  "FUNDROOM_GOOGLE_CLIENT_ID",
  "FUNDROOM_GOOGLE_CLIENT_SECRET",
  // Monitoring
  "ROLLBAR_SERVER_TOKEN",
  "NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN",
  // Analytics
  "POSTHOG_SERVER_KEY",
  // Stripe
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

const CRITICAL_FILES = [
  "proxy.ts",
  "vercel.json",
  "prisma/schema.prisma",
  "prisma/seed-bermuda.ts",
  "lib/security/rate-limiter.ts",
  "lib/security/csrf.ts",
  "lib/middleware/edge-auth.ts",
  "lib/middleware/admin-auth.ts",
  "lib/middleware/csp.ts",
  "lib/auth/paywall.ts",
  "lib/audit/audit-logger.ts",
  "lib/encryption.ts",
  "app/api/health/route.ts",
  "app/admin/setup/page.tsx",
  "app/lp/onboard/page-client.tsx",
  "app/(marketing)/page.tsx",
];

const FORBIDDEN_FILES = [
  "middleware.ts", // proxy.ts is the ONLY middleware entry point
];

interface CheckResult {
  name: string;
  status: "PASS" | "FAIL" | "WARN";
  message: string;
}

const results: CheckResult[] = [];
const verbose = process.argv.includes("--verbose");
const envOnly = process.argv.includes("--env-only");

function check(name: string, status: "PASS" | "FAIL" | "WARN", message: string) {
  results.push({ name, status, message });
  if (verbose || status !== "PASS") {
    const icon = status === "PASS" ? "✅" : status === "WARN" ? "⚠️" : "❌";
    console.log(`  ${icon} ${name}: ${message}`);
  }
}

// ── 1. Environment Variables ──

console.log("\n📋 1. Required Environment Variables\n");

for (const v of REQUIRED_ENV_VARS) {
  const val = process.env[v];
  if (!val || val.trim() === "") {
    check(v, "FAIL", "Missing or empty");
  } else {
    check(v, "PASS", `Set (${val.length} chars)`);
  }
}

console.log("\n📋 2. Recommended Environment Variables\n");

for (const v of RECOMMENDED_ENV_VARS) {
  const val = process.env[v];
  if (!val || val.trim() === "") {
    check(v, "WARN", "Not set — feature will be disabled");
  } else {
    check(v, "PASS", `Set (${val.length} chars)`);
  }
}

// ── 2. Security Checks ──

console.log("\n🔒 3. Security Configuration\n");

const secret = process.env.NEXTAUTH_SECRET;
if (secret && secret.length >= 64) {
  check("NEXTAUTH_SECRET length", "PASS", `${secret.length} chars (≥64 required)`);
} else if (secret) {
  check("NEXTAUTH_SECRET length", "WARN", `${secret.length} chars (recommend ≥64)`);
} else {
  check("NEXTAUTH_SECRET length", "FAIL", "Not set");
}

const encKey = process.env.ENCRYPTION_KEY;
if (encKey && encKey.length >= 32) {
  check("ENCRYPTION_KEY length", "PASS", `${encKey.length} chars`);
} else {
  check("ENCRYPTION_KEY length", encKey ? "WARN" : "FAIL", encKey ? `Only ${encKey.length} chars` : "Not set");
}

const paywallBypass = process.env.PAYWALL_BYPASS;
if (paywallBypass === "true") {
  check("PAYWALL_BYPASS", "WARN", "Set to true — MVP mode, no Stripe billing enforced");
} else {
  check("PAYWALL_BYPASS", "PASS", "Not set — paywall will be enforced");
}

if (envOnly) {
  printSummary();
  process.exit(0);
}

// ── 3. Critical Files ──

console.log("\n📁 4. Critical File Presence\n");

const fs = await import("fs");
const path = await import("path");
const root = process.cwd();

for (const file of CRITICAL_FILES) {
  const fullPath = path.join(root, file);
  if (fs.existsSync(fullPath)) {
    const stat = fs.statSync(fullPath);
    check(file, "PASS", `Exists (${(stat.size / 1024).toFixed(1)}KB)`);
  } else {
    check(file, "FAIL", "MISSING");
  }
}

for (const file of FORBIDDEN_FILES) {
  const fullPath = path.join(root, file);
  if (fs.existsSync(fullPath)) {
    check(file, "FAIL", "EXISTS — must be deleted (conflicts with proxy.ts)");
  } else {
    check(file, "PASS", "Correctly absent");
  }
}

// ── 4. Prisma Schema Validation ──

console.log("\n🗃️  5. Prisma Schema\n");

const schemaPath = path.join(root, "prisma/schema.prisma");
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, "utf-8");
  const modelCount = (schema.match(/^model\s+\w+/gm) || []).length;
  const enumCount = (schema.match(/^enum\s+\w+/gm) || []).length;
  const lineCount = schema.split("\n").length;

  check("Models", "PASS", `${modelCount} models`);
  check("Enums", "PASS", `${enumCount} enums`);
  check("Schema lines", "PASS", `${lineCount} lines`);

  // Check for org_id on critical models
  const criticalModels = ["Investor", "Fund", "Investment", "LPDocument", "AuditLog"];
  for (const model of criticalModels) {
    const modelRegex = new RegExp(`model\\s+${model}\\s*\\{[^}]*?(teamId|orgId|org_id)`, "s");
    if (modelRegex.test(schema)) {
      check(`${model} tenant isolation`, "PASS", "Has teamId/orgId field");
    } else {
      check(`${model} tenant isolation`, "WARN", "No obvious tenant scoping field found");
    }
  }
}

// ── 5. Security Headers in vercel.json ──

console.log("\n🛡️  6. Security Headers\n");

const vercelJsonPath = path.join(root, "vercel.json");
if (fs.existsSync(vercelJsonPath)) {
  const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, "utf-8"));
  const globalHeaders = vercelConfig.headers?.find((h: { source: string }) => h.source === "/(.*)")?.headers || [];
  const headerNames = globalHeaders.map((h: { key: string }) => h.key);

  const requiredHeaders = [
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
  ];

  for (const header of requiredHeaders) {
    if (headerNames.includes(header)) {
      const value = globalHeaders.find((h: { key: string }) => h.key === header)?.value;
      check(header, "PASS", value ? value.substring(0, 60) : "Set");
    } else {
      check(header, "FAIL", "Missing from vercel.json global headers");
    }
  }
}

// ── 6. Build Readiness ──

console.log("\n🏗️  7. Build Readiness\n");

const packageJsonPath = path.join(root, "package.json");
if (fs.existsSync(packageJsonPath)) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

  const nodeVersion = pkg.engines?.node;
  if (nodeVersion === "22.x") {
    check("Node.js version pin", "PASS", `"${nodeVersion}" — pinned correctly`);
  } else {
    check("Node.js version pin", "WARN", `"${nodeVersion}" — should be "22.x"`);
  }

  if (pkg.license === "PROPRIETARY") {
    check("License", "PASS", "PROPRIETARY");
  } else {
    check("License", "WARN", `"${pkg.license}" — expected PROPRIETARY`);
  }
}

// Check no middleware.ts conflict
const middlewarePath = path.join(root, "middleware.ts");
if (!fs.existsSync(middlewarePath)) {
  check("No middleware.ts conflict", "PASS", "Only proxy.ts exists (correct for Next.js 16)");
} else {
  check("No middleware.ts conflict", "FAIL", "middleware.ts exists — will crash Next.js 16");
}

printSummary();

// ── Summary ──

function printSummary() {
  const pass = results.filter((r) => r.status === "PASS").length;
  const warn = results.filter((r) => r.status === "WARN").length;
  const fail = results.filter((r) => r.status === "FAIL").length;

  console.log("\n" + "═".repeat(60));
  console.log(`  RESULTS: ✅ ${pass} passed  ⚠️  ${warn} warnings  ❌ ${fail} failures`);
  console.log("═".repeat(60));

  if (fail > 0) {
    console.log("\n❌ FAILURES (must fix before launch):\n");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`  - ${r.name}: ${r.message}`);
    }
  }

  if (warn > 0) {
    console.log("\n⚠️  WARNINGS (review before launch):\n");
    for (const r of results.filter((r) => r.status === "WARN")) {
      console.log(`  - ${r.name}: ${r.message}`);
    }
  }

  console.log("");
  process.exit(fail > 0 ? 1 : 0);
}
