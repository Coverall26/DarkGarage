/**
 * Server-Sent Events (SSE) Infrastructure — Redis Pub/Sub + In-Process Fallback
 *
 * Hybrid event delivery for real-time updates in serverless (Vercel):
 * - In-process EventEmitter for same-instance delivery (instant, ~0ms latency)
 * - Redis List for cross-instance delivery (~2-3s latency via polling)
 *
 * API routes call `emitSSE()` to broadcast events. The SSE endpoint in
 * `app/api/sse/route.ts` subscribes via `subscribeSSE()` which handles both
 * in-process and Redis-backed delivery.
 *
 * When Redis is not configured, falls back to in-process only (single-instance).
 */

import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

type SSEListener = (event: SSEEvent) => void;

export interface SSEEvent {
  /** Unique event ID for deduplication across instances */
  id: string;
  /** Event type for client-side filtering (e.g., "investor.committed", "wire.confirmed") */
  type: string;
  /** Scoped to organization for multi-tenant isolation */
  orgId: string;
  /** Optional: scope to specific fund */
  fundId?: string;
  /** Arbitrary JSON payload */
  data: Record<string, unknown>;
  /** ISO timestamp */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// In-Process Listener Map
// ---------------------------------------------------------------------------
// orgId → Set<listener>
const listeners = new Map<string, Set<SSEListener>>();

// ---------------------------------------------------------------------------
// Redis Configuration
// ---------------------------------------------------------------------------
const REDIS_KEY_PREFIX = "sse:org:";
const REDIS_MAX_EVENTS = 100; // Max events per org list
const REDIS_TTL_SECONDS = 300; // 5 min TTL on event lists
const REDIS_POLL_INTERVAL_MS = 2_000; // Poll Redis every 2s

/** Generate a short unique event ID */
function generateEventId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${ts}-${rand}`;
}

/**
 * Subscribe to SSE events for an organization.
 * Returns an unsubscribe function.
 *
 * Handles both in-process delivery (instant) and Redis polling (cross-instance).
 */
export function subscribeSSE(orgId: string, listener: SSEListener): () => void {
  // Register in-process listener
  if (!listeners.has(orgId)) {
    listeners.set(orgId, new Set());
  }
  listeners.get(orgId)!.add(listener);

  // Track seen event IDs for deduplication (in-process events arrive instantly,
  // Redis poll may return the same events)
  const seenIds = new Set<string>();
  let lastPollTime = Date.now();
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  // Wrap listener to track seen IDs from in-process delivery
  const wrappedListener: SSEListener = (event) => {
    seenIds.add(event.id);
    // Prevent unbounded growth — keep last 200 IDs
    if (seenIds.size > 200) {
      const entries = Array.from(seenIds);
      for (let i = 0; i < 100; i++) {
        seenIds.delete(entries[i]);
      }
    }
    listener(event);
  };

  // Replace original listener with wrapped version
  listeners.get(orgId)!.delete(listener);
  listeners.get(orgId)!.add(wrappedListener);

  // Start Redis polling if Redis is available
  const redisClient = redis;
  if (redisClient) {
    pollInterval = setInterval(async () => {
      try {
        const key = `${REDIS_KEY_PREFIX}${orgId}`;
        const events = await redisClient.lrange(key, 0, -1);
        if (!events || events.length === 0) return;

        for (const raw of events) {
          try {
            const event: SSEEvent = typeof raw === "string" ? JSON.parse(raw) : raw as SSEEvent;

            // Skip if already delivered via in-process
            if (seenIds.has(event.id)) continue;

            // Skip events older than our subscription start
            const eventTime = new Date(event.timestamp).getTime();
            if (eventTime < lastPollTime) continue;

            seenIds.add(event.id);
            listener(event);
          } catch {
            // Skip malformed events
          }
        }
      } catch (error) {
        logger.warn("Redis SSE poll failed", { module: "sse", orgId, error: String(error) });
      }
    }, REDIS_POLL_INTERVAL_MS);
  }

  // Return unsubscribe function
  return () => {
    const orgListeners = listeners.get(orgId);
    if (orgListeners) {
      orgListeners.delete(wrappedListener);
      if (orgListeners.size === 0) {
        listeners.delete(orgId);
      }
    }
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };
}

/**
 * Emit an SSE event to all connected clients for the given org.
 * Call this from any API route after a mutation (e.g., wire confirmed, doc approved).
 *
 * Delivers via:
 * 1. In-process listeners (instant, same serverless instance)
 * 2. Redis list (cross-instance, ~2-3s latency via polling)
 *
 * Fire-and-forget — never throws, never blocks the caller.
 */
export function emitSSE(event: Omit<SSEEvent, "timestamp" | "id">): void {
  try {
    const fullEvent: SSEEvent = {
      ...event,
      id: generateEventId(),
      timestamp: new Date().toISOString(),
    };

    // 1. In-process delivery (instant)
    const orgListeners = listeners.get(event.orgId);
    if (orgListeners && orgListeners.size > 0) {
      for (const listener of orgListeners) {
        try {
          listener(fullEvent);
        } catch {
          // Never let a broken listener crash the emitter
        }
      }
    }

    // 2. Redis cross-instance delivery (fire-and-forget)
    if (redis) {
      const key = `${REDIS_KEY_PREFIX}${event.orgId}`;
      const serialized = JSON.stringify(fullEvent);

      // Push to Redis list, trim to max size, set TTL
      // All operations are fire-and-forget — don't await
      Promise.all([
        redis.lpush(key, serialized),
        redis.ltrim(key, 0, REDIS_MAX_EVENTS - 1),
        redis.expire(key, REDIS_TTL_SECONDS),
      ]).catch((error) => {
        logger.warn("Redis SSE publish failed", { module: "sse", orgId: event.orgId, error: String(error) });
      });
    }
  } catch {
    // Fire-and-forget — silently ignore
  }
}

/**
 * Get the current number of connected listeners for an org.
 * Useful for health checks and monitoring.
 */
export function getListenerCount(orgId: string): number {
  return listeners.get(orgId)?.size ?? 0;
}

/**
 * Get total listener count across all orgs.
 */
export function getTotalListenerCount(): number {
  let total = 0;
  for (const orgListeners of listeners.values()) {
    total += orgListeners.size;
  }
  return total;
}

/**
 * Check if Redis is being used for cross-instance SSE delivery.
 */
export function isRedisSSEEnabled(): boolean {
  return redis !== null;
}

// --- Event Type Constants ---

export const SSE_EVENTS = {
  // Investor lifecycle
  INVESTOR_APPLIED: "investor.applied",
  INVESTOR_COMMITTED: "investor.committed",
  INVESTOR_FUNDED: "investor.funded",
  INVESTOR_STAGE_CHANGED: "investor.stage_changed",

  // Wire / payment
  WIRE_PROOF_UPLOADED: "wire.proof_uploaded",
  WIRE_CONFIRMED: "wire.confirmed",

  // Documents
  DOCUMENT_UPLOADED: "document.uploaded",
  DOCUMENT_APPROVED: "document.approved",
  DOCUMENT_REJECTED: "document.rejected",
  DOCUMENT_SIGNED: "document.signed",

  // Fund
  FUND_AGGREGATE_UPDATED: "fund.aggregate_updated",

  // Activity
  ACTIVITY_NEW: "activity.new",
  DASHBOARD_REFRESH: "dashboard.refresh",
} as const;
