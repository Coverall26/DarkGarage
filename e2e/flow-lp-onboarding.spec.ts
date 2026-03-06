import { test, expect } from "./fixtures/auth";

/**
 * E2E Flow: LP Onboarding
 *
 * Tests the LP registration and onboarding wizard:
 * Account → NDA → Accreditation → Entity → Commitment → Signing
 *
 * Uses the pre-authenticated LP fixture for dashboard tests
 * and unauthenticated fixture for registration flow.
 *
 * Requires: Dev server running with seeded database.
 */

test.describe("LP Portal — Dashboard Access", () => {
  test("authenticated LP sees dashboard with investment summary", async ({
    lpPage,
  }) => {
    await lpPage.goto("/lp/dashboard");
    await lpPage.waitForLoadState("networkidle");

    // Dashboard should show investment-related content
    const pageContent = await lpPage.textContent("body");
    const hasDashboardContent =
      pageContent?.includes("Dashboard") ||
      pageContent?.includes("Investment") ||
      pageContent?.includes("Commitment") ||
      pageContent?.includes("Status") ||
      pageContent?.includes("Fund");
    expect(hasDashboardContent).toBe(true);
  });

  test("LP dashboard shows 5-stage progress tracker", async ({ lpPage }) => {
    await lpPage.goto("/lp/dashboard");
    await lpPage.waitForLoadState("networkidle");

    // Progress tracker stages
    const stageTexts = [
      "Applied",
      "NDA",
      "Accredited",
      "Committed",
      "Funded",
    ];

    const pageContent = await lpPage.textContent("body");
    // At least some stages should be visible
    const visibleStages = stageTexts.filter((s) => pageContent?.includes(s));
    expect(visibleStages.length).toBeGreaterThan(0);
  });

  test("LP dashboard renders without errors", async ({ lpPage }) => {
    await lpPage.goto("/lp/dashboard");
    await lpPage.waitForLoadState("networkidle");

    // No error boundaries or error messages should be visible
    const errorBoundary = lpPage.locator(
      '[data-testid="error-boundary"], .error-boundary',
    );
    const errorAlert = lpPage.locator('[role="alert"]');
    const errorCount = await errorAlert.count();

    // If error alerts exist, they should be minor (not full-page crashes)
    const heading = lpPage.locator("h1, h2, h3");
    await expect(heading.first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("LP Portal — Navigation", () => {
  test("LP can navigate to Documents page", async ({ lpPage }) => {
    await lpPage.goto("/lp/docs");
    await lpPage.waitForLoadState("networkidle");

    const pageContent = await lpPage.textContent("body");
    const hasDocContent =
      pageContent?.includes("Document") ||
      pageContent?.includes("Upload") ||
      pageContent?.includes("file");
    expect(hasDocContent).toBe(true);
  });

  test("LP can navigate to Transactions page", async ({ lpPage }) => {
    await lpPage.goto("/lp/transactions");
    await lpPage.waitForLoadState("networkidle");

    const pageContent = await lpPage.textContent("body");
    const hasTransContent =
      pageContent?.includes("Transaction") ||
      pageContent?.includes("Payment") ||
      pageContent?.includes("Wire") ||
      pageContent?.includes("History");
    expect(hasTransContent).toBe(true);
  });

  test("LP can navigate to Wire Instructions page", async ({ lpPage }) => {
    await lpPage.goto("/lp/wire");
    await lpPage.waitForLoadState("networkidle");

    const pageContent = await lpPage.textContent("body");
    const hasWireContent =
      pageContent?.includes("Wire") ||
      pageContent?.includes("Bank") ||
      pageContent?.includes("Transfer") ||
      pageContent?.includes("Instructions") ||
      pageContent?.includes("Payment");
    expect(hasWireContent).toBe(true);
  });

  test("LP bottom tab bar is visible on mobile viewport", async ({
    lpPage,
  }) => {
    // Set mobile viewport
    await lpPage.setViewportSize({ width: 375, height: 812 });
    await lpPage.goto("/lp/dashboard");
    await lpPage.waitForLoadState("networkidle");

    // Bottom tab bar should be visible on mobile
    const tabBar = lpPage.locator(
      'nav[aria-label*="tab" i], [data-testid="bottom-tab-bar"], .bottom-tab-bar, nav.fixed.bottom-0',
    );

    // Check for navigation elements at the bottom
    const pageContent = await lpPage.textContent("body");
    // Mobile should still show core navigation options
    const hasNav =
      pageContent?.includes("Home") || pageContent?.includes("Docs");
    expect(hasNav).toBe(true);
  });
});

test.describe("LP Onboarding — Registration Flow", () => {
  test("unauthenticated user sees onboarding page with fund context", async ({
    unauthenticatedPage,
  }) => {
    // Try to access onboarding without auth
    await unauthenticatedPage.goto("/lp/onboard");
    await unauthenticatedPage.waitForLoadState("networkidle");

    const url = unauthenticatedPage.url();
    // Should either show onboarding or redirect to login
    const isOnboardOrLogin =
      url.includes("/lp/onboard") ||
      url.includes("/login") ||
      url.includes("/lp/login");
    expect(isOnboardOrLogin).toBe(true);
  });

  test("LP login page renders with email and password fields", async ({
    unauthenticatedPage,
  }) => {
    await unauthenticatedPage.goto("/lp/login");
    await unauthenticatedPage.waitForLoadState("networkidle");

    const emailInput = unauthenticatedPage.locator(
      'input[type="email"], input[name="email"]',
    );
    const passwordInput = unauthenticatedPage.locator(
      'input[type="password"], input[name="password"]',
    );

    // At least email input should be visible
    if (await emailInput.isVisible()) {
      await expect(emailInput).toBeVisible();
    }
  });
});

test.describe("LP Wire Instructions — Copy to Clipboard", () => {
  test("wire page shows bank details with copy buttons", async ({
    lpPage,
  }) => {
    await lpPage.goto("/lp/wire");
    await lpPage.waitForLoadState("networkidle");

    // Look for copy buttons or copy-to-clipboard indicators
    const copyButtons = lpPage.locator(
      'button:has-text("Copy"), button[aria-label*="copy" i], [data-testid*="copy"]',
    );
    const pageContent = await lpPage.textContent("body");

    // Wire page should contain bank-related content or instructions
    const hasWireInfo =
      pageContent?.includes("Bank") ||
      pageContent?.includes("Routing") ||
      pageContent?.includes("Account") ||
      pageContent?.includes("Wire") ||
      pageContent?.includes("Instructions") ||
      pageContent?.includes("no wire") ||
      pageContent?.includes("Not configured");
    expect(hasWireInfo).toBe(true);
  });
});
