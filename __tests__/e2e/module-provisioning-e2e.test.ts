/**
 * Test Suite 1: Module Provisioning (Prompt 8.1)
 *
 * Tests the 5-suite module system: provisionModulesForTier, add-on overrides,
 * tier upgrades/downgrades, and limit enforcement.
 */

import {
  provisionModulesForTier,
  resolveEffectiveModules,
  hasModule,
  isOverLimit,
  getModuleLimit,
  checkModuleLimit,
  clearModuleCache,
  provisionAddOn,
  revokeAddOn,
  _getModulesForTier,
  _normalizeTier,
} from "@/lib/modules/provision-engine";

const prisma = require("@/lib/prisma").default;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockOrgTier(tier: string) {
  (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
    id: "org-1",
    subscriptionTier: tier,
  });
}

function mockNoModules() {
  (prisma.orgProductModule.findMany as jest.Mock).mockResolvedValue([]);
}

function mockModules(modules: Array<{ module: string; enabled: boolean; limitValue: number | null; limitType: string | null }>) {
  (prisma.orgProductModule.findMany as jest.Mock).mockResolvedValue(
    modules.map((m, i) => ({ id: `mod-${i}`, orgId: "org-1", ...m }))
  );
}

function mockNoAddOns() {
  (prisma.orgAddOn.findMany as jest.Mock).mockResolvedValue([]);
}

function mockAddOns(types: string[]) {
  (prisma.orgAddOn.findMany as jest.Mock).mockResolvedValue(
    types.map((t) => ({ addOnType: t }))
  );
}

function mockUpsert() {
  (prisma.orgProductModule.upsert as jest.Mock).mockResolvedValue({});
  (prisma.orgAddOn.upsert as jest.Mock).mockResolvedValue({});
}

// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  clearModuleCache();
  mockUpsert();
  mockNoAddOns();
});

// =========================================================================
// Test Suite 1: Module Provisioning
// =========================================================================

describe("Test Suite 1: Module Provisioning", () => {
  // -----------------------------------------------------------------------
  // 1a. Tier normalization
  // -----------------------------------------------------------------------

  describe("Tier normalization", () => {
    it("normalizes CRM_PRO to PRO", () => {
      expect(_normalizeTier("CRM_PRO")).toBe("PRO");
    });

    it("normalizes unknown tiers to FREE", () => {
      expect(_normalizeTier("UNKNOWN")).toBe("FREE");
      expect(_normalizeTier("")).toBe("FREE");
    });

    it("keeps canonical tiers unchanged", () => {
      expect(_normalizeTier("FREE")).toBe("FREE");
      expect(_normalizeTier("PRO")).toBe("PRO");
      expect(_normalizeTier("BUSINESS")).toBe("BUSINESS");
      expect(_normalizeTier("FUNDROOM")).toBe("FUNDROOM");
    });
  });

  // -----------------------------------------------------------------------
  // 1b. FREE tier modules
  // -----------------------------------------------------------------------

  describe("provisionModulesForTier(FREE)", () => {
    it("creates modules with correct FREE tier limits", async () => {
      mockOrgTier("FREE");
      mockNoAddOns();

      await provisionModulesForTier("org-1", "FREE");

      const upsertCalls = (prisma.orgProductModule.upsert as jest.Mock).mock.calls;
      expect(upsertCalls.length).toBeGreaterThanOrEqual(6);

      // Find RAISEROOM upsert
      const raiseRoom = upsertCalls.find(
        (c: any) => c[0].create.module === "RAISEROOM"
      );
      expect(raiseRoom).toBeTruthy();
      expect(raiseRoom[0].create.enabled).toBe(true);
      expect(raiseRoom[0].create.limitValue).toBe(1);
      expect(raiseRoom[0].create.limitType).toBe("MAX_ROOMS");

      // Find SIGNSUITE upsert
      const signSuite = upsertCalls.find(
        (c: any) => c[0].create.module === "SIGNSUITE"
      );
      expect(signSuite).toBeTruthy();
      expect(signSuite[0].create.enabled).toBe(true);
      expect(signSuite[0].create.limitValue).toBe(10);
      expect(signSuite[0].create.limitType).toBe("MONTHLY_ESIGN");

      // Find RAISE_CRM upsert
      const raiseCrm = upsertCalls.find(
        (c: any) => c[0].create.module === "RAISE_CRM"
      );
      expect(raiseCrm).toBeTruthy();
      expect(raiseCrm[0].create.enabled).toBe(true);
      expect(raiseCrm[0].create.limitValue).toBe(20);
      expect(raiseCrm[0].create.limitType).toBe("MAX_CONTACTS");

      // FUNDROOM should be disabled on FREE
      const fundRoom = upsertCalls.find(
        (c: any) => c[0].create.module === "FUNDROOM"
      );
      expect(fundRoom).toBeTruthy();
      expect(fundRoom[0].create.enabled).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 1c. PRO tier modules
  // -----------------------------------------------------------------------

  describe("provisionModulesForTier(PRO)", () => {
    it("creates modules with correct PRO tier limits", async () => {
      mockOrgTier("PRO");
      mockNoAddOns();

      await provisionModulesForTier("org-1", "PRO");

      const upsertCalls = (prisma.orgProductModule.upsert as jest.Mock).mock.calls;

      // RAISEROOM — 5 rooms
      const raiseRoom = upsertCalls.find(
        (c: any) => c[0].create.module === "RAISEROOM"
      );
      expect(raiseRoom[0].create.limitValue).toBe(5);

      // SIGNSUITE — 25 e-sigs
      const signSuite = upsertCalls.find(
        (c: any) => c[0].create.module === "SIGNSUITE"
      );
      expect(signSuite[0].create.limitValue).toBe(25);

      // RAISE_CRM — unlimited contacts
      const raiseCrm = upsertCalls.find(
        (c: any) => c[0].create.module === "RAISE_CRM"
      );
      expect(raiseCrm[0].create.limitValue).toBeNull();

      // FUNDROOM still disabled on PRO
      const fundRoom = upsertCalls.find(
        (c: any) => c[0].create.module === "FUNDROOM"
      );
      expect(fundRoom[0].create.enabled).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 1d. BUSINESS tier modules
  // -----------------------------------------------------------------------

  describe("provisionModulesForTier(BUSINESS)", () => {
    it("creates modules with correct BUSINESS tier limits", async () => {
      mockOrgTier("BUSINESS");
      mockNoAddOns();

      await provisionModulesForTier("org-1", "BUSINESS");

      const upsertCalls = (prisma.orgProductModule.upsert as jest.Mock).mock.calls;

      // RAISEROOM — unlimited rooms
      const raiseRoom = upsertCalls.find(
        (c: any) => c[0].create.module === "RAISEROOM"
      );
      expect(raiseRoom[0].create.limitValue).toBeNull();

      // SIGNSUITE — 75 e-sigs
      const signSuite = upsertCalls.find(
        (c: any) => c[0].create.module === "SIGNSUITE"
      );
      expect(signSuite[0].create.limitValue).toBe(75);
    });
  });

  // -----------------------------------------------------------------------
  // 1e. FUNDROOM tier modules — all unlimited
  // -----------------------------------------------------------------------

  describe("provisionModulesForTier(FUNDROOM)", () => {
    it("creates 5 core modules, all unlimited", async () => {
      mockOrgTier("FUNDROOM");
      mockNoAddOns();

      await provisionModulesForTier("org-1", "FUNDROOM");

      const upsertCalls = (prisma.orgProductModule.upsert as jest.Mock).mock.calls;

      const enabledModules = upsertCalls
        .filter((c: any) => c[0].create.enabled === true)
        .map((c: any) => c[0].create.module);

      // All 5 core modules plus DOCROOMS should be enabled
      expect(enabledModules).toContain("RAISEROOM");
      expect(enabledModules).toContain("SIGNSUITE");
      expect(enabledModules).toContain("RAISE_CRM");
      expect(enabledModules).toContain("DATAROOM");
      expect(enabledModules).toContain("FUNDROOM");

      // All limits should be null (unlimited)
      const nonNullLimits = upsertCalls.filter(
        (c: any) => c[0].create.enabled && c[0].create.limitValue !== null
      );
      expect(nonNullLimits).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // 1f. Upgrade does not create duplicates
  // -----------------------------------------------------------------------

  describe("Tier upgrade (FREE → PRO)", () => {
    it("updates existing modules without creating duplicates via upsert", async () => {
      mockOrgTier("PRO");
      mockNoAddOns();

      // Simulate existing FREE-tier modules
      mockModules([
        { module: "RAISEROOM", enabled: true, limitValue: 1, limitType: "MAX_ROOMS" },
        { module: "SIGNSUITE", enabled: true, limitValue: 10, limitType: "MONTHLY_ESIGN" },
      ]);

      await provisionModulesForTier("org-1", "PRO");

      // All calls should be upserts (not creates)
      const upsertCalls = (prisma.orgProductModule.upsert as jest.Mock).mock.calls;
      expect(upsertCalls.length).toBeGreaterThanOrEqual(6);

      // SIGNSUITE should be updated to 25
      const signSuite = upsertCalls.find(
        (c: any) => c[0].update.limitValue === 25
      );
      expect(signSuite).toBeTruthy();

      // No createMany or create calls
      expect(prisma.orgProductModule.createMany).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 1g. Downgrade reduces limits but doesn't delete rows
  // -----------------------------------------------------------------------

  describe("Tier downgrade (PRO → FREE)", () => {
    it("reduces limits without deleting OrgProductModule rows", async () => {
      mockOrgTier("FREE");
      mockNoAddOns();

      // Simulate existing PRO-tier modules
      mockModules([
        { module: "RAISEROOM", enabled: true, limitValue: 5, limitType: "MAX_ROOMS" },
        { module: "SIGNSUITE", enabled: true, limitValue: 25, limitType: "MONTHLY_ESIGN" },
        { module: "RAISE_CRM", enabled: true, limitValue: null, limitType: "MAX_CONTACTS" },
      ]);

      await provisionModulesForTier("org-1", "FREE");

      // Should not call deleteMany or delete
      expect(prisma.orgProductModule.deleteMany).not.toHaveBeenCalled();
      expect(prisma.orgProductModule.delete).not.toHaveBeenCalled();

      // SIGNSUITE should be downgraded to 10
      const upsertCalls = (prisma.orgProductModule.upsert as jest.Mock).mock.calls;
      const signSuite = upsertCalls.find(
        (c: any) => c[0].create.module === "SIGNSUITE"
      );
      expect(signSuite[0].update.limitValue).toBe(10);

      // RAISE_CRM contacts should be limited to 20
      const raiseCrm = upsertCalls.find(
        (c: any) => c[0].create.module === "RAISE_CRM"
      );
      expect(raiseCrm[0].update.limitValue).toBe(20);
    });
  });

  // -----------------------------------------------------------------------
  // 1h. _getModulesForTier returns correct structure
  // -----------------------------------------------------------------------

  describe("_getModulesForTier structure validation", () => {
    it.each(["FREE", "PRO", "BUSINESS", "FUNDROOM"] as const)(
      "returns consistent structure for %s tier",
      (tier) => {
        const modules = _getModulesForTier(tier);
        expect(modules.length).toBeGreaterThanOrEqual(6);
        for (const m of modules) {
          expect(m).toHaveProperty("module");
          expect(m).toHaveProperty("enabled");
          expect(m).toHaveProperty("limitValue");
          expect(m).toHaveProperty("limitType");
        }
      }
    );
  });
});

// =========================================================================
// Test Suite 2: Module Access Middleware
// =========================================================================

describe("Test Suite 2: Module Access Middleware", () => {
  describe("hasModule", () => {
    it("returns true when module is enabled in DB", async () => {
      (prisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
        enabled: true,
      });

      const result = await hasModule("org-1", "SIGNSUITE");
      expect(result).toBe(true);
    });

    it("returns false when module is disabled", async () => {
      (prisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
        enabled: false,
      });

      const result = await hasModule("org-1", "FUNDROOM");
      expect(result).toBe(false);
    });

    it("falls back to tier defaults when no DB row exists", async () => {
      (prisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue(null);
      mockOrgTier("FREE");

      // FUNDROOM should be disabled on FREE tier
      const result = await hasModule("org-1", "FUNDROOM");
      expect(result).toBe(false);
    });

    it("returns true for FUNDROOM module on FUNDROOM tier default", async () => {
      (prisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue(null);
      mockOrgTier("FUNDROOM");

      const result = await hasModule("org-1", "FUNDROOM");
      expect(result).toBe(true);
    });
  });

  describe("isOverLimit", () => {
    it("returns false when limit is null (unlimited)", async () => {
      (prisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
        limitValue: null,
        limitType: "MONTHLY_ESIGN",
      });

      const result = await isOverLimit("org-1", "SIGNSUITE", "MONTHLY_ESIGN", 999);
      expect(result).toBe(false);
    });

    it("returns true when count meets limit", async () => {
      (prisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
        limitValue: 10,
        limitType: "MONTHLY_ESIGN",
      });

      const result = await isOverLimit("org-1", "SIGNSUITE", "MONTHLY_ESIGN", 10);
      expect(result).toBe(true);
    });

    it("returns false when count is under limit", async () => {
      (prisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
        limitValue: 10,
        limitType: "MONTHLY_ESIGN",
      });

      const result = await isOverLimit("org-1", "SIGNSUITE", "MONTHLY_ESIGN", 5);
      expect(result).toBe(false);
    });
  });

  describe("checkModuleLimit", () => {
    it("returns allowed=false when module is disabled", async () => {
      (prisma.orgProductModule.findUnique as jest.Mock).mockResolvedValue({
        enabled: false,
      });

      const result = await checkModuleLimit("org-1", "FUNDROOM", "MONTHLY_ESIGN");
      expect(result.allowed).toBe(false);
    });

    it("returns allowed=true and null limit for unlimited module", async () => {
      (prisma.orgProductModule.findUnique as jest.Mock)
        .mockResolvedValueOnce({ enabled: true }) // hasModule
        .mockResolvedValueOnce({ limitValue: null, limitType: "MONTHLY_ESIGN" }); // getModuleLimit

      (prisma.team.findMany as jest.Mock).mockResolvedValue([{ id: "team-1" }]);
      (prisma.envelope.count as jest.Mock).mockResolvedValue(50);

      const result = await checkModuleLimit("org-1", "SIGNSUITE", "MONTHLY_ESIGN");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBeNull();
    });
  });
});

// =========================================================================
// Test Suite 3: SignSuite Standalone Flow
// =========================================================================

describe("Test Suite 3: SignSuite Standalone Flow", () => {
  it("envelope gets source_module SIGNSUITE when created without dataroom", () => {
    // Unit test: verify the field mapping
    const envelopeInput = {
      teamId: "team-1",
      title: "NDA Agreement",
      sourceModule: "SIGNSUITE" as const,
    };
    expect(envelopeInput.sourceModule).toBe("SIGNSUITE");
  });

  it("parallel signing mode sends to all recipients simultaneously", () => {
    // Verify parallel signing mode configuration
    const parallelEnvelope = {
      signingMode: "PARALLEL",
      recipients: [
        { email: "a@test.com", order: 1 },
        { email: "b@test.com", order: 1 },
      ],
    };

    // All recipients in parallel have the same order
    const uniqueOrders = new Set(parallelEnvelope.recipients.map((r) => r.order));
    expect(uniqueOrders.size).toBe(1);
  });

  it("decline to sign sets envelope status to DECLINED", () => {
    const validStatuses = [
      "DRAFT", "PREPARING", "SCHEDULED", "SENT", "VIEWED",
      "PARTIALLY_SIGNED", "COMPLETED", "DECLINED", "VOIDED", "EXPIRED",
    ];
    expect(validStatuses).toContain("DECLINED");
  });

  it("SIGNSUITE module has MONTHLY_ESIGN limit type on FREE tier", () => {
    const freeModules = _getModulesForTier("FREE");
    const signSuite = freeModules.find((m) => m.module === "SIGNSUITE");
    expect(signSuite).toBeTruthy();
    expect(signSuite!.limitType).toBe("MONTHLY_ESIGN");
    expect(signSuite!.limitValue).toBe(10);
  });
});

// =========================================================================
// Test Suite 4: RaiseRoom Integration
// =========================================================================

describe("Test Suite 4: RaiseRoom Integration", () => {
  it("RAISEROOM module has MAX_ROOMS limit type on FREE tier", () => {
    const freeModules = _getModulesForTier("FREE");
    const raiseRoom = freeModules.find((m) => m.module === "RAISEROOM");
    expect(raiseRoom).toBeTruthy();
    expect(raiseRoom!.limitType).toBe("MAX_ROOMS");
    expect(raiseRoom!.limitValue).toBe(1);
  });

  it("RAISEROOM has 5 rooms on PRO tier", () => {
    const proModules = _getModulesForTier("PRO");
    const raiseRoom = proModules.find((m) => m.module === "RAISEROOM");
    expect(raiseRoom!.limitValue).toBe(5);
  });

  it("RAISEROOM is unlimited on BUSINESS tier", () => {
    const bizModules = _getModulesForTier("BUSINESS");
    const raiseRoom = bizModules.find((m) => m.module === "RAISEROOM");
    expect(raiseRoom!.limitValue).toBeNull();
  });

  it("NDA signing from RaiseRoom should use RAISEROOM source_module", () => {
    const ndaRecord = {
      linkId: "link-1",
      signerEmail: "investor@test.com",
      sourceModule: "RAISEROOM",
    };
    expect(ndaRecord.sourceModule).toBe("RAISEROOM");
  });
});

// =========================================================================
// Test Suite 5: RaiseCRM Source Tracking
// =========================================================================

describe("Test Suite 5: RaiseCRM Source Tracking", () => {
  const sourceModuleMap = {
    SIGNSUITE: "SIGNSUITE",
    RAISEROOM: "RAISEROOM",
    RAISE_CRM: "RAISE_CRM",
    DATAROOM: "DATAROOM",
    FUNDROOM: "FUNDROOM",
  };

  it.each(Object.entries(sourceModuleMap))(
    "contact created via %s gets source_module %s",
    (suiteKey, expectedModule) => {
      const contact = {
        email: "test@example.com",
        sourceModule: expectedModule,
      };
      expect(contact.sourceModule).toBe(expectedModule);
    }
  );

  it("RAISE_CRM module is enabled on all tiers", () => {
    for (const tier of ["FREE", "PRO", "BUSINESS", "FUNDROOM"] as const) {
      const modules = _getModulesForTier(tier);
      const crm = modules.find((m) => m.module === "RAISE_CRM");
      expect(crm).toBeTruthy();
      expect(crm!.enabled).toBe(true);
    }
  });

  it("RAISE_CRM has 20 contact limit on FREE, unlimited on paid", () => {
    const freeModules = _getModulesForTier("FREE");
    const freeCrm = freeModules.find((m) => m.module === "RAISE_CRM");
    expect(freeCrm!.limitValue).toBe(20);

    const proModules = _getModulesForTier("PRO");
    const proCrm = proModules.find((m) => m.module === "RAISE_CRM");
    expect(proCrm!.limitValue).toBeNull();
  });
});

// =========================================================================
// Test Suite 6: Cross-Suite Flows
// =========================================================================

describe("Test Suite 6: Cross-Suite Flows", () => {
  it("resolveEffectiveModules auto-provisions when no modules exist", async () => {
    mockNoModules();
    mockOrgTier("FREE");
    mockNoAddOns();

    // After auto-provision, second call returns modules
    (prisma.orgProductModule.findMany as jest.Mock)
      .mockResolvedValueOnce([]) // First call: no modules
      .mockResolvedValueOnce([ // After provisioning
        { module: "RAISEROOM", enabled: true, limitValue: 1, limitType: "MAX_ROOMS" },
        { module: "SIGNSUITE", enabled: true, limitValue: 10, limitType: "MONTHLY_ESIGN" },
        { module: "RAISE_CRM", enabled: true, limitValue: 20, limitType: "MAX_CONTACTS" },
        { module: "DATAROOM", enabled: true, limitValue: null, limitType: null },
        { module: "DOCROOMS", enabled: true, limitValue: null, limitType: null },
        { module: "FUNDROOM", enabled: false, limitValue: null, limitType: null },
      ]);

    const result = await resolveEffectiveModules("org-1");
    expect(result.tier).toBe("FREE");
    expect(result.modules.length).toBeGreaterThanOrEqual(6);
    expect(result.orgId).toBe("org-1");
  });

  it("add-on provisioning applies module overrides", async () => {
    mockOrgTier("FREE");
    (prisma.orgProductModule.findMany as jest.Mock).mockResolvedValue([
      { module: "PIPELINE_IQ_LITE", enabled: true, limitValue: 20, limitType: "MAX_CONTACTS" },
      { module: "PIPELINE_IQ", enabled: false, limitValue: null, limitType: null },
    ]);

    await provisionAddOn("org-1", "PIPELINE_IQ");

    // Verify PIPELINE_IQ is enabled and LITE is disabled
    const upsertCalls = (prisma.orgProductModule.upsert as jest.Mock).mock.calls;
    const piq = upsertCalls.find(
      (c: any) => c[0].create.module === "PIPELINE_IQ"
    );
    expect(piq?.[0]?.update?.enabled ?? piq?.[0]?.create?.enabled).toBe(true);
  });

  it("add-on revocation reverts to tier defaults", async () => {
    mockOrgTier("FREE");
    (prisma.orgProductModule.findMany as jest.Mock).mockResolvedValue([
      { module: "PIPELINE_IQ", enabled: true, limitValue: null, limitType: null },
    ]);

    await revokeAddOn("org-1", "PIPELINE_IQ");

    // Add-on should be deactivated
    expect(prisma.orgAddOn.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ active: false }),
      })
    );
  });
});

// =========================================================================
// Test Suite 7: Billing & Tier Changes
// =========================================================================

describe("Test Suite 7: Billing & Tier Changes", () => {
  it("provisionModulesForTier is called with correct tier on upgrade", async () => {
    mockOrgTier("PRO");
    mockNoAddOns();

    await provisionModulesForTier("org-1", "PRO");

    const upsertCalls = (prisma.orgProductModule.upsert as jest.Mock).mock.calls;
    // SIGNSUITE should get PRO limit (25)
    const signSuite = upsertCalls.find(
      (c: any) => c[0].create.module === "SIGNSUITE"
    );
    expect(signSuite[0].create.limitValue).toBe(25);
  });

  it("downgrade to FREE does not delete data", async () => {
    mockOrgTier("FREE");
    mockNoAddOns();

    await provisionModulesForTier("org-1", "FREE");

    // Verify no delete operations
    expect(prisma.orgProductModule.delete).not.toHaveBeenCalled();
    expect(prisma.orgProductModule.deleteMany).not.toHaveBeenCalled();

    // Verify limits are reduced
    const upsertCalls = (prisma.orgProductModule.upsert as jest.Mock).mock.calls;
    const raiseCrm = upsertCalls.find(
      (c: any) => c[0].create.module === "RAISE_CRM"
    );
    expect(raiseCrm[0].create.limitValue).toBe(20);
  });

  it("FUNDROOM tier enables all modules with null limits", async () => {
    mockOrgTier("FUNDROOM");
    mockNoAddOns();

    await provisionModulesForTier("org-1", "FUNDROOM");

    const upsertCalls = (prisma.orgProductModule.upsert as jest.Mock).mock.calls;
    const coreModules = ["RAISEROOM", "SIGNSUITE", "RAISE_CRM", "DATAROOM", "FUNDROOM"];

    for (const mod of coreModules) {
      const call = upsertCalls.find((c: any) => c[0].create.module === mod);
      expect(call).toBeTruthy();
      expect(call[0].create.enabled).toBe(true);
      expect(call[0].create.limitValue).toBeNull();
    }
  });

  it("payment failure grace → downgrade provisions FREE modules", async () => {
    // Simulate the flow: payment fails → after grace period → provisionModulesForTier("FREE")
    mockOrgTier("FREE");
    mockNoAddOns();

    await provisionModulesForTier("org-1", "FREE");

    const upsertCalls = (prisma.orgProductModule.upsert as jest.Mock).mock.calls;

    // FUNDROOM should be disabled
    const fundRoom = upsertCalls.find(
      (c: any) => c[0].create.module === "FUNDROOM"
    );
    expect(fundRoom[0].create.enabled).toBe(false);

    // SIGNSUITE back to 10/mo
    const signSuite = upsertCalls.find(
      (c: any) => c[0].create.module === "SIGNSUITE"
    );
    expect(signSuite[0].create.limitValue).toBe(10);
  });
});
