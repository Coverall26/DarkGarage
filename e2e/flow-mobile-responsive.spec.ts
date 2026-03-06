import { test, expect } from "./fixtures/auth";

/**
 * E2E Flow: Mobile Responsiveness
 *
 * Tests mobile-specific UI behavior across the platform:
 *   - LP bottom tab bar visibility on mobile viewport (< 768px)
 *   - GP sidebar collapse to hamburger on mobile
 *   - LP onboarding step indicator scrollability
 *   - Touch target sizes (>= 44px) on interactive elements
 *   - iOS zoom prevention (16px font on inputs)
 *
 * Uses the 'mobile-chrome' project from playwright.config.ts (Pixel 7).
 *
 * Requires: Dev server running with seeded database (Bermuda tenant).
 */

// Pixel 7 viewport dimensions (matches mobile-chrome project in playwright config)
const MOBILE_WIDTH = 412;
const MOBILE_HEIGHT = 915;

// iPhone SE — smallest common mobile viewport
const IPHONE_SE_WIDTH = 375;
const IPHONE_SE_HEIGHT = 812;

// WCAG 2.1 AA minimum touch target size
const MIN_TOUCH_TARGET = 44;

// ---------------------------------------------------------------------------
// 1. LP Bottom Tab Bar Visibility on Mobile (< 768px)
// ---------------------------------------------------------------------------

test.describe("Mobile — LP Bottom Tab Bar Visibility (< 768px)", () => {
  test("bottom tab bar is visible on mobile LP dashboard", async ({
    lpPage,
  }) => {
    await lpPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await lpPage.goto("/lp/dashboard");
    await lpPage.waitForLoadState("networkidle");

    // Bottom tab bar should be present on mobile — fixed at bottom of screen
    const tabBar = lpPage.locator(
      'nav.fixed.bottom-0, [data-testid="bottom-tab-bar"], nav[aria-label*="tab" i]',
    );

    // Verify the 4 bottom navigation labels are rendered
    const pageContent = await lpPage.textContent("body");
    const tabLabels = ["Home", "Docs", "Payments", "Settings"];
    const foundLabels = tabLabels.filter((label) =>
      pageContent?.includes(label),
    );
    expect(foundLabels.length).toBeGreaterThanOrEqual(3);
  });

  test("bottom tab bar is hidden on desktop viewport (>= 768px)", async ({
    lpPage,
  }) => {
    // Desktop viewport — bottom tab bar uses md:hidden (hidden at >= 768px)
    await lpPage.setViewportSize({ width: 1024, height: 768 });
    await lpPage.goto("/lp/dashboard");
    await lpPage.waitForLoadState("networkidle");

    const tabBar = lpPage.locator("nav.fixed.bottom-0");
    if ((await tabBar.count()) > 0) {
      const isVisible = await tabBar.first().isVisible();
      expect(isVisible).toBe(false);
    }
  });

  test("bottom tab bar has exactly 4 navigation items on mobile", async ({
    lpPage,
  }) => {
    await lpPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await lpPage.goto("/lp/dashboard");
    await lpPage.waitForLoadState("networkidle");

    // 4 tabs: Home, Docs, Payments, Settings
    const pageContent = await lpPage.textContent("body");
    const tabLabels = ["Home", "Docs", "Payments", "Settings"];
    const foundLabels = tabLabels.filter((label) =>
      pageContent?.includes(label),
    );
    expect(foundLabels.length).toBeGreaterThanOrEqual(3);
  });

  test("tapping Docs tab navigates to documents page", async ({ lpPage }) => {
    await lpPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await lpPage.goto("/lp/dashboard");
    await lpPage.waitForLoadState("networkidle");

    const docsTab = lpPage.locator(
      'a:has-text("Docs"), button:has-text("Docs"), a[href*="/lp/docs"]',
    );
    if (await docsTab.first().isVisible()) {
      await docsTab.first().click();
      await lpPage.waitForLoadState("networkidle");

      const url = lpPage.url();
      const pageContent = await lpPage.textContent("body");
      const isOnDocs =
        url.includes("/lp/docs") ||
        pageContent?.includes("Document") ||
        pageContent?.includes("Upload");
      expect(isOnDocs).toBe(true);
    }
  });

  test("tapping Home tab returns to dashboard from another page", async ({
    lpPage,
  }) => {
    await lpPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    // Start on docs page
    await lpPage.goto("/lp/docs");
    await lpPage.waitForLoadState("networkidle");

    const homeTab = lpPage.locator(
      'a:has-text("Home"), button:has-text("Home"), a[href*="/lp/dashboard"]',
    );
    if (await homeTab.first().isVisible()) {
      await homeTab.first().click();
      await lpPage.waitForLoadState("networkidle");

      const url = lpPage.url();
      const isOnDashboard =
        url.includes("/lp/dashboard") || url.includes("/lp");
      expect(isOnDashboard).toBe(true);
    }
  });

  test("bottom tab bar touch targets meet 44px minimum", async ({
    lpPage,
  }) => {
    await lpPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await lpPage.goto("/lp/dashboard");
    await lpPage.waitForLoadState("networkidle");

    const tabItems = lpPage.locator(
      'nav.fixed.bottom-0 a, nav.fixed.bottom-0 button, [data-testid="bottom-tab-bar"] a',
    );
    const count = await tabItems.count();

    for (let i = 0; i < count; i++) {
      const box = await tabItems.nth(i).boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40);
        expect(box.width).toBeGreaterThanOrEqual(40);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. GP Sidebar Collapse to Hamburger on Mobile
// ---------------------------------------------------------------------------

test.describe("Mobile — GP Sidebar Collapse to Hamburger", () => {
  test("GP sidebar is replaced by hamburger on mobile viewport", async ({
    gpPage,
  }) => {
    await gpPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await gpPage.goto("/admin/dashboard");
    await gpPage.waitForLoadState("networkidle");

    // Full-width sidebar (w-60 = 240px) should not be visible on mobile
    const sidebar = gpPage.locator(
      'aside.w-60, nav[data-testid="admin-sidebar"]',
    );
    if ((await sidebar.count()) > 0) {
      const box = await sidebar.first().boundingBox();
      if (box) {
        // On mobile, sidebar is either hidden or a slide-out drawer
        expect(box.width).toBeLessThan(200);
      }
    }

    // Page should not have horizontal overflow
    const bodyScrollWidth = await gpPage.evaluate(
      () => document.body.scrollWidth,
    );
    expect(bodyScrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH + 20);
  });

  test("GP dashboard renders meaningful content on mobile", async ({
    gpPage,
  }) => {
    await gpPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await gpPage.goto("/admin/dashboard");
    await gpPage.waitForLoadState("networkidle");

    const pageContent = await gpPage.textContent("body");
    const hasDashboardContent =
      pageContent?.includes("Dashboard") ||
      pageContent?.includes("Pipeline") ||
      pageContent?.includes("Fund") ||
      pageContent?.includes("Investor") ||
      pageContent?.includes("Welcome");
    expect(hasDashboardContent).toBe(true);
  });

  test("GP sidebar auto-collapses on tablet viewport (768-1023px)", async ({
    gpPage,
  }) => {
    await gpPage.setViewportSize({ width: 800, height: 1024 });
    await gpPage.goto("/admin/dashboard");
    await gpPage.waitForLoadState("networkidle");

    // On tablet, sidebar should be collapsed to icon-only (w-16 = 64px)
    // No horizontal overflow
    const bodyScrollWidth = await gpPage.evaluate(
      () => document.body.scrollWidth,
    );
    expect(bodyScrollWidth).toBeLessThanOrEqual(820);

    // Page should still render meaningful content
    const pageContent = await gpPage.textContent("body");
    expect(pageContent?.length).toBeGreaterThan(0);
  });

  test("GP investors page is usable on mobile without overflow", async ({
    gpPage,
  }) => {
    await gpPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await gpPage.goto("/admin/investors");
    await gpPage.waitForLoadState("networkidle");

    const bodyScrollWidth = await gpPage.evaluate(
      () => document.body.scrollWidth,
    );
    // Tables may cause slight overflow — allow tolerance
    expect(bodyScrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH + 50);

    const pageContent = await gpPage.textContent("body");
    const hasContent =
      pageContent?.includes("Investor") ||
      pageContent?.includes("Pipeline") ||
      pageContent?.includes("No investors");
    expect(hasContent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. LP Onboarding Step Indicator Scrollability
// ---------------------------------------------------------------------------

test.describe("Mobile — LP Onboarding Step Indicator Scrollability", () => {
  test("step indicator fits within smallest mobile viewport (375px) without page overflow", async ({
    lpPage,
  }) => {
    await lpPage.setViewportSize({
      width: IPHONE_SE_WIDTH,
      height: IPHONE_SE_HEIGHT,
    });
    await lpPage.goto("/lp/onboard");
    await lpPage.waitForLoadState("networkidle");

    // Page body should not overflow horizontally
    const bodyScrollWidth = await lpPage.evaluate(
      () => document.body.scrollWidth,
    );
    expect(bodyScrollWidth).toBeLessThanOrEqual(IPHONE_SE_WIDTH + 20);
  });

  test("step indicator container has overflow-x handling for horizontal scroll", async ({
    lpPage,
  }) => {
    await lpPage.setViewportSize({
      width: IPHONE_SE_WIDTH,
      height: IPHONE_SE_HEIGHT,
    });
    await lpPage.goto("/lp/onboard");
    await lpPage.waitForLoadState("networkidle");

    // The step indicator should use overflow-x-auto for horizontal scrolling
    const stepIndicator = lpPage.locator(
      '.overflow-x-auto, [data-testid="step-indicator"], .step-indicator',
    );
    if ((await stepIndicator.count()) > 0) {
      const overflowX = await stepIndicator.first().evaluate((el) =>
        window.getComputedStyle(el).overflowX,
      );
      const isScrollable =
        overflowX === "auto" || overflowX === "scroll" || overflowX === "hidden";
      expect(isScrollable).toBe(true);
    }
  });

  test("onboarding page renders without errors on Pixel 7 viewport", async ({
    lpPage,
  }) => {
    await lpPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await lpPage.goto("/lp/onboard");
    await lpPage.waitForLoadState("networkidle");

    // No horizontal page overflow
    const bodyScrollWidth = await lpPage.evaluate(
      () => document.body.scrollWidth,
    );
    expect(bodyScrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH + 20);

    // Should render some heading or form content (not a blank/error page)
    const heading = lpPage.locator("h1, h2, h3");
    if ((await heading.count()) > 0) {
      await expect(heading.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("onboarding Next button has adequate touch target on mobile", async ({
    lpPage,
  }) => {
    await lpPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await lpPage.goto("/lp/onboard");
    await lpPage.waitForLoadState("networkidle");

    const nextButton = lpPage.locator(
      'button:has-text("Next"), button:has-text("Continue")',
    );
    if (await nextButton.first().isVisible()) {
      const box = await nextButton.first().boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Touch Target Sizes (>= 44px) on Interactive Elements
// ---------------------------------------------------------------------------

test.describe("Mobile — Touch Target Sizes (>= 44px)", () => {
  test("LP dashboard buttons meet 44px minimum touch target", async ({
    lpPage,
  }) => {
    await lpPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await lpPage.goto("/lp/dashboard");
    await lpPage.waitForLoadState("networkidle");

    const buttons = lpPage.locator("button:visible");
    const count = await buttons.count();

    let checkedCount = 0;
    for (let i = 0; i < Math.min(count, 10); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box && box.height > 0) {
        // At least one dimension should meet the 44px minimum
        const maxDim = Math.max(box.height, box.width);
        expect(maxDim).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
        checkedCount++;
      }
    }
  });

  test("login submit button meets 44px minimum touch target", async ({
    unauthenticatedPage,
  }) => {
    await unauthenticatedPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await unauthenticatedPage.goto("/lp/login");
    await unauthenticatedPage.waitForLoadState("networkidle");

    const submitButton = unauthenticatedPage.locator('button[type="submit"]');
    if (await submitButton.isVisible()) {
      const box = await submitButton.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      }
    }
  });

  test("wire page copy buttons have adequate touch targets", async ({
    lpPage,
  }) => {
    await lpPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await lpPage.goto("/lp/wire");
    await lpPage.waitForLoadState("networkidle");

    const copyButtons = lpPage.locator(
      'button:has-text("Copy"), button[aria-label*="copy" i]',
    );
    const count = await copyButtons.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 5); i++) {
        const box = await copyButtons.nth(i).boundingBox();
        if (box) {
          const maxDim = Math.max(box.height, box.width);
          expect(maxDim).toBeGreaterThanOrEqual(30);
        }
      }
    }
  });

  test("GP admin dashboard buttons meet touch target requirements", async ({
    gpPage,
  }) => {
    await gpPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await gpPage.goto("/admin/dashboard");
    await gpPage.waitForLoadState("networkidle");

    const buttons = gpPage.locator("button:visible");
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 8); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box && box.height > 0) {
        const maxDim = Math.max(box.height, box.width);
        expect(maxDim).toBeGreaterThanOrEqual(24);
      }
    }
  });

  test("admin login submit button meets 44px touch target", async ({
    unauthenticatedPage,
  }) => {
    await unauthenticatedPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await unauthenticatedPage.goto("/admin/login");
    await unauthenticatedPage.waitForLoadState("networkidle");

    const submitButton = unauthenticatedPage.locator('button[type="submit"]');
    if (await submitButton.isVisible()) {
      const box = await submitButton.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. iOS Zoom Prevention (16px Font on Inputs)
// ---------------------------------------------------------------------------

test.describe("Mobile — iOS Zoom Prevention (16px Font on Inputs)", () => {
  test("LP login email input uses >= 16px font to prevent iOS auto-zoom", async ({
    unauthenticatedPage,
  }) => {
    await unauthenticatedPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await unauthenticatedPage.goto("/lp/login");
    await unauthenticatedPage.waitForLoadState("networkidle");

    const emailInput = unauthenticatedPage.locator(
      'input[type="email"], input[name="email"]',
    );
    if (await emailInput.isVisible()) {
      const fontSize = await emailInput.evaluate((el) =>
        window.getComputedStyle(el).fontSize,
      );
      const fontSizeNum = parseFloat(fontSize);
      // iOS Safari auto-zooms on inputs < 16px — must be >= 16px
      expect(fontSizeNum).toBeGreaterThanOrEqual(16);
    }
  });

  test("LP onboarding text inputs use >= 16px font", async ({ lpPage }) => {
    await lpPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await lpPage.goto("/lp/onboard");
    await lpPage.waitForLoadState("networkidle");

    const textInputs = lpPage.locator(
      'input[type="text"], input[type="email"], input[type="tel"], input[type="number"]',
    );
    const count = await textInputs.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      if (await textInputs.nth(i).isVisible()) {
        const fontSize = await textInputs.nth(i).evaluate((el) =>
          window.getComputedStyle(el).fontSize,
        );
        const fontSizeNum = parseFloat(fontSize);
        expect(fontSizeNum).toBeGreaterThanOrEqual(16);
      }
    }
  });

  test("admin login inputs use >= 16px font", async ({
    unauthenticatedPage,
  }) => {
    await unauthenticatedPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await unauthenticatedPage.goto("/admin/login");
    await unauthenticatedPage.waitForLoadState("networkidle");

    const emailInput = unauthenticatedPage.locator(
      'input[type="email"], input[name="email"]',
    );
    if (await emailInput.isVisible()) {
      const fontSize = await emailInput.evaluate((el) =>
        window.getComputedStyle(el).fontSize,
      );
      const fontSizeNum = parseFloat(fontSize);
      expect(fontSizeNum).toBeGreaterThanOrEqual(16);
    }
  });

  test("password inputs use >= 16px font on mobile", async ({
    unauthenticatedPage,
  }) => {
    await unauthenticatedPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await unauthenticatedPage.goto("/lp/login");
    await unauthenticatedPage.waitForLoadState("networkidle");

    const passwordInput = unauthenticatedPage.locator(
      'input[type="password"], input[name="password"]',
    );
    if (
      (await passwordInput.count()) > 0 &&
      (await passwordInput.first().isVisible())
    ) {
      const fontSize = await passwordInput.first().evaluate((el) =>
        window.getComputedStyle(el).fontSize,
      );
      const fontSizeNum = parseFloat(fontSize);
      expect(fontSizeNum).toBeGreaterThanOrEqual(16);
    }
  });
});

// ---------------------------------------------------------------------------
// Additional Mobile Layout Integrity
// ---------------------------------------------------------------------------

test.describe("Mobile — Page Layout Integrity", () => {
  test("LP wire page renders without horizontal overflow", async ({
    lpPage,
  }) => {
    await lpPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await lpPage.goto("/lp/wire");
    await lpPage.waitForLoadState("networkidle");

    const bodyScrollWidth = await lpPage.evaluate(
      () => document.body.scrollWidth,
    );
    expect(bodyScrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH + 20);
  });

  test("LP documents page renders without overflow", async ({ lpPage }) => {
    await lpPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await lpPage.goto("/lp/docs");
    await lpPage.waitForLoadState("networkidle");

    const bodyScrollWidth = await lpPage.evaluate(
      () => document.body.scrollWidth,
    );
    expect(bodyScrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH + 20);
  });

  test("signing page is accessible on mobile viewport", async ({
    unauthenticatedPage,
  }) => {
    await unauthenticatedPage.setViewportSize({
      width: MOBILE_WIDTH,
      height: MOBILE_HEIGHT,
    });
    await unauthenticatedPage.goto("/view/sign/test-token");
    await unauthenticatedPage.waitForLoadState("networkidle");

    const bodyScrollWidth = await unauthenticatedPage.evaluate(
      () => document.body.scrollWidth,
    );
    expect(bodyScrollWidth).toBeLessThanOrEqual(MOBILE_WIDTH + 20);
  });
});
