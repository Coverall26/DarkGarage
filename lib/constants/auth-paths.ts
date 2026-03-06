/**
 * Auth-related path constants for redirect loop prevention.
 *
 * Used by all login pages (investor, LP, admin) to detect when a `?next=`
 * parameter points back to a login page, which would cause a redirect loop.
 *
 * Also used to identify paths that should not be redirected to from
 * non-matching portals (e.g., admin routes from investor login).
 */

/** Paths that are login/auth pages — redirecting to these causes loops. */
export const AUTH_LOOP_PATHS = [
  "/login",
  "/admin/login",
  "/lp/login",
  "/register",
  "/verify",
] as const;

/**
 * Returns true if the given path would cause a redirect loop
 * (i.e., it points to an auth/login page).
 */
export function isAuthLoopPath(path: string): boolean {
  return AUTH_LOOP_PATHS.some((p) => path.includes(p));
}
