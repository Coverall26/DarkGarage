/**
 * Middleware Chaining Utility
 *
 * Lightweight utility for composing edge middleware functions.
 * Each middleware in the chain either:
 *   - Returns a NextResponse (terminates the chain, sends that response)
 *   - Returns null (passes to the next middleware in the chain)
 *
 * If all middlewares return null, NextResponse.next() is returned.
 *
 * Edge-compatible: No Prisma, no Node.js-only imports.
 */

import { NextRequest, NextResponse } from "next/server";

export type MiddlewareFn =
  | ((req: NextRequest) => Promise<NextResponse | null>)
  | ((req: NextRequest) => NextResponse | null);

/**
 * Chains middleware functions. Each function either:
 * - Returns a NextResponse (terminates chain, sends that response)
 * - Returns null (passes to next middleware in chain)
 *
 * If all middlewares return null, NextResponse.next() is returned.
 */
export async function chain(
  req: NextRequest,
  middlewares: MiddlewareFn[],
): Promise<NextResponse> {
  for (const middleware of middlewares) {
    const result = await middleware(req);
    if (result) return result;
  }
  return NextResponse.next();
}

/**
 * Creates a middleware that only runs for matching path prefixes.
 * If the request path doesn't match any prefix, the middleware is skipped (returns null).
 */
export function withPathPrefix(
  prefix: string | string[],
  fn: MiddlewareFn,
): MiddlewareFn {
  const prefixes = Array.isArray(prefix) ? prefix : [prefix];
  return async (req: NextRequest) => {
    const path = req.nextUrl.pathname;
    if (prefixes.some((p) => path.startsWith(p))) {
      return fn(req);
    }
    return null;
  };
}
