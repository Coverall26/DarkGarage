/**
 * Tests for server-events module.
 *
 * The module uses posthog-node SDK and `import "server-only"`.
 * We mock both to test the publishServerEvent function.
 */

// Mock "server-only" (it's a no-op guard that throws at import in client bundles)
jest.mock("server-only", () => ({}));

// Mock posthog-node
const mockCapture = jest.fn();
const mockShutdown = jest.fn().mockResolvedValue(undefined);

jest.mock("posthog-node", () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    capture: mockCapture,
    shutdown: mockShutdown,
  })),
}));

// Store original env
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  process.env = { ...originalEnv };
  delete process.env.POSTHOG_SERVER_KEY;
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  delete process.env.POSTHOG_HOST;
});

afterAll(() => {
  process.env = originalEnv;
});

describe("server-events", () => {
  describe("publishServerEvent", () => {
    it("logs to console when PostHog key is not set", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      const { publishServerEvent } = await import("@/lib/tracking/server-events");
      await publishServerEvent("funnel_signup_completed", { userId: "u1" });

      expect(consoleSpy).toHaveBeenCalledWith(
        "[FUNNEL] funnel_signup_completed",
        expect.objectContaining({
          userId: "u1",
        }),
      );
      expect(mockCapture).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("publishes to PostHog when POSTHOG_SERVER_KEY is set", async () => {
      process.env.POSTHOG_SERVER_KEY = "phx_test-key-123";

      const { publishServerEvent } = await import("@/lib/tracking/server-events");
      await publishServerEvent("funnel_org_created", { orgId: "org-1", userId: "u1" });

      expect(mockCapture).toHaveBeenCalledTimes(1);
      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: "u1",
          event: "funnel_org_created",
          properties: expect.objectContaining({
            orgId: "org-1",
            userId: "u1",
            $lib: "posthog-node",
            source: "server",
          }),
        }),
      );
    });

    it("falls back to NEXT_PUBLIC_POSTHOG_KEY when server key not set", async () => {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_public-key";

      const { PostHog } = await import("posthog-node");
      const { publishServerEvent } = await import("@/lib/tracking/server-events");
      await publishServerEvent("test_event", { userId: "u1" });

      expect(PostHog).toHaveBeenCalledWith("phc_public-key", expect.any(Object));
      expect(mockCapture).toHaveBeenCalledTimes(1);
    });

    it("creates PostHog client with custom host when POSTHOG_HOST is set", async () => {
      process.env.POSTHOG_SERVER_KEY = "phx_test-key";
      process.env.POSTHOG_HOST = "https://custom.posthog.example.com";

      const { PostHog } = await import("posthog-node");
      const { publishServerEvent } = await import("@/lib/tracking/server-events");
      await publishServerEvent("test_event");

      expect(PostHog).toHaveBeenCalledWith("phx_test-key", {
        host: "https://custom.posthog.example.com",
        flushAt: 10,
        flushInterval: 5000,
      });
    });

    it("uses default US host when POSTHOG_HOST is not set", async () => {
      process.env.POSTHOG_SERVER_KEY = "phx_test-key";

      const { PostHog } = await import("posthog-node");
      const { publishServerEvent } = await import("@/lib/tracking/server-events");
      await publishServerEvent("test_event");

      expect(PostHog).toHaveBeenCalledWith("phx_test-key", {
        host: "https://us.i.posthog.com",
        flushAt: 10,
        flushInterval: 5000,
      });
    });

    it("logs warning when PostHog capture throws", async () => {
      process.env.POSTHOG_SERVER_KEY = "phx_test-key";
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      mockCapture.mockImplementationOnce(() => {
        throw new Error("Network error");
      });

      const { publishServerEvent } = await import("@/lib/tracking/server-events");
      await publishServerEvent("test_event");

      expect(warnSpy).toHaveBeenCalledWith(
        "[SERVER_EVENTS] PostHog capture error:",
        expect.any(Error),
      );

      warnSpy.mockRestore();
    });

    it("never throws even on capture error", async () => {
      process.env.POSTHOG_SERVER_KEY = "phx_test-key";
      jest.spyOn(console, "warn").mockImplementation();
      mockCapture.mockImplementationOnce(() => {
        throw new Error("Connection refused");
      });

      const { publishServerEvent } = await import("@/lib/tracking/server-events");
      await expect(
        publishServerEvent("test_event"),
      ).resolves.toBeUndefined();

      jest.restoreAllMocks();
    });

    it("uses 'server' as distinctId when no userId provided", async () => {
      process.env.POSTHOG_SERVER_KEY = "phx_test-key";

      const { publishServerEvent } = await import("@/lib/tracking/server-events");
      await publishServerEvent("minimal_event");

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: "server",
          event: "minimal_event",
        }),
      );
    });

    it("sends only event name with default properties when no properties provided", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      const { publishServerEvent } = await import("@/lib/tracking/server-events");
      await publishServerEvent("minimal_event");

      expect(consoleSpy).toHaveBeenCalledWith("[FUNNEL] minimal_event", {});

      consoleSpy.mockRestore();
    });
  });

  describe("flushServerEvents", () => {
    it("calls shutdown on PostHog client when configured", async () => {
      process.env.POSTHOG_SERVER_KEY = "phx_test-key";

      const { publishServerEvent, flushServerEvents } = await import(
        "@/lib/tracking/server-events"
      );
      // Initialize the client first
      await publishServerEvent("init_event");
      // Now flush
      await flushServerEvents();

      expect(mockShutdown).toHaveBeenCalledTimes(1);
    });

    it("does nothing when PostHog is not configured", async () => {
      const { flushServerEvents } = await import("@/lib/tracking/server-events");
      await flushServerEvents();

      expect(mockShutdown).not.toHaveBeenCalled();
    });
  });
});
