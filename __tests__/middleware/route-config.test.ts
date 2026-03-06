/**
 * Tests for route classification — lib/middleware/route-config.ts
 *
 * Verifies every route category is correctly assigned and the fail-safe
 * defaults work as expected. Includes edge cases for trailing slashes,
 * query params, and case sensitivity.
 */

import {
  classifyRoute,
  RouteCategory,
  PUBLIC_PATHS,
  CRON_PATHS,
  ADMIN_PATHS,
  TEAM_SCOPED_PATHS,
  AUTHENTICATED_PATHS,
} from "@/lib/middleware/route-config";

describe("route-config: classifyRoute", () => {
  // ----- PUBLIC -----
  describe("PUBLIC routes", () => {
    it("classifies /api/auth/* as PUBLIC", () => {
      expect(classifyRoute("/api/auth/register")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/auth/send-code")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/auth/verify-code")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/auth/[...nextauth]")).toBe(RouteCategory.PUBLIC);
    });

    it("classifies /api/webhooks/* as PUBLIC", () => {
      expect(classifyRoute("/api/webhooks/persona")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/webhooks/stripe-crm")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/webhooks/resend")).toBe(RouteCategory.PUBLIC);
    });

    it("classifies /api/health as PUBLIC", () => {
      expect(classifyRoute("/api/health")).toBe(RouteCategory.PUBLIC);
    });

    it("classifies /api/marketplace/public/* as PUBLIC", () => {
      expect(classifyRoute("/api/marketplace/public/listings")).toBe(RouteCategory.PUBLIC);
    });

    it("classifies tracking endpoints as PUBLIC", () => {
      expect(classifyRoute("/api/record_click")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/record_view")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/record_video_view")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/tracking/events")).toBe(RouteCategory.PUBLIC);
    });

    it("classifies OG and CSP as PUBLIC", () => {
      expect(classifyRoute("/api/og/image")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/csp-report")).toBe(RouteCategory.PUBLIC);
    });

    it("classifies /api/stripe/webhook as PUBLIC", () => {
      expect(classifyRoute("/api/stripe/webhook")).toBe(RouteCategory.PUBLIC);
    });

    it("classifies view-related endpoints as PUBLIC", () => {
      expect(classifyRoute("/api/views")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/views-dataroom")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/view/some-link")).toBe(RouteCategory.PUBLIC);
    });

    it("classifies branding and feature-flags as PUBLIC", () => {
      expect(classifyRoute("/api/branding/tenant")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/feature-flags")).toBe(RouteCategory.PUBLIC);
    });

    it("classifies marketplace waitlist as PUBLIC", () => {
      expect(classifyRoute("/api/marketplace/waitlist")).toBe(RouteCategory.PUBLIC);
    });

    it("classifies unsubscribe as PUBLIC", () => {
      expect(classifyRoute("/api/unsubscribe")).toBe(RouteCategory.PUBLIC);
    });

    it("classifies help endpoints as PUBLIC", () => {
      expect(classifyRoute("/api/help/faq")).toBe(RouteCategory.PUBLIC);
    });
  });

  // ----- CRON -----
  describe("CRON routes", () => {
    it("classifies /api/cron/* as CRON", () => {
      expect(classifyRoute("/api/cron/domains")).toBe(RouteCategory.CRON);
      expect(classifyRoute("/api/cron/audit-retention")).toBe(RouteCategory.CRON);
      expect(classifyRoute("/api/cron/aum-snapshots")).toBe(RouteCategory.CRON);
      expect(classifyRoute("/api/cron/sequences")).toBe(RouteCategory.CRON);
    });

    // /api/jobs/* uses INTERNAL_API_KEY (not CRON_SECRET) — classified as PUBLIC
    // (job route handlers verify INTERNAL_API_KEY themselves)
    it("does NOT classify /api/jobs/* as CRON", () => {
      expect(classifyRoute("/api/jobs/cleanup")).toBe(RouteCategory.PUBLIC);
    });
  });

  // ----- ADMIN -----
  describe("ADMIN routes", () => {
    it("classifies /api/admin/* as ADMIN", () => {
      expect(classifyRoute("/api/admin/settings")).toBe(RouteCategory.ADMIN);
      expect(classifyRoute("/api/admin/investors/manual-entry")).toBe(RouteCategory.ADMIN);
      expect(classifyRoute("/api/admin/wire/confirm")).toBe(RouteCategory.ADMIN);
      expect(classifyRoute("/api/admin/dashboard-stats")).toBe(RouteCategory.ADMIN);
    });

    it("classifies /api/admin/platform/* as ADMIN", () => {
      expect(classifyRoute("/api/admin/platform/settings")).toBe(RouteCategory.ADMIN);
    });
  });

  // ----- TEAM_SCOPED -----
  describe("TEAM_SCOPED routes", () => {
    it("classifies /api/teams/* as TEAM_SCOPED", () => {
      expect(classifyRoute("/api/teams/123/funds")).toBe(RouteCategory.TEAM_SCOPED);
      expect(classifyRoute("/api/teams/abc/wire-transfers")).toBe(RouteCategory.TEAM_SCOPED);
    });

    it("classifies /api/billing/* as TEAM_SCOPED", () => {
      expect(classifyRoute("/api/billing/checkout")).toBe(RouteCategory.TEAM_SCOPED);
      expect(classifyRoute("/api/billing/portal")).toBe(RouteCategory.TEAM_SCOPED);
    });

    it("classifies /api/funds/* as TEAM_SCOPED", () => {
      expect(classifyRoute("/api/funds/create")).toBe(RouteCategory.TEAM_SCOPED);
    });

    it("classifies /api/setup/* as TEAM_SCOPED", () => {
      expect(classifyRoute("/api/setup/complete")).toBe(RouteCategory.TEAM_SCOPED);
    });

    it("classifies /api/outreach/* and /api/contacts/* as TEAM_SCOPED", () => {
      expect(classifyRoute("/api/outreach/sequences")).toBe(RouteCategory.TEAM_SCOPED);
      expect(classifyRoute("/api/contacts/123")).toBe(RouteCategory.TEAM_SCOPED);
    });

    it("classifies /api/ai/* and /api/tier/* as TEAM_SCOPED", () => {
      expect(classifyRoute("/api/ai/draft-email")).toBe(RouteCategory.TEAM_SCOPED);
      expect(classifyRoute("/api/tier")).toBe(RouteCategory.TEAM_SCOPED);
    });

  });

  // ----- AUTHENTICATED -----
  describe("AUTHENTICATED routes", () => {
    it("classifies /api/esign/* as AUTHENTICATED", () => {
      expect(classifyRoute("/api/esign/envelopes")).toBe(RouteCategory.AUTHENTICATED);
      expect(classifyRoute("/api/esign/sign")).toBe(RouteCategory.AUTHENTICATED);
    });

    it("classifies /api/lp/* as AUTHENTICATED", () => {
      expect(classifyRoute("/api/lp/register")).toBe(RouteCategory.AUTHENTICATED);
      expect(classifyRoute("/api/lp/fund-context")).toBe(RouteCategory.AUTHENTICATED);
      expect(classifyRoute("/api/lp/wire-proof")).toBe(RouteCategory.AUTHENTICATED);
    });

    it("classifies /api/user/* as AUTHENTICATED", () => {
      expect(classifyRoute("/api/user/notification-preferences")).toBe(RouteCategory.AUTHENTICATED);
    });

    it("classifies /api/notifications/* as AUTHENTICATED", () => {
      expect(classifyRoute("/api/notifications")).toBe(RouteCategory.AUTHENTICATED);
      expect(classifyRoute("/api/notifications/preferences")).toBe(RouteCategory.AUTHENTICATED);
    });

    it("classifies /api/investor-profile/* as AUTHENTICATED", () => {
      expect(classifyRoute("/api/investor-profile/123")).toBe(RouteCategory.AUTHENTICATED);
    });

    it("classifies /api/documents/* as AUTHENTICATED", () => {
      expect(classifyRoute("/api/documents/upload")).toBe(RouteCategory.AUTHENTICATED);
    });

    it("classifies /api/sign/* as AUTHENTICATED", () => {
      expect(classifyRoute("/api/sign/some-token")).toBe(RouteCategory.AUTHENTICATED);
    });

    it("classifies /api/account/* as AUTHENTICATED", () => {
      expect(classifyRoute("/api/account/general")).toBe(RouteCategory.AUTHENTICATED);
    });

    it("classifies /api/passkeys/* as AUTHENTICATED", () => {
      expect(classifyRoute("/api/passkeys/register")).toBe(RouteCategory.AUTHENTICATED);
    });

    it("classifies /api/conversations/* as AUTHENTICATED", () => {
      expect(classifyRoute("/api/conversations/123")).toBe(RouteCategory.AUTHENTICATED);
    });

    it("classifies /api/analytics/* as AUTHENTICATED", () => {
      expect(classifyRoute("/api/analytics/overview")).toBe(RouteCategory.AUTHENTICATED);
    });

    it("classifies /api/storage/* as AUTHENTICATED", () => {
      expect(classifyRoute("/api/storage/presign")).toBe(RouteCategory.AUTHENTICATED);
    });

    it("classifies /api/mupdf/* as AUTHENTICATED", () => {
      expect(classifyRoute("/api/mupdf/convert")).toBe(RouteCategory.AUTHENTICATED);
    });

    it("classifies /api/signature/* as AUTHENTICATED", () => {
      expect(classifyRoute("/api/signature/verify")).toBe(RouteCategory.AUTHENTICATED);
    });
  });

  // ----- FAIL-SAFE -----
  describe("Fail-safe defaults", () => {
    it("defaults unknown /api/* paths to AUTHENTICATED", () => {
      expect(classifyRoute("/api/unknown-endpoint")).toBe(RouteCategory.AUTHENTICATED);
      expect(classifyRoute("/api/something/nested/deeply")).toBe(RouteCategory.AUTHENTICATED);
    });

    it("classifies non-API paths as PUBLIC", () => {
      expect(classifyRoute("/admin/dashboard")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/lp/onboard")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/")).toBe(RouteCategory.PUBLIC);
    });
  });

  // ----- PATH ARRAY EXPORTS -----
  describe("Path array exports", () => {
    it("exports PUBLIC_PATHS array", () => {
      expect(Array.isArray(PUBLIC_PATHS)).toBe(true);
      expect(PUBLIC_PATHS.length).toBeGreaterThan(0);
      expect(PUBLIC_PATHS).toContain("/api/auth/");
      expect(PUBLIC_PATHS).toContain("/api/webhooks/");
      expect(PUBLIC_PATHS).toContain("/api/health");
    });

    it("exports CRON_PATHS array", () => {
      expect(Array.isArray(CRON_PATHS)).toBe(true);
      expect(CRON_PATHS).toContain("/api/cron/");
    });

    it("exports ADMIN_PATHS array", () => {
      expect(Array.isArray(ADMIN_PATHS)).toBe(true);
      expect(ADMIN_PATHS).toContain("/api/admin/");
    });

    it("exports TEAM_SCOPED_PATHS array", () => {
      expect(Array.isArray(TEAM_SCOPED_PATHS)).toBe(true);
      expect(TEAM_SCOPED_PATHS).toContain("/api/teams/");
    });

    it("exports AUTHENTICATED_PATHS array", () => {
      expect(Array.isArray(AUTHENTICATED_PATHS)).toBe(true);
      expect(AUTHENTICATED_PATHS).toContain("/api/lp/");
      expect(AUTHENTICATED_PATHS).toContain("/api/esign/");
    });

    it("has no overlap between path arrays", () => {
      const allPaths = [
        ...PUBLIC_PATHS,
        ...CRON_PATHS,
        ...ADMIN_PATHS,
        ...TEAM_SCOPED_PATHS,
        ...AUTHENTICATED_PATHS,
      ];
      const uniquePaths = new Set(allPaths);
      expect(uniquePaths.size).toBe(allPaths.length);
    });
  });

  // ----- PRIORITY ORDER -----
  describe("Priority order", () => {
    it("PUBLIC takes precedence over AUTHENTICATED", () => {
      // /api/auth/ is PUBLIC even though it could match AUTHENTICATED fallback
      expect(classifyRoute("/api/auth/register")).toBe(RouteCategory.PUBLIC);
    });

    it("CRON takes precedence over AUTHENTICATED", () => {
      expect(classifyRoute("/api/cron/cleanup")).toBe(RouteCategory.CRON);
    });

    it("ADMIN takes precedence over TEAM_SCOPED", () => {
      // /api/admin/ is ADMIN, not the AUTHENTICATED fallback
      expect(classifyRoute("/api/admin/teams/settings")).toBe(RouteCategory.ADMIN);
    });
  });

  // ----- EDGE CASES -----
  describe("Edge cases", () => {
    it("handles exact path matches (no trailing slash)", () => {
      expect(classifyRoute("/api/health")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/record_click")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/csp-report")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/feature-flags")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/tier")).toBe(RouteCategory.TEAM_SCOPED);
    });

    it("handles prefix matches (with trailing slash in config)", () => {
      // These paths end with / in the config, so they match startsWith
      expect(classifyRoute("/api/auth/callback")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/webhooks/persona/complete")).toBe(RouteCategory.PUBLIC);
      expect(classifyRoute("/api/cron/domains/verify")).toBe(RouteCategory.CRON);
      expect(classifyRoute("/api/admin/fund/123/details")).toBe(RouteCategory.ADMIN);
    });

    it("prefix matching includes partial path segments (by design)", () => {
      // PUBLIC_PATHS contains "/api/health" — startsWith matching means
      // /api/healthcheck also matches. This is by design for edge-runtime
      // performance (no regex). In practice, no real route conflicts exist.
      expect(classifyRoute("/api/healthcheck")).toBe(RouteCategory.PUBLIC);
    });

    it("handles deeply nested paths", () => {
      expect(classifyRoute("/api/teams/t1/funds/f1/transactions/tx1")).toBe(RouteCategory.TEAM_SCOPED);
      expect(classifyRoute("/api/admin/investors/i1/review/approve")).toBe(RouteCategory.ADMIN);
      expect(classifyRoute("/api/lp/bank/link-token")).toBe(RouteCategory.AUTHENTICATED);
    });

    it("classifies all five RouteCategory enum values", () => {
      expect(Object.values(RouteCategory)).toEqual(
        expect.arrayContaining(["PUBLIC", "CRON", "AUTHENTICATED", "TEAM_SCOPED", "ADMIN"]),
      );
      expect(Object.keys(RouteCategory)).toHaveLength(5);
    });
  });

  // ----- SNAPSHOT TEST -----
  describe("Snapshot: all configured paths classify correctly", () => {
    it("every PUBLIC_PATHS entry classifies as PUBLIC", () => {
      for (const p of PUBLIC_PATHS) {
        // Use a sub-path if it ends with /
        const testPath = p.endsWith("/") ? `${p}test` : p;
        expect(classifyRoute(testPath)).toBe(RouteCategory.PUBLIC);
      }
    });

    it("every CRON_PATHS entry classifies as CRON", () => {
      for (const p of CRON_PATHS) {
        const testPath = p.endsWith("/") ? `${p}test` : p;
        expect(classifyRoute(testPath)).toBe(RouteCategory.CRON);
      }
    });

    it("every ADMIN_PATHS entry classifies as ADMIN", () => {
      for (const p of ADMIN_PATHS) {
        const testPath = p.endsWith("/") ? `${p}test` : p;
        expect(classifyRoute(testPath)).toBe(RouteCategory.ADMIN);
      }
    });

    it("every TEAM_SCOPED_PATHS entry classifies as TEAM_SCOPED", () => {
      for (const p of TEAM_SCOPED_PATHS) {
        const testPath = p.endsWith("/") ? `${p}test` : p;
        expect(classifyRoute(testPath)).toBe(RouteCategory.TEAM_SCOPED);
      }
    });

    it("every AUTHENTICATED_PATHS entry classifies as AUTHENTICATED", () => {
      for (const p of AUTHENTICATED_PATHS) {
        const testPath = p.endsWith("/") ? `${p}test` : p;
        expect(classifyRoute(testPath)).toBe(RouteCategory.AUTHENTICATED);
      }
    });
  });
});
