/**
 * Middleware User Context Extraction
 *
 * Reads the user identity headers injected by the edge middleware
 * (proxy.ts → edge-auth.ts → applyEdgeAuthHeaders).
 *
 * Route handlers can optionally use this to avoid a redundant
 * getServerSession() call when the middleware has already validated
 * the JWT. This is an optimization layer, NOT a replacement for
 * Prisma-based RBAC checks.
 *
 * Usage in App Router:
 *   import { getMiddlewareUser } from "@/lib/auth/getMiddlewareUser";
 *   const user = getMiddlewareUser(request.headers);
 *   if (user.id) { /* middleware-verified user *\/ }
 *
 * Usage in Pages Router:
 *   import { getMiddlewareUserFromReq } from "@/lib/auth/getMiddlewareUser";
 *   const user = getMiddlewareUserFromReq(req);
 *   if (user.id) { /* middleware-verified user *\/ }
 */

import type { IncomingMessage } from "http";

export interface MiddlewareUser {
  /** User ID from JWT (null if headers not present) */
  id: string | null;
  /** User email from JWT (null if headers not present) */
  email: string | null;
  /** User role from JWT (null if headers not present) */
  role: string | null;
}

/**
 * Extract middleware-injected user context from request headers.
 *
 * Works with both the Web API Headers object (App Router / NextRequest)
 * and Node.js IncomingMessage headers (Pages Router).
 *
 * @param headers - Web API Headers object
 * @returns MiddlewareUser with nullable fields
 */
export function getMiddlewareUser(headers: Headers): MiddlewareUser {
  return {
    id: headers.get("x-middleware-user-id"),
    email: headers.get("x-middleware-user-email"),
    role: headers.get("x-middleware-user-role"),
  };
}

/**
 * Extract middleware-injected user context from a Pages Router request.
 *
 * Pages Router uses Node.js IncomingMessage which stores headers
 * as lowercase key-value pairs (string | string[] | undefined).
 *
 * @param req - Node.js IncomingMessage (NextApiRequest)
 * @returns MiddlewareUser with nullable fields
 */
export function getMiddlewareUserFromReq(req: IncomingMessage): MiddlewareUser {
  const getHeader = (name: string): string | null => {
    const value = req.headers[name];
    if (Array.isArray(value)) return value[0] || null;
    return value || null;
  };

  return {
    id: getHeader("x-middleware-user-id"),
    email: getHeader("x-middleware-user-email"),
    role: getHeader("x-middleware-user-role"),
  };
}
