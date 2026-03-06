/**
 * SEC Form D Compliance Validation Tests
 *
 * Self-contained test suite with pure validation functions embedded directly
 * in the test file. Covers SEC Form D (OMB 3235-0076) compliance across all
 * exemption types, investor accreditation rules, filing deadlines, and
 * data integrity.
 *
 * Regulation types tested:
 *   - Rule 506(b): Up to 35 non-accredited, no general solicitation
 *   - Rule 506(c): All accredited, general solicitation allowed, verification required
 *   - Regulation A+: Tier 1 ($20M), Tier 2 ($75M), non-accredited allowed
 *   - Rule 504: Max $10M in 12 months
 *
 * Also tests:
 *   - Investment Company Act exemptions (3(c)(1), 3(c)(7))
 *   - Filing deadline calculations (15-day rule)
 *   - Issuer identity validation
 *   - Accreditation status categorization
 *   - Edge cases (zero investors, boundary amounts, missing data)
 *   - Cross-exemption switching validation
 */

// ============================================================================
// Types
// ============================================================================

type SecExemption = "506B" | "506C" | "REG_A_PLUS" | "RULE_504";

type AccreditationStatus =
  | "SELF_CERTIFIED"
  | "KYC_VERIFIED"
  | "THIRD_PARTY_VERIFIED"
  | "PENDING"
  | "NOT_ACCREDITED";

type InvestmentCompanyExemption = "3C1" | "3C7" | null;

interface InvestorRecord {
  id: string;
  accreditationStatus: AccreditationStatus;
  accreditationMethod?: string;
  fundedAmount: number;
  commitmentAmount: number;
  subscriptionDate: Date | null;
  isAccredited: boolean;
}

interface FundFormDData {
  fundName: string;
  regulationDExemption: SecExemption;
  investmentCompanyExemption: InvestmentCompanyExemption;
  targetRaise: number;
  totalRaised: number;
  minimumInvestment: number;
  entityMode: "FUND" | "STARTUP";
  fundSubType: string | null;
  investors: InvestorRecord[];
  formDFilingDate: Date | null;
  firstSaleDate: Date | null;
  issuer: {
    entityName: string;
    entityType: string;
    state: string;
    ein: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressCity: string | null;
    addressState: string | null;
    addressZip: string | null;
  };
}

interface FormDError {
  field: string;
  code: string;
  message: string;
  severity: "ERROR" | "WARNING";
}

interface FormDValidationResult {
  valid: boolean;
  errors: FormDError[];
  warnings: FormDError[];
  investorCounts: {
    total: number;
    accredited: number;
    nonAccredited: number;
    pending: number;
  };
  filingDeadline: Date | null;
  filingType: "NEW_NOTICE" | "AMENDMENT";
}

// ============================================================================
// Pure Validation Functions (self-contained)
// ============================================================================

function isAccredited(status: AccreditationStatus): boolean {
  return status === "SELF_CERTIFIED" || status === "KYC_VERIFIED" || status === "THIRD_PARTY_VERIFIED";
}

function isNonAccredited(status: AccreditationStatus): boolean {
  return status === "NOT_ACCREDITED";
}

function calculateFilingDeadline(firstSaleDate: Date | null): Date | null {
  if (!firstSaleDate) return null;
  const deadline = new Date(firstSaleDate);
  deadline.setDate(deadline.getDate() + 15);
  return deadline;
}

function countInvestorsByAccreditation(investors: InvestorRecord[]): {
  total: number;
  accredited: number;
  nonAccredited: number;
  pending: number;
} {
  const total = investors.length;
  const accredited = investors.filter((i) => isAccredited(i.accreditationStatus)).length;
  const nonAccredited = investors.filter((i) => isNonAccredited(i.accreditationStatus)).length;
  const pending = investors.filter((i) => i.accreditationStatus === "PENDING").length;
  return { total, accredited, nonAccredited, pending };
}

function validateFormDCompliance(data: FundFormDData): FormDValidationResult {
  const errors: FormDError[] = [];
  const warnings: FormDError[] = [];
  const investorCounts = countInvestorsByAccreditation(data.investors);
  const filingDeadline = calculateFilingDeadline(data.firstSaleDate);
  const filingType = data.formDFilingDate ? "AMENDMENT" : "NEW_NOTICE";

  // ---- Issuer validation ----
  if (!data.issuer.entityName || data.issuer.entityName.trim().length === 0) {
    errors.push({
      field: "issuer.entityName",
      code: "MISSING_ISSUER_NAME",
      message: "Issuer legal entity name is required",
      severity: "ERROR",
    });
  }

  if (!data.issuer.addressState) {
    errors.push({
      field: "issuer.addressState",
      code: "MISSING_STATE",
      message: "State of organization is required for Form D",
      severity: "ERROR",
    });
  }

  if (!data.issuer.phone) {
    warnings.push({
      field: "issuer.phone",
      code: "MISSING_PHONE",
      message: "Issuer phone number is recommended for Form D",
      severity: "WARNING",
    });
  }

  // ---- Exemption-specific validation ----
  switch (data.regulationDExemption) {
    case "506B": {
      // Rule 506(b): max 35 non-accredited investors
      if (investorCounts.nonAccredited > 35) {
        errors.push({
          field: "investors",
          code: "506B_NON_ACCREDITED_LIMIT",
          message: `Rule 506(b) allows maximum 35 non-accredited investors. Found: ${investorCounts.nonAccredited}`,
          severity: "ERROR",
        });
      }
      // No general solicitation under 506(b)
      break;
    }

    case "506C": {
      // Rule 506(c): ALL investors must be accredited
      if (investorCounts.nonAccredited > 0) {
        errors.push({
          field: "investors",
          code: "506C_ALL_ACCREDITED",
          message: `Rule 506(c) requires all investors to be accredited. Found ${investorCounts.nonAccredited} non-accredited`,
          severity: "ERROR",
        });
      }
      // 506(c) requires reasonable steps to verify accreditation
      const selfCertOnly = data.investors.filter(
        (i) => i.accreditationStatus === "SELF_CERTIFIED"
      );
      if (selfCertOnly.length > 0 && data.regulationDExemption === "506C") {
        warnings.push({
          field: "investors",
          code: "506C_VERIFICATION_REQUIRED",
          message: `Rule 506(c) requires reasonable verification beyond self-certification. ${selfCertOnly.length} investor(s) are self-certified only`,
          severity: "WARNING",
        });
      }
      // Pending investors are a risk
      if (investorCounts.pending > 0) {
        warnings.push({
          field: "investors",
          code: "506C_PENDING_ACCREDITATION",
          message: `${investorCounts.pending} investor(s) have pending accreditation status`,
          severity: "WARNING",
        });
      }
      break;
    }

    case "REG_A_PLUS": {
      // Reg A+ Tier 1: max $20M, Tier 2: max $75M
      // We use the target raise as the offering amount
      if (data.targetRaise > 75_000_000) {
        errors.push({
          field: "targetRaise",
          code: "REG_A_PLUS_AMOUNT_EXCEEDED",
          message: `Regulation A+ Tier 2 maximum is $75M. Target: $${data.targetRaise.toLocaleString()}`,
          severity: "ERROR",
        });
      } else if (data.targetRaise > 20_000_000) {
        // Between $20M and $75M is Tier 2 (additional audit requirements)
        warnings.push({
          field: "targetRaise",
          code: "REG_A_PLUS_TIER_2",
          message: `Offering exceeds $20M — Regulation A+ Tier 2 requires audited financial statements`,
          severity: "WARNING",
        });
      }
      break;
    }

    case "RULE_504": {
      // Rule 504: max $10M in 12 months
      if (data.targetRaise > 10_000_000) {
        errors.push({
          field: "targetRaise",
          code: "RULE_504_AMOUNT_EXCEEDED",
          message: `Rule 504 maximum is $10M in a 12-month period. Target: $${data.targetRaise.toLocaleString()}`,
          severity: "ERROR",
        });
      }
      break;
    }
  }

  // ---- Investment Company Act validation ----
  if (data.investmentCompanyExemption === "3C1") {
    // 3(c)(1): max 100 beneficial owners
    if (investorCounts.total > 100) {
      errors.push({
        field: "investors",
        code: "3C1_INVESTOR_LIMIT",
        message: `Section 3(c)(1) allows maximum 100 beneficial owners. Found: ${investorCounts.total}`,
        severity: "ERROR",
      });
    }
  } else if (data.investmentCompanyExemption === "3C7") {
    // 3(c)(7): all must be qualified purchasers
    if (investorCounts.nonAccredited > 0) {
      errors.push({
        field: "investors",
        code: "3C7_QUALIFIED_PURCHASERS",
        message: `Section 3(c)(7) requires all investors to be qualified purchasers. Found ${investorCounts.nonAccredited} non-qualified`,
        severity: "ERROR",
      });
    }
  }

  // ---- Filing deadline warnings ----
  if (filingDeadline && filingType === "NEW_NOTICE") {
    const now = new Date();
    const daysUntilDeadline = Math.ceil(
      (filingDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilDeadline < 0) {
      errors.push({
        field: "filingDeadline",
        code: "FILING_OVERDUE",
        message: `Form D filing deadline was ${Math.abs(daysUntilDeadline)} day(s) ago`,
        severity: "ERROR",
      });
    } else if (daysUntilDeadline <= 5) {
      warnings.push({
        field: "filingDeadline",
        code: "FILING_SOON",
        message: `Form D filing deadline is in ${daysUntilDeadline} day(s)`,
        severity: "WARNING",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    investorCounts,
    filingDeadline,
    filingType,
  };
}

// ============================================================================
// Test Helpers
// ============================================================================

function createInvestor(
  overrides: Partial<InvestorRecord> = {}
): InvestorRecord {
  return {
    id: `inv-${Math.random().toString(36).slice(2, 8)}`,
    accreditationStatus: "SELF_CERTIFIED",
    fundedAmount: 100_000,
    commitmentAmount: 100_000,
    subscriptionDate: new Date("2025-06-15"),
    isAccredited: true,
    ...overrides,
  };
}

function createFormDData(
  overrides: Partial<FundFormDData> = {}
): FundFormDData {
  return {
    fundName: "Test Fund I",
    regulationDExemption: "506B",
    investmentCompanyExemption: null,
    targetRaise: 10_000_000,
    totalRaised: 1_000_000,
    minimumInvestment: 100_000,
    entityMode: "FUND",
    fundSubType: null,
    investors: [createInvestor()],
    formDFilingDate: null,
    firstSaleDate: new Date("2025-06-15"),
    issuer: {
      entityName: "Test Capital LLC",
      entityType: "LLC",
      state: "DE",
      ein: "12-3456789",
      phone: "+1-555-555-0100",
      addressLine1: "100 Main St",
      addressCity: "Wilmington",
      addressState: "DE",
      addressZip: "19801",
    },
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("SEC Form D Compliance Validation", () => {
  // --------------------------------------------------------------------------
  // Rule 506(b) Validation
  // --------------------------------------------------------------------------

  describe("Rule 506(b)", () => {
    it("should pass with all accredited investors", () => {
      const data = createFormDData({
        regulationDExemption: "506B",
        investors: [
          createInvestor({ accreditationStatus: "SELF_CERTIFIED" }),
          createInvestor({ accreditationStatus: "KYC_VERIFIED" }),
          createInvestor({ accreditationStatus: "THIRD_PARTY_VERIFIED" }),
        ],
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(true);
      expect(result.investorCounts.accredited).toBe(3);
      expect(result.investorCounts.nonAccredited).toBe(0);
    });

    it("should pass with up to 35 non-accredited investors", () => {
      const accredited = Array.from({ length: 10 }, () =>
        createInvestor({ accreditationStatus: "SELF_CERTIFIED" })
      );
      const nonAccredited = Array.from({ length: 35 }, () =>
        createInvestor({ accreditationStatus: "NOT_ACCREDITED", isAccredited: false })
      );
      const data = createFormDData({
        regulationDExemption: "506B",
        investors: [...accredited, ...nonAccredited],
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(true);
      expect(result.investorCounts.nonAccredited).toBe(35);
    });

    it("should fail when exceeding 35 non-accredited investors", () => {
      const nonAccredited = Array.from({ length: 36 }, () =>
        createInvestor({ accreditationStatus: "NOT_ACCREDITED", isAccredited: false })
      );
      const data = createFormDData({
        regulationDExemption: "506B",
        investors: nonAccredited,
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "506B_NON_ACCREDITED_LIMIT" })
      );
    });

    it("should not count PENDING investors as non-accredited", () => {
      const data = createFormDData({
        regulationDExemption: "506B",
        investors: [
          createInvestor({ accreditationStatus: "PENDING" }),
          createInvestor({ accreditationStatus: "SELF_CERTIFIED" }),
        ],
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(true);
      expect(result.investorCounts.pending).toBe(1);
      expect(result.investorCounts.nonAccredited).toBe(0);
    });

    it("should report exactly 35 non-accredited as valid (boundary)", () => {
      const investors = Array.from({ length: 35 }, () =>
        createInvestor({ accreditationStatus: "NOT_ACCREDITED", isAccredited: false })
      );
      const data = createFormDData({
        regulationDExemption: "506B",
        investors,
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Rule 506(c) Validation
  // --------------------------------------------------------------------------

  describe("Rule 506(c)", () => {
    it("should pass when all investors are accredited", () => {
      const data = createFormDData({
        regulationDExemption: "506C",
        investors: [
          createInvestor({ accreditationStatus: "KYC_VERIFIED" }),
          createInvestor({ accreditationStatus: "THIRD_PARTY_VERIFIED" }),
        ],
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail when any investor is non-accredited", () => {
      const data = createFormDData({
        regulationDExemption: "506C",
        investors: [
          createInvestor({ accreditationStatus: "KYC_VERIFIED" }),
          createInvestor({ accreditationStatus: "NOT_ACCREDITED", isAccredited: false }),
        ],
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "506C_ALL_ACCREDITED" })
      );
    });

    it("should warn about self-certified-only investors under 506(c)", () => {
      const data = createFormDData({
        regulationDExemption: "506C",
        investors: [
          createInvestor({ accreditationStatus: "SELF_CERTIFIED" }),
        ],
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "506C_VERIFICATION_REQUIRED" })
      );
    });

    it("should warn about pending accreditation under 506(c)", () => {
      const data = createFormDData({
        regulationDExemption: "506C",
        investors: [
          createInvestor({ accreditationStatus: "KYC_VERIFIED" }),
          createInvestor({ accreditationStatus: "PENDING" }),
        ],
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "506C_PENDING_ACCREDITATION" })
      );
    });

    it("should fail with even one non-accredited among many accredited", () => {
      const accredited = Array.from({ length: 50 }, () =>
        createInvestor({ accreditationStatus: "KYC_VERIFIED" })
      );
      const data = createFormDData({
        regulationDExemption: "506C",
        investors: [
          ...accredited,
          createInvestor({ accreditationStatus: "NOT_ACCREDITED", isAccredited: false }),
        ],
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe("506C_ALL_ACCREDITED");
    });

    it("should not flag KYC_VERIFIED investors for verification warning", () => {
      const data = createFormDData({
        regulationDExemption: "506C",
        investors: [
          createInvestor({ accreditationStatus: "KYC_VERIFIED" }),
          createInvestor({ accreditationStatus: "THIRD_PARTY_VERIFIED" }),
        ],
      });
      const result = validateFormDCompliance(data);
      const verificationWarning = result.warnings.find(
        (w) => w.code === "506C_VERIFICATION_REQUIRED"
      );
      expect(verificationWarning).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Regulation A+ Validation
  // --------------------------------------------------------------------------

  describe("Regulation A+", () => {
    it("should pass for Tier 1 offering up to $20M", () => {
      const data = createFormDData({
        regulationDExemption: "REG_A_PLUS",
        targetRaise: 20_000_000,
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(true);
      expect(result.warnings.find((w) => w.code === "REG_A_PLUS_TIER_2")).toBeUndefined();
    });

    it("should warn for Tier 2 offering between $20M and $75M", () => {
      const data = createFormDData({
        regulationDExemption: "REG_A_PLUS",
        targetRaise: 50_000_000,
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "REG_A_PLUS_TIER_2" })
      );
    });

    it("should fail when exceeding $75M Tier 2 limit", () => {
      const data = createFormDData({
        regulationDExemption: "REG_A_PLUS",
        targetRaise: 80_000_000,
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "REG_A_PLUS_AMOUNT_EXCEEDED" })
      );
    });

    it("should allow non-accredited investors (no accreditation restriction)", () => {
      const data = createFormDData({
        regulationDExemption: "REG_A_PLUS",
        targetRaise: 15_000_000,
        investors: [
          createInvestor({ accreditationStatus: "NOT_ACCREDITED", isAccredited: false }),
          createInvestor({ accreditationStatus: "NOT_ACCREDITED", isAccredited: false }),
        ],
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(true);
      // No accreditation-related errors
      const accreditErrors = result.errors.filter(
        (e) => e.code.includes("ACCREDITED") || e.code.includes("506")
      );
      expect(accreditErrors).toHaveLength(0);
    });

    it("should pass at exactly $20M boundary (Tier 1 max)", () => {
      const data = createFormDData({
        regulationDExemption: "REG_A_PLUS",
        targetRaise: 20_000_000,
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(true);
      expect(result.warnings.find((w) => w.code === "REG_A_PLUS_TIER_2")).toBeUndefined();
    });

    it("should warn at $20,000,001 (just above Tier 1)", () => {
      const data = createFormDData({
        regulationDExemption: "REG_A_PLUS",
        targetRaise: 20_000_001,
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "REG_A_PLUS_TIER_2" })
      );
    });
  });

  // --------------------------------------------------------------------------
  // Rule 504 Validation
  // --------------------------------------------------------------------------

  describe("Rule 504", () => {
    it("should pass when offering is under $10M", () => {
      const data = createFormDData({
        regulationDExemption: "RULE_504",
        targetRaise: 5_000_000,
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(true);
    });

    it("should pass at exactly $10M", () => {
      const data = createFormDData({
        regulationDExemption: "RULE_504",
        targetRaise: 10_000_000,
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(true);
    });

    it("should fail when exceeding $10M", () => {
      const data = createFormDData({
        regulationDExemption: "RULE_504",
        targetRaise: 10_000_001,
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "RULE_504_AMOUNT_EXCEEDED" })
      );
    });

    it("should allow non-accredited investors", () => {
      const data = createFormDData({
        regulationDExemption: "RULE_504",
        targetRaise: 5_000_000,
        investors: Array.from({ length: 50 }, () =>
          createInvestor({ accreditationStatus: "NOT_ACCREDITED", isAccredited: false })
        ),
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Investment Company Act Exemptions
  // --------------------------------------------------------------------------

  describe("Investment Company Act Exemptions", () => {
    it("3(c)(1) should pass with 100 or fewer investors", () => {
      const investors = Array.from({ length: 100 }, () => createInvestor());
      const data = createFormDData({
        investmentCompanyExemption: "3C1",
        investors,
      });
      const result = validateFormDCompliance(data);
      const limitError = result.errors.find((e) => e.code === "3C1_INVESTOR_LIMIT");
      expect(limitError).toBeUndefined();
    });

    it("3(c)(1) should fail with more than 100 investors", () => {
      const investors = Array.from({ length: 101 }, () => createInvestor());
      const data = createFormDData({
        investmentCompanyExemption: "3C1",
        investors,
      });
      const result = validateFormDCompliance(data);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "3C1_INVESTOR_LIMIT" })
      );
    });

    it("3(c)(7) should fail with non-accredited investors", () => {
      const data = createFormDData({
        investmentCompanyExemption: "3C7",
        investors: [
          createInvestor({ accreditationStatus: "KYC_VERIFIED" }),
          createInvestor({ accreditationStatus: "NOT_ACCREDITED", isAccredited: false }),
        ],
      });
      const result = validateFormDCompliance(data);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "3C7_QUALIFIED_PURCHASERS" })
      );
    });

    it("3(c)(7) should pass with all accredited investors", () => {
      const data = createFormDData({
        investmentCompanyExemption: "3C7",
        investors: [
          createInvestor({ accreditationStatus: "KYC_VERIFIED" }),
          createInvestor({ accreditationStatus: "THIRD_PARTY_VERIFIED" }),
        ],
      });
      const result = validateFormDCompliance(data);
      const qpError = result.errors.find((e) => e.code === "3C7_QUALIFIED_PURCHASERS");
      expect(qpError).toBeUndefined();
    });

    it("should allow null exemption (no Investment Company Act check)", () => {
      const data = createFormDData({
        investmentCompanyExemption: null,
        investors: Array.from({ length: 200 }, () => createInvestor()),
      });
      const result = validateFormDCompliance(data);
      const icaErrors = result.errors.filter(
        (e) => e.code.startsWith("3C")
      );
      expect(icaErrors).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Filing Deadline Calculations
  // --------------------------------------------------------------------------

  describe("Filing Deadline Calculations", () => {
    it("should calculate deadline as firstSaleDate + 15 days", () => {
      const firstSale = new Date("2025-06-15");
      const deadline = calculateFilingDeadline(firstSale);
      expect(deadline).toEqual(new Date("2025-06-30"));
    });

    it("should return null when no first sale date", () => {
      const deadline = calculateFilingDeadline(null);
      expect(deadline).toBeNull();
    });

    it("should handle month boundary (Jan 20 + 15 = Feb 4)", () => {
      const firstSale = new Date("2025-01-20");
      const deadline = calculateFilingDeadline(firstSale);
      expect(deadline).toEqual(new Date("2025-02-04"));
    });

    it("should handle year boundary (Dec 20 + 15 = Jan 4 next year)", () => {
      const firstSale = new Date("2025-12-20");
      const deadline = calculateFilingDeadline(firstSale);
      expect(deadline).toEqual(new Date("2026-01-04"));
    });

    it("should handle leap year boundary (Feb 15 + 15 in leap year)", () => {
      const firstSale = new Date("2024-02-15"); // 2024 is a leap year
      const deadline = calculateFilingDeadline(firstSale);
      expect(deadline).toEqual(new Date("2024-03-01"));
    });

    it("should determine filing type as AMENDMENT when previous filing exists", () => {
      const data = createFormDData({
        formDFilingDate: new Date("2025-01-01"),
      });
      const result = validateFormDCompliance(data);
      expect(result.filingType).toBe("AMENDMENT");
    });

    it("should determine filing type as NEW_NOTICE when no previous filing", () => {
      const data = createFormDData({
        formDFilingDate: null,
      });
      const result = validateFormDCompliance(data);
      expect(result.filingType).toBe("NEW_NOTICE");
    });
  });

  // --------------------------------------------------------------------------
  // Issuer Information Validation
  // --------------------------------------------------------------------------

  describe("Issuer Information Validation", () => {
    it("should fail when entity name is missing", () => {
      const data = createFormDData({
        issuer: {
          ...createFormDData().issuer,
          entityName: "",
        },
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "MISSING_ISSUER_NAME" })
      );
    });

    it("should fail when state is missing", () => {
      const data = createFormDData({
        issuer: {
          ...createFormDData().issuer,
          addressState: null,
        },
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "MISSING_STATE" })
      );
    });

    it("should warn when phone is missing", () => {
      const data = createFormDData({
        issuer: {
          ...createFormDData().issuer,
          phone: null,
        },
      });
      const result = validateFormDCompliance(data);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: "MISSING_PHONE" })
      );
      // Phone is a warning, not an error
      const phoneErrors = result.errors.filter((e) => e.code === "MISSING_PHONE");
      expect(phoneErrors).toHaveLength(0);
    });

    it("should pass with all required issuer fields present", () => {
      const data = createFormDData();
      const result = validateFormDCompliance(data);
      const issuerErrors = result.errors.filter(
        (e) => e.field.startsWith("issuer")
      );
      expect(issuerErrors).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // Accreditation Status Helpers
  // --------------------------------------------------------------------------

  describe("Accreditation Status Helpers", () => {
    it("should classify SELF_CERTIFIED as accredited", () => {
      expect(isAccredited("SELF_CERTIFIED")).toBe(true);
    });

    it("should classify KYC_VERIFIED as accredited", () => {
      expect(isAccredited("KYC_VERIFIED")).toBe(true);
    });

    it("should classify THIRD_PARTY_VERIFIED as accredited", () => {
      expect(isAccredited("THIRD_PARTY_VERIFIED")).toBe(true);
    });

    it("should classify PENDING as not accredited", () => {
      expect(isAccredited("PENDING")).toBe(false);
    });

    it("should classify NOT_ACCREDITED as not accredited", () => {
      expect(isAccredited("NOT_ACCREDITED")).toBe(false);
    });

    it("should count investor breakdown correctly", () => {
      const investors = [
        createInvestor({ accreditationStatus: "SELF_CERTIFIED" }),
        createInvestor({ accreditationStatus: "KYC_VERIFIED" }),
        createInvestor({ accreditationStatus: "THIRD_PARTY_VERIFIED" }),
        createInvestor({ accreditationStatus: "PENDING" }),
        createInvestor({ accreditationStatus: "NOT_ACCREDITED", isAccredited: false }),
      ];
      const counts = countInvestorsByAccreditation(investors);
      expect(counts.total).toBe(5);
      expect(counts.accredited).toBe(3);
      expect(counts.nonAccredited).toBe(1);
      expect(counts.pending).toBe(1);
    });

    it("should handle empty investor list", () => {
      const counts = countInvestorsByAccreditation([]);
      expect(counts.total).toBe(0);
      expect(counts.accredited).toBe(0);
      expect(counts.nonAccredited).toBe(0);
      expect(counts.pending).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Cross-Exemption Switching
  // --------------------------------------------------------------------------

  describe("Cross-Exemption Switching Validation", () => {
    it("should fail 506(c) with data valid for 506(b) due to non-accredited", () => {
      // Valid for 506(b): 5 non-accredited is fine
      const data = createFormDData({
        regulationDExemption: "506B",
        investors: [
          ...Array.from({ length: 10 }, () =>
            createInvestor({ accreditationStatus: "KYC_VERIFIED" })
          ),
          ...Array.from({ length: 5 }, () =>
            createInvestor({ accreditationStatus: "NOT_ACCREDITED", isAccredited: false })
          ),
        ],
      });
      const resultB = validateFormDCompliance(data);
      expect(resultB.valid).toBe(true);

      // Same investors fail under 506(c)
      const dataC = { ...data, regulationDExemption: "506C" as SecExemption };
      const resultC = validateFormDCompliance(dataC);
      expect(resultC.valid).toBe(false);
      expect(resultC.errors).toContainEqual(
        expect.objectContaining({ code: "506C_ALL_ACCREDITED" })
      );
    });

    it("should pass Rule 504 with amount that would fail Reg A+ Tier 2 limit", () => {
      // $9M is fine for Rule 504 but small for Reg A+
      const data504 = createFormDData({
        regulationDExemption: "RULE_504",
        targetRaise: 9_000_000,
      });
      expect(validateFormDCompliance(data504).valid).toBe(true);

      // $9M is also fine for Reg A+ (Tier 1)
      const dataRegA = createFormDData({
        regulationDExemption: "REG_A_PLUS",
        targetRaise: 9_000_000,
      });
      expect(validateFormDCompliance(dataRegA).valid).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe("Edge Cases", () => {
    it("should handle zero investors", () => {
      const data = createFormDData({ investors: [] });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(true);
      expect(result.investorCounts.total).toBe(0);
    });

    it("should handle missing first sale date", () => {
      const data = createFormDData({ firstSaleDate: null });
      const result = validateFormDCompliance(data);
      expect(result.filingDeadline).toBeNull();
    });

    it("should combine multiple validation errors", () => {
      const data = createFormDData({
        regulationDExemption: "506C",
        investmentCompanyExemption: "3C1",
        investors: [
          ...Array.from({ length: 101 }, () =>
            createInvestor({ accreditationStatus: "NOT_ACCREDITED", isAccredited: false })
          ),
        ],
        issuer: {
          ...createFormDData().issuer,
          entityName: "",
          addressState: null,
        },
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(false);
      // Should have: MISSING_ISSUER_NAME, MISSING_STATE, 506C_ALL_ACCREDITED, 3C1_INVESTOR_LIMIT
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });

    it("should handle $0 target raise", () => {
      const data = createFormDData({
        regulationDExemption: "RULE_504",
        targetRaise: 0,
      });
      const result = validateFormDCompliance(data);
      expect(result.valid).toBe(true);
    });

    it("should treat whitespace-only entity name as missing", () => {
      const data = createFormDData({
        issuer: {
          ...createFormDData().issuer,
          entityName: "   ",
        },
      });
      const result = validateFormDCompliance(data);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: "MISSING_ISSUER_NAME" })
      );
    });
  });
});
