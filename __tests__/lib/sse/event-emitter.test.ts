/**
 * Tests for SSE Event Emitter — Redis pub/sub + in-process hybrid
 */

jest.mock("@/lib/redis", () => ({
  redis: {
    lpush: jest.fn().mockResolvedValue(1),
    ltrim: jest.fn().mockResolvedValue("OK"),
    expire: jest.fn().mockResolvedValue(1),
    lrange: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import { redis } from "@/lib/redis";
import {
  emitSSE,
  subscribeSSE,
  getListenerCount,
  getTotalListenerCount,
  isRedisSSEEnabled,
  SSE_EVENTS,
} from "@/lib/sse/event-emitter";

// Get references to the mock functions created inside the factory
const mockLpush = redis!.lpush as jest.Mock;
const mockLtrim = redis!.ltrim as jest.Mock;
const mockExpire = redis!.expire as jest.Mock;
const mockLrange = redis!.lrange as jest.Mock;

describe("SSE Event Emitter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("emitSSE", () => {
    it("delivers events to in-process listeners", () => {
      const listener = jest.fn();
      const unsubscribe = subscribeSSE("org-1", listener);

      emitSSE({
        type: SSE_EVENTS.WIRE_CONFIRMED,
        orgId: "org-1",
        data: { amount: 50000 },
      });

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0];
      expect(event.type).toBe("wire.confirmed");
      expect(event.orgId).toBe("org-1");
      expect(event.data).toEqual({ amount: 50000 });
      expect(event.id).toBeTruthy();
      expect(event.timestamp).toBeTruthy();

      unsubscribe();
    });

    it("generates unique event IDs", () => {
      const events: Array<{ id: string }> = [];
      const listener = jest.fn((e) => events.push(e));
      const unsubscribe = subscribeSSE("org-2", listener);

      emitSSE({ type: "test.a", orgId: "org-2", data: {} });
      emitSSE({ type: "test.b", orgId: "org-2", data: {} });

      expect(events[0].id).not.toBe(events[1].id);
      unsubscribe();
    });

    it("publishes to Redis when available", async () => {
      const unsubscribe = subscribeSSE("org-3", jest.fn());

      emitSSE({
        type: SSE_EVENTS.DOCUMENT_APPROVED,
        orgId: "org-3",
        data: { docId: "doc-1" },
      });

      // Allow fire-and-forget Promise.all microtasks to flush
      await Promise.resolve();
      await Promise.resolve();

      expect(mockLpush).toHaveBeenCalledWith(
        "sse:org:org-3",
        expect.any(String)
      );
      expect(mockLtrim).toHaveBeenCalledWith("sse:org:org-3", 0, 99);
      expect(mockExpire).toHaveBeenCalledWith("sse:org:org-3", 300);

      unsubscribe();
    });

    it("does not throw on listener errors", () => {
      const badListener = jest.fn(() => {
        throw new Error("listener crash");
      });
      const unsubscribe = subscribeSSE("org-4", badListener);

      expect(() => {
        emitSSE({ type: "test", orgId: "org-4", data: {} });
      }).not.toThrow();

      unsubscribe();
    });

    it("scopes events to correct org", () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const unsub1 = subscribeSSE("org-a", listener1);
      const unsub2 = subscribeSSE("org-b", listener2);

      emitSSE({ type: "test", orgId: "org-a", data: {} });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).not.toHaveBeenCalled();

      unsub1();
      unsub2();
    });
  });

  describe("subscribeSSE", () => {
    it("returns an unsubscribe function", () => {
      const listener = jest.fn();
      const unsubscribe = subscribeSSE("org-5", listener);

      emitSSE({ type: "test", orgId: "org-5", data: {} });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      emitSSE({ type: "test", orgId: "org-5", data: {} });
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });

    it("cleans up org entry when last listener removed", () => {
      const listener = jest.fn();
      const unsubscribe = subscribeSSE("org-6", listener);

      expect(getListenerCount("org-6")).toBe(1);

      unsubscribe();

      expect(getListenerCount("org-6")).toBe(0);
    });
  });

  describe("getListenerCount", () => {
    it("returns 0 for unknown org", () => {
      expect(getListenerCount("unknown-org")).toBe(0);
    });

    it("tracks listener count per org", () => {
      const unsub1 = subscribeSSE("org-7", jest.fn());
      const unsub2 = subscribeSSE("org-7", jest.fn());

      expect(getListenerCount("org-7")).toBe(2);

      unsub1();
      expect(getListenerCount("org-7")).toBe(1);

      unsub2();
      expect(getListenerCount("org-7")).toBe(0);
    });
  });

  describe("getTotalListenerCount", () => {
    it("sums across all orgs", () => {
      const unsub1 = subscribeSSE("org-8", jest.fn());
      const unsub2 = subscribeSSE("org-9", jest.fn());
      const unsub3 = subscribeSSE("org-9", jest.fn());

      expect(getTotalListenerCount()).toBeGreaterThanOrEqual(3);

      unsub1();
      unsub2();
      unsub3();
    });
  });

  describe("isRedisSSEEnabled", () => {
    it("returns true when Redis is configured", () => {
      expect(isRedisSSEEnabled()).toBe(true);
    });
  });

  describe("SSE_EVENTS constants", () => {
    it("has all expected event types", () => {
      expect(SSE_EVENTS.INVESTOR_APPLIED).toBe("investor.applied");
      expect(SSE_EVENTS.WIRE_CONFIRMED).toBe("wire.confirmed");
      expect(SSE_EVENTS.DOCUMENT_APPROVED).toBe("document.approved");
      expect(SSE_EVENTS.FUND_AGGREGATE_UPDATED).toBe("fund.aggregate_updated");
      expect(SSE_EVENTS.DASHBOARD_REFRESH).toBe("dashboard.refresh");
    });
  });
});
