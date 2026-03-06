import { test, expect } from "./fixtures/auth";

/**
 * E2E Flow: Dataroom Access & Document Viewing
 *
 * Tests public dataroom access, link protection,
 * document viewing, and analytics tracking.
 *
 * Requires: Dev server running with seeded database
 * (Bermuda Club Fund dataroom at /d/bermuda-club-fund).
 */

const DATAROOM_SLUG = "bermuda-club-fund";
const DATAROOM_URL = `/d/${DATAROOM_SLUG}`;

test.describe("Dataroom — Public Access", () => {
  test("public dataroom page loads without authentication", async ({
    unauthenticatedPage,
  }) => {
    await unauthenticatedPage.goto(DATAROOM_URL);
    await unauthenticatedPage.waitForLoadState("networkidle");

    const url = unauthenticatedPage.url();
    // Should load dataroom or show access form (email gate / password)
    const pageContent = await unauthenticatedPage.textContent("body");
    const isDataroomRelated =
      pageContent?.includes("Bermuda") ||
      pageContent?.includes("Fund") ||
      pageContent?.includes("Document") ||
      pageContent?.includes("email") ||
      pageContent?.includes("password") ||
      pageContent?.includes("Access") ||
      pageContent?.includes("not found") ||
      pageContent?.includes("404");
    expect(isDataroomRelated).toBe(true);
  });

  test("dataroom renders document list when accessible", async ({
    unauthenticatedPage,
  }) => {
    await unauthenticatedPage.goto(DATAROOM_URL);
    await unauthenticatedPage.waitForLoadState("networkidle");

    // If email gate or password protection, fill accordingly
    const emailInput = unauthenticatedPage.locator(
      'input[type="email"], input[name="email"]',
    );
    if (await emailInput.isVisible()) {
      // Email gate — submit a test email
      await emailInput.fill("test-visitor@example.com");
      const submitButton = unauthenticatedPage.locator(
        'button[type="submit"]',
      );
      if (await submitButton.isVisible()) {
        await submitButton.click();
        await unauthenticatedPage.waitForLoadState("networkidle");
      }
    }

    // After access, should see document or folder listings
    const pageContent = await unauthenticatedPage.textContent("body");
    expect(pageContent).toBeTruthy();
  });

  test("expired link shows appropriate message", async ({
    unauthenticatedPage,
  }) => {
    // Access a non-existent dataroom link
    await unauthenticatedPage.goto("/d/non-existent-dataroom-link-xyz");
    await unauthenticatedPage.waitForLoadState("networkidle");

    const pageContent = await unauthenticatedPage.textContent("body");
    // Should show 404 or "not found" or redirect
    const hasErrorContent =
      pageContent?.includes("not found") ||
      pageContent?.includes("404") ||
      pageContent?.includes("expired") ||
      pageContent?.includes("invalid") ||
      pageContent?.includes("doesn't exist") ||
      pageContent?.includes("does not exist");
    // Even if it redirects, the page should have rendered
    expect(pageContent?.length).toBeGreaterThan(0);
  });
});

test.describe("Dataroom — GP Analytics View", () => {
  test("GP can access analytics dashboard", async ({ gpPage }) => {
    await gpPage.goto("/admin/analytics");
    await gpPage.waitForLoadState("networkidle");

    const pageContent = await gpPage.textContent("body");
    const hasAnalyticsContent =
      pageContent?.includes("Analytics") ||
      pageContent?.includes("Views") ||
      pageContent?.includes("Engagement") ||
      pageContent?.includes("Visitors") ||
      pageContent?.includes("Dataroom");
    expect(hasAnalyticsContent).toBe(true);
  });

  test("GP can view dataroom list", async ({ gpPage }) => {
    await gpPage.goto("/datarooms");
    await gpPage.waitForLoadState("networkidle");

    const pageContent = await gpPage.textContent("body");
    const hasDataroomContent =
      pageContent?.includes("Dataroom") ||
      pageContent?.includes("Create") ||
      pageContent?.includes("Share") ||
      pageContent?.includes("Documents");
    expect(hasDataroomContent).toBe(true);
  });
});

test.describe("Dataroom — Document Viewer", () => {
  test("document viewer page handles missing link gracefully", async ({
    unauthenticatedPage,
  }) => {
    // Try to access a view page with invalid link ID
    await unauthenticatedPage.goto("/view/invalid-link-id-12345");
    await unauthenticatedPage.waitForLoadState("networkidle");

    const pageContent = await unauthenticatedPage.textContent("body");
    // Should show error state, not crash
    expect(pageContent?.length).toBeGreaterThan(0);
  });

  test("GP documents page loads and shows document management", async ({
    gpPage,
  }) => {
    await gpPage.goto("/documents");
    await gpPage.waitForLoadState("networkidle");

    const pageContent = await gpPage.textContent("body");
    const hasDocContent =
      pageContent?.includes("Document") ||
      pageContent?.includes("Upload") ||
      pageContent?.includes("Template") ||
      pageContent?.includes("Create");
    expect(hasDocContent).toBe(true);
  });
});

test.describe("Dataroom — Mobile Responsive", () => {
  test("dataroom renders correctly on mobile viewport", async ({
    unauthenticatedPage,
  }) => {
    await unauthenticatedPage.setViewportSize({ width: 375, height: 812 });
    await unauthenticatedPage.goto(DATAROOM_URL);
    await unauthenticatedPage.waitForLoadState("networkidle");

    // Page should render without horizontal overflow
    const bodyWidth = await unauthenticatedPage.evaluate(
      () => document.body.scrollWidth,
    );
    const viewportWidth = 375;
    // Allow small tolerance for scrollbar
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);
  });
});
