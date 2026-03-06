/**
 * Tests for cron authentication — lib/middleware/cron-auth.ts
 */

import { verifyCronSecret, requireCronAuth } from "@/lib/middleware/cron-auth";

describe("cron-auth", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: "test-cron-secret-12345" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("verifyCronSecret", () => {
    it("returns true for valid Bearer token", () => {
      const request = new Request("https://example.com/api/cron/test", {
        headers: { authorization: "Bearer test-cron-secret-12345" },
      });
      expect(verifyCronSecret(request)).toBe(true);
    });

    it("returns false for invalid Bearer token", () => {
      const request = new Request("https://example.com/api/cron/test", {
        headers: { authorization: "Bearer wrong-secret" },
      });
      expect(verifyCronSecret(request)).toBe(false);
    });

    it("returns false for missing Authorization header", () => {
      const request = new Request("https://example.com/api/cron/test");
      expect(verifyCronSecret(request)).toBe(false);
    });

    it("returns false for non-Bearer auth scheme", () => {
      const request = new Request("https://example.com/api/cron/test", {
        headers: { authorization: "Basic dXNlcjpwYXNz" },
      });
      expect(verifyCronSecret(request)).toBe(false);
    });

    it("returns false when CRON_SECRET is not configured", () => {
      delete process.env.CRON_SECRET;
      const request = new Request("https://example.com/api/cron/test", {
        headers: { authorization: "Bearer test-cron-secret-12345" },
      });
      expect(verifyCronSecret(request)).toBe(false);
    });

    it("returns false for empty Bearer token", () => {
      const request = new Request("https://example.com/api/cron/test", {
        headers: { authorization: "Bearer " },
      });
      expect(verifyCronSecret(request)).toBe(false);
    });
  });

  describe("requireCronAuth", () => {
    it("returns null (pass through) for valid cron secret", () => {
      const request = new Request("https://example.com/api/cron/test", {
        headers: { authorization: "Bearer test-cron-secret-12345" },
      });
      expect(requireCronAuth(request)).toBeNull();
    });

    it("returns 401 NextResponse for invalid secret", async () => {
      const request = new Request("https://example.com/api/cron/test", {
        headers: { authorization: "Bearer bad-secret" },
      });
      const response = requireCronAuth(request);
      expect(response).not.toBeNull();
      expect(response!.status).toBe(401);
      const body = await response!.json();
      expect(body.error).toBe("Unauthorized: Invalid CRON_SECRET");
    });

    it("returns 401 NextResponse for missing Authorization header", async () => {
      const request = new Request("https://example.com/api/cron/test");
      const response = requireCronAuth(request);
      expect(response).not.toBeNull();
      expect(response!.status).toBe(401);
    });
  });
});
