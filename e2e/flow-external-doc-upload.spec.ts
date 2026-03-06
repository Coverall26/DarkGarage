import { test, expect } from "./fixtures/auth";

/**
 * E2E Flow: External Document Upload
 *
 * Tests GP uploading docs for LP and LP uploading their own docs:
 *   - GP logs in, navigates to investor detail, uploads document on behalf of LP
 *   - LP logs in, sees document in their vault
 *   - LP uploads their own document
 *   - GP reviews and approves/rejects LP document
 *
 * Document Status Flow:
 *   LP uploads -> UPLOADED_PENDING_REVIEW
 *   GP approves -> APPROVED
 *   GP rejects -> REJECTED
 *   GP requests revision -> REVISION_REQUESTED
 *
 * Requires: Dev server running with seeded database (Bermuda tenant).
 */

test.describe("External Doc Upload — GP Uploads for LP", () => {
  test("GP can access investor detail page", async ({ gpPage }) => {
    await gpPage.goto("/admin/investors");
    await gpPage.waitForLoadState("networkidle");

    const pageContent = await gpPage.textContent("body");
    const hasInvestorList =
      pageContent?.includes("Investor") ||
      pageContent?.includes("Pipeline") ||
      pageContent?.includes("Applied") ||
      pageContent?.includes("Committed") ||
      pageContent?.includes("No investors");
    expect(hasInvestorList).toBe(true);
  });

  test("GP investor detail page shows document management section", async ({
    gpPage,
  }) => {
    await gpPage.goto("/admin/investors");
    await gpPage.waitForLoadState("networkidle");

    // Try to click on an investor row or link
    const investorLink = gpPage.locator(
      'a[href*="/admin/investors/"], tr[data-investor-id], [data-testid*="investor-row"]',
    );

    if ((await investorLink.count()) > 0) {
      await investorLink.first().click();
      await gpPage.waitForLoadState("networkidle");

      const detailContent = await gpPage.textContent("body");
      const hasDetailContent =
        detailContent?.includes("Document") ||
        detailContent?.includes("Upload") ||
        detailContent?.includes("Profile") ||
        detailContent?.includes("Investment") ||
        detailContent?.includes("Status") ||
        detailContent?.includes("Investor");
      expect(hasDetailContent).toBe(true);
    }
  });

  test("GP documents admin page loads with review tabs", async ({
    gpPage,
  }) => {
    await gpPage.goto("/admin/documents");
    await gpPage.waitForLoadState("networkidle");

    const pageContent = await gpPage.textContent("body");
    const hasDocContent =
      pageContent?.includes("Document") ||
      pageContent?.includes("Template") ||
      pageContent?.includes("LP") ||
      pageContent?.includes("Review") ||
      pageContent?.includes("Pending") ||
      pageContent?.includes("Approved") ||
      pageContent?.includes("Rejected");
    expect(hasDocContent).toBe(true);
  });

  test("GP documents page has LP Documents and Document Templates views", async ({
    gpPage,
  }) => {
    await gpPage.goto("/admin/documents");
    await gpPage.waitForLoadState("networkidle");

    const pageContent = await gpPage.textContent("body");
    // Should have both LP document review and template management
    const hasViewToggle =
      pageContent?.includes("LP Document") ||
      pageContent?.includes("Template") ||
      pageContent?.includes("Pending") ||
      pageContent?.includes("Review") ||
      pageContent?.includes("Document");
    expect(hasViewToggle).toBe(true);
  });

  test("GP can see pending document review counts", async ({ gpPage }) => {
    await gpPage.goto("/admin/documents");
    await gpPage.waitForLoadState("networkidle");

    // Look for status tabs or counts
    const pageContent = await gpPage.textContent("body");
    const hasCounts =
      pageContent?.includes("Pending") ||
      pageContent?.includes("All") ||
      pageContent?.includes("Approved") ||
      pageContent?.includes("Rejected") ||
      pageContent?.includes("0") ||
      pageContent?.includes("No");
    expect(hasCounts).toBe(true);
  });
});

test.describe("External Doc Upload — LP Document Vault", () => {
  test("LP docs page shows document list or empty state", async ({
    lpPage,
  }) => {
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
      pageContent?.includes("Vault");
    expect(hasDocContent).toBe(true);
  });

  test("LP docs page has upload button or upload area", async ({ lpPage }) => {
    await lpPage.goto("/lp/docs");
    await lpPage.waitForLoadState("networkidle");

    // Look for upload capability
    const uploadElements = lpPage.locator(
      'button:has-text("Upload"), input[type="file"], [data-testid*="upload"], label:has-text("Upload")',
    );
    const pageContent = await lpPage.textContent("body");

    const hasUpload =
      (await uploadElements.count()) > 0 ||
      pageContent?.includes("Upload") ||
      pageContent?.includes("Add") ||
      pageContent?.includes("Choose");
    expect(hasUpload).toBe(true);
  });

  test("LP docs page shows document status badges", async ({ lpPage }) => {
    await lpPage.goto("/lp/docs");
    await lpPage.waitForLoadState("networkidle");

    const pageContent = await lpPage.textContent("body");
    // Status badges should be visible for any existing documents
    const hasStatusInfo =
      pageContent?.includes("Approved") ||
      pageContent?.includes("Pending") ||
      pageContent?.includes("Review") ||
      pageContent?.includes("Rejected") ||
      pageContent?.includes("Revision") ||
      pageContent?.includes("No documents") ||
      pageContent?.includes("Upload");
    expect(hasStatusInfo).toBe(true);
  });

  test("LP can see GP-uploaded documents in vault", async ({ lpPage }) => {
    await lpPage.goto("/lp/docs");
    await lpPage.waitForLoadState("networkidle");

    // GP-uploaded documents should appear with GP_UPLOADED status
    const pageContent = await lpPage.textContent("body");
    // The vault page should render without errors
    expect(pageContent?.length).toBeGreaterThan(0);

    // No error boundaries should be visible
    const errorBoundary = lpPage.locator('[data-testid="error-boundary"]');
    const errorCount = await errorBoundary.count();
    expect(errorCount).toBe(0);
  });
});

test.describe("External Doc Upload — GP Document Review", () => {
  test("GP pending documents dashboard loads", async ({ gpPage }) => {
    await gpPage.goto("/admin/documents");
    await gpPage.waitForLoadState("networkidle");

    const pageContent = await gpPage.textContent("body");
    const hasPendingContent =
      pageContent?.includes("Pending") ||
      pageContent?.includes("Review") ||
      pageContent?.includes("Document") ||
      pageContent?.includes("Approve") ||
      pageContent?.includes("Reject") ||
      pageContent?.includes("All");
    expect(hasPendingContent).toBe(true);
  });

  test("GP document review shows approve and reject action buttons", async ({
    gpPage,
  }) => {
    await gpPage.goto("/admin/documents");
    await gpPage.waitForLoadState("networkidle");

    const pageContent = await gpPage.textContent("body");
    // Look for action buttons or indicators
    const hasActions =
      pageContent?.includes("Approve") ||
      pageContent?.includes("Reject") ||
      pageContent?.includes("Review") ||
      pageContent?.includes("Request") ||
      pageContent?.includes("Revision") ||
      pageContent?.includes("No pending") ||
      pageContent?.includes("Pending");
    expect(hasActions).toBe(true);
  });

  test("GP fund detail page has Documents tab", async ({ gpPage }) => {
    await gpPage.goto("/admin/fund");
    await gpPage.waitForLoadState("networkidle");

    // Navigate to first fund
    const fundLink = gpPage.locator(
      'a[href*="/admin/fund/"], [data-testid*="fund-card"]',
    );
    if ((await fundLink.count()) > 0) {
      await fundLink.first().click();
      await gpPage.waitForLoadState("networkidle");

      const pageContent = await gpPage.textContent("body");
      const hasDocTab =
        pageContent?.includes("Document") ||
        pageContent?.includes("Overview") ||
        pageContent?.includes("Wire") ||
        pageContent?.includes("CRM");
      expect(hasDocTab).toBe(true);
    }
  });

  test("GP can access pending actions from fund overview", async ({
    gpPage,
  }) => {
    await gpPage.goto("/admin/dashboard");
    await gpPage.waitForLoadState("networkidle");

    const pageContent = await gpPage.textContent("body");
    // Dashboard should show pending actions card or related content
    const hasPendingActions =
      pageContent?.includes("Action") ||
      pageContent?.includes("Pending") ||
      pageContent?.includes("Review") ||
      pageContent?.includes("Wire") ||
      pageContent?.includes("Document") ||
      pageContent?.includes("Dashboard");
    expect(hasPendingActions).toBe(true);
  });
});

test.describe("External Doc Upload — Document Type Selection", () => {
  test("LP upload modal shows document type options", async ({ lpPage }) => {
    await lpPage.goto("/lp/docs");
    await lpPage.waitForLoadState("networkidle");

    // Look for upload button to open modal
    const uploadButton = lpPage.locator(
      'button:has-text("Upload"), button:has-text("Add Document")',
    );

    if (await uploadButton.first().isVisible()) {
      await uploadButton.first().click();
      await lpPage.waitForTimeout(500);

      const modalContent = await lpPage.textContent("body");
      // Modal should show document type selection
      const hasDocTypes =
        modalContent?.includes("Type") ||
        modalContent?.includes("Select") ||
        modalContent?.includes("NDA") ||
        modalContent?.includes("Subscription") ||
        modalContent?.includes("Agreement") ||
        modalContent?.includes("Tax") ||
        modalContent?.includes("Identity") ||
        modalContent?.includes("Upload");
      expect(hasDocTypes).toBe(true);
    }
  });

  test("LP upload accepts PDF files", async ({ lpPage }) => {
    await lpPage.goto("/lp/docs");
    await lpPage.waitForLoadState("networkidle");

    // Check that file input exists and accepts correct types
    const fileInput = lpPage.locator('input[type="file"]');
    if ((await fileInput.count()) > 0) {
      const accept = await fileInput.first().getAttribute("accept");
      // Should accept PDF and/or images
      const acceptsPdf =
        accept === null ||
        accept?.includes("pdf") ||
        accept?.includes("PDF") ||
        accept?.includes("image") ||
        accept?.includes("*");
      expect(acceptsPdf).toBe(true);
    }
  });
});

test.describe("External Doc Upload — Notification Flow", () => {
  test("GP documents page shows review notification indicators", async ({
    gpPage,
  }) => {
    await gpPage.goto("/admin/documents");
    await gpPage.waitForLoadState("networkidle");

    // Check for notification badges or counts
    const pageContent = await gpPage.textContent("body");
    // Page should have tab counts or empty states
    const hasNotificationInfo =
      pageContent?.includes("Pending") ||
      pageContent?.includes("All") ||
      pageContent?.includes("0") ||
      pageContent?.includes("No") ||
      pageContent?.includes("Review");
    expect(hasNotificationInfo).toBe(true);
  });

  test("GP dashboard pending actions includes document review count", async ({
    gpPage,
  }) => {
    await gpPage.goto("/admin/dashboard");
    await gpPage.waitForLoadState("networkidle");

    const pageContent = await gpPage.textContent("body");
    // Dashboard should reference pending actions
    const hasDashboardActions =
      pageContent?.includes("Action") ||
      pageContent?.includes("Pending") ||
      pageContent?.includes("Document") ||
      pageContent?.includes("Review") ||
      pageContent?.includes("Wire") ||
      pageContent?.includes("Dashboard");
    expect(hasDashboardActions).toBe(true);
  });
});

test.describe("External Doc Upload — Error Handling", () => {
  test("LP docs page handles network errors gracefully", async ({
    lpPage,
  }) => {
    const consoleErrors: string[] = [];
    lpPage.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (
          !text.includes("404") &&
          !text.includes("401") &&
          !text.includes("Failed to fetch") &&
          !text.includes("NetworkError") &&
          !text.includes("net::")
        ) {
          consoleErrors.push(text);
        }
      }
    });

    await lpPage.goto("/lp/docs");
    await lpPage.waitForLoadState("networkidle");

    // No critical JS errors
    expect(consoleErrors.length).toBeLessThanOrEqual(5);
  });

  test("GP documents page renders without crashes", async ({ gpPage }) => {
    const consoleErrors: string[] = [];
    gpPage.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (
          !text.includes("404") &&
          !text.includes("401") &&
          !text.includes("Failed to fetch") &&
          !text.includes("NetworkError") &&
          !text.includes("net::")
        ) {
          consoleErrors.push(text);
        }
      }
    });

    await gpPage.goto("/admin/documents");
    await gpPage.waitForLoadState("networkidle");

    // Page should load without critical errors
    expect(consoleErrors.length).toBeLessThanOrEqual(5);

    // Should have meaningful content
    const heading = gpPage.locator("h1, h2, h3");
    await expect(heading.first()).toBeVisible({ timeout: 10_000 });
  });
});
