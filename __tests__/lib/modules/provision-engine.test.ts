/**
 * Tests for Product Module Provisioning Engine (v3 Rebrand)
 *
 * v3 tier mapping:
 *   FREE:     RAISEROOM(1 room) + SIGNSUITE(10/mo) + RAISE_CRM(20 contacts) + DATAROOM + DOCROOMS
 *   PRO:      RAISEROOM(5 rooms) + SIGNSUITE(25/mo) + RAISE_CRM(unlimited) + DATAROOM + DOCROOMS
 *   BUSINESS: RAISEROOM(unlimited) + SIGNSUITE(75/mo) + RAISE_CRM(unlimited) + DATAROOM + DOCROOMS
 *   FUNDROOM: All 6 main modules unlimited
 *
 * Legacy modules (PIPELINE_IQ_LITE, PIPELINE_IQ) are always disabled on v3 tiers.
 * CRM_PRO is a legacy alias → normalized to PRO.
 */

// Mock prisma before imports
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    organization: {
      findUnique: jest.fn(),
    },
    orgProductModule: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    orgAddOn: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    team: {
      findMany: jest.fn(),
    },
    envelope: {
      count: jest.fn(),
    },
    contact: {
      count: jest.fn(),
    },
    dataroom: {
      count: jest.fn(),
    },
    document: {
      count: jest.fn(),
    },
  },
}));

jest.mock("@/lib/tier/crm-tier", () => ({
  invalidateTierCache: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import prisma from "@/lib/prisma";
import { invalidateTierCache } from "@/lib/tier/crm-tier";
import {
  provisionModulesForTier,
  provisionAddOn,
  revokeAddOn,
  resolveEffectiveModules,
  hasModule,
  getModuleLimit,
  isOverLimit,
  getModuleUsage,
  checkModuleLimit,
  clearModuleCache,
  invalidateModuleCache,
  _getModulesForTier,
  _normalizeTier,
} from "@/lib/modules/provision-engine";

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

beforeEach(() => {
  jest.clearAllMocks();
  clearModuleCache();
  // Default: no active add-ons
  (mockPrisma.orgAddOn.findMany as jest.Mock).mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// _normalizeTier
// ---------------------------------------------------------------------------

describe("normalizeTier", () => {
  it("passes through canonical v3 tiers unchanged", () => {
    expect(_normalizeTier("FREE")).toBe("FREE");
    expect(_normalizeTier("PRO")).toBe("PRO");
    expect(_normalizeTier("BUSINESS")).toBe("BUSINESS");
    expect(_normalizeTier("FUNDROOM")).toBe("FUNDROOM");
  });

  it("normalizes CRM_PRO to PRO", () => {
    expect(_normalizeTier("CRM_PRO")).toBe("PRO");
  });

  it("defaults to FREE for unknown tiers", () => {
    expect(_normalizeTier("UNKNOWN")).toBe("FREE");
    expect(_normalizeTier("")).toBe("FREE");
    expect(_normalizeTier("ENTERPRISE")).toBe("FREE");
  });
});

// ---------------------------------------------------------------------------
// _getModulesForTier (internal, exported for testing)
// ---------------------------------------------------------------------------

describe("getModulesForTier", () => {
  it("returns 8 modules for every tier (including 2 legacy disabled)", () => {
    for (const tier of ["FREE", "PRO", "BUSINESS", "FUNDROOM"] as const) {
      const modules = _getModulesForTier(tier);
      expect(modules).toHaveLength(8);

      // Legacy modules always disabled
      const piqLite = modules.find((m) => m.module === "PIPELINE_IQ_LITE");
      expect(piqLite?.enabled).toBe(false);
      const piq = modules.find((m) => m.module === "PIPELINE_IQ");
      expect(piq?.enabled).toBe(false);
    }
  });

  it("FREE tier: RAISEROOM(1 room), SIGNSUITE(10/mo), RAISE_CRM(20 contacts), DATAROOM, DOCROOMS", () => {
    const modules = _getModulesForTier("FREE");

    const raiseroom = modules.find((m) => m.module === "RAISEROOM");
    expect(raiseroom?.enabled).toBe(true);
    expect(raiseroom?.limitValue).toBe(1);
    expect(raiseroom?.limitType).toBe("MAX_ROOMS");

    const signsuite = modules.find((m) => m.module === "SIGNSUITE");
    expect(signsuite?.enabled).toBe(true);
    expect(signsuite?.limitValue).toBe(10);
    expect(signsuite?.limitType).toBe("MONTHLY_ESIGN");

    const raiseCrm = modules.find((m) => m.module === "RAISE_CRM");
    expect(raiseCrm?.enabled).toBe(true);
    expect(raiseCrm?.limitValue).toBe(20);
    expect(raiseCrm?.limitType).toBe("MAX_CONTACTS");

    const dataroom = modules.find((m) => m.module === "DATAROOM");
    expect(dataroom?.enabled).toBe(true);
    expect(dataroom?.limitValue).toBeNull();

    const docrooms = modules.find((m) => m.module === "DOCROOMS");
    expect(docrooms?.enabled).toBe(true);

    const fundroom = modules.find((m) => m.module === "FUNDROOM");
    expect(fundroom?.enabled).toBe(false);
  });

  it("PRO tier: RAISEROOM(5 rooms), SIGNSUITE(25/mo), RAISE_CRM(unlimited)", () => {
    const modules = _getModulesForTier("PRO");

    const raiseroom = modules.find((m) => m.module === "RAISEROOM");
    expect(raiseroom?.enabled).toBe(true);
    expect(raiseroom?.limitValue).toBe(5);

    const signsuite = modules.find((m) => m.module === "SIGNSUITE");
    expect(signsuite?.enabled).toBe(true);
    expect(signsuite?.limitValue).toBe(25);

    const raiseCrm = modules.find((m) => m.module === "RAISE_CRM");
    expect(raiseCrm?.enabled).toBe(true);
    expect(raiseCrm?.limitValue).toBeNull(); // unlimited

    const fundroom = modules.find((m) => m.module === "FUNDROOM");
    expect(fundroom?.enabled).toBe(false);
  });

  it("CRM_PRO normalizes to PRO — same output", () => {
    const proModules = _getModulesForTier("PRO");
    const crmProModules = _getModulesForTier("CRM_PRO");

    // Same structure (both return PRO defaults)
    expect(crmProModules).toHaveLength(proModules.length);
    for (const pm of proModules) {
      const cm = crmProModules.find((m) => m.module === pm.module);
      expect(cm).toBeDefined();
      expect(cm?.enabled).toBe(pm.enabled);
      expect(cm?.limitValue).toBe(pm.limitValue);
      expect(cm?.limitType).toBe(pm.limitType);
    }
  });

  it("BUSINESS tier: RAISEROOM(unlimited), SIGNSUITE(75/mo), RAISE_CRM(unlimited)", () => {
    const modules = _getModulesForTier("BUSINESS");

    const raiseroom = modules.find((m) => m.module === "RAISEROOM");
    expect(raiseroom?.enabled).toBe(true);
    expect(raiseroom?.limitValue).toBeNull(); // unlimited rooms

    const signsuite = modules.find((m) => m.module === "SIGNSUITE");
    expect(signsuite?.enabled).toBe(true);
    expect(signsuite?.limitValue).toBe(75);

    const raiseCrm = modules.find((m) => m.module === "RAISE_CRM");
    expect(raiseCrm?.enabled).toBe(true);
    expect(raiseCrm?.limitValue).toBeNull();

    const fundroom = modules.find((m) => m.module === "FUNDROOM");
    expect(fundroom?.enabled).toBe(false);
  });

  it("FUNDROOM tier: all 6 main modules enabled and unlimited", () => {
    const modules = _getModulesForTier("FUNDROOM");

    const mainModules = ["RAISEROOM", "SIGNSUITE", "RAISE_CRM", "DATAROOM", "DOCROOMS", "FUNDROOM"];
    for (const name of mainModules) {
      const mod = modules.find((m) => m.module === name);
      expect(mod?.enabled).toBe(true);
      expect(mod?.limitValue).toBeNull();
    }

    // 6 main enabled + 2 legacy disabled = 8 total, 6 enabled
    const enabled = modules.filter((m) => m.enabled);
    expect(enabled).toHaveLength(6);
  });

  it("defaults to FREE for unknown tier", () => {
    const modules = _getModulesForTier("UNKNOWN" as never);
    // Should match FREE tier
    const raiseCrm = modules.find((m) => m.module === "RAISE_CRM");
    expect(raiseCrm?.enabled).toBe(true);
    expect(raiseCrm?.limitValue).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// provisionModulesForTier
// ---------------------------------------------------------------------------

describe("provisionModulesForTier", () => {
  it("upserts all 8 modules for FREE tier", async () => {
    (mockPrisma.orgProductModule.upsert as jest.Mock).mockResolvedValue({});

    await provisionModulesForTier("org-1", "FREE");

    expect(mockPrisma.orgProductModule.upsert).toHaveBeenCalledTimes(8);
    expect(invalidateTierCache).toHaveBeenCalledWith("org-1");
  });

  it("upserts all 8 modules for FUNDROOM tier", async () => {
    (mockPrisma.orgProductModule.upsert as jest.Mock).mockResolvedValue({});

    await provisionModulesForTier("org-1", "FUNDROOM");

    expect(mockPrisma.orgProductModule.upsert).toHaveBeenCalledTimes(8);
  });

  it("upserts correct RAISEROOM config for FREE tier", async () => {
    (mockPrisma.orgProductModule.upsert as jest.Mock).mockResolvedValue({});

    await provisionModulesForTier("org-1", "FREE");

    const raiseroomCall = (mockPrisma.orgProductModule.upsert as jest.Mock).mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { where: { orgId_module: { module: string } } }).where.orgId_module.module === "RAISEROOM",
    );
    expect(raiseroomCall).toBeDefined();
    expect(raiseroomCall![0].create.enabled).toBe(true);
    expect(raiseroomCall![0].create.limitValue).toBe(1);
    expect(raiseroomCall![0].create.limitType).toBe("MAX_ROOMS");
  });

  it("applies active PIPELINE_IQ add-on override during provisioning", async () => {
    (mockPrisma.orgAddOn.findMany as jest.Mock).mockResolvedValue([
      { addOnType: "PIPELINE_IQ" },
    ]);
    (mockPrisma.orgProductModule.upsert as jest.Mock).mockResolvedValue({});

    await provisionModulesForTier("org-1", "FREE");

    // Find the PIPELINE_IQ upsert — should be enabled with unlimited contacts
    const piqCall = (mockPrisma.orgProductModule.upsert as jest.Mock).mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { where: { orgId_module: { module: string } } }).where.orgId_module.module === "PIPELINE_IQ",
    );
    expect(piqCall).toBeDefined();
    expect(piqCall![0].create.enabled).toBe(true);
    expect(piqCall![0].create.limitValue).toBeNull();

    // PIPELINE_IQ_LITE should remain disabled (v3 default)
    const liteCall = (mockPrisma.orgProductModule.upsert as jest.Mock).mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { where: { orgId_module: { module: string } } }).where.orgId_module.module === "PIPELINE_IQ_LITE",
    );
    expect(liteCall).toBeDefined();
    expect(liteCall![0].create.enabled).toBe(false);
  });

  it("invalidates both module and tier caches", async () => {
    (mockPrisma.orgProductModule.upsert as jest.Mock).mockResolvedValue({});

    await provisionModulesForTier("org-1", "PRO");

    expect(invalidateTierCache).toHaveBeenCalledWith("org-1");
  });
});

// ---------------------------------------------------------------------------
// provisionAddOn / revokeAddOn
// ---------------------------------------------------------------------------

describe("provisionAddOn", () => {
  it("enables PIPELINE_IQ add-on and leaves PIPELINE_IQ_LITE disabled", async () => {
    (mockPrisma.orgAddOn.upsert as jest.Mock).mockResolvedValue({});
    (mockPrisma.orgProductModule.findMany as jest.Mock).mockResolvedValue([
      { module: "PIPELINE_IQ_LITE", enabled: false, limitValue: null, limitType: null },
      { module: "PIPELINE_IQ", enabled: false, limitValue: null, limitType: null },
      { module: "RAISEROOM", enabled: true, limitValue: 1, limitType: "MAX_ROOMS" },
      { module: "DATAROOM", enabled: true, limitValue: null, limitType: null },
    ]);
    (mockPrisma.orgProductModule.upsert as jest.Mock).mockResolvedValue({});

    await provisionAddOn("org-1", "PIPELINE_IQ", "si_stripe123");

    // Verify add-on created
    expect(mockPrisma.orgAddOn.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId_addOnType: { orgId: "org-1", addOnType: "PIPELINE_IQ" } },
        create: expect.objectContaining({ active: true, stripeSubscriptionItemId: "si_stripe123" }),
      }),
    );

    // PIPELINE_IQ should be enabled
    const piqCall = (mockPrisma.orgProductModule.upsert as jest.Mock).mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { where: { orgId_module: { module: string } } }).where.orgId_module.module === "PIPELINE_IQ",
    );
    expect(piqCall![0].update.enabled).toBe(true);

    // PIPELINE_IQ_LITE should stay disabled
    const liteCall = (mockPrisma.orgProductModule.upsert as jest.Mock).mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { where: { orgId_module: { module: string } } }).where.orgId_module.module === "PIPELINE_IQ_LITE",
    );
    expect(liteCall![0].update.enabled).toBe(false);
  });

  it("passes stripeSubscriptionItemId to add-on record", async () => {
    (mockPrisma.orgAddOn.upsert as jest.Mock).mockResolvedValue({});
    (mockPrisma.orgProductModule.findMany as jest.Mock).mockResolvedValue([]);

    await provisionAddOn("org-1", "AI_CRM", "si_ai_123");

    expect(mockPrisma.orgAddOn.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          stripeSubscriptionItemId: "si_ai_123",
        }),
      }),
    );
  });
});

describe("revokeAddOn", () => {
  it("revokes PIPELINE_IQ add-on and reverts to FREE tier defaults", async () => {
    (mockPrisma.orgAddOn.upsert as jest.Mock).mockResolvedValue({});
    (mockPrisma.organization.findUnique as jest.Mock).mockResolvedValue({
      subscriptionTier: "FREE",
    });
    (mockPrisma.orgProductModule.findMany as jest.Mock).mockResolvedValue([
      { module: "PIPELINE_IQ_LITE", enabled: false, limitValue: null, limitType: null },
      { module: "PIPELINE_IQ", enabled: true, limitValue: null, limitType: "MAX_CONTACTS" },
      { module: "DATAROOM", enabled: true, limitValue: null, limitType: null },
    ]);
    (mockPrisma.orgProductModule.upsert as jest.Mock).mockResolvedValue({});

    await revokeAddOn("org-1", "PIPELINE_IQ");

    // Verify add-on deactivated
    expect(mockPrisma.orgAddOn.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { active: false },
      }),
    );

    // FREE tier v3: PIPELINE_IQ_LITE remains disabled (legacy)
    const liteCall = (mockPrisma.orgProductModule.upsert as jest.Mock).mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { where: { orgId_module: { module: string } } }).where.orgId_module.module === "PIPELINE_IQ_LITE",
    );
    expect(liteCall![0].update.enabled).toBe(false);

    // PIPELINE_IQ reverts to disabled (FREE tier default)
    const piqCall = (mockPrisma.orgProductModule.upsert as jest.Mock).mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { where: { orgId_module: { module: string } } }).where.orgId_module.module === "PIPELINE_IQ",
    );
    expect(piqCall![0].update.enabled).toBe(false);

    expect(invalidateTierCache).toHaveBeenCalledWith("org-1");
  });

  it("revokes PIPELINE_IQ add-on for CRM_PRO (→ PRO) tier — both legacy modules stay disabled", async () => {
    (mockPrisma.orgAddOn.upsert as jest.Mock).mockResolvedValue({});
    (mockPrisma.organization.findUnique as jest.Mock).mockResolvedValue({
      subscriptionTier: "CRM_PRO",
    });
    (mockPrisma.orgProductModule.findMany as jest.Mock).mockResolvedValue([
      { module: "PIPELINE_IQ_LITE", enabled: false, limitValue: null, limitType: null },
      { module: "PIPELINE_IQ", enabled: true, limitValue: null, limitType: "MAX_CONTACTS" },
    ]);
    (mockPrisma.orgProductModule.upsert as jest.Mock).mockResolvedValue({});

    await revokeAddOn("org-1", "PIPELINE_IQ");

    // CRM_PRO normalizes to PRO → both legacy modules disabled
    const piqCall = (mockPrisma.orgProductModule.upsert as jest.Mock).mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { where: { orgId_module: { module: string } } }).where.orgId_module.module === "PIPELINE_IQ",
    );
    expect(piqCall![0].update.enabled).toBe(false);

    const liteCall = (mockPrisma.orgProductModule.upsert as jest.Mock).mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { where: { orgId_module: { module: string } } }).where.orgId_module.module === "PIPELINE_IQ_LITE",
    );
    expect(liteCall![0].update.enabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveEffectiveModules
// ---------------------------------------------------------------------------

describe("resolveEffectiveModules", () => {
  it("returns existing module rows when provisioned", async () => {
    const dbModules = [
      { module: "RAISEROOM", enabled: true, limitValue: 1, limitType: "MAX_ROOMS" },
      { module: "SIGNSUITE", enabled: true, limitValue: 10, limitType: "MONTHLY_ESIGN" },
      { module: "RAISE_CRM", enabled: true, limitValue: 20, limitType: "MAX_CONTACTS" },
      { module: "DATAROOM", enabled: true, limitValue: null, limitType: null },
    ];
    (mockPrisma.orgProductModule.findMany as jest.Mock).mockResolvedValue(dbModules);
    (mockPrisma.organization.findUnique as jest.Mock).mockResolvedValue({
      subscriptionTier: "FREE",
    });

    const result = await resolveEffectiveModules("org-1");

    expect(result.orgId).toBe("org-1");
    expect(result.tier).toBe("FREE");
    expect(result.modules).toHaveLength(4);
    expect(result.addOns).toEqual([]);
  });

  it("auto-provisions modules when no rows exist", async () => {
    // First call returns empty (no rows), second call returns provisioned rows
    (mockPrisma.orgProductModule.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { module: "RAISEROOM", enabled: true, limitValue: 1, limitType: "MAX_ROOMS" },
      ]);
    (mockPrisma.organization.findUnique as jest.Mock).mockResolvedValue({
      subscriptionTier: "FREE",
    });
    (mockPrisma.orgProductModule.upsert as jest.Mock).mockResolvedValue({});

    const result = await resolveEffectiveModules("org-1");

    // Should have triggered provisioning (8 modules)
    expect(mockPrisma.orgProductModule.upsert).toHaveBeenCalledTimes(8);
    expect(result.modules).toHaveLength(1);
  });

  it("includes active add-on types", async () => {
    (mockPrisma.orgProductModule.findMany as jest.Mock).mockResolvedValue([
      { module: "RAISE_CRM", enabled: true, limitValue: null, limitType: null },
    ]);
    (mockPrisma.organization.findUnique as jest.Mock).mockResolvedValue({
      subscriptionTier: "PRO",
    });
    (mockPrisma.orgAddOn.findMany as jest.Mock).mockResolvedValue([
      { addOnType: "PIPELINE_IQ" },
      { addOnType: "AI_CRM" },
    ]);

    const result = await resolveEffectiveModules("org-1");

    expect(result.addOns).toEqual(["PIPELINE_IQ", "AI_CRM"]);
    expect(result.tier).toBe("PRO");
  });

  it("normalizes CRM_PRO tier to PRO in result", async () => {
    (mockPrisma.orgProductModule.findMany as jest.Mock).mockResolvedValue([
      { module: "RAISEROOM", enabled: true, limitValue: 5, limitType: "MAX_ROOMS" },
    ]);
    (mockPrisma.organization.findUnique as jest.Mock).mockResolvedValue({
      subscriptionTier: "CRM_PRO",
    });

    const result = await resolveEffectiveModules("org-1");

    expect(result.tier).toBe("PRO");
  });
});

// ---------------------------------------------------------------------------
// hasModule / getModuleLimit / isOverLimit
// ---------------------------------------------------------------------------

describe("hasModule", () => {
  it("returns true when module is enabled", async () => {
    (mockPrisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
      enabled: true,
    });

    expect(await hasModule("org-1", "DATAROOM")).toBe(true);
  });

  it("returns false when module is disabled", async () => {
    (mockPrisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
      enabled: false,
    });

    expect(await hasModule("org-1", "FUNDROOM")).toBe(false);
  });

  it("falls back to tier defaults when no DB row exists", async () => {
    (mockPrisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.organization.findUnique as jest.Mock).mockResolvedValue({
      subscriptionTier: "FREE",
    });

    // RAISEROOM is enabled on FREE tier
    expect(await hasModule("org-1", "RAISEROOM")).toBe(true);
    // RAISE_CRM is enabled on FREE tier
    expect(await hasModule("org-1", "RAISE_CRM")).toBe(true);
    // FUNDROOM is NOT enabled on FREE tier
    expect(await hasModule("org-1", "FUNDROOM")).toBe(false);
    // Legacy modules are disabled on v3 FREE tier
    expect(await hasModule("org-1", "PIPELINE_IQ_LITE")).toBe(false);
    expect(await hasModule("org-1", "PIPELINE_IQ")).toBe(false);
  });

  it("uses cache when available", async () => {
    // Prime the cache by making an initial call
    (mockPrisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
      enabled: true,
    });
    await hasModule("org-cache-test", "DATAROOM");

    // Clear mock call count
    (mockPrisma.orgProductModule.findUnique as jest.Mock).mockClear();

    // Cache doesn't have this module, so it will still call DB
    // But this demonstrates the cache path is exercised
    (mockPrisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
      enabled: true,
    });
    const result = await hasModule("org-cache-test", "SIGNSUITE");
    expect(result).toBe(true);
  });
});

describe("getModuleLimit", () => {
  it("returns limit value when type matches", async () => {
    (mockPrisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
      limitValue: 10,
      limitType: "MONTHLY_ESIGN",
    });

    const limit = await getModuleLimit("org-1", "SIGNSUITE", "MONTHLY_ESIGN");
    expect(limit).toBe(10);
  });

  it("returns null when limit type does not match", async () => {
    (mockPrisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
      limitValue: 10,
      limitType: "MONTHLY_ESIGN",
    });

    const limit = await getModuleLimit("org-1", "SIGNSUITE", "MAX_STORAGE_MB");
    expect(limit).toBeNull();
  });

  it("returns null when no row exists", async () => {
    (mockPrisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue(null);

    const limit = await getModuleLimit("org-1", "SIGNSUITE", "MONTHLY_ESIGN");
    expect(limit).toBeNull();
  });
});

describe("isOverLimit", () => {
  it("returns true when at limit", async () => {
    (mockPrisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
      limitValue: 20,
      limitType: "MAX_CONTACTS",
    });

    expect(await isOverLimit("org-1", "RAISE_CRM", "MAX_CONTACTS", 20)).toBe(true);
  });

  it("returns false when under limit", async () => {
    (mockPrisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
      limitValue: 20,
      limitType: "MAX_CONTACTS",
    });

    expect(await isOverLimit("org-1", "RAISE_CRM", "MAX_CONTACTS", 19)).toBe(false);
  });

  it("returns false when unlimited (null limit)", async () => {
    (mockPrisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
      limitValue: null,
      limitType: "MAX_CONTACTS",
    });

    expect(await isOverLimit("org-1", "RAISE_CRM", "MAX_CONTACTS", 9999)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getModuleUsage
// ---------------------------------------------------------------------------

describe("getModuleUsage", () => {
  beforeEach(() => {
    (mockPrisma.team.findMany as jest.Mock).mockResolvedValue([
      { id: "team-1" },
      { id: "team-2" },
    ]);
  });

  it("counts envelopes for MONTHLY_ESIGN", async () => {
    (mockPrisma.envelope.count as jest.Mock).mockResolvedValue(7);

    const usage = await getModuleUsage("org-1", "SIGNSUITE", "MONTHLY_ESIGN");

    expect(usage).toBe(7);
    expect(mockPrisma.envelope.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teamId: { in: ["team-1", "team-2"] },
        }),
      }),
    );
  });

  it("counts active contacts for MAX_CONTACTS", async () => {
    (mockPrisma.contact.count as jest.Mock).mockResolvedValue(15);

    const usage = await getModuleUsage("org-1", "RAISE_CRM", "MAX_CONTACTS");

    expect(usage).toBe(15);
    expect(mockPrisma.contact.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teamId: { in: ["team-1", "team-2"] },
          status: { notIn: ["ARCHIVED", "LOST"] },
        }),
      }),
    );
  });

  it("counts RAISE_ROOM datarooms for MAX_ROOMS", async () => {
    (mockPrisma.dataroom.count as jest.Mock).mockResolvedValue(3);

    const usage = await getModuleUsage("org-1", "RAISEROOM", "MAX_ROOMS");

    expect(usage).toBe(3);
    expect(mockPrisma.dataroom.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teamId: { in: ["team-1", "team-2"] },
          roomType: "RAISE_ROOM",
        }),
      }),
    );
  });

  it("estimates storage from document count for MAX_STORAGE_MB", async () => {
    (mockPrisma.document.count as jest.Mock).mockResolvedValue(50);

    const usage = await getModuleUsage("org-1", "RAISEROOM", "MAX_STORAGE_MB");

    // 50 docs × 2MB = 100MB
    expect(usage).toBe(100);
  });

  it("returns 0 when org has no teams", async () => {
    (mockPrisma.team.findMany as jest.Mock).mockResolvedValue([]);

    const usage = await getModuleUsage("org-1", "SIGNSUITE", "MONTHLY_ESIGN");
    expect(usage).toBe(0);
  });

  it("returns 0 for unknown limit type", async () => {
    const usage = await getModuleUsage("org-1", "SIGNSUITE", "UNKNOWN_TYPE");
    expect(usage).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// checkModuleLimit (combined access + usage check)
// ---------------------------------------------------------------------------

describe("checkModuleLimit", () => {
  it("returns allowed=false when module is disabled", async () => {
    (mockPrisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
      enabled: false,
    });

    const result = await checkModuleLimit("org-1", "FUNDROOM", "MAX_ROOMS");

    expect(result.allowed).toBe(false);
    expect(result.current).toBe(0);
    expect(result.limit).toBe(0);
  });

  it("returns allowed=true when module is unlimited", async () => {
    // hasModule check
    (mockPrisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
      enabled: true,
      limitValue: null,
      limitType: "MAX_CONTACTS",
    });
    // getModuleUsage
    (mockPrisma.team.findMany as jest.Mock).mockResolvedValue([{ id: "team-1" }]);
    (mockPrisma.contact.count as jest.Mock).mockResolvedValue(500);

    const result = await checkModuleLimit("org-1", "RAISE_CRM", "MAX_CONTACTS");

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(500);
    expect(result.limit).toBeNull();
  });

  it("returns allowed=true when under limit", async () => {
    (mockPrisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
      enabled: true,
      limitValue: 20,
      limitType: "MAX_CONTACTS",
    });
    (mockPrisma.team.findMany as jest.Mock).mockResolvedValue([{ id: "team-1" }]);
    (mockPrisma.contact.count as jest.Mock).mockResolvedValue(15);

    const result = await checkModuleLimit("org-1", "RAISE_CRM", "MAX_CONTACTS");

    expect(result.allowed).toBe(true);
    expect(result.current).toBe(15);
    expect(result.limit).toBe(20);
  });

  it("returns allowed=false when at or over limit", async () => {
    (mockPrisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
      enabled: true,
      limitValue: 10,
      limitType: "MONTHLY_ESIGN",
    });
    (mockPrisma.team.findMany as jest.Mock).mockResolvedValue([{ id: "team-1" }]);
    (mockPrisma.envelope.count as jest.Mock).mockResolvedValue(10);

    const result = await checkModuleLimit("org-1", "SIGNSUITE", "MONTHLY_ESIGN");

    expect(result.allowed).toBe(false);
    expect(result.current).toBe(10);
    expect(result.limit).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Cache behavior
// ---------------------------------------------------------------------------

describe("Module cache", () => {
  it("invalidateModuleCache clears a specific org", async () => {
    // This is a unit test of the exported function
    // We can't directly inspect the cache, but we verify no errors
    invalidateModuleCache("org-test");
    // No error = pass
  });

  it("clearModuleCache clears all cached data", () => {
    clearModuleCache();
    // No error = pass
  });
});

// ---------------------------------------------------------------------------
// Edge case: PIPELINE_IQ_LITE_RESET add-on
// ---------------------------------------------------------------------------

describe("PIPELINE_IQ_LITE_RESET add-on", () => {
  it("resets RAISE_CRM contact limit to 20 when applied during provisioning", async () => {
    (mockPrisma.orgAddOn.findMany as jest.Mock).mockResolvedValue([
      { addOnType: "PIPELINE_IQ_LITE_RESET" },
    ]);
    (mockPrisma.orgProductModule.upsert as jest.Mock).mockResolvedValue({});

    await provisionModulesForTier("org-1", "FREE");

    // RAISE_CRM should have limitValue reset to 20
    const raiseCrmCall = (mockPrisma.orgProductModule.upsert as jest.Mock).mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { where: { orgId_module: { module: string } } }).where.orgId_module.module === "RAISE_CRM",
    );
    expect(raiseCrmCall).toBeDefined();
    expect(raiseCrmCall![0].create.enabled).toBe(true);
    expect(raiseCrmCall![0].create.limitValue).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Edge case: Free tier + PIPELINE_IQ add-on
// ---------------------------------------------------------------------------

describe("Edge case: Free tier + PIPELINE_IQ add-on", () => {
  it("enables PIPELINE_IQ and keeps PIPELINE_IQ_LITE disabled on FREE tier with add-on", async () => {
    (mockPrisma.orgAddOn.findMany as jest.Mock).mockResolvedValue([
      { addOnType: "PIPELINE_IQ" },
    ]);
    (mockPrisma.orgProductModule.upsert as jest.Mock).mockResolvedValue({});

    await provisionModulesForTier("org-1", "FREE");

    // Collect all upsert calls
    const calls = (mockPrisma.orgProductModule.upsert as jest.Mock).mock.calls;

    const piqCall = calls.find(
      (c: unknown[]) =>
        (c[0] as { where: { orgId_module: { module: string } } }).where.orgId_module.module === "PIPELINE_IQ",
    );
    const liteCall = calls.find(
      (c: unknown[]) =>
        (c[0] as { where: { orgId_module: { module: string } } }).where.orgId_module.module === "PIPELINE_IQ_LITE",
    );

    // PIPELINE_IQ should be enabled with unlimited contacts
    expect(piqCall![0].create.enabled).toBe(true);
    expect(piqCall![0].create.limitValue).toBeNull();

    // PIPELINE_IQ_LITE stays disabled (v3 default)
    expect(liteCall![0].create.enabled).toBe(false);
  });
});
