#!/usr/bin/env npx ts-node
/**
 * Route Inventory Script
 * Generates a comprehensive report of all API routes in the FundRoom platform.
 *
 * Usage:
 *   npx ts-node scripts/route-inventory.ts
 *   npx ts-node scripts/route-inventory.ts --json    # JSON output
 *   npx ts-node scripts/route-inventory.ts --csv     # CSV output
 *
 * Output:
 *   - All routes, their router (App/Pages), auth method, rate limiting
 *   - Duplicate detection between routers
 *   - Migration status tracking
 */

import * as fs from "fs";
import * as path from "path";

interface RouteInfo {
  filePath: string;
  router: "Pages" | "App";
  normalizedPath: string;
  hasAuth: boolean;
  authMethod: string;
  hasRateLimit: boolean;
  rateLimitTier: string;
  isDuplicate: boolean;
  migrationStatus: "MIGRATED" | "KEEP" | "DEPRECATE" | "PENDING";
  category: string;
  lastModified: string;
}

function findFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...findFiles(fullPath, ext));
    } else if (item.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

function normalizePath(filePath: string, router: "Pages" | "App"): string {
  if (router === "Pages") {
    return filePath
      .replace(/^pages\/api\//, "")
      .replace(/\/index\.ts$/, "")
      .replace(/\.ts$/, "")
      .replace(/\.deprecated$/, "");
  }
  return filePath.replace(/^app\/api\//, "").replace(/\/route\.ts$/, "");
}

function categorizeRoute(normalizedPath: string): string {
  if (normalizedPath.startsWith("auth/")) return "Authentication";
  if (normalizedPath.startsWith("admin/")) return "Admin/GP";
  if (normalizedPath.startsWith("lp/")) return "LP Portal";
  if (normalizedPath.startsWith("teams/") && normalizedPath.includes("/datarooms/"))
    return "Dataroom";
  if (normalizedPath.startsWith("teams/") && normalizedPath.includes("/documents/"))
    return "Documents";
  if (normalizedPath.startsWith("teams/") && normalizedPath.includes("/funds/"))
    return "Fund Management";
  if (normalizedPath.startsWith("teams/") && normalizedPath.includes("/billing/"))
    return "Billing";
  if (normalizedPath.startsWith("teams/") && normalizedPath.includes("/marketplace/"))
    return "Marketplace";
  if (normalizedPath.startsWith("teams/") && normalizedPath.includes("/signature"))
    return "E-Signature";
  if (normalizedPath.startsWith("teams/")) return "Team Management";
  if (normalizedPath.startsWith("links/")) return "Link Management";
  if (normalizedPath.startsWith("sign/")) return "E-Signature";
  if (normalizedPath.startsWith("signature/")) return "E-Signature (Legacy)";
  if (normalizedPath.startsWith("esign/")) return "E-Signature (Shared Drive)";
  if (normalizedPath.startsWith("contacts/")) return "CRM Contacts";
  if (normalizedPath.startsWith("outreach/")) return "CRM Outreach";
  if (normalizedPath.startsWith("billing/")) return "CRM Billing";
  if (normalizedPath.startsWith("ai/")) return "AI Features";
  if (normalizedPath.startsWith("file/")) return "File Upload";
  if (normalizedPath.startsWith("jobs/")) return "Background Jobs";
  if (normalizedPath.startsWith("cron/")) return "Cron Jobs";
  if (normalizedPath.startsWith("webhooks/") || normalizedPath.startsWith("stripe/"))
    return "Webhooks";
  if (normalizedPath.startsWith("mupdf/")) return "PDF Processing";
  if (normalizedPath.startsWith("setup/")) return "GP Setup";
  if (normalizedPath.startsWith("marketplace/")) return "Marketplace";
  if (normalizedPath.startsWith("record_") || normalizedPath.startsWith("views"))
    return "Tracking";
  if (normalizedPath.startsWith("notifications/")) return "Notifications";
  if (normalizedPath.startsWith("conversations/")) return "Conversations";
  if (normalizedPath.startsWith("investor-profile/")) return "Investor Profile";
  if (normalizedPath.startsWith("approvals/")) return "Approvals";
  if (normalizedPath.startsWith("transactions/")) return "Transactions";
  if (normalizedPath.startsWith("tier")) return "Tier/Plan";
  if (normalizedPath.startsWith("org/")) return "Organization";
  if (normalizedPath.startsWith("offering/")) return "Offering";
  if (normalizedPath === "health" || normalizedPath === "revalidate") return "Infrastructure";
  if (normalizedPath.startsWith("branding/")) return "Branding";
  if (normalizedPath.startsWith("account")) return "Account";
  if (normalizedPath.startsWith("passkeys/")) return "Passkeys";
  if (normalizedPath.startsWith("viewer/")) return "Viewer Portal";
  if (normalizedPath.startsWith("view/")) return "View Auth";
  if (normalizedPath.startsWith("unsubscribe/")) return "Email Prefs";
  if (normalizedPath.startsWith("user/")) return "User Settings";
  if (normalizedPath.startsWith("subscriptions/")) return "Subscriptions";
  if (normalizedPath.startsWith("storage/")) return "Storage";
  return "Other";
}

function checkAuth(content: string): { hasAuth: boolean; method: string } {
  const authPatterns = [
    { pattern: /enforceRBAC|enforceRBACAppRouter/, method: "RBAC" },
    { pattern: /requireAdmin|requireAdminAppRouter/, method: "AdminRBAC" },
    { pattern: /requireTeamMember|requireTeamMemberAppRouter/, method: "TeamMember" },
    { pattern: /requireGPAccess|requireGPAccessAppRouter/, method: "GPAccess" },
    { pattern: /getServerSession/, method: "Session" },
    { pattern: /withTeamAuth/, method: "TeamAuth" },
    { pattern: /authenticateGP/, method: "GPAuth" },
    { pattern: /authenticateSigner/, method: "SignerAuth" },
    { pattern: /validateApiToken/, method: "APIToken" },
    { pattern: /verifyCronAuth|CRON_SECRET/, method: "CronSecret" },
    { pattern: /verifyStripeSignature|stripe\.webhooks\.constructEvent/, method: "StripeWebhook" },
    { pattern: /verifyPersonaSignature|persona.*hmac/i, method: "PersonaWebhook" },
    { pattern: /verifySvixSignature|svix/i, method: "SvixWebhook" },
    { pattern: /enforceCrmRole/, method: "CRMRole" },
    { pattern: /getToken\(/, method: "JWT" },
    { pattern: /viewerId|viewer.*cookie/i, method: "ViewerSession" },
  ];

  for (const { pattern, method } of authPatterns) {
    if (pattern.test(content)) {
      return { hasAuth: true, method };
    }
  }

  return { hasAuth: false, method: "NONE" };
}

function checkRateLimit(content: string): { hasRateLimit: boolean; tier: string } {
  const rlPatterns = [
    { pattern: /strictRateLimiter/, tier: "strict (3/hr)" },
    { pattern: /authRateLimiter|appRouterAuthRateLimit/, tier: "auth (10/hr)" },
    { pattern: /mfaVerifyRateLimiter|appRouterMfaRateLimit/, tier: "mfa (5/15min)" },
    { pattern: /signatureRateLimiter/, tier: "signature (5/15min)" },
    { pattern: /uploadRateLimiter|appRouterUploadRateLimit/, tier: "upload (20/min)" },
    { pattern: /apiRateLimiter|appRouterRateLimit/, tier: "api (100/min)" },
    { pattern: /registrationLimiter/, tier: "registration (5/min)" },
  ];

  for (const { pattern, tier } of rlPatterns) {
    if (pattern.test(content)) {
      return { hasRateLimit: true, tier };
    }
  }

  return { hasRateLimit: false, tier: "blanket only (200/min)" };
}

function determineMigrationStatus(
  normalizedPath: string,
  router: "Pages" | "App",
  isDuplicate: boolean,
  filePath: string,
): "MIGRATED" | "KEEP" | "DEPRECATE" | "PENDING" {
  // App Router routes are always "MIGRATED" (they are the target)
  if (router === "App") return "MIGRATED";

  // Deprecated files
  if (filePath.includes(".deprecated")) return "DEPRECATE";

  // If Pages route has App Router duplicate, it's a candidate for deprecation
  if (isDuplicate) return "DEPRECATE";

  // NextAuth catch-all must stay in Pages Router
  if (normalizedPath === "auth/[...nextauth]") return "KEEP";

  // TUS file upload handlers have special middleware requirements
  if (normalizedPath.includes("tus/")) return "KEEP";

  // Complex catch-all routes with special handling
  if (normalizedPath.includes("[[...")) return "KEEP";

  // Dataroom, document, link CRUD routes - core DataRoom functionality
  // These are complex and deeply integrated - keep for now
  if (
    normalizedPath.startsWith("teams/") &&
    (normalizedPath.includes("/datarooms/") ||
      normalizedPath.includes("/documents/") ||
      normalizedPath.includes("/folders/"))
  ) {
    return "KEEP";
  }

  // File upload handlers with special body parsing
  if (normalizedPath.startsWith("file/")) return "KEEP";

  // MuPDF processing with special binary handling
  if (normalizedPath.startsWith("mupdf/")) return "KEEP";

  // Background jobs
  if (normalizedPath.startsWith("jobs/")) return "KEEP";

  // Storage handlers
  if (normalizedPath.startsWith("storage/")) return "KEEP";

  // Webhook routes with provider-specific signature verification
  if (normalizedPath.startsWith("webhooks/")) return "KEEP";

  // Simple admin/LP routes that should migrate
  return "PENDING";
}

function main(): void {
  const rootDir = path.resolve(__dirname, "..");
  const outputFormat = process.argv.includes("--json")
    ? "json"
    : process.argv.includes("--csv")
      ? "csv"
      : "text";

  // Collect all Pages Router routes
  const pagesDir = path.join(rootDir, "pages", "api");
  const pagesFiles = findFiles(pagesDir, ".ts").map((f) => path.relative(rootDir, f));

  // Collect all App Router routes
  const appDir = path.join(rootDir, "app", "api");
  const appFiles = findFiles(appDir, ".ts")
    .filter((f) => f.endsWith("route.ts"))
    .map((f) => path.relative(rootDir, f));

  // Build normalized path sets for duplicate detection
  const appNormalized = new Set(appFiles.map((f) => normalizePath(f, "App")));
  const pagesNormalized = new Set(pagesFiles.map((f) => normalizePath(f, "Pages")));

  const routes: RouteInfo[] = [];

  // Process Pages Router routes
  for (const filePath of pagesFiles) {
    const fullPath = path.join(rootDir, filePath);
    const content = fs.readFileSync(fullPath, "utf-8");
    const normalized = normalizePath(filePath, "Pages");
    const isDuplicate = appNormalized.has(normalized);
    const { hasAuth, method: authMethod } = checkAuth(content);
    const { hasRateLimit, tier: rateLimitTier } = checkRateLimit(content);
    const stat = fs.statSync(fullPath);

    routes.push({
      filePath,
      router: "Pages",
      normalizedPath: normalized,
      hasAuth,
      authMethod,
      hasRateLimit,
      rateLimitTier,
      isDuplicate,
      migrationStatus: determineMigrationStatus(normalized, "Pages", isDuplicate, filePath),
      category: categorizeRoute(normalized),
      lastModified: stat.mtime.toISOString().split("T")[0],
    });
  }

  // Process App Router routes
  for (const filePath of appFiles) {
    const fullPath = path.join(rootDir, filePath);
    const content = fs.readFileSync(fullPath, "utf-8");
    const normalized = normalizePath(filePath, "App");
    const isDuplicate = pagesNormalized.has(normalized);
    const { hasAuth, method: authMethod } = checkAuth(content);
    const { hasRateLimit, tier: rateLimitTier } = checkRateLimit(content);
    const stat = fs.statSync(fullPath);

    routes.push({
      filePath,
      router: "App",
      normalizedPath: normalized,
      hasAuth,
      authMethod,
      hasRateLimit,
      rateLimitTier,
      isDuplicate,
      migrationStatus: "MIGRATED",
      category: categorizeRoute(normalized),
      lastModified: stat.mtime.toISOString().split("T")[0],
    });
  }

  // Generate stats
  const pagesRoutes = routes.filter((r) => r.router === "Pages");
  const appRoutes = routes.filter((r) => r.router === "App");
  const duplicates = routes.filter((r) => r.isDuplicate);
  const noAuth = routes.filter((r) => !r.hasAuth);
  const noRateLimit = routes.filter((r) => !r.hasRateLimit);

  const statusCounts = {
    MIGRATED: routes.filter((r) => r.migrationStatus === "MIGRATED").length,
    KEEP: routes.filter((r) => r.migrationStatus === "KEEP").length,
    DEPRECATE: routes.filter((r) => r.migrationStatus === "DEPRECATE").length,
    PENDING: routes.filter((r) => r.migrationStatus === "PENDING").length,
  };

  const categoryCounts: Record<string, number> = {};
  for (const r of routes) {
    categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
  }

  if (outputFormat === "json") {
    console.log(
      JSON.stringify(
        {
          generated: new Date().toISOString(),
          summary: {
            totalRoutes: routes.length,
            pagesRouter: pagesRoutes.length,
            appRouter: appRoutes.length,
            duplicates: duplicates.length / 2,
            noAuth: noAuth.length,
            statusCounts,
            categoryCounts,
          },
          routes,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (outputFormat === "csv") {
    console.log(
      "filePath,router,normalizedPath,hasAuth,authMethod,hasRateLimit,rateLimitTier,isDuplicate,migrationStatus,category,lastModified",
    );
    for (const r of routes) {
      console.log(
        `"${r.filePath}","${r.router}","${r.normalizedPath}",${r.hasAuth},"${r.authMethod}",${r.hasRateLimit},"${r.rateLimitTier}",${r.isDuplicate},"${r.migrationStatus}","${r.category}","${r.lastModified}"`,
      );
    }
    return;
  }

  // Text output
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  FUNDROOM API ROUTE INVENTORY");
  console.log(`  Generated: ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("SUMMARY");
  console.log("───────────────────────────────────────────────────────────");
  console.log(`  Total routes:      ${routes.length}`);
  console.log(`  Pages Router:      ${pagesRoutes.length}`);
  console.log(`  App Router:        ${appRoutes.length}`);
  console.log(`  Duplicates:        ${duplicates.length / 2} pairs`);
  console.log(`  Without per-route auth: ${noAuth.length} (covered by edge middleware)`);
  console.log(`  Without per-route RL:   ${noRateLimit.length} (covered by blanket 200/min)\n`);

  console.log("MIGRATION STATUS");
  console.log("───────────────────────────────────────────────────────────");
  console.log(`  MIGRATED (in App Router):  ${statusCounts.MIGRATED}`);
  console.log(`  KEEP (stay in Pages):      ${statusCounts.KEEP}`);
  console.log(`  DEPRECATE (remove):        ${statusCounts.DEPRECATE}`);
  console.log(`  PENDING (to migrate):      ${statusCounts.PENDING}\n`);

  console.log("CATEGORIES");
  console.log("───────────────────────────────────────────────────────────");
  const sortedCategories = Object.entries(categoryCounts).sort(([, a], [, b]) => b - a);
  for (const [cat, count] of sortedCategories) {
    console.log(`  ${cat.padEnd(30)} ${count}`);
  }

  console.log("\n\nDUPLICATE ROUTES (exist in both routers)");
  console.log("───────────────────────────────────────────────────────────");
  const dupPaths = new Set<string>();
  for (const r of duplicates) {
    if (!dupPaths.has(r.normalizedPath)) {
      dupPaths.add(r.normalizedPath);
      console.log(`  /api/${r.normalizedPath}`);
    }
  }

  console.log("\n\nPENDING MIGRATION (Pages routes to move to App Router)");
  console.log("───────────────────────────────────────────────────────────");
  const pending = routes.filter((r) => r.migrationStatus === "PENDING");
  for (const r of pending) {
    console.log(`  ${r.filePath.padEnd(70)} [${r.category}]`);
  }

  console.log("\n\nDEPRECATE (Pages routes to remove after verification)");
  console.log("───────────────────────────────────────────────────────────");
  const deprecate = routes.filter((r) => r.migrationStatus === "DEPRECATE");
  for (const r of deprecate) {
    console.log(`  ${r.filePath.padEnd(70)} [dup: ${r.isDuplicate}]`);
  }

  console.log("\n\nKEEP (Pages routes staying for now)");
  console.log("───────────────────────────────────────────────────────────");
  const keep = routes.filter((r) => r.migrationStatus === "KEEP");
  for (const r of keep) {
    console.log(`  ${r.filePath.padEnd(70)} [${r.category}]`);
  }

  console.log(
    "\n\nNO PER-ROUTE AUTH (relies on edge middleware blanket protection only)",
  );
  console.log("───────────────────────────────────────────────────────────");
  for (const r of noAuth) {
    console.log(`  ${r.filePath.padEnd(70)} [${r.category}]`);
  }
}

main();
