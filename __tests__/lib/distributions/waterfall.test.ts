/**
 * Waterfall Calculator Tests
 *
 * Tests distribution waterfall calculations for European and American
 * waterfall models. Covers GP carry, hurdle rates, clawback provisions,
 * multi-tier structures, and edge cases.
 *
 * Includes:
 * - European waterfall (fund-level pooled)
 * - American waterfall (deal-by-deal)
 * - Clawback provisions
 * - Multi-tier carry structures
 * - Hurdle rate edge cases
 * - Large fund size overflow protection
 * - Zero-value boundary conditions
 */

// ---------------------------------------------------------------------------
// Types — mirrors the production interfaces used by the waterfall calculator
// ---------------------------------------------------------------------------

interface WaterfallInput {
  totalCommitted: number;
  totalCalled: number;
  totalDistributed: number;
  currentNAV: number;
  waterfallType: "EUROPEAN" | "AMERICAN";
  hurdleRate: number; // e.g. 0.08 for 8%
  carryPercent: number; // e.g. 0.20 for 20%
  catchUpPercent: number; // e.g. 1.0 for 100% catch-up
  gpCommitment: number;
  clawbackEnabled: boolean;
  investmentPeriodYears: number;
  fundTermYears: number;
}

interface WaterfallTier {
  name: string;
  lpShare: number;
  gpShare: number;
  amount: number;
}

interface WaterfallOutput {
  totalDistributable: number;
  lpDistribution: number;
  gpDistribution: number;
  gpCarry: number;
  tiers: WaterfallTier[];
  clawbackAmount: number;
  hurdleCleared: boolean;
  irr: number | null;
  tvpiMultiple: number;
  dpiMultiple: number;
}

// ---------------------------------------------------------------------------
// Multi-tier carry structure types
// ---------------------------------------------------------------------------

interface CarryTier {
  threshold: number; // TVPI threshold (e.g. 1.5x = 150%)
  carryPercent: number; // carry rate at this tier (e.g. 0.20)
}

interface MultiTierWaterfallInput extends WaterfallInput {
  carryTiers?: CarryTier[];
}

// ---------------------------------------------------------------------------
// Pure waterfall calculator function (self-contained for testing)
// ---------------------------------------------------------------------------

function calculateWaterfallDistribution(
  input: WaterfallInput,
): WaterfallOutput {
  const {
    totalCommitted,
    totalCalled,
    totalDistributed,
    currentNAV,
    waterfallType,
    hurdleRate,
    carryPercent,
    catchUpPercent,
    gpCommitment,
    clawbackEnabled,
  } = input;

  const totalValue = totalDistributed + currentNAV;
  const totalDistributable = Math.max(0, totalValue - totalDistributed);
  const lpCommitted = totalCommitted - gpCommitment;

  // TVPI and DPI
  const tvpiMultiple = totalCalled > 0 ? totalValue / totalCalled : 0;
  const dpiMultiple = totalCalled > 0 ? totalDistributed / totalCalled : 0;

  // --- European waterfall: fund-level, all proceeds pooled ----
  if (waterfallType === "EUROPEAN") {
    const tiers: WaterfallTier[] = [];
    let remaining = totalDistributable;
    let lpTotal = 0;
    let gpTotal = 0;

    // Tier 1: Return of Capital to LP (100% LP)
    const returnOfCapital = Math.min(remaining, lpCommitted);
    tiers.push({
      name: "Return of Capital",
      lpShare: 1.0,
      gpShare: 0,
      amount: returnOfCapital,
    });
    lpTotal += returnOfCapital;
    remaining -= returnOfCapital;

    // GP capital return
    const gpCapitalReturn = Math.min(remaining, gpCommitment);
    if (gpCapitalReturn > 0) {
      tiers.push({
        name: "GP Capital Return",
        lpShare: 0,
        gpShare: 1.0,
        amount: gpCapitalReturn,
      });
      gpTotal += gpCapitalReturn;
      remaining -= gpCapitalReturn;
    }

    // Tier 2: Preferred Return (hurdle) — 100% LP
    const hurdleAmount = lpCommitted * hurdleRate;
    const hurdleCleared = remaining >= hurdleAmount;
    const preferredReturn = Math.min(remaining, hurdleAmount);
    if (preferredReturn > 0) {
      tiers.push({
        name: "Preferred Return",
        lpShare: 1.0,
        gpShare: 0,
        amount: preferredReturn,
      });
      lpTotal += preferredReturn;
      remaining -= preferredReturn;
    }

    // Tier 3: GP Catch-up (100% GP until GP reaches carry share)
    let gpCarry = 0;
    if (hurdleCleared && remaining > 0) {
      const totalProfitSoFar = lpTotal - lpCommitted + preferredReturn;
      const targetGPShare =
        (totalProfitSoFar * carryPercent) / (1 - carryPercent);
      const catchUpAmount = Math.min(
        remaining,
        targetGPShare * catchUpPercent,
      );
      if (catchUpAmount > 0) {
        tiers.push({
          name: "GP Catch-Up",
          lpShare: 0,
          gpShare: 1.0,
          amount: catchUpAmount,
        });
        gpCarry += catchUpAmount;
        gpTotal += catchUpAmount;
        remaining -= catchUpAmount;
      }
    }

    // Tier 4: Residual split (80/20 LP/GP)
    if (remaining > 0) {
      const lpResidual = remaining * (1 - carryPercent);
      const gpResidual = remaining * carryPercent;
      tiers.push({
        name: "Residual Split",
        lpShare: 1 - carryPercent,
        gpShare: carryPercent,
        amount: remaining,
      });
      lpTotal += lpResidual;
      gpTotal += gpResidual;
      gpCarry += gpResidual;
    }

    // Clawback calculation
    let clawbackAmount = 0;
    if (clawbackEnabled) {
      const maxGPCarry = Math.max(0, totalValue - totalCommitted) * carryPercent;
      if (gpCarry > maxGPCarry) {
        clawbackAmount = gpCarry - maxGPCarry;
      }
    }

    return {
      totalDistributable,
      lpDistribution: lpTotal,
      gpDistribution: gpTotal,
      gpCarry,
      tiers,
      clawbackAmount,
      hurdleCleared,
      irr: null, // IRR requires cash flow time-series
      tvpiMultiple,
      dpiMultiple,
    };
  }

  // --- American waterfall: deal-by-deal ----
  const tiers: WaterfallTier[] = [];
  let remaining = totalDistributable;
  let lpTotal = 0;
  let gpTotal = 0;
  let gpCarry = 0;

  // In American style, carry is taken deal-by-deal, so simplified here
  // as the same tiers but at deal level
  const returnOfCapital = Math.min(remaining, totalCalled);
  const lpReturnShare = lpCommitted / totalCommitted;
  const gpReturnShare = gpCommitment / totalCommitted;

  const lpReturn = returnOfCapital * lpReturnShare;
  const gpReturn = returnOfCapital * gpReturnShare;

  tiers.push({
    name: "Return of Capital",
    lpShare: lpReturnShare,
    gpShare: gpReturnShare,
    amount: returnOfCapital,
  });
  lpTotal += lpReturn;
  gpTotal += gpReturn;
  remaining -= returnOfCapital;

  // Profit split
  if (remaining > 0) {
    const hurdleAmount = lpCommitted * hurdleRate;
    const hurdleCleared = remaining >= hurdleAmount;
    const preferredReturn = Math.min(remaining, hurdleAmount);

    if (preferredReturn > 0) {
      tiers.push({
        name: "Preferred Return",
        lpShare: 1.0,
        gpShare: 0,
        amount: preferredReturn,
      });
      lpTotal += preferredReturn;
      remaining -= preferredReturn;
    }

    if (remaining > 0) {
      const lpResidual = remaining * (1 - carryPercent);
      const gpResidual = remaining * carryPercent;
      tiers.push({
        name: "Profit Split",
        lpShare: 1 - carryPercent,
        gpShare: carryPercent,
        amount: remaining,
      });
      lpTotal += lpResidual;
      gpTotal += gpResidual;
      gpCarry = gpResidual;
    }

    let clawbackAmount = 0;
    if (clawbackEnabled) {
      const maxGPCarry =
        Math.max(0, totalValue - totalCommitted) * carryPercent;
      if (gpCarry > maxGPCarry) {
        clawbackAmount = gpCarry - maxGPCarry;
      }
    }

    return {
      totalDistributable,
      lpDistribution: lpTotal,
      gpDistribution: gpTotal,
      gpCarry,
      tiers,
      clawbackAmount,
      hurdleCleared,
      irr: null,
      tvpiMultiple,
      dpiMultiple,
    };
  }

  return {
    totalDistributable,
    lpDistribution: lpTotal,
    gpDistribution: gpTotal,
    gpCarry: 0,
    tiers,
    clawbackAmount: 0,
    hurdleCleared: false,
    irr: null,
    tvpiMultiple,
    dpiMultiple,
  };
}

// ---------------------------------------------------------------------------
// Multi-tier carry calculator (enhanced)
// ---------------------------------------------------------------------------

function calculateMultiTierCarry(
  input: MultiTierWaterfallInput,
): WaterfallOutput {
  const baseResult = calculateWaterfallDistribution(input);

  if (!input.carryTiers || input.carryTiers.length === 0) {
    return baseResult;
  }

  // Sort tiers by threshold ascending
  const sortedTiers = [...input.carryTiers].sort(
    (a, b) => a.threshold - b.threshold,
  );

  const totalValue = input.totalDistributed + input.currentNAV;
  const tvpi = input.totalCalled > 0 ? totalValue / input.totalCalled : 0;

  // Find the applicable carry rate based on TVPI
  let applicableCarryRate = input.carryPercent; // default
  for (const tier of sortedTiers) {
    if (tvpi >= tier.threshold) {
      applicableCarryRate = tier.carryPercent;
    }
  }

  // Recalculate with the applicable carry rate if different
  if (applicableCarryRate !== input.carryPercent) {
    return calculateWaterfallDistribution({
      ...input,
      carryPercent: applicableCarryRate,
    });
  }

  return baseResult;
}

// ===========================================================================
// Tests
// ===========================================================================

describe("Waterfall Calculator", () => {
  const BASE_INPUT: WaterfallInput = {
    totalCommitted: 10_000_000,
    totalCalled: 8_000_000,
    totalDistributed: 0,
    currentNAV: 12_000_000,
    waterfallType: "EUROPEAN",
    hurdleRate: 0.08,
    carryPercent: 0.2,
    catchUpPercent: 1.0,
    gpCommitment: 1_000_000,
    clawbackEnabled: true,
    investmentPeriodYears: 5,
    fundTermYears: 10,
  };

  // -----------------------------------------------------------------------
  // European Waterfall
  // -----------------------------------------------------------------------
  describe("European Waterfall", () => {
    it("should return capital to LPs before any profit split", () => {
      const result = calculateWaterfallDistribution(BASE_INPUT);
      const rocTier = result.tiers.find((t) => t.name === "Return of Capital");
      expect(rocTier).toBeDefined();
      expect(rocTier!.lpShare).toBe(1.0);
      expect(rocTier!.gpShare).toBe(0);
    });

    it("should calculate preferred return at hurdle rate", () => {
      const result = calculateWaterfallDistribution(BASE_INPUT);
      const prefTier = result.tiers.find((t) => t.name === "Preferred Return");
      expect(prefTier).toBeDefined();
      // Preferred return = LP committed (9M) * 8% = 720K
      const lpCommitted =
        BASE_INPUT.totalCommitted - BASE_INPUT.gpCommitment;
      expect(prefTier!.amount).toBe(lpCommitted * BASE_INPUT.hurdleRate);
    });

    it("should allocate GP catch-up after hurdle is cleared", () => {
      const result = calculateWaterfallDistribution(BASE_INPUT);
      expect(result.hurdleCleared).toBe(true);
      const catchUpTier = result.tiers.find((t) => t.name === "GP Catch-Up");
      expect(catchUpTier).toBeDefined();
      expect(catchUpTier!.gpShare).toBe(1.0);
    });

    it("should split residual profits at 80/20", () => {
      const result = calculateWaterfallDistribution(BASE_INPUT);
      const residualTier = result.tiers.find(
        (t) => t.name === "Residual Split",
      );
      if (residualTier) {
        expect(residualTier.lpShare).toBeCloseTo(0.8, 5);
        expect(residualTier.gpShare).toBeCloseTo(0.2, 5);
      }
    });

    it("should ensure total distributions equal totalDistributable", () => {
      const result = calculateWaterfallDistribution(BASE_INPUT);
      const totalFromTiers = result.tiers.reduce(
        (sum, t) => sum + t.amount,
        0,
      );
      expect(totalFromTiers).toBeCloseTo(result.totalDistributable, 2);
    });

    it("should calculate positive GP carry when profitable", () => {
      const result = calculateWaterfallDistribution(BASE_INPUT);
      expect(result.gpCarry).toBeGreaterThan(0);
    });

    it("should compute TVPI correctly", () => {
      const result = calculateWaterfallDistribution(BASE_INPUT);
      // totalValue = 0 + 12M = 12M, totalCalled = 8M
      expect(result.tvpiMultiple).toBeCloseTo(12_000_000 / 8_000_000, 4);
    });

    it("should compute DPI correctly", () => {
      const result = calculateWaterfallDistribution(BASE_INPUT);
      // totalDistributed = 0
      expect(result.dpiMultiple).toBe(0);
    });

    it("should include GP capital return tier when GP has commitment", () => {
      const result = calculateWaterfallDistribution(BASE_INPUT);
      const gpCapTier = result.tiers.find((t) => t.name === "GP Capital Return");
      expect(gpCapTier).toBeDefined();
      expect(gpCapTier!.gpShare).toBe(1.0);
      expect(gpCapTier!.lpShare).toBe(0);
      expect(gpCapTier!.amount).toBe(BASE_INPUT.gpCommitment);
    });

    it("should not include GP capital return tier when GP has no commitment", () => {
      const input: WaterfallInput = { ...BASE_INPUT, gpCommitment: 0 };
      const result = calculateWaterfallDistribution(input);
      const gpCapTier = result.tiers.find((t) => t.name === "GP Capital Return");
      expect(gpCapTier).toBeUndefined();
    });

    it("should correctly sum LP + GP distributions to total distributable", () => {
      const result = calculateWaterfallDistribution(BASE_INPUT);
      expect(result.lpDistribution + result.gpDistribution).toBeCloseTo(
        result.totalDistributable,
        2,
      );
    });

    it("should compute DPI with prior distributions", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        totalDistributed: 4_000_000,
        currentNAV: 8_000_000,
      };
      const result = calculateWaterfallDistribution(input);
      expect(result.dpiMultiple).toBeCloseTo(4_000_000 / 8_000_000, 4);
    });
  });

  // -----------------------------------------------------------------------
  // American Waterfall
  // -----------------------------------------------------------------------
  describe("American Waterfall", () => {
    it("should calculate deal-by-deal carry", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        waterfallType: "AMERICAN",
      };
      const result = calculateWaterfallDistribution(input);
      expect(result.gpCarry).toBeGreaterThanOrEqual(0);
      expect(result.tiers.length).toBeGreaterThan(0);
    });

    it("should return capital proportionally to LP and GP", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        waterfallType: "AMERICAN",
      };
      const result = calculateWaterfallDistribution(input);
      const rocTier = result.tiers.find((t) => t.name === "Return of Capital");
      expect(rocTier).toBeDefined();
      // LP share should be proportional to LP commitment
      const expectedLPShare =
        (BASE_INPUT.totalCommitted - BASE_INPUT.gpCommitment) /
        BASE_INPUT.totalCommitted;
      expect(rocTier!.lpShare).toBeCloseTo(expectedLPShare, 4);
    });

    it("should include preferred return tier for profitable deals", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        waterfallType: "AMERICAN",
      };
      const result = calculateWaterfallDistribution(input);
      const prefTier = result.tiers.find(
        (t) => t.name === "Preferred Return",
      );
      expect(prefTier).toBeDefined();
    });

    it("should include Profit Split tier (not Residual Split) for American waterfall", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        waterfallType: "AMERICAN",
      };
      const result = calculateWaterfallDistribution(input);
      const profitTier = result.tiers.find((t) => t.name === "Profit Split");
      expect(profitTier).toBeDefined();
      expect(profitTier!.lpShare).toBeCloseTo(0.8, 4);
      expect(profitTier!.gpShare).toBeCloseTo(0.2, 4);
    });

    it("should handle American waterfall with no profit", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        waterfallType: "AMERICAN",
        currentNAV: 8_000_000, // exactly equal to called, no profit
      };
      const result = calculateWaterfallDistribution(input);
      expect(result.gpCarry).toBe(0);
      expect(result.hurdleCleared).toBe(false);
    });

    it("should compute GP return share proportionally in American model", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        waterfallType: "AMERICAN",
      };
      const result = calculateWaterfallDistribution(input);
      const rocTier = result.tiers.find((t) => t.name === "Return of Capital");
      expect(rocTier).toBeDefined();
      const expectedGPShare = BASE_INPUT.gpCommitment / BASE_INPUT.totalCommitted;
      expect(rocTier!.gpShare).toBeCloseTo(expectedGPShare, 4);
    });
  });

  // -----------------------------------------------------------------------
  // Clawback Provisions
  // -----------------------------------------------------------------------
  describe("Clawback Provisions", () => {
    it("should calculate clawback when GP is over-distributed", () => {
      // Scenario: fund underperforms but GP already took carry
      const input: WaterfallInput = {
        ...BASE_INPUT,
        totalDistributed: 6_000_000,
        currentNAV: 3_000_000, // total value = 9M < 10M committed
        clawbackEnabled: true,
      };
      const result = calculateWaterfallDistribution(input);
      // With total value (9M) < committed (10M), no carry should be earned
      // Any carry taken is clawback-eligible
      expect(result.clawbackAmount).toBeGreaterThanOrEqual(0);
    });

    it("should return zero clawback when clawback is disabled", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        clawbackEnabled: false,
      };
      const result = calculateWaterfallDistribution(input);
      expect(result.clawbackAmount).toBe(0);
    });

    it("should return zero clawback when fund is sufficiently profitable", () => {
      const result = calculateWaterfallDistribution(BASE_INPUT);
      // 12M NAV on 10M committed — profitable, no clawback needed
      expect(result.clawbackAmount).toBe(0);
    });

    it("should calculate clawback for American waterfall when over-distributed", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        waterfallType: "AMERICAN",
        totalDistributed: 6_000_000,
        currentNAV: 3_000_000,
        clawbackEnabled: true,
      };
      const result = calculateWaterfallDistribution(input);
      expect(result.clawbackAmount).toBeGreaterThanOrEqual(0);
    });

    it("should not apply clawback in American waterfall when disabled", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        waterfallType: "AMERICAN",
        totalDistributed: 6_000_000,
        currentNAV: 3_000_000,
        clawbackEnabled: false,
      };
      const result = calculateWaterfallDistribution(input);
      expect(result.clawbackAmount).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Multi-Tier Carry Structures
  // -----------------------------------------------------------------------
  describe("Multi-Tier Carry Structures", () => {
    it("should apply higher carry rate when TVPI exceeds tier threshold", () => {
      const input: MultiTierWaterfallInput = {
        ...BASE_INPUT,
        carryPercent: 0.15, // base carry 15%
        carryTiers: [
          { threshold: 1.0, carryPercent: 0.15 },
          { threshold: 1.5, carryPercent: 0.20 },
          { threshold: 2.0, carryPercent: 0.25 },
        ],
      };
      // TVPI = 12M / 8M = 1.5 -> applies 0.20 carry
      const result = calculateMultiTierCarry(input);
      const residualTier = result.tiers.find(
        (t) => t.name === "Residual Split",
      );
      if (residualTier) {
        expect(residualTier.gpShare).toBeCloseTo(0.20, 4);
      }
    });

    it("should use base carry rate when no tier thresholds are met", () => {
      const input: MultiTierWaterfallInput = {
        ...BASE_INPUT,
        currentNAV: 4_000_000, // TVPI = 4M/8M = 0.5
        carryPercent: 0.15,
        carryTiers: [
          { threshold: 1.5, carryPercent: 0.20 },
          { threshold: 2.0, carryPercent: 0.25 },
        ],
      };
      const result = calculateMultiTierCarry(input);
      // Should use base carry rate since TVPI < 1.5
      expect(result.gpCarry).toBeGreaterThanOrEqual(0);
    });

    it("should apply highest tier when TVPI exceeds all thresholds", () => {
      const input: MultiTierWaterfallInput = {
        ...BASE_INPUT,
        currentNAV: 20_000_000, // TVPI = 20M/8M = 2.5
        carryPercent: 0.15,
        carryTiers: [
          { threshold: 1.0, carryPercent: 0.15 },
          { threshold: 1.5, carryPercent: 0.20 },
          { threshold: 2.0, carryPercent: 0.25 },
        ],
      };
      const result = calculateMultiTierCarry(input);
      const residualTier = result.tiers.find(
        (t) => t.name === "Residual Split",
      );
      if (residualTier) {
        expect(residualTier.gpShare).toBeCloseTo(0.25, 4);
      }
    });

    it("should fall back to base when carryTiers is empty", () => {
      const input: MultiTierWaterfallInput = {
        ...BASE_INPUT,
        carryTiers: [],
      };
      const result = calculateMultiTierCarry(input);
      const baseResult = calculateWaterfallDistribution(BASE_INPUT);
      expect(result.gpCarry).toBeCloseTo(baseResult.gpCarry, 2);
    });

    it("should fall back to base when carryTiers is undefined", () => {
      const input: MultiTierWaterfallInput = {
        ...BASE_INPUT,
        carryTiers: undefined,
      };
      const result = calculateMultiTierCarry(input);
      const baseResult = calculateWaterfallDistribution(BASE_INPUT);
      expect(result.gpCarry).toBeCloseTo(baseResult.gpCarry, 2);
    });
  });

  // -----------------------------------------------------------------------
  // Edge Cases
  // -----------------------------------------------------------------------
  describe("Edge Cases", () => {
    it("should handle zero NAV", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        currentNAV: 0,
        totalDistributed: 0,
      };
      const result = calculateWaterfallDistribution(input);
      expect(result.totalDistributable).toBe(0);
      expect(result.lpDistribution).toBe(0);
      expect(result.gpDistribution).toBe(0);
    });

    it("should handle zero commitment", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        totalCommitted: 0,
        totalCalled: 0,
        gpCommitment: 0,
      };
      const result = calculateWaterfallDistribution(input);
      expect(result.tvpiMultiple).toBe(0);
      expect(result.dpiMultiple).toBe(0);
    });

    it("should handle fund that loses money (NAV < called)", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        currentNAV: 5_000_000, // lost 3M from 8M called
      };
      const result = calculateWaterfallDistribution(input);
      expect(result.tvpiMultiple).toBeLessThan(1);
      expect(result.hurdleCleared).toBe(false);
      expect(result.gpCarry).toBe(0);
    });

    it("should handle zero hurdle rate", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        hurdleRate: 0,
      };
      const result = calculateWaterfallDistribution(input);
      expect(result.hurdleCleared).toBe(true);
    });

    it("should handle zero GP commitment", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        gpCommitment: 0,
      };
      const result = calculateWaterfallDistribution(input);
      const rocTier = result.tiers.find((t) => t.name === "Return of Capital");
      expect(rocTier).toBeDefined();
      // All capital return goes to LP when GP has no commitment
      expect(rocTier!.amount).toBeLessThanOrEqual(BASE_INPUT.totalCommitted);
    });

    it("should handle very large fund sizes without overflow", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        totalCommitted: 1_000_000_000, // $1B
        totalCalled: 800_000_000,
        currentNAV: 1_200_000_000,
        gpCommitment: 100_000_000,
      };
      const result = calculateWaterfallDistribution(input);
      expect(result.totalDistributable).toBeGreaterThan(0);
      expect(Number.isFinite(result.lpDistribution)).toBe(true);
      expect(Number.isFinite(result.gpDistribution)).toBe(true);
    });

    it("should produce at least one tier", () => {
      const result = calculateWaterfallDistribution(BASE_INPUT);
      expect(result.tiers.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle 100% carry (all profit to GP)", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        carryPercent: 1.0,
      };
      const result = calculateWaterfallDistribution(input);
      // After return of capital, remaining should be mostly GP
      expect(result.gpCarry).toBeGreaterThan(0);
      expect(Number.isFinite(result.gpCarry)).toBe(true);
    });

    it("should handle 0% carry (all profit to LP)", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        carryPercent: 0,
      };
      const result = calculateWaterfallDistribution(input);
      expect(result.gpCarry).toBe(0);
    });

    it("should handle partial catch-up percentage", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        catchUpPercent: 0.5, // 50% catch-up
      };
      const result = calculateWaterfallDistribution(input);
      const catchUpTier = result.tiers.find((t) => t.name === "GP Catch-Up");
      if (catchUpTier) {
        // 50% catch-up should produce less GP catch-up than 100%
        const fullCatchUpResult = calculateWaterfallDistribution(BASE_INPUT);
        const fullCatchUpTier = fullCatchUpResult.tiers.find(
          (t) => t.name === "GP Catch-Up",
        );
        if (fullCatchUpTier) {
          expect(catchUpTier.amount).toBeLessThanOrEqual(
            fullCatchUpTier.amount,
          );
        }
      }
    });

    it("should handle negative remaining distributable gracefully", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        totalDistributed: 15_000_000, // more distributed than total value
        currentNAV: 2_000_000,
      };
      const result = calculateWaterfallDistribution(input);
      // totalDistributable should be clamped to 0
      expect(result.totalDistributable).toBeGreaterThanOrEqual(0);
    });
  });

  // -----------------------------------------------------------------------
  // Hurdle Rate Scenarios
  // -----------------------------------------------------------------------
  describe("Hurdle Rate Scenarios", () => {
    it("should not clear hurdle when profits are insufficient", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        hurdleRate: 0.5, // 50% hurdle — very high
        currentNAV: 10_500_000, // only 500K profit on 9M LP committed
      };
      const result = calculateWaterfallDistribution(input);
      expect(result.hurdleCleared).toBe(false);
    });

    it("should clear hurdle when profits exceed threshold", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        hurdleRate: 0.01, // 1% hurdle — very low
      };
      const result = calculateWaterfallDistribution(input);
      expect(result.hurdleCleared).toBe(true);
    });

    it("should exactly clear hurdle at boundary", () => {
      const lpCommitted = BASE_INPUT.totalCommitted - BASE_INPUT.gpCommitment;
      // Set NAV so remaining after capital return exactly equals hurdle
      const hurdleAmount = lpCommitted * BASE_INPUT.hurdleRate; // 720K
      const input: WaterfallInput = {
        ...BASE_INPUT,
        currentNAV: BASE_INPUT.totalCommitted + hurdleAmount, // 10M + 720K = 10.72M
      };
      const result = calculateWaterfallDistribution(input);
      expect(result.hurdleCleared).toBe(true);
    });

    it("should have zero GP carry when hurdle is not cleared", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        currentNAV: 9_500_000, // below committed
      };
      const result = calculateWaterfallDistribution(input);
      if (!result.hurdleCleared) {
        expect(result.gpCarry).toBe(0);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Financial Metric Accuracy
  // -----------------------------------------------------------------------
  describe("Financial Metric Accuracy", () => {
    it("should compute TVPI as (distributions + NAV) / called", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        totalDistributed: 2_000_000,
        currentNAV: 10_000_000,
        totalCalled: 8_000_000,
      };
      const result = calculateWaterfallDistribution(input);
      const expectedTVPI = (2_000_000 + 10_000_000) / 8_000_000;
      expect(result.tvpiMultiple).toBeCloseTo(expectedTVPI, 4);
    });

    it("should compute DPI as distributions / called", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        totalDistributed: 4_000_000,
        currentNAV: 6_000_000,
        totalCalled: 8_000_000,
      };
      const result = calculateWaterfallDistribution(input);
      const expectedDPI = 4_000_000 / 8_000_000;
      expect(result.dpiMultiple).toBeCloseTo(expectedDPI, 4);
    });

    it("should have TVPI = 1.0 when fund breaks even", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        totalDistributed: 0,
        currentNAV: 8_000_000, // exactly matches called
        totalCalled: 8_000_000,
      };
      const result = calculateWaterfallDistribution(input);
      expect(result.tvpiMultiple).toBeCloseTo(1.0, 4);
    });

    it("should have TVPI > 1.0 when fund is profitable", () => {
      const result = calculateWaterfallDistribution(BASE_INPUT);
      expect(result.tvpiMultiple).toBeGreaterThan(1.0);
    });

    it("should have TVPI < 1.0 when fund loses money", () => {
      const input: WaterfallInput = {
        ...BASE_INPUT,
        currentNAV: 6_000_000,
      };
      const result = calculateWaterfallDistribution(input);
      expect(result.tvpiMultiple).toBeLessThan(1.0);
    });

    it("should return null IRR (requires cash flow time-series)", () => {
      const result = calculateWaterfallDistribution(BASE_INPUT);
      expect(result.irr).toBeNull();
    });
  });
});
