/**
 * RBAC (Role-Based Access Control) Enforcement
 *
 * Fine-grained role enforcement for API routes.
 * Implements the Master Plan's OWNER / GP_ADMIN / GP_VIEWER / LP role system.
 *
 * Usage:
 *   const auth = await enforceRBAC(req, res, { roles: ["OWNER", "ADMIN"], teamId: "..." });
 *   if (!auth) return; // Response already sent (401/403)
 *   // auth.userId, auth.teamId, auth.role available
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";

export type RBACRole =
  | "OWNER"
  | "SUPER_ADMIN"
  | "ADMIN"
  | "MANAGER"
  | "MEMBER";

export interface RBACResult {
  userId: string;
  email: string;
  teamId: string;
  role: RBACRole;
  session: { user: CustomUser };
}

interface EnforceRBACOptions {
  /** Allowed roles for this endpoint */
  roles: RBACRole[];
  /** Team ID — if not provided, extracted from req.query.teamId */
  teamId?: string;
  /** If true, the teamId query parameter is required */
  requireTeamId?: boolean;
}

/**
 * Enforce RBAC on an API route.
 *
 * Returns the authenticated user context if authorized, or null if
 * a 401/403 response has already been sent.
 */
export async function enforceRBAC(
  req: NextApiRequest,
  res: NextApiResponse,
  options: EnforceRBACOptions,
): Promise<RBACResult | null> {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const user = session.user as CustomUser;
  const teamId =
    options.teamId ||
    (req.query.teamId as string) ||
    (req.body?.teamId as string);

  if (!teamId && options.requireTeamId !== false) {
    res.status(400).json({ error: "teamId is required" });
    return null;
  }

  if (!teamId) {
    // No team scoping — just verify session
    return {
      userId: user.id,
      email: user.email || "",
      teamId: "",
      role: "MEMBER",
      session: { user },
    };
  }

  const userTeam = await prisma.userTeam.findFirst({
    where: {
      userId: user.id,
      teamId,
      role: { in: options.roles },
      status: "ACTIVE",
    },
  });

  if (!userTeam) {
    res.status(403).json({ error: "Forbidden: insufficient permissions" });
    return null;
  }

  return {
    userId: user.id,
    email: user.email || "",
    teamId,
    role: userTeam.role as RBACRole,
    session: { user },
  };
}

/** Shortcut: require OWNER or ADMIN roles */
export async function requireAdmin(
  req: NextApiRequest,
  res: NextApiResponse,
  teamId?: string,
): Promise<RBACResult | null> {
  return enforceRBAC(req, res, {
    roles: ["OWNER", "SUPER_ADMIN", "ADMIN"],
    teamId,
  });
}

/** Shortcut: require any team member role */
export async function requireTeamMember(
  req: NextApiRequest,
  res: NextApiResponse,
  teamId?: string,
): Promise<RBACResult | null> {
  return enforceRBAC(req, res, {
    roles: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],
    teamId,
  });
}

/** Shortcut: require GP-level access (owner, admin, or manager) */
export async function requireGPAccess(
  req: NextApiRequest,
  res: NextApiResponse,
  teamId?: string,
): Promise<RBACResult | null> {
  return enforceRBAC(req, res, {
    roles: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
    teamId,
  });
}

/** Check if a user has a specific role in a team (no response sent) */
export async function hasRole(
  userId: string,
  teamId: string,
  roles: RBACRole[],
): Promise<boolean> {
  const userTeam = await prisma.userTeam.findFirst({
    where: {
      userId,
      teamId,
      role: { in: roles },
      status: "ACTIVE",
    },
  });
  return !!userTeam;
}

// ── App Router Variants ──

import { NextResponse } from "next/server";

interface AppRouterRBACOptions {
  /** Allowed roles for this endpoint */
  roles: RBACRole[];
  /** Team ID — must be passed explicitly (no req.query in App Router) */
  teamId?: string;
  /** If true, teamId is required (default: true) */
  requireTeamId?: boolean;
}

/**
 * Enforce RBAC on an App Router API route.
 *
 * Returns the RBACResult if authorized, or a NextResponse error if not.
 *
 * Usage:
 *   const auth = await enforceRBACAppRouter({ roles: ["OWNER", "ADMIN"], teamId });
 *   if (auth instanceof NextResponse) return auth;
 *   // auth is now RBACResult
 */
export async function enforceRBACAppRouter(
  options: AppRouterRBACOptions,
): Promise<RBACResult | NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as CustomUser;
  const teamId = options.teamId;

  if (!teamId && options.requireTeamId !== false) {
    return NextResponse.json(
      { error: "teamId is required" },
      { status: 400 },
    );
  }

  if (!teamId) {
    // No team scoping — just verify session
    return {
      userId: user.id,
      email: user.email || "",
      teamId: "",
      role: "MEMBER" as RBACRole,
      session: { user },
    };
  }

  const userTeam = await prisma.userTeam.findFirst({
    where: {
      userId: user.id,
      teamId,
      role: { in: options.roles },
      status: "ACTIVE",
    },
  });

  if (!userTeam) {
    return NextResponse.json(
      { error: "Forbidden: insufficient permissions" },
      { status: 403 },
    );
  }

  return {
    userId: user.id,
    email: user.email || "",
    teamId,
    role: userTeam.role as RBACRole,
    session: { user },
  };
}

/** App Router shortcut: require OWNER or ADMIN roles */
export async function requireAdminAppRouter(
  teamId?: string,
  options?: { requireTeamId?: boolean },
): Promise<RBACResult | NextResponse> {
  return enforceRBACAppRouter({
    roles: ["OWNER", "SUPER_ADMIN", "ADMIN"],
    teamId,
    // When no teamId is provided, default to not requiring it
    // (the route will do its own team lookup)
    requireTeamId: options?.requireTeamId ?? (teamId ? true : false),
  });
}

/** App Router shortcut: require any team member role */
export async function requireTeamMemberAppRouter(
  teamId?: string,
): Promise<RBACResult | NextResponse> {
  return enforceRBACAppRouter({
    roles: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],
    teamId,
    requireTeamId: teamId ? true : false,
  });
}

/** App Router shortcut: require GP-level access */
export async function requireGPAccessAppRouter(
  teamId?: string,
): Promise<RBACResult | NextResponse> {
  return enforceRBACAppRouter({
    roles: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
    teamId,
    requireTeamId: teamId ? true : false,
  });
}

// ── Higher-Order Function Wrappers ──

export type AuthLevel = "public" | "authenticated" | "admin" | "gp" | "member" | "owner";

interface WithAuthOptions {
  /** Authentication level required */
  level: AuthLevel;
  /** Allowed HTTP methods (e.g. ["GET", "POST"]). If omitted, all methods allowed */
  methods?: string[];
}

type PagesRouterHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
  auth: RBACResult,
) => Promise<void>;

/**
 * Higher-order function that wraps a Pages Router API handler with auth + RBAC.
 *
 * Usage:
 *   export default withAuth({ level: "admin" }, async (req, res, auth) => {
 *     // auth.userId, auth.teamId, auth.role available
 *     res.json({ ok: true });
 *   });
 *
 * Levels:
 *   - "public": No auth required (pass-through)
 *   - "authenticated": Session required, no role check
 *   - "member": Any team member
 *   - "gp": OWNER / SUPER_ADMIN / ADMIN / MANAGER
 *   - "admin": OWNER / SUPER_ADMIN / ADMIN
 *   - "owner": OWNER only
 */
export function withAuth(
  options: WithAuthOptions,
  handler: PagesRouterHandler,
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Method check
    if (options.methods && !options.methods.includes(req.method || "GET")) {
      res.setHeader("Allow", options.methods.join(", "));
      res.status(405).json({ error: `Method ${req.method} not allowed` });
      return;
    }

    // Public routes — no auth needed
    if (options.level === "public") {
      const emptyAuth: RBACResult = {
        userId: "",
        email: "",
        teamId: "",
        role: "MEMBER",
        session: { user: {} as CustomUser },
      };
      return handler(req, res, emptyAuth);
    }

    // All other levels require a session
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = session.user as CustomUser;

    // "authenticated" — session only, no team/role check
    if (options.level === "authenticated") {
      const auth: RBACResult = {
        userId: user.id,
        email: user.email || "",
        teamId: "",
        role: "MEMBER",
        session: { user },
      };
      return handler(req, res, auth);
    }

    // Levels that require team membership
    const roleMap: Record<string, RBACRole[]> = {
      member: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],
      gp: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
      admin: ["OWNER", "SUPER_ADMIN", "ADMIN"],
      owner: ["OWNER"],
    };

    const roles = roleMap[options.level];
    if (!roles) {
      res.status(500).json({ error: "Invalid auth level configuration" });
      return;
    }

    const auth = await enforceRBAC(req, res, { roles });
    if (!auth) return; // Response already sent
    return handler(req, res, auth);
  };
}

// ── LP Authentication Helper ──

export interface LPAuthResult {
  userId: string;
  email: string;
  investorId: string | null;
  session: { user: CustomUser };
}

/**
 * Authenticate LP user and return investor profile context.
 *
 * Pages Router usage:
 *   const auth = await requireLPAuth(req, res);
 *   if (!auth) return; // 401 already sent
 *   // auth.userId, auth.investorId available
 *
 * @returns LPAuthResult or null (response already sent)
 */
export async function requireLPAuth(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<LPAuthResult | null> {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const user = session.user as CustomUser;

  const investor = await prisma.investor.findFirst({
    where: {
      OR: [
        { userId: user.id },
        { user: { email: user.email || "" } },
      ],
    },
    select: { id: true },
  });

  return {
    userId: user.id,
    email: user.email || "",
    investorId: investor?.id || null,
    session: { user },
  };
}

/**
 * App Router LP auth helper.
 *
 * Usage:
 *   const auth = await requireLPAuthAppRouter();
 *   if (auth instanceof NextResponse) return auth;
 *   // auth.userId, auth.investorId available
 */
export async function requireLPAuthAppRouter(): Promise<
  LPAuthResult | NextResponse
> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as CustomUser;

  const investor = await prisma.investor.findFirst({
    where: {
      OR: [
        { userId: user.id },
        { user: { email: user.email || "" } },
      ],
    },
    select: { id: true },
  });

  return {
    userId: user.id,
    email: user.email || "",
    investorId: investor?.id || null,
    session: { user },
  };
}

/**
 * Authenticate session only — no team or role checks.
 * For App Router routes that just need a logged-in user.
 */
export async function requireAuthAppRouter(): Promise<
  RBACResult | NextResponse
> {
  return enforceRBACAppRouter({
    roles: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],
    requireTeamId: false,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CENTRALIZED RBAC PERMISSION MATRIX
// ═══════════════════════════════════════════════════════════════════════════
//
// Single source of truth for role→permission mappings across the platform.
// Every API route handler should use `checkPermission()` or the shortcut
// functions above (requireAdmin, requireGPAccess, etc.) — NOT inline role
// arrays.
//
// Role hierarchy (highest → lowest):
//   OWNER > SUPER_ADMIN > ADMIN > MANAGER > MEMBER
//
// Principle: higher roles inherit all permissions of lower roles.
//
// CRM roles (VIEWER / CONTRIBUTOR / MANAGER) are a separate, orthogonal
// system — see lib/auth/crm-roles.ts. They do NOT map 1:1 to team roles.
//
// ═══════════════════════════════════════════════════════════════════════════

/**
 * All platform-level permissions.
 *
 * Naming: `{resource}:{action}`.
 * Resources correspond to Prisma models or logical feature domains.
 * Actions are standard CRUD plus domain-specific verbs.
 */
export const Permission = {
  // ── Fund Management ──
  FUND_CREATE:            "fund:create",
  FUND_READ:              "fund:read",
  FUND_UPDATE:            "fund:update",
  FUND_DELETE:            "fund:delete",
  FUND_MANAGE_SETTINGS:   "fund:manage_settings",

  // ── Investor Management ──
  INVESTOR_READ:          "investor:read",
  INVESTOR_CREATE:        "investor:create",
  INVESTOR_UPDATE:        "investor:update",
  INVESTOR_DELETE:        "investor:delete",
  INVESTOR_APPROVE:       "investor:approve",
  INVESTOR_REJECT:        "investor:reject",
  INVESTOR_BULK_IMPORT:   "investor:bulk_import",
  INVESTOR_EXPORT:        "investor:export",

  // ── Investment / Commitment ──
  INVESTMENT_READ:        "investment:read",
  INVESTMENT_UPDATE:      "investment:update",
  INVESTMENT_MANUAL_ENTRY: "investment:manual_entry",

  // ── Wire Transfer ──
  WIRE_READ:              "wire:read",
  WIRE_CONFIGURE:         "wire:configure",
  WIRE_CONFIRM:           "wire:confirm",

  // ── Document Management ──
  DOCUMENT_READ:          "document:read",
  DOCUMENT_UPLOAD:        "document:upload",
  DOCUMENT_REVIEW:        "document:review",
  DOCUMENT_DELETE:        "document:delete",
  DOCUMENT_TEMPLATE_MANAGE: "document:template_manage",

  // ── E-Signature ──
  ESIGN_SEND:             "esign:send",
  ESIGN_VOID:             "esign:void",
  ESIGN_REMIND:           "esign:remind",
  ESIGN_READ:             "esign:read",

  // ── Dataroom ──
  DATAROOM_CREATE:        "dataroom:create",
  DATAROOM_READ:          "dataroom:read",
  DATAROOM_UPDATE:        "dataroom:update",
  DATAROOM_DELETE:        "dataroom:delete",
  DATAROOM_MANAGE_LINKS:  "dataroom:manage_links",
  DATAROOM_VIEW_ANALYTICS: "dataroom:view_analytics",

  // ── Team Management ──
  TEAM_INVITE:            "team:invite",
  TEAM_REMOVE_MEMBER:     "team:remove_member",
  TEAM_CHANGE_ROLE:       "team:change_role",
  TEAM_READ_MEMBERS:      "team:read_members",

  // ── Settings ──
  SETTINGS_READ:          "settings:read",
  SETTINGS_UPDATE:        "settings:update",
  SETTINGS_BILLING:       "settings:billing",

  // ── Reports & Analytics ──
  REPORT_VIEW:            "report:view",
  REPORT_EXPORT:          "report:export",
  REPORT_FORM_D:          "report:form_d",
  ANALYTICS_VIEW:         "analytics:view",

  // ── Marketplace ──
  MARKETPLACE_MANAGE_DEAL: "marketplace:manage_deal",
  MARKETPLACE_READ_DEAL:  "marketplace:read_deal",
  MARKETPLACE_MANAGE_LISTING: "marketplace:manage_listing",

  // ── Audit ──
  AUDIT_VIEW:             "audit:view",
  AUDIT_EXPORT:           "audit:export",

  // ── Platform Admin ──
  PLATFORM_SETTINGS:      "platform:settings",
  PLATFORM_ACTIVATION:    "platform:activation",

  // ── Approval Queue ──
  APPROVAL_READ:          "approval:read",
  APPROVAL_ACTION:        "approval:action",
} as const;

export type PermissionKey = (typeof Permission)[keyof typeof Permission];

/**
 * Centralized permission matrix.
 *
 * Maps each permission to the set of team roles that are granted access.
 * Role hierarchy is NOT implicit — each permission explicitly lists all
 * allowed roles for clarity and auditability.
 *
 * When adding a new permission:
 *   1. Add the constant to `Permission` above
 *   2. Add the role mapping to `PERMISSION_MATRIX` below
 *   3. Use `checkPermission(role, Permission.YOUR_NEW_PERM)` in the route
 */
export const PERMISSION_MATRIX: Record<PermissionKey, readonly RBACRole[]> = {
  // ── Fund Management ──
  [Permission.FUND_CREATE]:            ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.FUND_READ]:              ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],
  [Permission.FUND_UPDATE]:            ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.FUND_DELETE]:            ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.FUND_MANAGE_SETTINGS]:   ["OWNER", "SUPER_ADMIN", "ADMIN"],

  // ── Investor Management ──
  [Permission.INVESTOR_READ]:          ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
  [Permission.INVESTOR_CREATE]:        ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
  [Permission.INVESTOR_UPDATE]:        ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
  [Permission.INVESTOR_DELETE]:        ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.INVESTOR_APPROVE]:       ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.INVESTOR_REJECT]:        ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.INVESTOR_BULK_IMPORT]:   ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.INVESTOR_EXPORT]:        ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],

  // ── Investment / Commitment ──
  [Permission.INVESTMENT_READ]:        ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
  [Permission.INVESTMENT_UPDATE]:      ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.INVESTMENT_MANUAL_ENTRY]: ["OWNER", "SUPER_ADMIN", "ADMIN"],

  // ── Wire Transfer ──
  [Permission.WIRE_READ]:              ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
  [Permission.WIRE_CONFIGURE]:         ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.WIRE_CONFIRM]:           ["OWNER", "SUPER_ADMIN", "ADMIN"],

  // ── Document Management ──
  [Permission.DOCUMENT_READ]:          ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],
  [Permission.DOCUMENT_UPLOAD]:        ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
  [Permission.DOCUMENT_REVIEW]:        ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.DOCUMENT_DELETE]:        ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.DOCUMENT_TEMPLATE_MANAGE]: ["OWNER", "SUPER_ADMIN", "ADMIN"],

  // ── E-Signature ──
  [Permission.ESIGN_SEND]:             ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
  [Permission.ESIGN_VOID]:             ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.ESIGN_REMIND]:           ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
  [Permission.ESIGN_READ]:             ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],

  // ── Dataroom ──
  [Permission.DATAROOM_CREATE]:        ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
  [Permission.DATAROOM_READ]:          ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],
  [Permission.DATAROOM_UPDATE]:        ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
  [Permission.DATAROOM_DELETE]:        ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.DATAROOM_MANAGE_LINKS]:  ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
  [Permission.DATAROOM_VIEW_ANALYTICS]: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],

  // ── Team Management ──
  [Permission.TEAM_INVITE]:            ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.TEAM_REMOVE_MEMBER]:     ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.TEAM_CHANGE_ROLE]:       ["OWNER", "SUPER_ADMIN"],
  [Permission.TEAM_READ_MEMBERS]:      ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],

  // ── Settings ──
  [Permission.SETTINGS_READ]:          ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
  [Permission.SETTINGS_UPDATE]:        ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.SETTINGS_BILLING]:       ["OWNER", "SUPER_ADMIN"],

  // ── Reports & Analytics ──
  [Permission.REPORT_VIEW]:            ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
  [Permission.REPORT_EXPORT]:          ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.REPORT_FORM_D]:          ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.ANALYTICS_VIEW]:         ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],

  // ── Marketplace ──
  [Permission.MARKETPLACE_MANAGE_DEAL]: ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
  [Permission.MARKETPLACE_READ_DEAL]:  ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER", "MEMBER"],
  [Permission.MARKETPLACE_MANAGE_LISTING]: ["OWNER", "SUPER_ADMIN", "ADMIN"],

  // ── Audit ──
  [Permission.AUDIT_VIEW]:             ["OWNER", "SUPER_ADMIN", "ADMIN"],
  [Permission.AUDIT_EXPORT]:           ["OWNER", "SUPER_ADMIN", "ADMIN"],

  // ── Platform Admin ──
  [Permission.PLATFORM_SETTINGS]:      ["OWNER"],
  [Permission.PLATFORM_ACTIVATION]:    ["OWNER", "SUPER_ADMIN"],

  // ── Approval Queue ──
  [Permission.APPROVAL_READ]:          ["OWNER", "SUPER_ADMIN", "ADMIN", "MANAGER"],
  [Permission.APPROVAL_ACTION]:        ["OWNER", "SUPER_ADMIN", "ADMIN"],
};

// ── Permission Helpers ──

/**
 * Check if a role has a specific permission.
 *
 * Usage:
 *   if (!checkPermission(auth.role, Permission.WIRE_CONFIRM)) {
 *     return res.status(403).json({ error: "Forbidden" });
 *   }
 */
export function checkPermission(
  role: RBACRole | string,
  permission: PermissionKey,
): boolean {
  const allowedRoles = PERMISSION_MATRIX[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role as RBACRole);
}

/**
 * Get all permissions granted to a specific role.
 *
 * Usage:
 *   const perms = getPermissionsForRole("MANAGER");
 *   // → ["fund:read", "investor:read", "investor:create", ...]
 */
export function getPermissionsForRole(role: RBACRole): PermissionKey[] {
  return (Object.entries(PERMISSION_MATRIX) as [PermissionKey, readonly RBACRole[]][])
    .filter(([, roles]) => roles.includes(role))
    .map(([perm]) => perm);
}

/**
 * Get the minimum role required for a specific permission.
 * Based on the role hierarchy: MEMBER < MANAGER < ADMIN < SUPER_ADMIN < OWNER.
 *
 * Usage:
 *   getMinimumRole(Permission.WIRE_CONFIRM) // → "ADMIN"
 *   getMinimumRole(Permission.FUND_READ)    // → "MEMBER"
 */
export function getMinimumRole(permission: PermissionKey): RBACRole | null {
  const allowedRoles = PERMISSION_MATRIX[permission];
  if (!allowedRoles || allowedRoles.length === 0) return null;

  const hierarchy: RBACRole[] = ["MEMBER", "MANAGER", "ADMIN", "SUPER_ADMIN", "OWNER"];
  for (const role of hierarchy) {
    if (allowedRoles.includes(role)) return role;
  }
  return null;
}

/**
 * Enforce a specific permission in an App Router handler.
 *
 * Combines session validation + team membership + permission check in one call.
 *
 * Usage:
 *   const auth = await enforcePermissionAppRouter(Permission.WIRE_CONFIRM, teamId);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth.userId, auth.role available
 */
export async function enforcePermissionAppRouter(
  permission: PermissionKey,
  teamId?: string,
): Promise<RBACResult | NextResponse> {
  const allowedRoles = PERMISSION_MATRIX[permission];
  if (!allowedRoles) {
    return NextResponse.json(
      { error: "Invalid permission configuration" },
      { status: 500 },
    );
  }

  return enforceRBACAppRouter({
    roles: [...allowedRoles],
    teamId,
    requireTeamId: teamId ? true : false,
  });
}

/**
 * Enforce a specific permission in a Pages Router handler.
 *
 * Usage:
 *   const auth = await enforcePermission(req, res, Permission.WIRE_CONFIRM, teamId);
 *   if (!auth) return; // 401/403 already sent
 */
export async function enforcePermission(
  req: NextApiRequest,
  res: NextApiResponse,
  permission: PermissionKey,
  teamId?: string,
): Promise<RBACResult | null> {
  const allowedRoles = PERMISSION_MATRIX[permission];
  if (!allowedRoles) {
    res.status(500).json({ error: "Invalid permission configuration" });
    return null;
  }

  return enforceRBAC(req, res, {
    roles: [...allowedRoles],
    teamId,
  });
}
