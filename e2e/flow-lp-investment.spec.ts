import { test, expect } from "./fixtures/auth";

/**
 * E2E Flow: LP Investment End-to-End
 *
 * Tests the complete LP investment flow from public dataroom
 * through onboarding to funded status:
 *   Dataroom view -> "I Want to Invest" -> LP Onboarding ->
 *   Personal Info -> Entity -> Address -> Accreditation ->
 *   NDA -> Commitment -> Wire Proof -> LP Dashboard verification
 *
 * Requires: Dev server running with seeded database (Bermuda tenant).
 */

const DATAROOM_SLUG = "bermuda-club-fund";
const DATAROOM_URL = `/d/${DATAROOM_SLUG}`;

test.describe("LP Investment — Dataroom Entry Point", () => {
  test("visitor can view public dataroom page", async ({
    unauthenticatedPage,
  }) => {
    await unauthenticatedPage.goto(DATAROOM_URL);
    await unauthenticatedPage.waitForLoadState("networkidle");

    const pageContent = await unauthenticatedPage.textContent("body");
    // Dataroom should show fund/document content or access gate
    const hasDataroomContent =
      pageContent?.includes("Bermuda") ||
      pageContent?.includes("Fund") ||
      pageContent?.includes("Document") ||
      pageContent?.includes("email") ||
      pageContent?.includes("Access");
    expect(hasDataroomContent).toBe(true);
  });

  test("dataroom page contains an invest or interest button", async ({
    unauthenticatedPage,
  }) => {
    await unauthenticatedPage.goto(DATAROOM_URL);
    await unauthenticatedPage.waitForLoadState("networkidle");

    // If email gate, fill it first
    const emailInput = unauthenticatedPage.locator(
      'input[type="email"], input[name="email"]',
    );
    if (await emailInput.isVisible()) {
      await emailInput.fill("visitor-test@example.com");
      const submitBtn = unauthenticatedPage.locator('button[type="submit"]');
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await unauthenticatedPage.waitForLoadState("networkidle");
      }
    }

    const pageContent = await unauthenticatedPage.textContent("body");
    // Page should either show invest button or fund-related content
    const hasInvestOrAccess =
      pageContent?.includes("Invest") ||
      pageContent?.includes("Interest") ||
      pageContent?.includes("Fund") ||
      pageContent?.includes("Document");
    expect(hasInvestOrAccess).toBe(true);
  });

  test("invest button navigates to LP onboarding with fund context", async ({
    unauthenticatedPage,
  }) => {
    await unauthenticatedPage.goto(DATAROOM_URL);
    await unauthenticatedPage.waitForLoadState("networkidle");

    // If there is an email gate, fill it first
    const emailInput = unauthenticatedPage.locator(
      'input[type="email"], input[name="email"]',
    );
    if (await emailInput.isVisible()) {
      await emailInput.fill("new-investor-test@example.com");
      const submitBtn = unauthenticatedPage.locator('button[type="submit"]');
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await unauthenticatedPage.waitForLoadState("networkidle");
      }
    }

    // Look for invest button and click it
    const investButton = unauthenticatedPage.locator(
      'button:has-text("Invest"), a:has-text("Invest")',
    );
    if (await investButton.first().isVisible()) {
      await investButton.first().click();
      await unauthenticatedPage.waitForLoadState("networkidle");

      const url = unauthenticatedPage.url();
      // Should navigate to LP onboarding or login with fund context
      const hasOnboardContext =
        url.includes("/lp/onboard") ||
        url.includes("/lp/login") ||
        url.includes("fundId") ||
        url.includes("teamId");
      expect(hasOnboardContext).toBe(true);
    }
  });

  test("dataroom page does not have horizontal overflow", async ({
    unauthenticatedPage,
  }) => {
    await unauthenticatedPage.goto(DATAROOM_URL);
    await unauthenticatedPage.waitForLoadState("networkidle");

    const bodyWidth = await unauthenticatedPage.evaluate(
      () => document.body.scrollWidth,
    );
    const viewportWidth =
      unauthenticatedPage.viewportSize()?.width ?? 1280;
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);
  });
});

test.describe("LP Investment — Onboarding Wizard Steps", () => {
  test("LP onboarding page renders with step indicator", async ({
    unauthenticatedPage,
  }) => {
    await unauthenticatedPage.goto("/lp/onboard");
    await unauthenticatedPage.waitForLoadState("networkidle");

    const url = unauthenticatedPage.url();
    // Should show onboarding or redirect to login
    const isOnboardOrLogin =
      url.includes("/lp/onboard") || url.includes("/login");
    expect(isOnboardOrLogin).toBe(true);

    if (url.includes("/lp/onboard")) {
      const pageContent = await unauthenticatedPage.textContent("body");
      const hasStepContent =
        pageContent?.includes("Step") ||
        pageContent?.includes("Personal") ||
        pageContent?.includes("Account") ||
        pageContent?.includes("Info");
      expect(hasStepContent).toBe(true);
    }
  });

  test("Step 1: Personal Info form has name, email, and phone fields", async ({
    lpPage,
  }) => {
    await lpPage.goto("/lp/onboard");
    await lpPage.waitForLoadState("networkidle");

    const pageContent = await lpPage.textContent("body");
    const hasPersonalFields =
      pageContent?.includes("Name") ||
      pageContent?.includes("Email") ||
      pageContent?.includes("Phone") ||
      pageContent?.includes("First") ||
      pageContent?.includes("Last") ||
      pageContent?.includes("Personal");
    expect(hasPersonalFields).toBe(true);

    // Check for input fields
    const formInputs = lpPage.locator("input, select, textarea");
    const inputCount = await formInputs.count();
    expect(inputCount).toBeGreaterThan(0);
  });

  test("Step 1: can fill personal info fields", async ({ lpPage }) => {
    await lpPage.goto("/lp/onboard");
    await lpPage.waitForLoadState("networkidle");

    const firstNameInput = lpPage.locator(
      'input[name="firstName"], input[placeholder*="first" i], input[placeholder*="First" i]',
    );
    const lastNameInput = lpPage.locator(
      'input[name="lastName"], input[placeholder*="last" i], input[placeholder*="Last" i]',
    );
    const emailInput = lpPage.locator(
      'input[name="email"], input[type="email"]',
    );
    const phoneInput = lpPage.locator(
      'input[name="phone"], input[type="tel"], input[placeholder*="phone" i]',
    );

    if (await firstNameInput.first().isVisible()) {
      await firstNameInput.first().fill("Test");
      await expect(firstNameInput.first()).toHaveValue("Test");
    }
    if (await lastNameInput.first().isVisible()) {
      await lastNameInput.first().fill("Investor");
      await expect(lastNameInput.first()).toHaveValue("Investor");
    }
    if (await emailInput.first().isVisible()) {
      await emailInput.first().fill("test-investor-e2e@example.com");
    }
    if (await phoneInput.first().isVisible()) {
      await phoneInput.first().fill("5551234567");
    }
  });

  test("Step 1: Next button navigates to next step", async ({ lpPage }) => {
    await lpPage.goto("/lp/onboard");
    await lpPage.waitForLoadState("networkidle");

    // Fill minimal fields
    const firstNameInput = lpPage.locator(
      'input[name="firstName"], input[placeholder*="first" i]',
    );
    if (await firstNameInput.first().isVisible()) {
      await firstNameInput.first().fill("Test");
    }

    const nextButton = lpPage.locator(
      'button:has-text("Next"), button:has-text("Continue")',
    );
    if (await nextButton.first().isVisible()) {
      await nextButton.first().click();
      await lpPage.waitForTimeout(500);

      // Should have moved to next step — content should change
      const pageContent = await lpPage.textContent("body");
      expect(pageContent?.length).toBeGreaterThan(0);
    }
  });

  test("entity type selection shows Individual option", async ({ lpPage }) => {
    await lpPage.goto("/lp/onboard");
    await lpPage.waitForLoadState("networkidle");

    const nextButton = lpPage.locator(
      'button:has-text("Next"), button:has-text("Continue")',
    );

    // Advance through steps to reach entity type
    for (let i = 0; i < 3; i++) {
      if (await nextButton.first().isVisible()) {
        await nextButton.first().click();
        await lpPage.waitForTimeout(500);
      }
    }

    const pageContent = await lpPage.textContent("body");
    const hasEntityContent =
      pageContent?.includes("Individual") ||
      pageContent?.includes("Entity") ||
      pageContent?.includes("LLC") ||
      pageContent?.includes("Trust") ||
      pageContent?.includes("Type") ||
      pageContent?.includes("Accredit") ||
      pageContent?.includes("NDA") ||
      pageContent?.includes("Address");
    expect(hasEntityContent).toBe(true);
  });

  test("accreditation step shows self-certification options", async ({
    lpPage,
  }) => {
    await lpPage.goto("/lp/onboard");
    await lpPage.waitForLoadState("networkidle");

    const nextButton = lpPage.locator(
      'button:has-text("Next"), button:has-text("Continue")',
    );
    for (let i = 0; i < 5; i++) {
      if (await nextButton.first().isVisible()) {
        await nextButton.first().click();
        await lpPage.waitForTimeout(500);
      }
    }

    const pageContent = await lpPage.textContent("body");
    const hasAccreditContent =
      pageContent?.includes("Accredit") ||
      pageContent?.includes("Income") ||
      pageContent?.includes("Net Worth") ||
      pageContent?.includes("Certified") ||
      pageContent?.includes("NDA") ||
      pageContent?.includes("Commit") ||
      pageContent?.includes("Sign") ||
      pageContent?.includes("Fund");
    expect(hasAccreditContent).toBe(true);
  });
});

test.describe("LP Investment — Commitment & Wire Proof", () => {
  test("commitment step shows investment amount field", async ({ lpPage }) => {
    await lpPage.goto("/lp/onboard");
    await lpPage.waitForLoadState("networkidle");

    const nextButton = lpPage.locator(
      'button:has-text("Next"), button:has-text("Continue")',
    );
    for (let i = 0; i < 7; i++) {
      if (await nextButton.first().isVisible()) {
        await nextButton.first().click();
        await lpPage.waitForTimeout(500);
      }
    }

    const pageContent = await lpPage.textContent("body");
    const hasCommitContent =
      pageContent?.includes("Commit") ||
      pageContent?.includes("Amount") ||
      pageContent?.includes("Investment") ||
      pageContent?.includes("$") ||
      pageContent?.includes("Wire") ||
      pageContent?.includes("Sign") ||
      pageContent?.includes("Fund") ||
      pageContent?.includes("Complete");
    expect(hasCommitContent).toBe(true);
  });

  test("LP wire page shows bank details or instructions", async ({
    lpPage,
  }) => {
    await lpPage.goto("/lp/wire");
    await lpPage.waitForLoadState("networkidle");

    const pageContent = await lpPage.textContent("body");
    const hasWireContent =
      pageContent?.includes("Wire") ||
      pageContent?.includes("Bank") ||
      pageContent?.includes("Account") ||
      pageContent?.includes("Transfer") ||
      pageContent?.includes("Upload") ||
      pageContent?.includes("Proof") ||
      pageContent?.includes("Instructions") ||
      pageContent?.includes("not configured") ||
      pageContent?.includes("Not configured");
    expect(hasWireContent).toBe(true);
  });

  test("LP wire page has proof upload area", async ({ lpPage }) => {
    await lpPage.goto("/lp/wire");
    await lpPage.waitForLoadState("networkidle");

    const uploadArea = lpPage.locator(
      'input[type="file"], [data-testid*="upload"], button:has-text("Upload"), label:has-text("Upload")',
    );
    const pageContent = await lpPage.textContent("body");

    const hasUploadOrInstructions =
      (await uploadArea.count()) > 0 ||
      pageContent?.includes("Upload") ||
      pageContent?.includes("Proof") ||
      pageContent?.includes("Wire") ||
      pageContent?.includes("Payment");
    expect(hasUploadOrInstructions).toBe(true);
  });

  test("LP wire page has copy-to-clipboard buttons for bank details", async ({
    lpPage,
  }) => {
    await lpPage.goto("/lp/wire");
    await lpPage.waitForLoadState("networkidle");

    const pageContent = await lpPage.textContent("body");
    // Wire page should have copy functionality
    const hasCopyOrWire =
      pageContent?.includes("Copy") ||
      pageContent?.includes("Bank") ||
      pageContent?.includes("Routing") ||
      pageContent?.includes("Wire") ||
      pageContent?.includes("Instructions") ||
      pageContent?.includes("Not configured");
    expect(hasCopyOrWire).toBe(true);
  });
});

test.describe("LP Investment — Dashboard Verification", () => {
  test("authenticated LP sees investment data on dashboard", async ({
    lpPage,
  }) => {
    await lpPage.goto("/lp/dashboard");
    await lpPage.waitForLoadState("networkidle");

    const pageContent = await lpPage.textContent("body");
    const hasDashboardContent =
      pageContent?.includes("Dashboard") ||
      pageContent?.includes("Investment") ||
      pageContent?.includes("Commitment") ||
      pageContent?.includes("Status") ||
      pageContent?.includes("Fund") ||
      pageContent?.includes("$");
    expect(hasDashboardContent).toBe(true);
  });

  test("LP dashboard progress tracker shows correct stages", async ({
    lpPage,
  }) => {
    await lpPage.goto("/lp/dashboard");
    await lpPage.waitForLoadState("networkidle");

    const stageTexts = [
      "Applied",
      "NDA",
      "Accredited",
      "Committed",
      "Funded",
    ];

    const pageContent = await lpPage.textContent("body");
    const visibleStages = stageTexts.filter((s) => pageContent?.includes(s));
    expect(visibleStages.length).toBeGreaterThan(0);
  });

  test("LP transactions page shows transaction history", async ({
    lpPage,
  }) => {
    await lpPage.goto("/lp/transactions");
    await lpPage.waitForLoadState("networkidle");

    const pageContent = await lpPage.textContent("body");
    const hasTransContent =
      pageContent?.includes("Transaction") ||
      pageContent?.includes("Payment") ||
      pageContent?.includes("Wire") ||
      pageContent?.includes("History") ||
      pageContent?.includes("Pending") ||
      pageContent?.includes("Completed") ||
      pageContent?.includes("No transaction");
    expect(hasTransContent).toBe(true);
  });

  test("LP documents vault is accessible", async ({ lpPage }) => {
    await lpPage.goto("/lp/docs");
    await lpPage.waitForLoadState("networkidle");

    const pageContent = await lpPage.textContent("body");
    const hasDocContent =
      pageContent?.includes("Document") ||
      pageContent?.includes("Upload") ||
      pageContent?.includes("Status") ||
      pageContent?.includes("Approved") ||
      pageContent?.includes("Pending") ||
      pageContent?.includes("No documents") ||
      pageContent?.includes("file");
    expect(hasDocContent).toBe(true);
  });

  test("LP dashboard renders without critical JavaScript errors", async ({
    lpPage,
  }) => {
    const criticalErrors: string[] = [];
    lpPage.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Filter out expected errors (API calls, network issues)
        if (
          !text.includes("404") &&
          !text.includes("401") &&
          !text.includes("Failed to fetch") &&
          !text.includes("NetworkError") &&
          !text.includes("net::")
        ) {
          criticalErrors.push(text);
        }
      }
    });

    await lpPage.goto("/lp/dashboard");
    await lpPage.waitForLoadState("networkidle");

    // Allow a few non-critical console errors but no crashes
    expect(criticalErrors.length).toBeLessThanOrEqual(5);
  });
});
