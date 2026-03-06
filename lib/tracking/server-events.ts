/**
 * Server-Side Event Publishing
 *
 * Sends tracking events to PostHog from server-side code (API routes,
 * auth callbacks, etc.) using the posthog-node SDK.
 *
 * Falls back to console.log when PostHog is not configured.
 *
 * IMPORTANT: This file is server-only. Do NOT import from client components.
 * The barrel export (lib/tracking/index.ts) does NOT re-export this module.
 * Import directly: import { publishServerEvent } from "@/lib/tracking/server-events";
 *
 * Usage:
 *   publishServerEvent("funnel_signup_completed", { userId, method: "email" });
 *
 * PII RULES:
 *   - NEVER send email addresses, names, or other PII
 *   - Use userId only for user identification
 *   - See docs/TRACKING_RULES.md for the full policy
 */

import "server-only";

import { PostHog } from "posthog-node";
import { logger } from "@/lib/logger";

/** Properties allowed on server-side events — no PII fields. */
interface ServerEventProperties {
  userId?: string;
  teamId?: string;
  orgId?: string;
  portal?: string;
  method?: string;
  source?: string;
  dealId?: string;
  investorId?: string;
  plan?: string;
  priceId?: string;
  errorType?: string;
  declineCode?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Lazily initialised PostHog client.
 * Returns null when POSTHOG_SERVER_KEY (or NEXT_PUBLIC_POSTHOG_KEY) is not set.
 */
let _client: PostHog | null | undefined;

function getPostHogClient(): PostHog | null {
  if (_client !== undefined) return _client;

  const apiKey =
    process.env.POSTHOG_SERVER_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) {
    _client = null;
    return null;
  }

  _client = new PostHog(apiKey, {
    host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
    flushAt: 10,
    flushInterval: 5000,
  });

  return _client;
}

/**
 * Publish a server-side tracking event.
 *
 * @param eventName - A descriptive event name (e.g. "funnel_signup_completed")
 * @param properties - Key/value properties (must NOT include PII like email/name)
 *
 * Behaviour:
 *  - If PostHog key is set, publishes via posthog-node SDK.
 *  - Otherwise, logs to console so events are visible during development.
 *  - Errors are caught and logged — this function never throws.
 *  - Callers should NOT await this function (fire-and-forget).
 */
export async function publishServerEvent(
  eventName: string,
  properties: ServerEventProperties = {},
): Promise<void> {
  const client = getPostHogClient();

  if (!client) {
    // Dev/test fallback: log so events are visible
    logger.debug(`[FUNNEL] ${eventName}`, { module: "server-events", ...properties });
    return;
  }

  try {
    client.capture({
      distinctId: properties.userId || "server",
      event: eventName,
      properties: {
        ...properties,
        $lib: "posthog-node",
        source: properties.source || "server",
      },
    });
  } catch (error) {
    logger.warn("PostHog capture error", { module: "server-events", error: String(error) });
  }
}

/**
 * Flush pending PostHog events. Call during graceful shutdown.
 */
export async function flushServerEvents(): Promise<void> {
  const client = getPostHogClient();
  if (client) {
    await client.shutdown();
  }
}
