import { useEffect, useState, useCallback } from "react";
import { logger } from "@/lib/logger";

import { getSession } from "next-auth/react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

import { getPostHogConfig } from "@/lib/posthog";
import { CONSENT_COOKIE_NAME, parseConsentCookie, hasConsent } from "@/lib/tracking/cookie-consent";
import { CustomUser } from "@/lib/types";

let posthogInitialized = false;

/**
 * Read the current analytics consent status from the cookie.
 * Returns true only if the user has explicitly accepted analytics cookies.
 */
function hasAnalyticsConsent(): boolean {
  if (typeof document === "undefined") return false;
  const cookies = document.cookie.split(";").map((c) => c.trim());
  const consentCookie = cookies.find((c) => c.startsWith(`${CONSENT_COOKIE_NAME}=`));
  if (!consentCookie) return false;
  const value = consentCookie.split("=").slice(1).join("=");
  const prefs = parseConsentCookie(decodeURIComponent(value));
  return hasConsent(prefs, "analytics");
}

export const PostHogCustomProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isReady, setIsReady] = useState(false);

  const initPostHog = useCallback(() => {
    if (typeof window === "undefined" || posthogInitialized) return;

    const posthogConfig = getPostHogConfig();
    if (!posthogConfig) return;

    // Respect cookie consent — only initialize if analytics consent was given
    if (!hasAnalyticsConsent()) {
      logger.info("PostHog skipped — no analytics consent", { module: "posthog-provider" });
      return;
    }

    try {
      const uiHost = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST;
      posthog.init(posthogConfig.key, {
        api_host: posthogConfig.host,
        ...(uiHost ? { ui_host: uiHost } : {}),
        disable_session_recording: true,
        autocapture: false,
        bootstrap: { distinctID: undefined },
        persistence: "memory",
        loaded: (ph) => {
          posthogInitialized = true;
          if (process.env.NODE_ENV === "development") {
            try { ph.debug(); } catch (e) { /* ignore */ }
          }
          getSession()
            .then((session) => {
              if (session) {
                try {
                  ph.identify(
                    (session.user as CustomUser).email ??
                      (session.user as CustomUser).id,
                    {
                      email: (session.user as CustomUser).email,
                      userId: (session.user as CustomUser).id,
                    },
                  );
                } catch (e) { /* ignore analytics errors */ }
              } else {
                try { ph.reset(); } catch (e) { /* ignore */ }
              }
            })
            .catch(() => { /* ignore session errors */ });
        },
      });
    } catch (error) {
      // PostHog init failed (likely blocked by extension) - continue without analytics
      logger.warn("Analytics initialization skipped", { module: "posthog-provider" });
    }
  }, []);

  useEffect(() => {
    // Attempt initial init (will no-op if no consent)
    initPostHog();
    setIsReady(true);

    // Listen for consent changes — initialize PostHog if user accepts analytics later
    const handleConsentUpdate = () => {
      if (hasAnalyticsConsent() && !posthogInitialized) {
        initPostHog();
      } else if (!hasAnalyticsConsent() && posthogInitialized) {
        // User revoked consent — opt out of tracking
        try { posthog.opt_out_capturing(); } catch (e) { /* ignore */ }
        logger.info("PostHog opted out — analytics consent revoked", { module: "posthog-provider" });
      }
    };

    window.addEventListener("fr:consent-updated", handleConsentUpdate);
    return () => {
      window.removeEventListener("fr:consent-updated", handleConsentUpdate);
    };
  }, [initPostHog]);

  // Always render children immediately - don't block on PostHog
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
};
