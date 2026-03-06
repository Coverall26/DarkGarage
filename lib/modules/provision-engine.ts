/**
 * Product Module Provisioning Engine (v3 Rebrand)
 *
 * Manages which product modules are enabled for each org based on their
 * subscription tier and active add-ons.
 *
 * v3 Suite mapping:
 *   RaiseRoom  — Capital raise data rooms (RAISEROOM module)
 *   SignSuite  — E-signature (SIGNSUITE module)
 *   PipelineIQ — CRM pipeline (RAISE_CRM module, replaces PIPELINE_IQ/PIPELINE_IQ_LITE)
 *   DataRoom   — Secure document sharing (DATAROOM module)
 *   FundRoom   — Full fund management (FUNDROOM module)
 *
 * Module mapping per tier:
 *   FREE:      RAISEROOM(1 room, 20MB) + SIGNSUITE(10/mo) + RAISE_CRM(20 contacts) + DATAROOM(basic)
 *   PRO:       RAISEROOM(5 rooms, 500MB) + SIGNSUITE(25/mo) + RAISE_CRM(unlimited) + DATAROOM(full)
 *   BUSINESS:  RAISEROOM(unlimited, 2GB) + SIGNSUITE(75/mo) + RAISE_CRM(unlimited+analytics) + DATAROOM(full+bulk)
 *   FUNDROOM:  All five modules unlimited
 *
 * Legacy tier aliases:
 *   CRM_PRO → treated as PRO
 *
 * Add-on overrides:
 *   PIPELINE_IQ add-on: enables PIPELINE_IQ, disables PIPELINE_IQ_LITE, contacts unlimited
 *   PIPELINE_IQ_LITE_RESET: resets PIPELINE_IQ_LITE contact count (one-time)
 *   AI_CRM add-on: enables AI CRM features (handled in crm-tier.ts, not module-level)
 */

import prisma from "@/lib/prisma";
import type { ProductModule, AddOnType } from "@prisma/client";
import { invalidateTierCache } from "@/lib/tier/crm-tier";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** v3 subscription tiers. CRM_PRO is a legacy alias for PRO. */
export type CrmSubscriptionTier = "FREE" | "CRM_PRO" | "PRO" | "BUSINESS" | "FUNDROOM";

export interface ModuleConfig {
  module: ProductModule;
  enabled: boolean;
  limitValue: number | null;
  limitType: string | null;
}

export interface EffectiveModules {
  modules: ModuleConfig[];
  orgId: string;
  tier: CrmSubscriptionTier;
  addOns: AddOnType[];
}

export interface ModuleLimitCheck {
  allowed: boolean;
  current: number;
  limit: number | null;
}

// ---------------------------------------------------------------------------
// 60-second TTL cache for module lookups
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const MODULE_CACHE_TTL_MS = 60_000; // 60 seconds
const moduleCache = new Map<string, CacheEntry<ModuleConfig[]>>();

function getCachedModules(orgId: string): ModuleConfig[] | null {
  const entry = moduleCache.get(orgId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    moduleCache.delete(orgId);
    return null;
  }
  return entry.value;
}

function setCachedModules(orgId: string, modules: ModuleConfig[]): void {
  moduleCache.set(orgId, {
    value: modules,
    expiresAt: Date.now() + MODULE_CACHE_TTL_MS,
  });
}

/** Invalidate the module cache for a specific org. */
export function invalidateModuleCache(orgId: string): void {
  moduleCache.delete(orgId);
}

/** Clear the entire module cache (useful for testing). */
export function clearModuleCache(): void {
  moduleCache.clear();
}

// ---------------------------------------------------------------------------
// Tier normalization (legacy alias handling)
// ---------------------------------------------------------------------------

/** Normalize legacy tier names to canonical v3 tiers. */
function normalizeTier(tier: string): CrmSubscriptionTier {
  if (tier === "CRM_PRO") return "PRO";
  if (["FREE", "PRO", "BUSINESS", "FUNDROOM"].includes(tier)) {
    return tier as CrmSubscriptionTier;
  }
  return "FREE";
}

// ---------------------------------------------------------------------------
// Tier → Module mapping (v3)
// ---------------------------------------------------------------------------

function getModulesForTier(tier: CrmSubscriptionTier): ModuleConfig[] {
  const normalized = normalizeTier(tier);

  switch (normalized) {
    case "FREE":
      return [
        // RaiseRoom — 1 room, 20MB storage
        { module: "RAISEROOM", enabled: true, limitValue: 1, limitType: "MAX_ROOMS" },
        // SignSuite — 10 e-sigs per month
        { module: "SIGNSUITE", enabled: true, limitValue: 10, limitType: "MONTHLY_ESIGN" },
        // PipelineIQ — 20 contacts max
        { module: "RAISE_CRM", enabled: true, limitValue: 20, limitType: "MAX_CONTACTS" },
        // DataRoom — basic (enabled, no explicit limit)
        { module: "DATAROOM", enabled: true, limitValue: null, limitType: null },
        // DataRoom engine (DOCROOMS) — basic
        { module: "DOCROOMS", enabled: true, limitValue: null, limitType: null },
        // FundRoom — not available on FREE
        { module: "FUNDROOM", enabled: false, limitValue: null, limitType: null },
        // Legacy modules — disabled on v3 tiers, kept for backward compat
        { module: "PIPELINE_IQ_LITE", enabled: false, limitValue: null, limitType: null },
        { module: "PIPELINE_IQ", enabled: false, limitValue: null, limitType: null },
      ];

    case "PRO":
      return [
        // RaiseRoom — 5 rooms, 500MB storage
        { module: "RAISEROOM", enabled: true, limitValue: 5, limitType: "MAX_ROOMS" },
        // SignSuite — 25 e-sigs per month
        { module: "SIGNSUITE", enabled: true, limitValue: 25, limitType: "MONTHLY_ESIGN" },
        // PipelineIQ — unlimited contacts
        { module: "RAISE_CRM", enabled: true, limitValue: null, limitType: "MAX_CONTACTS" },
        // DataRoom — full
        { module: "DATAROOM", enabled: true, limitValue: null, limitType: null },
        // DataRoom engine (DOCROOMS) — full
        { module: "DOCROOMS", enabled: true, limitValue: null, limitType: null },
        // FundRoom — not available on PRO
        { module: "FUNDROOM", enabled: false, limitValue: null, limitType: null },
        // Legacy modules — disabled
        { module: "PIPELINE_IQ_LITE", enabled: false, limitValue: null, limitType: null },
        { module: "PIPELINE_IQ", enabled: false, limitValue: null, limitType: null },
      ];

    case "BUSINESS":
      return [
        // RaiseRoom — unlimited rooms, 2GB storage
        { module: "RAISEROOM", enabled: true, limitValue: null, limitType: "MAX_ROOMS" },
        // SignSuite — 75 e-sigs per month
        { module: "SIGNSUITE", enabled: true, limitValue: 75, limitType: "MONTHLY_ESIGN" },
        // PipelineIQ — unlimited contacts + analytics
        { module: "RAISE_CRM", enabled: true, limitValue: null, limitType: "MAX_CONTACTS" },
        // DataRoom — full + bulk download
        { module: "DATAROOM", enabled: true, limitValue: null, limitType: null },
        // DataRoom engine (DOCROOMS) — full
        { module: "DOCROOMS", enabled: true, limitValue: null, limitType: null },
        // FundRoom — not available on BUSINESS
        { module: "FUNDROOM", enabled: false, limitValue: null, limitType: null },
        // Legacy modules — disabled
        { module: "PIPELINE_IQ_LITE", enabled: false, limitValue: null, limitType: null },
        { module: "PIPELINE_IQ", enabled: false, limitValue: null, limitType: null },
      ];

    case "FUNDROOM":
      return [
        // All five modules unlimited
        { module: "RAISEROOM", enabled: true, limitValue: null, limitType: null },
        { module: "SIGNSUITE", enabled: true, limitValue: null, limitType: null },
        { module: "RAISE_CRM", enabled: true, limitValue: null, limitType: null },
        { module: "DATAROOM", enabled: true, limitValue: null, limitType: null },
        { module: "DOCROOMS", enabled: true, limitValue: null, limitType: null },
        { module: "FUNDROOM", enabled: true, limitValue: null, limitType: null },
        // Legacy modules — disabled (RAISE_CRM replaces them)
        { module: "PIPELINE_IQ_LITE", enabled: false, limitValue: null, limitType: null },
        { module: "PIPELINE_IQ", enabled: false, limitValue: null, limitType: null },
      ];

    default:
      return getModulesForTier("FREE");
  }
}

// ---------------------------------------------------------------------------
// Add-on overrides
// ---------------------------------------------------------------------------

function applyAddOnOverrides(
  modules: ModuleConfig[],
  addOnType: AddOnType,
): ModuleConfig[] {
  const result = modules.map((m) => ({ ...m }));

  switch (addOnType) {
    case "PIPELINE_IQ": {
      // Legacy: Enable full CRM, disable lite, contacts unlimited
      const lite = result.find((m) => m.module === "PIPELINE_IQ_LITE");
      if (lite) {
        lite.enabled = false;
        lite.limitValue = null;
      }
      const full = result.find((m) => m.module === "PIPELINE_IQ");
      if (full) {
        full.enabled = true;
        full.limitValue = null; // unlimited contacts
      }
      break;
    }
    case "PIPELINE_IQ_LITE_RESET": {
      // One-time reset: re-enables PIPELINE_IQ_LITE with fresh 20-contact limit
      // Only meaningful if org is on FREE tier and has PIPELINE_IQ_LITE
      const lite = result.find((m) => m.module === "PIPELINE_IQ_LITE");
      if (lite && lite.enabled) {
        lite.limitValue = 20;
      }
      // Also reset RAISE_CRM contacts if applicable
      const raiseCrm = result.find((m) => m.module === "RAISE_CRM");
      if (raiseCrm && raiseCrm.limitType === "MAX_CONTACTS" && raiseCrm.limitValue !== null) {
        raiseCrm.limitValue = 20; // Reset to FREE tier default
      }
      break;
    }
    // AI_CRM, REMOVE_BRANDING, CUSTOM_DOMAIN, PRIORITY_SUPPORT are
    // feature flags, not module-level toggles. They're handled in crm-tier.ts
    // and the settings center.
    default:
      break;
  }

  return result;
}

function revertAddOnOverrides(
  modules: ModuleConfig[],
  addOnType: AddOnType,
  tier: CrmSubscriptionTier,
): ModuleConfig[] {
  switch (addOnType) {
    case "PIPELINE_IQ": {
      // Revert to tier defaults for CRM modules
      const tierDefaults = getModulesForTier(tier);
      const result = modules.map((m) => ({ ...m }));

      const liteDef = tierDefaults.find((m) => m.module === "PIPELINE_IQ_LITE");
      const fullDef = tierDefaults.find((m) => m.module === "PIPELINE_IQ");

      const lite = result.find((m) => m.module === "PIPELINE_IQ_LITE");
      const full = result.find((m) => m.module === "PIPELINE_IQ");

      if (lite && liteDef) {
        lite.enabled = liteDef.enabled;
        lite.limitValue = liteDef.limitValue;
      }
      if (full && fullDef) {
        full.enabled = fullDef.enabled;
        full.limitValue = fullDef.limitValue;
      }

      return result;
    }
    default:
      return modules;
  }
}

// ---------------------------------------------------------------------------
// Core API: provisionModulesForTier
// ---------------------------------------------------------------------------

/**
 * Provision (upsert) all product modules for an org based on their subscription tier.
 * Called when tier changes (checkout, upgrade, downgrade).
 * Invalidates the module cache for the org.
 */
export async function provisionModulesForTier(
  orgId: string,
  tier: CrmSubscriptionTier,
): Promise<void> {
  let configs = getModulesForTier(tier);

  // Check for active add-ons that override module state
  const activeAddOns = await prisma.orgAddOn.findMany({
    where: { orgId, active: true },
    select: { addOnType: true },
  });

  for (const addOn of activeAddOns) {
    configs = applyAddOnOverrides(configs, addOn.addOnType);
  }

  // Upsert each module
  for (const config of configs) {
    await prisma.orgProductModule.upsert({
      where: { orgId_module: { orgId, module: config.module } },
      create: {
        orgId,
        module: config.module,
        enabled: config.enabled,
        limitValue: config.limitValue,
        limitType: config.limitType,
      },
      update: {
        enabled: config.enabled,
        limitValue: config.limitValue,
        limitType: config.limitType,
      },
    });
  }

  invalidateModuleCache(orgId);
  invalidateTierCache(orgId);
  logger.info("Provisioned modules for tier", {
    module: "provision-engine",
    metadata: { orgId, tier, moduleCount: configs.length },
  });
}

// ---------------------------------------------------------------------------
// Core API: provisionAddOn / revokeAddOn
// ---------------------------------------------------------------------------

/**
 * Enable an add-on for an org. Applies module overrides if applicable.
 */
export async function provisionAddOn(
  orgId: string,
  addOnType: AddOnType,
  stripeSubscriptionItemId?: string,
): Promise<void> {
  // Upsert the add-on record
  await prisma.orgAddOn.upsert({
    where: { orgId_addOnType: { orgId, addOnType } },
    create: {
      orgId,
      addOnType,
      stripeSubscriptionItemId: stripeSubscriptionItemId || null,
      active: true,
    },
    update: {
      active: true,
      stripeSubscriptionItemId: stripeSubscriptionItemId || undefined,
    },
  });

  // Apply module overrides
  const currentModules = await prisma.orgProductModule.findMany({
    where: { orgId },
  });

  const configs: ModuleConfig[] = currentModules.map((m) => ({
    module: m.module,
    enabled: m.enabled,
    limitValue: m.limitValue,
    limitType: m.limitType,
  }));

  const updated = applyAddOnOverrides(configs, addOnType);

  for (const config of updated) {
    await prisma.orgProductModule.upsert({
      where: { orgId_module: { orgId, module: config.module } },
      create: {
        orgId,
        module: config.module,
        enabled: config.enabled,
        limitValue: config.limitValue,
        limitType: config.limitType,
      },
      update: {
        enabled: config.enabled,
        limitValue: config.limitValue,
        limitType: config.limitType,
      },
    });
  }

  invalidateModuleCache(orgId);
  invalidateTierCache(orgId);
  logger.info("Provisioned add-on", {
    module: "provision-engine",
    metadata: { orgId, addOnType },
  });
}

/**
 * Revoke an add-on for an org. Reverts module overrides to tier defaults.
 */
export async function revokeAddOn(
  orgId: string,
  addOnType: AddOnType,
): Promise<void> {
  // Deactivate the add-on record
  await prisma.orgAddOn.upsert({
    where: { orgId_addOnType: { orgId, addOnType } },
    create: { orgId, addOnType, active: false },
    update: { active: false },
  });

  // Resolve current tier to know what defaults to revert to
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { subscriptionTier: true },
  });

  const tier = normalizeTier(org?.subscriptionTier || "FREE");

  // Get current module state and revert add-on overrides
  const currentModules = await prisma.orgProductModule.findMany({
    where: { orgId },
  });

  const configs: ModuleConfig[] = currentModules.map((m) => ({
    module: m.module,
    enabled: m.enabled,
    limitValue: m.limitValue,
    limitType: m.limitType,
  }));

  const reverted = revertAddOnOverrides(configs, addOnType, tier);

  for (const config of reverted) {
    await prisma.orgProductModule.upsert({
      where: { orgId_module: { orgId, module: config.module } },
      create: {
        orgId,
        module: config.module,
        enabled: config.enabled,
        limitValue: config.limitValue,
        limitType: config.limitType,
      },
      update: {
        enabled: config.enabled,
        limitValue: config.limitValue,
        limitType: config.limitType,
      },
    });
  }

  invalidateModuleCache(orgId);
  invalidateTierCache(orgId);
  logger.info("Revoked add-on", {
    module: "provision-engine",
    metadata: { orgId, addOnType },
  });
}

// ---------------------------------------------------------------------------
// Core API: resolveEffectiveModules
// ---------------------------------------------------------------------------

/**
 * Get the merged set of tier modules + add-on overrides for an org.
 * Reads from DB (OrgProductModule rows). If no rows exist, provisions defaults.
 * Uses 60-second TTL cache for performance.
 */
export async function resolveEffectiveModules(
  orgId: string,
): Promise<EffectiveModules> {
  let dbModules = await prisma.orgProductModule.findMany({
    where: { orgId },
  });

  // Auto-provision if no modules exist yet (first access)
  if (dbModules.length === 0) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { subscriptionTier: true },
    });
    const tier = normalizeTier(org?.subscriptionTier || "FREE");
    await provisionModulesForTier(orgId, tier);

    dbModules = await prisma.orgProductModule.findMany({
      where: { orgId },
    });
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { subscriptionTier: true },
  });

  const activeAddOns = await prisma.orgAddOn.findMany({
    where: { orgId, active: true },
    select: { addOnType: true },
  });

  const modules = dbModules.map((m) => ({
    module: m.module,
    enabled: m.enabled,
    limitValue: m.limitValue,
    limitType: m.limitType,
  }));

  // Update cache
  setCachedModules(orgId, modules);

  return {
    orgId,
    tier: normalizeTier(org?.subscriptionTier || "FREE"),
    addOns: activeAddOns.map((a) => a.addOnType),
    modules,
  };
}

// ---------------------------------------------------------------------------
// Helper: hasModule / getModuleLimit / isOverLimit
// ---------------------------------------------------------------------------

/**
 * Check if an org has a specific module enabled.
 * Uses cache when available.
 */
export async function hasModule(
  orgId: string,
  module: ProductModule,
): Promise<boolean> {
  // Check cache first
  const cached = getCachedModules(orgId);
  if (cached) {
    const mod = cached.find((m) => m.module === module);
    if (mod) return mod.enabled;
  }

  const row = await prisma.orgProductModule.findUnique({
    where: { orgId_module: { orgId, module } },
    select: { enabled: true },
  });

  if (!row) {
    // No row means modules haven't been provisioned yet — check tier defaults
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { subscriptionTier: true },
    });
    const tier = normalizeTier(org?.subscriptionTier || "FREE");
    const defaults = getModulesForTier(tier);
    const def = defaults.find((d) => d.module === module);
    return def?.enabled ?? false;
  }

  return row.enabled;
}

/**
 * Get the limit for a specific module and limit type.
 * Returns null for unlimited.
 */
export async function getModuleLimit(
  orgId: string,
  module: ProductModule,
  limitType: string,
): Promise<number | null> {
  // Check cache first
  const cached = getCachedModules(orgId);
  if (cached) {
    const mod = cached.find((m) => m.module === module);
    if (mod && mod.limitType === limitType) return mod.limitValue;
    if (mod && mod.limitType !== limitType) return null;
  }

  const row = await prisma.orgProductModule.findUnique({
    where: { orgId_module: { orgId, module } },
    select: { limitValue: true, limitType: true },
  });

  if (!row || row.limitType !== limitType) {
    return null; // No limit configured for this type
  }

  return row.limitValue;
}

/**
 * Check if an org has exceeded a module's usage limit.
 */
export async function isOverLimit(
  orgId: string,
  module: ProductModule,
  limitType: string,
  currentCount: number,
): Promise<boolean> {
  const limit = await getModuleLimit(orgId, module, limitType);
  if (limit === null) return false; // Unlimited
  return currentCount >= limit;
}

// ---------------------------------------------------------------------------
// Usage counting: getModuleUsage
// ---------------------------------------------------------------------------

/**
 * Get the current usage count for a module's limit type.
 * Supports: MONTHLY_ESIGN, MAX_CONTACTS, MAX_ROOMS, MAX_STORAGE_MB.
 *
 * Resolves orgId → teamIds, then counts the appropriate resources.
 */
export async function getModuleUsage(
  orgId: string,
  module: ProductModule,
  limitType: string,
): Promise<number> {
  // Resolve all teams for this org
  const teams = await prisma.team.findMany({
    where: { organizationId: orgId },
    select: { id: true },
  });
  const teamIds = teams.map((t) => t.id);

  if (teamIds.length === 0) return 0;

  switch (limitType) {
    case "MONTHLY_ESIGN": {
      // Count envelopes created this calendar month across all org teams
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const count = await prisma.envelope.count({
        where: {
          teamId: { in: teamIds },
          createdAt: { gte: startOfMonth },
        },
      });
      return count;
    }

    case "MAX_CONTACTS": {
      // Count active contacts across all org teams
      const count = await prisma.contact.count({
        where: {
          teamId: { in: teamIds },
          status: { notIn: ["ARCHIVED", "LOST"] },
        },
      });
      return count;
    }

    case "MAX_ROOMS": {
      // Count datarooms with roomType=RAISE_ROOM across all org teams
      const count = await prisma.dataroom.count({
        where: {
          teamId: { in: teamIds },
          roomType: "RAISE_ROOM",
        },
      });
      return count;
    }

    case "MAX_STORAGE_MB": {
      // Sum document file sizes across all org teams (approximate via document count)
      // Storage tracking is approximate — exact byte tracking is Phase 2
      const docs = await prisma.document.count({
        where: {
          teamId: { in: teamIds },
        },
      });
      // Rough estimate: 2MB per document average
      return docs * 2;
    }

    default:
      logger.warn("Unknown limit type for usage counting", {
        module: "provision-engine",
        metadata: { orgId, productModule: module, limitType },
      });
      return 0;
  }
}

// ---------------------------------------------------------------------------
// checkModuleLimit — combined access + usage check
// ---------------------------------------------------------------------------

/**
 * Combined module access + usage limit check.
 * Returns { allowed, current, limit } for a given module and limit type.
 *
 * - allowed: true if the module is enabled AND usage is within limit
 * - current: current usage count
 * - limit: the configured limit (null = unlimited)
 */
export async function checkModuleLimit(
  orgId: string,
  module: ProductModule,
  limitType: string,
): Promise<ModuleLimitCheck> {
  // First check if module is enabled
  const enabled = await hasModule(orgId, module);
  if (!enabled) {
    return { allowed: false, current: 0, limit: 0 };
  }

  // Get the configured limit
  const limit = await getModuleLimit(orgId, module, limitType);

  // If unlimited, always allowed
  if (limit === null) {
    const current = await getModuleUsage(orgId, module, limitType);
    return { allowed: true, current, limit: null };
  }

  // Count current usage
  const current = await getModuleUsage(orgId, module, limitType);

  return {
    allowed: current < limit,
    current,
    limit,
  };
}

// ---------------------------------------------------------------------------
// Export tier mapping for testing
// ---------------------------------------------------------------------------

export { getModulesForTier as _getModulesForTier, normalizeTier as _normalizeTier };
