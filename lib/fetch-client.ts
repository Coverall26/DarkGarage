import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from "@/lib/security/csrf";

/**
 * Fetch wrapper that automatically includes the X-Requested-With: FundRoom
 * CSRF header on all requests. Use this for API mutations (POST, PUT, PATCH, DELETE)
 * instead of raw `fetch()` to ensure CSRF protection passes.
 *
 * For SWR GET requests, the `fetcher` from `lib/utils.ts` already includes the header.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: {
      [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
      ...init?.headers,
    },
  });
}

/**
 * JSON mutation helper. Sends a JSON body with CSRF header and returns parsed JSON.
 * Throws on non-OK responses.
 */
export async function apiMutate<T = unknown>(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const { method = "POST", body, headers = {} } = options;
  const res = await apiFetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    const error = new Error(text) as Error & { status: number };
    error.status = res.status;
    throw error;
  }

  return res.json();
}
