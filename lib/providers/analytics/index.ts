import type { AnalyticsProvider, AnalyticsProviderConfig, AnalyticsProviderType } from "./types";
import { PostHogAnalyticsProvider } from "./posthog-adapter";

export * from "./types";
export { PostHogAnalyticsProvider } from "./posthog-adapter";

let cachedProvider: AnalyticsProvider | null = null;
let cachedProviderType: AnalyticsProviderType | null = null;

function getAnalyticsConfigFromEnv(): AnalyticsProviderConfig {
  const provider = (process.env.ANALYTICS_PROVIDER || "posthog") as AnalyticsProviderType;

  return {
    provider,
    apiKey: process.env.POSTHOG_SERVER_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY,
    host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
  };
}

export function createAnalyticsProvider(config?: AnalyticsProviderConfig): AnalyticsProvider {
  const providerType = config?.provider || "posthog";

  switch (providerType) {
    case "posthog":
      return new PostHogAnalyticsProvider(config);
    case "mixpanel":
    case "amplitude":
      throw new Error(`Analytics provider "${providerType}" is not yet implemented`);
    default:
      throw new Error(`Unsupported analytics provider: ${providerType}`);
  }
}

export function getAnalyticsProvider(): AnalyticsProvider {
  const config = getAnalyticsConfigFromEnv();

  if (!cachedProvider || cachedProviderType !== config.provider) {
    cachedProvider = createAnalyticsProvider(config);
    cachedProviderType = config.provider;
  }

  return cachedProvider;
}

export function resetAnalyticsProvider(): void {
  cachedProvider = null;
  cachedProviderType = null;
}
