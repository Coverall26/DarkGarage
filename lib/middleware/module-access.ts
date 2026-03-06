/**
 * Module Access Middleware (v3 Rebrand)
 *
 * Provides higher-order functions for API routes to enforce product module
 * access and usage limits at the org level.
 *
 * HOFs:
 *   1. withModuleAccess(module) — Uses getServerSession auth. Checks if an
 *      org has the specified module enabled. Returns 403 with
 *      MODULE_NOT_AVAILABLE + upgrade suggestions if not.
 *
 *   2. withModuleAccessApp(module) — Uses edge-auth headers (faster, no
 *      DB session lookup). Same module check, for routes behind edge auth.
 *
 *   3. withModuleLimit(module, limitType, countFn) — Manual usage counting.
 *      Authenticates, resolves org, counts via countFn, checks limit.
 *
 *   4. withModuleLimitAuto(module, limitType) — Auto usage counting via
 *      provision engine's getModuleUsage(). No countFn needed.
 *
 * Inline helpers:
 *   - checkModuleAccess(orgId, module) — Returns 403 or null.
 *   - checkModuleLimit(orgId, module, limitType, currentCount) — Returns 403 or null.
 *   - checkModuleLimitAuto(orgId, module, limitType) — Auto-counts, returns 403 or null.
 *
 * Integration:
 *   These work alongside (not replace) the existing tier-based gates in
 *   lib/tier/gates.ts. Module access is the lower-level check — "is this
 *   feature enabled for this org?" — while tier gates do usage-based
 *   counting (e.g., e-sig monthly cap, contact count).
 *
 * v3 upgrade path naming:
 *   PRO ($29/mo) → Business ($39/mo) → FundRoom ($79/mo)
 *
 * Usage:
 *   // Session-based HOF (legacy routes)
 *   export const POST = withModuleAccess("SIGNSUITE")(async (req) => { ... });
 *
 *   // Edge-auth HOF (recommended for routes behind proxy.ts edge auth)
 *   export const POST = withModuleAccessApp("RAISE_CRM")(async (req) => { ... });
 *
 *   // Auto-counting limit HOF
 *   export const POST = withModuleLimitAuto("SIGNSUITE", "MONTHLY_ESIGN")(async (req) => { ... });
 *
 *   // Inline check inside an existing handler
 *   const moduleCheck = await checkModuleAccess(orgId, "RAISE_CRM");
 *   if (moduleCheck) return moduleCheck; // NextResponse 403
 *
 *   // Auto-counting limit check
 *   const limitCheck = await checkModuleLimitAuto(orgId, "RAISE_CRM", "MAX_CONTACTS");
 *   if (limitCheck) return limitCheck; // NextResponse 403
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import prisma from "@/lib/prisma";
import type { ProductModule } from "@prisma/client";
import {
  hasModule,
  getModuleLimit,
  isOverLimit,
  getModuleUsage,
} from "@/lib/modules/provision-engine";
import { getMiddlewareUser } from "@/lib/auth/getMiddlewareUser";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpgradePath {
  name: string;
  price: string;
  url: string;
}

export interface ModuleAccessError {
  error: "MODULE_NOT_AVAILABLE";
  module: string;
  upgrade_paths: UpgradePath[];
}

export interface ModuleLimitError {
  error: "LIMIT_EXCEEDED";
  module: string;
  limitType: string;
  current: number;
  limit: number;
  upgrade_paths: UpgradePath[];
}

// ---------------------------------------------------------------------------
// v3 Upgrade path suggestions
// ---------------------------------------------------------------------------

const BILLING_URL = "/admin/settings?tab=billing";

const UPGRADE_PATHS: Record<string, UpgradePath[]> = {
  // RaiseRoom — capital raise data rooms
  RAISEROOM: [
    { name: "Pro", price: "$29/mo", url: BILLING_URL },
    { name: "Business", price: "$39/mo", url: BILLING_URL },
    { name: "FundRoom", price: "$79/mo", url: BILLING_URL },
  ],
  // SignSuite — e-signature
  SIGNSUITE: [
    { name: "Pro", price: "$29/mo", url: BILLING_URL },
    { name: "Business", price: "$39/mo", url: BILLING_URL },
    { name: "FundRoom", price: "$79/mo", url: BILLING_URL },
  ],
  // PipelineIQ — CRM pipeline (replaces PIPELINE_IQ / PIPELINE_IQ_LITE)
  RAISE_CRM: [
    { name: "Pro — unlimited contacts", price: "$29/mo", url: BILLING_URL },
    { name: "Business — analytics & automation", price: "$39/mo", url: BILLING_URL },
    { name: "FundRoom", price: "$79/mo", url: BILLING_URL },
  ],
  // DataRoom — secure document sharing (available on all tiers)
  DATAROOM: [],
  // DataRoom engine (DOCROOMS) — document filing (available on all tiers)
  DOCROOMS: [],
  // FundRoom — full fund management (FUNDROOM tier only)
  FUNDROOM: [
    { name: "FundRoom", price: "$79/mo", url: BILLING_URL },
  ],
  // Legacy modules — kept for backward compatibility
  PIPELINE_IQ: [
    { name: "Pro", price: "$29/mo", url: BILLING_URL },
    { name: "FundRoom", price: "$79/mo", url: BILLING_URL },
  ],
  PIPELINE_IQ_LITE: [
    { name: "Pro — unlimited contacts", price: "$29/mo", url: BILLING_URL },
    { name: "PipelineIQ add-on", price: "Contact sales", url: BILLING_URL },
  ],
};

function getUpgradePaths(module: string): UpgradePath[] {
  return UPGRADE_PATHS[module] ?? [
    { name: "FundRoom", price: "$79/mo", url: BILLING_URL },
  ];
}

// ---------------------------------------------------------------------------
// Org resolution helpers
// ---------------------------------------------------------------------------

async function resolveOrgId(userId: string): Promise<string | null> {
  const userTeam = await prisma.userTeam.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { team: { select: { organizationId: true } } },
  });
  return userTeam?.team?.organizationId ?? null;
}

/**
 * Resolve organizationId from a teamId. Useful for routes that already
 * have the teamId from auth but need the orgId for module checks.
 */
export async function resolveOrgIdFromTeam(teamId: string): Promise<string | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { organizationId: true },
  });
  return team?.organizationId ?? null;
}

// ---------------------------------------------------------------------------
// Inline check functions (for use inside existing handlers)
// ---------------------------------------------------------------------------

/**
 * Check if an org has a module enabled. Returns a 403 NextResponse if not,
 * or null if access is granted.
 */
export async function checkModuleAccess(
  orgId: string,
  module: ProductModule,
): Promise<NextResponse | null> {
  const enabled = await hasModule(orgId, module);

  if (!enabled) {
    logger.info("Module access denied", {
      module: "module-access",
      metadata: { orgId, productModule: module },
    });

    const body: ModuleAccessError = {
      error: "MODULE_NOT_AVAILABLE",
      module,
      upgrade_paths: getUpgradePaths(module),
    };
    return NextResponse.json(body, { status: 403 });
  }

  return null;
}

/**
 * Check if an org has exceeded a module's usage limit. Returns a 403
 * NextResponse if over limit, or null if within limits.
 *
 * This variant requires the caller to supply `currentCount` manually.
 * For auto-counting, use `checkModuleLimitAuto()`.
 */
export async function checkModuleLimit(
  orgId: string,
  module: ProductModule,
  limitType: string,
  currentCount: number,
): Promise<NextResponse | null> {
  const over = await isOverLimit(orgId, module, limitType, currentCount);

  if (over) {
    const limit = await getModuleLimit(orgId, module, limitType);

    logger.info("Module limit exceeded", {
      module: "module-access",
      metadata: { orgId, productModule: module, limitType, currentCount, limit },
    });

    const body: ModuleLimitError = {
      error: "LIMIT_EXCEEDED",
      module,
      limitType,
      current: currentCount,
      limit: limit ?? 0,
      upgrade_paths: getUpgradePaths(module),
    };
    return NextResponse.json(body, { status: 403 });
  }

  return null;
}

/**
 * Auto-counting limit check. Uses `getModuleUsage()` from the provision
 * engine to count current usage, then checks against the configured limit.
 *
 * Returns a 403 NextResponse if over limit, or null if within limits.
 */
export async function checkModuleLimitAuto(
  orgId: string,
  module: ProductModule,
  limitType: string,
): Promise<NextResponse | null> {
  const currentCount = await getModuleUsage(orgId, module, limitType);
  return checkModuleLimit(orgId, module, limitType, currentCount);
}

// ---------------------------------------------------------------------------
// HOF: withModuleAccess (session-based auth)
// ---------------------------------------------------------------------------

type AppRouterHandler = (
  req: NextRequest,
  context?: { params?: Promise<Record<string, string>> },
) => Promise<NextResponse>;

/**
 * Higher-order function that wraps an App Router handler with a module
 * access check. Authenticates the user via getServerSession, resolves
 * their org, checks module access, and only then invokes the handler.
 *
 * For routes that already have their own auth, prefer the inline
 * `checkModuleAccess()` instead.
 */
export function withModuleAccess(module: ProductModule) {
  return (handler: AppRouterHandler): AppRouterHandler => {
    return async (req, context) => {
      // Authenticate
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Resolve org
      const orgId = await resolveOrgId(session.user.id);
      if (!orgId) {
        return NextResponse.json(
          { error: "No organization found for user" },
          { status: 403 },
        );
      }

      // Check module access
      const blocked = await checkModuleAccess(orgId, module);
      if (blocked) return blocked;

      return handler(req, context);
    };
  };
}

// ---------------------------------------------------------------------------
// HOF: withModuleAccessApp (edge-auth headers, no session lookup)
// ---------------------------------------------------------------------------

/**
 * Higher-order function using edge-auth headers for user identity.
 * Faster than withModuleAccess() because it skips getServerSession().
 *
 * Requires routes to be behind proxy.ts edge auth, which injects
 * x-middleware-user-id/email/role headers.
 *
 * Usage:
 *   export const POST = withModuleAccessApp("RAISE_CRM")(async (req) => { ... });
 */
export function withModuleAccessApp(module: ProductModule) {
  return (handler: AppRouterHandler): AppRouterHandler => {
    return async (req, context) => {
      // Extract user from edge-auth headers
      const user = getMiddlewareUser(req.headers);
      if (!user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Resolve org
      const orgId = await resolveOrgId(user.id);
      if (!orgId) {
        return NextResponse.json(
          { error: "No organization found for user" },
          { status: 403 },
        );
      }

      // Check module access
      const blocked = await checkModuleAccess(orgId, module);
      if (blocked) return blocked;

      return handler(req, context);
    };
  };
}

// ---------------------------------------------------------------------------
// HOF: withModuleLimit (manual counting)
// ---------------------------------------------------------------------------

type CountResolver = (
  req: NextRequest,
  orgId: string,
) => Promise<number>;

/**
 * Higher-order function that wraps an App Router handler with a module
 * limit check. Authenticates, resolves org, counts current usage via the
 * provided `countFn`, checks limit, and invokes handler if within bounds.
 */
export function withModuleLimit(
  module: ProductModule,
  limitType: string,
  countFn: CountResolver,
) {
  return (handler: AppRouterHandler): AppRouterHandler => {
    return async (req, context) => {
      // Authenticate
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Resolve org
      const orgId = await resolveOrgId(session.user.id);
      if (!orgId) {
        return NextResponse.json(
          { error: "No organization found for user" },
          { status: 403 },
        );
      }

      // Count current usage
      const currentCount = await countFn(req, orgId);

      // Check limit
      const blocked = await checkModuleLimit(orgId, module, limitType, currentCount);
      if (blocked) return blocked;

      return handler(req, context);
    };
  };
}

// ---------------------------------------------------------------------------
// HOF: withModuleLimitAuto (auto counting via provision engine)
// ---------------------------------------------------------------------------

/**
 * Higher-order function with automatic usage counting via the provision
 * engine's getModuleUsage(). No countFn needed — the engine queries the
 * appropriate tables based on limitType.
 *
 * Uses edge-auth headers for user identity (faster, no session lookup).
 *
 * Supported limitTypes: MONTHLY_ESIGN, MAX_CONTACTS, MAX_ROOMS, MAX_STORAGE_MB
 *
 * Usage:
 *   export const POST = withModuleLimitAuto("SIGNSUITE", "MONTHLY_ESIGN")(async (req) => { ... });
 */
export function withModuleLimitAuto(
  module: ProductModule,
  limitType: string,
) {
  return (handler: AppRouterHandler): AppRouterHandler => {
    return async (req, context) => {
      // Extract user from edge-auth headers
      const user = getMiddlewareUser(req.headers);
      if (!user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Resolve org
      const orgId = await resolveOrgId(user.id);
      if (!orgId) {
        return NextResponse.json(
          { error: "No organization found for user" },
          { status: 403 },
        );
      }

      // Auto-count and check limit
      const blocked = await checkModuleLimitAuto(orgId, module, limitType);
      if (blocked) return blocked;

      return handler(req, context);
    };
  };
}
