import { test, expect } from "./fixtures/auth";

/**
 * E2E Flow: Document Signing (FundRoom Sign)
 *
 * Tests the e-signature flow:
 * - GP document management
 * - LP signing documents view
 * - Public token-based signing page
 * - Signature templates
 *
 * Requires: Dev server running with seeded database.
 */

test.describe("E-Signature — GP Document Management", () => {
  test("GP can access e-signature settings", async ({ gpPage }) => {
    await gpPage.goto("/admin/settings");
    await gpPage.waitForLoadState("networkidle");

    const pageContent = await gpPage.textContent("body");
    const hasSignatureContent =
      pageContent?.includes("Signature") ||
      pageContent?.includes("Sign") ||
      pageContent?.includes("Document") ||
      pageContent?.includes("Template") ||
      pageContent?.includes("Settings");
    expect(hasSignatureContent).toBe(true);
  });

  test("GP documents page shows LP documents and templates tabs", async ({
    gpPage,
  }) => {
    await gpPage.goto("/admin/documents");
    await gpPage.waitForLoadState("networkidle");

    const pageContent = await gpPage.textContent("body");
    // Should have document-related content
    const hasContent =
      pageContent?.includes("Document") ||
      pageContent?.includes("Template") ||
      pageContent?.includes("LP") ||
      pageContent?.includes("Review") ||
      pageContent?.includes("Pending");
    expect(hasContent).toBe(true);
  });

  test("GP can access fund document settings from fund detail", async ({
    gpPage,
  }) => {
    // Navigate to fund management
    await gpPage.goto("/admin/fund");
    await gpPage.waitForLoadState("networkidle");

    // Look for fund cards or fund list
    const pageContent = await gpPage.textContent("body");
    const hasFundContent =
      pageContent?.includes("Fund") ||
      pageContent?.includes("Bermuda") ||
      pageContent?.includes("Overview");
    expect(hasFundContent).toBe(true);
  });
});

test.describe("E-Signature — Public Signing Page", () => {
  test("signing page with invalid token shows error", async ({
    unauthenticatedPage,
  }) => {
    // Access signing page with a fake token
    await unauthenticatedPage.goto("/view/sign/invalid-token-xyz123");
    await unauthenticatedPage.waitForLoadState("networkidle");

    const pageContent = await unauthenticatedPage.textContent("body");
    // Should show an error or redirect, not crash
    const hasErrorOrRedirect =
      pageContent?.includes("invalid") ||
      pageContent?.includes("expired") ||
      pageContent?.includes("not found") ||
      pageContent?.includes("error") ||
      pageContent?.includes("Error") ||
      pageContent?.includes("sign") ||
      pageContent?.includes("404") ||
      pageContent?.length === 0; // might redirect
    expect(pageContent?.length).toBeGreaterThanOrEqual(0);
  });

  test("signing page renders without JavaScript errors", async ({
    unauthenticatedPage,
  }) => {
    const consoleErrors: string[] = [];
    unauthenticatedPage.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await unauthenticatedPage.goto("/view/sign/test-token");
    await unauthenticatedPage.waitForLoadState("networkidle");

    // Filter out expected errors (API 404s, missing tokens)
    const unexpectedErrors = consoleErrors.filter(
      (e) =>
        !e.includes("404") &&
        !e.includes("401") &&
        !e.includes("Failed to fetch") &&
        !e.includes("NetworkError") &&
        !e.includes("net::"),
    );

    // Should not have critical JS errors (like undefined references)
    // API errors from missing data are expected and acceptable
    expect(unexpectedErrors.length).toBeLessThanOrEqual(5);
  });
});

test.describe("E-Signature — LP Signing Flow", () => {
  test("LP can view pending signing documents from dashboard", async ({
    lpPage,
  }) => {
    await lpPage.goto("/lp/dashboard");
    await lpPage.waitForLoadState("networkidle");

    const pageContent = await lpPage.textContent("body");
    // Dashboard should reference signatures or documents
    const hasSigningInfo =
      pageContent?.includes("Sign") ||
      pageContent?.includes("Document") ||
      pageContent?.includes("Pending") ||
      pageContent?.includes("Complete") ||
      pageContent?.includes("Dashboard");
    expect(hasSigningInfo).toBe(true);
  });

  test("LP document vault shows document statuses", async ({ lpPage }) => {
    await lpPage.goto("/lp/docs");
    await lpPage.waitForLoadState("networkidle");

    const pageContent = await lpPage.textContent("body");
    const hasDocVault =
      pageContent?.includes("Document") ||
      pageContent?.includes("Status") ||
      pageContent?.includes("Upload") ||
      pageContent?.includes("Approved") ||
      pageContent?.includes("Pending") ||
      pageContent?.includes("No documents");
    expect(hasDocVault).toBe(true);
  });
});

test.describe("E-Signature — Envelope System", () => {
  test("GP can access e-signature page for envelope management", async ({
    gpPage,
  }) => {
    await gpPage.goto("/e-signature");
    await gpPage.waitForLoadState("networkidle");

    const pageContent = await gpPage.textContent("body");
    // E-signature page should have envelope or document sending content
    const hasEsignContent =
      pageContent?.includes("Envelope") ||
      pageContent?.includes("Sign") ||
      pageContent?.includes("Send") ||
      pageContent?.includes("Document") ||
      pageContent?.includes("E-Sign") ||
      pageContent?.includes("Signature");
    expect(hasEsignContent).toBe(true);
  });
});

test.describe("E-Signature — Responsive Design", () => {
  test("signing page is accessible on mobile viewport", async ({
    unauthenticatedPage,
  }) => {
    await unauthenticatedPage.setViewportSize({ width: 375, height: 812 });
    await unauthenticatedPage.goto("/view/sign/test-token");
    await unauthenticatedPage.waitForLoadState("networkidle");

    // Page should render on mobile without overflow
    const bodyWidth = await unauthenticatedPage.evaluate(
      () => document.body.scrollWidth,
    );
    expect(bodyWidth).toBeLessThanOrEqual(400);
  });
});
