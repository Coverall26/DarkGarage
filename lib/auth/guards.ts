/**
 * Auth Guards — Consolidated Barrel File
 *
 * Single import point for ALL authentication and authorization functions.
 *
 * Usage:
 *   import { enforceRBAC, requireAdmin, requireLPAuth, ... } from "@/lib/auth/guards";
 *
 * This module re-exports from:
 *   - rbac.ts — Team-scoped RBAC (Pages + App Router)
 *   - role-hierarchy.ts — Canonical ROLE_HIERARCHY + helpers
 *   - crm-roles.ts — CRM-specific 3-level permissions
 *   - admin-guard.ts — Admin portal SSR/GSSP guards
 *   - with-role.ts — Simple LP/GP role checking
 *   - authorization.ts — Portal authorization helpers
 *   - getMiddlewareUser.ts — Edge middleware user extraction
 *   - paywall.ts — FundRoom subscription paywall
 *   - with-team-auth-pages.ts — Pages Router team auth (legacy, 2 consumers)
 */

// ── Core RBAC (94 consumers — dominant auth module) ──
export {
  enforceRBAC,
  requireAdmin,
  requireTeamMember,
  requireGPAccess,
  hasRole,
  enforceRBACAppRouter,
  requireAdminAppRouter,
  requireTeamMemberAppRouter,
  requireGPAccessAppRouter,
  requireLPAuth,
  requireLPAuthAppRouter,
  requireAuthAppRouter,
  withAuth,
} from "@/lib/auth/rbac";

export type {
  RBACRole,
  RBACResult,
  LPAuthResult,
  AuthLevel,
} from "@/lib/auth/rbac";

// ── Role Hierarchy (shared canonical source) ──
export {
  ROLE_HIERARCHY,
  meetsMinimumRole,
  GP_ROLES,
  ADMIN_ROLES,
  ALL_ROLES,
} from "@/lib/auth/role-hierarchy";

// ── CRM Roles (13 consumers — contacts + outreach routes) ──
export {
  resolveCrmRole,
  hasCrmPermission,
  enforceCrmRole,
  enforceCrmRoleAppRouter,
} from "@/lib/auth/crm-roles";

// ── Admin Portal Guards (2 consumers — SSR pages) ──
export {
  requireAdminPortalAccess,
  requireAdminAccess,
  withAdminGuard,
} from "@/lib/auth/admin-guard";

export type { AdminPortalGuardResult } from "@/lib/auth/admin-guard";

// ── LP/GP Role System (7 consumers) ──
export {
  getUserWithRole,
  requireRole,
  filterByInvestorIfLP,
} from "@/lib/auth/with-role";

export type {
  UserRole,
  AuthenticatedUser,
  RoleCheckResult,
} from "@/lib/auth/with-role";

// ── Portal Authorization (1 consumer — [...nextauth]) ──
export {
  checkIsAdmin,
  checkViewerAccess,
  authorizeAdminPortal,
  authorizeVisitorPortal,
} from "@/lib/auth/authorization";

export type { AuthorizationResult } from "@/lib/auth/authorization";

// ── Edge Middleware User Extraction ──
export {
  getMiddlewareUser,
  getMiddlewareUserFromReq,
} from "@/lib/auth/getMiddlewareUser";

// ── FundRoom Paywall (6 consumers) ──
export {
  requireFundroomActive,
  requireFundroomActiveByFund,
  getActivationStatus,
  clearPlatformSettingsCache,
  PAYWALL_ERROR,
} from "@/lib/auth/paywall";

// ── Pages Router Team Auth (legacy — 2 consumers) ──
export { withTeamAuthPages } from "@/lib/auth/with-team-auth-pages";
export type { PagesTeamAuthResult } from "@/lib/auth/with-team-auth-pages";
