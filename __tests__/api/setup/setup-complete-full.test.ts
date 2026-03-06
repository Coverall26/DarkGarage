/**
 * Comprehensive tests for POST /api/setup/complete
 * GP Organization Setup Wizard completion.
 *
 * Covers: authentication, Organization creation (all fields, EIN encryption,
 * slug generation, bad actor cert, defaults), OrganizationDefaults (notifications,
 * audit retention, document templates, accreditation), Team + UserTeam (OWNER),
 * Fund creation (GP_FUND economics, STARTUP instruments: SAFE/Conv Note/Priced
 * Round/SPV, advanced settings, marketplace, SEC fields, wire encryption),
 * DATAROOM_ONLY skip, FundroomActivation with setupProgress, Dataroom creation,
 * audit events (org created, bad actor cert, fund created, team invites queued),
 * analytics server event, error handling, response shape, numeric parsing,
 * transaction atomicity, pricing tiers.
 *
 * NOTE: FundingRound-specific tests are in setup-complete-funding-round.test.ts.
 * This file intentionally avoids duplicating those focused FundingRound tests,
 * though it does cover FundingRound creation as part of broader STARTUP mode
 * and planned rounds verification.
 */

import { NextRequest, NextResponse } from "next/server";

// --- Mock setup ---

const mockRequireAuthAppRouter = jest.fn();
const mockLogAuditEvent = jest.fn().mockResolvedValue(undefined);
const mockPublishServerEvent = jest.fn().mockResolvedValue(undefined);
const mockReportError = jest.fn();
const mockEncryptTaxId = jest.fn((val: string) => `encrypted_${val}`);

jest.mock("@/lib/auth/rbac", () => ({
  requireAuthAppRouter: (...args: unknown[]) => mockRequireAuthAppRouter(...args),
}));

jest.mock("@/lib/audit/audit-logger", () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
}));

jest.mock("@/lib/error", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

jest.mock("@/lib/tracking/server-events", () => ({
  publishServerEvent: (...args: unknown[]) => mockPublishServerEvent(...args),
}));

jest.mock("@/lib/crypto/secure-storage", () => ({
  encryptTaxId: (...args: unknown[]) => mockEncryptTaxId(...args),
}));

import { POST } from "@/app/api/setup/complete/route";
import prisma from "@/lib/prisma";

// --- Constants ---

const USER_ID = "user-setup-full-001";
const USER_EMAIL = "gp@acme-capital.com";

// --- Helpers ---

function mockAuth() {
  mockRequireAuthAppRouter.mockResolvedValue({
    userId: USER_ID,
    email: USER_EMAIL,
    teamId: "",
    role: "MEMBER",
    session: { user: { id: USER_ID, email: USER_EMAIL } },
  });
}

function mockAuthFail() {
  mockRequireAuthAppRouter.mockResolvedValue(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  );
}

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest(
    new URL("http://localhost:3000/api/setup/complete"),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "192.168.1.100",
        "user-agent": "Jest Test Agent",
      },
      body: JSON.stringify(body),
    },
  );
}

/**
 * Build a full tx mock with jest.fn() methods for every Prisma model
 * used inside the setup/complete $transaction callback.
 */
function setupTx(overrides?: {
  fundReturn?: Record<string, unknown>;
}) {
  const mockFund = overrides?.fundReturn || {
    id: "fund-test-001",
    name: "Acme Fund I",
    teamId: "team-test-001",
    entityMode: "FUND",
  };

  const tx = {
    organization: {
      create: jest.fn().mockResolvedValue({ id: "org-test-001", name: "Acme Capital", slug: "acme-capital" }),
    },
    organizationDefaults: {
      create: jest.fn().mockResolvedValue({}),
    },
    team: {
      create: jest.fn().mockResolvedValue({ id: "team-test-001", name: "Acme Capital" }),
    },
    userTeam: {
      create: jest.fn().mockResolvedValue({}),
    },
    fund: {
      create: jest.fn().mockResolvedValue(mockFund),
      update: jest.fn().mockResolvedValue(mockFund),
    },
    fundAggregate: {
      create: jest.fn().mockResolvedValue({}),
    },
    fundingRound: {
      create: jest.fn().mockResolvedValue({ id: "round-test-001" }),
    },
    fundPricingTier: {
      create: jest.fn().mockResolvedValue({ id: "tier-test-001" }),
    },
    dataroom: {
      create: jest.fn().mockResolvedValue({ id: "dr-test-001", name: "Acme Dataroom", pId: "dr_dr_test" }),
    },
    fundroomActivation: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  (prisma.$transaction as jest.Mock).mockImplementation(async (callback: (t: typeof tx) => Promise<unknown>) => {
    return callback(tx);
  });

  return tx;
}

// Reusable body presets
function gpFundBody(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    companyName: "Acme Capital LLC",
    raiseMode: "GP_FUND",
    fundName: "Acme Fund I",
    targetRaise: "10000000",
    minInvestment: "100000",
    mgmtFee: "2",
    carry: "20",
    hurdle: "8",
    fundTerm: "10",
    waterfallType: "EUROPEAN",
    fundStrategy: "PE",
    regDExemption: "506B",
    bankName: "Chase",
    accountName: "Acme Capital LLC",
    accountNumber: "123456789",
    routingNumber: "021000021",
    dataroomName: "Acme Dataroom",
    entityType: "LLC",
    ein: "12-3456789",
    address: "123 Main St",
    city: "New York",
    state: "NY",
    zip: "10001",
    brandColor: "#0A1628",
    accentColor: "#0066FF",
    ...extra,
  };
}

const STARTUP_BODY = {
  companyName: "Acme Startup Inc",
  raiseMode: "STARTUP",
  instrumentType: "SAFE",
  roundName: "Seed Round",
  targetRaise: 2000000,
  valCap: "10000000",
  discount: "20",
};

const DATAROOM_ONLY_BODY = {
  companyName: "Acme Dataroom Co",
  raiseMode: "DATAROOM_ONLY",
};

// =====================================================================
// Tests
// =====================================================================

describe("POST /api/setup/complete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth();
  });

  // -------------------------------------------------------------------
  // 1. Authentication
  // -------------------------------------------------------------------
  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuthFail();
      const res = await POST(makeReq(gpFundBody()));
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("does not call prisma.$transaction when unauthenticated", async () => {
      mockAuthFail();
      await POST(makeReq(gpFundBody()));
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("calls requireAuthAppRouter on every request", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody()));
      expect(mockRequireAuthAppRouter).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------
  // 2. Organization Creation
  // -------------------------------------------------------------------
  describe("Organization creation", () => {
    it("creates organization with all provided fields", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        contactPhone: "+1-555-0100",
        description: "Premier venture capital firm",
        sector: "Technology",
        geography: "North America",
        website: "https://acme-capital.com",
        foundedYear: "2020",
        logoUrl: "https://example.com/logo.png",
        legalName: "Acme Capital Management LLC",
        yearIncorporated: "2019",
        jurisdiction: "Delaware",
        previousNamesList: ["Old Acme", "Acme Ventures"],
        relatedPersons: [
          { name: "Jane Smith", title: "CEO", relationship: "Executive Officer" },
        ],
        contactName: "Jane Smith",
        contactEmail: "jane@acme-capital.com",
        badActorCertified: true,
        regDExemption: "506C",
      })));

      const d = tx.organization.create.mock.calls[0][0].data;
      expect(d.name).toBe("Acme Capital LLC");
      expect(d.entityType).toBe("LLC");
      expect(d.phone).toBe("+1-555-0100");
      expect(d.addressLine1).toBe("123 Main St");
      expect(d.addressCity).toBe("New York");
      expect(d.addressState).toBe("NY");
      expect(d.addressZip).toBe("10001");
      expect(d.addressCountry).toBe("US");
      expect(d.logo).toBe("https://example.com/logo.png");
      expect(d.brandColor).toBe("#0A1628");
      expect(d.accentColor).toBe("#0066FF");
      expect(d.companyDescription).toBe("Premier venture capital firm");
      expect(d.sector).toBe("Technology");
      expect(d.geography).toBe("North America");
      expect(d.website).toBe("https://acme-capital.com");
      expect(d.foundedYear).toBe(2020);
      expect(d.legalName).toBe("Acme Capital Management LLC");
      expect(d.yearIncorporated).toBe(2019);
      expect(d.jurisdiction).toBe("Delaware");
      expect(d.previousNames).toBe("Old Acme, Acme Ventures");
      expect(d.relatedPersons).toEqual([
        { name: "Jane Smith", title: "CEO", relationship: "Executive Officer" },
      ]);
      expect(d.contactName).toBe("Jane Smith");
      expect(d.contactEmail).toBe("jane@acme-capital.com");
      expect(d.regulationDExemption).toBe("506C");
      expect(d.productMode).toBe("GP_FUND");
      expect(d.featureFlags).toEqual({ mode: "GP_FUND" });
    });

    it("generates org ID with org_ prefix", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody()));
      expect(tx.organization.create.mock.calls[0][0].data.id).toMatch(/^org_/);
    });

    it("computes slug from company name", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({ companyName: "Acme Capital LLC" })));
      expect(tx.organization.create.mock.calls[0][0].data.slug).toBe("acme-capital-llc");
    });

    it("strips special characters from slug", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({ companyName: "J&K Partners (Fund I)" })));
      const slug = tx.organization.create.mock.calls[0][0].data.slug;
      expect(slug).toMatch(/^[a-z0-9-]+$/);
      expect(slug).not.toMatch(/^-|-$/);
    });

    it("encrypts EIN via encryptTaxId with dashes stripped", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({ ein: "12-3456789" })));
      expect(mockEncryptTaxId).toHaveBeenCalledWith("123456789");
      expect(tx.organization.create.mock.calls[0][0].data.ein).toBe("encrypted_123456789");
    });

    it("sets ein to null when not provided", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({ ein: undefined })));
      expect(tx.organization.create.mock.calls[0][0].data.ein).toBeNull();
    });

    it("uses defaults when optional fields are missing", async () => {
      const tx = setupTx();
      await POST(makeReq({ companyName: "Minimal", raiseMode: "GP_FUND" }));
      const d = tx.organization.create.mock.calls[0][0].data;
      expect(d.addressCountry).toBe("US");
      expect(d.brandColor).toBe("#0A1628");
      expect(d.accentColor).toBe("#0066FF");
      expect(d.badActorCertified).toBe(false);
      expect(d.badActorCertifiedAt).toBeNull();
      expect(d.badActorCertifiedBy).toBeNull();
      expect(d.formDReminderEnabled).toBe(true);
    });

    it("uses 'Untitled Organization' when companyName missing", async () => {
      const tx = setupTx();
      await POST(makeReq({ raiseMode: "GP_FUND" }));
      expect(tx.organization.create.mock.calls[0][0].data.name).toBe("Untitled Organization");
    });

    it("sets badActorCertified fields when true", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({ badActorCertified: true })));
      const d = tx.organization.create.mock.calls[0][0].data;
      expect(d.badActorCertified).toBe(true);
      expect(d.badActorCertifiedAt).toBeInstanceOf(Date);
      expect(d.badActorCertifiedBy).toBe(USER_ID);
    });

    it("joins previousNamesList into comma-separated string", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        previousNamesList: ["Alpha", "Beta", "Gamma"],
      })));
      expect(tx.organization.create.mock.calls[0][0].data.previousNames).toBe("Alpha, Beta, Gamma");
    });

    it("falls back to previousNames string when previousNamesList is empty", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        previousNamesList: [],
        previousNames: "Legacy Name",
      })));
      expect(tx.organization.create.mock.calls[0][0].data.previousNames).toBe("Legacy Name");
    });

    it("stores relatedPersons as JSON array", async () => {
      const tx = setupTx();
      const persons = [
        { name: "Jane Doe", title: "CEO", relationship: "Executive Officer" },
        { name: "John Smith", title: "CFO", relationship: "Director" },
      ];
      await POST(makeReq(gpFundBody({ relatedPersons: persons })));
      expect(tx.organization.create.mock.calls[0][0].data.relatedPersons).toEqual(persons);
    });

    it("sets relatedPersons to null when empty array", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({ relatedPersons: [] })));
      expect(tx.organization.create.mock.calls[0][0].data.relatedPersons).toBeNull();
    });

    it("sets regulationDExemption on both organization and fund", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({ regDExemption: "506C" })));
      expect(tx.organization.create.mock.calls[0][0].data.regulationDExemption).toBe("506C");
      expect(tx.fund.create.mock.calls[0][0].data.regulationDExemption).toBe("506C");
    });
  });

  // -------------------------------------------------------------------
  // 3. OrganizationDefaults
  // -------------------------------------------------------------------
  describe("OrganizationDefaults creation", () => {
    it("creates defaults linked to organization ID", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody()));
      const orgId = tx.organization.create.mock.calls[0][0].data.id;
      expect(tx.organizationDefaults.create.mock.calls[0][0].data.organizationId).toBe(orgId);
    });

    it("creates defaults with all notification preferences enabled", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        emailGPCommitment: true,
        emailGPWire: true,
        emailLPSteps: true,
        notifyGpLpOnboardingStart: true,
        notifyGpLpInactive: true,
        notifyGpExternalDocUpload: true,
        notifyLpWireConfirm: true,
        notifyLpNewDocument: true,
        notifyLpChangeRequest: true,
        notifyLpOnboardingReminder: true,
      })));
      const d = tx.organizationDefaults.create.mock.calls[0][0].data;
      expect(d.notifyGpCommitment).toBe(true);
      expect(d.notifyGpWireUpload).toBe(true);
      expect(d.notifyLpStepComplete).toBe(true);
      expect(d.notifyGpLpOnboardingStart).toBe(true);
      expect(d.notifyGpLpInactive).toBe(true);
      expect(d.notifyGpExternalDocUpload).toBe(true);
      expect(d.notifyLpWireConfirm).toBe(true);
      expect(d.notifyLpNewDocument).toBe(true);
      expect(d.notifyLpChangeRequest).toBe(true);
      expect(d.notifyLpOnboardingReminder).toBe(true);
    });

    it("disables notifications when explicitly set to false", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        emailGPCommitment: false,
        emailGPWire: false,
        emailLPSteps: false,
        gpApproval: false,
      })));
      const d = tx.organizationDefaults.create.mock.calls[0][0].data;
      expect(d.notifyGpCommitment).toBe(false);
      expect(d.notifyGpWireUpload).toBe(false);
      expect(d.notifyLpStepComplete).toBe(false);
      expect(d.requireGpApproval).toBe(false);
    });

    it("uses true defaults for notifications when not provided", async () => {
      const tx = setupTx();
      await POST(makeReq({ companyName: "Minimal", raiseMode: "GP_FUND" }));
      const d = tx.organizationDefaults.create.mock.calls[0][0].data;
      expect(d.notifyGpCommitment).toBe(true);
      expect(d.notifyGpWireUpload).toBe(true);
      expect(d.notifyLpStepComplete).toBe(true);
      expect(d.requireGpApproval).toBe(true);
      expect(d.allowExternalDocUpload).toBe(true);
      expect(d.allowGpDocUploadForLp).toBe(true);
    });

    it("uses SELF_ACK as default accreditation method", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody()));
      expect(tx.organizationDefaults.create.mock.calls[0][0].data.accreditationMethod).toBe("SELF_ACK");
    });

    it("stores accreditation method and minimum invest threshold", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        accreditationMethod: "SELF_ACK_MIN_INVEST",
        minimumInvestThreshold: "250000",
      })));
      const d = tx.organizationDefaults.create.mock.calls[0][0].data;
      expect(d.accreditationMethod).toBe("SELF_ACK_MIN_INVEST");
      expect(d.minimumInvestThreshold).toBe(250000);
    });

    it("calculates audit retention days from years", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({ auditRetention: "10" })));
      expect(tx.organizationDefaults.create.mock.calls[0][0].data.auditLogRetentionDays).toBe(3650);
    });

    it("uses default 7-year retention when not provided", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody()));
      expect(tx.organizationDefaults.create.mock.calls[0][0].data.auditLogRetentionDays).toBe(2555);
    });

    it("stores documentTemplates in featureFlags", async () => {
      const tx = setupTx();
      const templates = [
        { docType: "NDA", source: "fundroom_template" },
        { docType: "SUBSCRIPTION", source: "custom_uploaded" },
      ];
      await POST(makeReq(gpFundBody({ documentTemplates: templates })));
      expect(tx.organizationDefaults.create.mock.calls[0][0].data.featureFlags.documentTemplates).toEqual(templates);
    });

    it("stores mode in featureFlags", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody()));
      expect(tx.organizationDefaults.create.mock.calls[0][0].data.featureFlags.mode).toBe("GP_FUND");
    });

    it("uses 506B as default regulationDExemption", async () => {
      const tx = setupTx();
      await POST(makeReq({ companyName: "Minimal", raiseMode: "GP_FUND" }));
      expect(tx.organizationDefaults.create.mock.calls[0][0].data.regulationDExemption).toBe("506B");
    });
  });

  // -------------------------------------------------------------------
  // 4. Team & UserTeam
  // -------------------------------------------------------------------
  describe("Team & UserTeam creation", () => {
    it("creates Team linked to Organization", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody()));
      const orgId = tx.organization.create.mock.calls[0][0].data.id;
      const teamData = tx.team.create.mock.calls[0][0].data;
      expect(teamData.name).toBe("Acme Capital LLC");
      expect(teamData.organizationId).toBe(orgId);
      expect(teamData.id).toMatch(/^team_/);
    });

    it("creates UserTeam with OWNER role", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody()));
      const ut = tx.userTeam.create.mock.calls[0][0].data;
      expect(ut.userId).toBe(USER_ID);
      expect(ut.role).toBe("OWNER");
      expect(ut.teamId).toMatch(/^team_/);
    });

    it("uses 'Default Team' when companyName missing", async () => {
      const tx = setupTx();
      await POST(makeReq({ raiseMode: "GP_FUND" }));
      expect(tx.team.create.mock.calls[0][0].data.name).toBe("Default Team");
    });
  });

  // -------------------------------------------------------------------
  // 5. Fund Creation — GP_FUND Mode
  // -------------------------------------------------------------------
  describe("Fund creation — GP_FUND mode", () => {
    it("creates fund with GP economics", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody()));
      const d = tx.fund.create.mock.calls[0][0].data;
      expect(d.entityMode).toBe("FUND");
      expect(d.name).toBe("Acme Fund I");
      expect(d.targetRaise).toBe(10000000);
      expect(d.minimumInvestment).toBe(100000);
      expect(d.managementFeePct).toBe(0.02);
      expect(d.carryPct).toBe(0.2);
      expect(d.hurdleRate).toBe(0.08);
      expect(d.termYears).toBe(10);
      expect(d.waterfallType).toBe("EUROPEAN");
      expect(d.regulationDExemption).toBe("506B");
      expect(d.instrumentType).toBe("LPA");
      expect(d.createdBy).toBe(USER_ID);
    });

    it("creates FundAggregate for fund", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody()));
      expect(tx.fundAggregate.create).toHaveBeenCalledTimes(1);
      expect(tx.fundAggregate.create.mock.calls[0][0].data.fundId).toBe("fund-test-001");
    });

    it("auto-generates fund name from company name", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({ companyName: "Alpha Partners", fundName: undefined })));
      expect(tx.fund.create.mock.calls[0][0].data.name).toBe("Alpha Partners Fund I");
    });

    it("stores advanced fund settings", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        gpCommitment: "1000000",
        investmentPeriod: "5",
        recyclingEnabled: true,
        keyPersonEnabled: true,
        keyPersonName: "John Smith",
        noFaultDivorceThreshold: "75",
        preferredReturnMethod: "SIMPLE",
        clawbackProvision: true,
        mgmtFeeOffset: "50",
      })));
      const d = tx.fund.create.mock.calls[0][0].data;
      expect(d.gpCommitmentAmount).toBe(1000000);
      // gpCommitmentPct = 1000000 / 10000000 = 0.1
      expect(d.gpCommitmentPct).toBe(0.1);
      expect(d.investmentPeriodYears).toBe(5);
      expect(d.recyclingEnabled).toBe(true);
      expect(d.keyPersonEnabled).toBe(true);
      expect(d.keyPersonName).toBe("John Smith");
      expect(d.noFaultDivorceThreshold).toBe(75);
      expect(d.preferredReturnMethod).toBe("SIMPLE");
      expect(d.clawbackProvision).toBe(true);
      expect(d.mgmtFeeOffsetPct).toBe(0.5);
    });

    it("stores GP_FUND featureFlags with unitPrice/minimumCommitment/highWaterMark", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        sharePrice: "95000",
        minimumCommitment: "100000",
        highWaterMark: true,
      })));
      const ff = tx.fund.create.mock.calls[0][0].data.featureFlags;
      expect(ff).toEqual({
        unitPrice: 95000,
        highWaterMark: true,
        minimumCommitment: 100000,
      });
    });

    it("stores SEC / Investment Company Act fields", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        investmentCompanyExemption: "3C1",
        useOfProceeds: "Invest in early-stage tech",
        salesCommissions: "2% of gross proceeds",
      })));
      const d = tx.fund.create.mock.calls[0][0].data;
      expect(d.investmentCompanyExemption).toBe("3C1");
      expect(d.useOfProceeds).toBe("Invest in early-stage tech");
      expect(d.salesCommissions).toBe("2% of gross proceeds");
    });

    it("stores marketplace fields when opted in", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        marketplaceInterest: true,
        marketplaceDescription: "PE fund focused on tech",
        marketplaceCategory: "VENTURE_CAPITAL",
      })));
      const d = tx.fund.create.mock.calls[0][0].data;
      expect(d.marketplaceInterest).toBe(true);
      expect(d.marketplaceDescription).toBe("PE fund focused on tech");
      expect(d.marketplaceCategory).toBe("VENTURE_CAPITAL");
      expect(d.marketplaceInterestDate).toBeInstanceOf(Date);
    });

    it("sets marketplace fields to false/null when not opted in", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody()));
      const d = tx.fund.create.mock.calls[0][0].data;
      expect(d.marketplaceInterest).toBe(false);
      expect(d.marketplaceInterestDate).toBeNull();
    });

    it("creates pricing tiers when initialTiers provided", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        initialTiers: [
          { tranche: 1, name: "Early", pricePerUnit: "90000", unitsAvailable: "50" },
          { tranche: 2, name: "Standard", pricePerUnit: "95000", unitsAvailable: "100" },
          { tranche: 3, name: "Late", pricePerUnit: "100000", unitsAvailable: "25" },
        ],
      })));
      expect(tx.fundPricingTier.create).toHaveBeenCalledTimes(3);
      const t1 = tx.fundPricingTier.create.mock.calls[0][0].data;
      expect(t1.fundId).toBe("fund-test-001");
      expect(t1.tranche).toBe(1);
      expect(t1.name).toBe("Early");
      expect(t1.pricePerUnit).toBe(90000);
      expect(t1.unitsAvailable).toBe(50);
      expect(t1.unitsTotal).toBe(50);
      expect(t1.isActive).toBe(true);

      const t2 = tx.fundPricingTier.create.mock.calls[1][0].data;
      expect(t2.isActive).toBe(false);
    });

    it("skips pricing tiers with invalid price or units", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        initialTiers: [
          { tranche: 1, name: "Valid", pricePerUnit: "90000", unitsAvailable: "50" },
          { tranche: 2, name: "No Price", pricePerUnit: "", unitsAvailable: "50" },
          { tranche: 3, name: "Zero Units", pricePerUnit: "95000", unitsAvailable: "0" },
        ],
      })));
      expect(tx.fundPricingTier.create).toHaveBeenCalledTimes(1);
    });

    it("does NOT create pricing tiers for STARTUP mode", async () => {
      const tx = setupTx({
        fundReturn: { id: "fund-s-001", name: "Seed", entityMode: "STARTUP", teamId: "team-test-001" },
      });
      await POST(makeReq({
        ...STARTUP_BODY,
        initialTiers: [
          { tranche: 1, name: "Tier", pricePerUnit: "90000", unitsAvailable: "50" },
        ],
      }));
      expect(tx.fundPricingTier.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------
  // 6. Fund Creation — STARTUP Mode
  // -------------------------------------------------------------------
  describe("Fund creation — STARTUP mode", () => {
    it("creates SAFE fund with correct fields", async () => {
      const tx = setupTx({
        fundReturn: { id: "fund-s-001", name: "Seed Round", entityMode: "STARTUP", teamId: "team-test-001" },
      });
      await POST(makeReq({
        ...STARTUP_BODY,
        safeType: "POST_MONEY",
        minInvestment: "25000",
        mfn: true,
        proRata: true,
      }));
      const d = tx.fund.create.mock.calls[0][0].data;
      expect(d.entityMode).toBe("STARTUP");
      expect(d.instrumentType).toBe("SAFE");
      expect(d.valuationCap).toBe(10000000);
      expect(d.discountRatePct).toBe(0.2);
      expect(d.safeType).toBe("POST_MONEY");
      expect(d.minimumInvestment).toBe(25000);
      expect(d.featureFlags.instrumentType).toBe("SAFE");
      expect(d.featureFlags.roundName).toBe("Seed Round");
      expect(d.featureFlags.mfn).toBe(true);
      expect(d.featureFlags.proRata).toBe(true);
    });

    it("uses roundName as fund name for non-SPV STARTUP", async () => {
      const tx = setupTx({
        fundReturn: { id: "fund-s-001", name: "Series A", entityMode: "STARTUP", teamId: "team-test-001" },
      });
      await POST(makeReq({ ...STARTUP_BODY, roundName: "Series A" }));
      expect(tx.fund.create.mock.calls[0][0].data.name).toBe("Series A");
    });

    it("creates Convertible Note fund with interest and maturity", async () => {
      const tx = setupTx({
        fundReturn: { id: "fund-cn-001", name: "Bridge", entityMode: "STARTUP", teamId: "team-test-001" },
      });
      await POST(makeReq({
        companyName: "Acme",
        raiseMode: "STARTUP",
        instrumentType: "CONVERTIBLE_NOTE",
        roundName: "Bridge",
        targetRaise: 1000000,
        valCap: "8000000",
        discount: "15",
        interestRate: "6",
        maturityDate: "2027-06-30",
        qualFinancing: "1000000",
      }));
      const d = tx.fund.create.mock.calls[0][0].data;
      expect(d.instrumentType).toBe("CONVERTIBLE_NOTE");
      expect(d.interestRatePct).toBe(0.06);
      expect(d.maturityDate).toEqual(new Date("2027-06-30"));
      expect(d.qualifiedFinancingThreshold).toBe(1000000);
      expect(d.valuationCap).toBe(8000000);
      expect(d.discountRatePct).toBe(0.15);
    });

    it("creates Priced Round fund with governance in featureFlags", async () => {
      const tx = setupTx({
        fundReturn: { id: "fund-pr-001", name: "Series A", entityMode: "STARTUP", teamId: "team-test-001" },
      });
      await POST(makeReq({
        companyName: "Acme",
        raiseMode: "STARTUP",
        instrumentType: "PRICED_ROUND",
        roundName: "Series A",
        targetRaise: 10000000,
        preMoneyVal: "40000000",
        liqPref: "1x_non_participating",
        antiDilution: "broad_weighted",
        optionPool: "15",
        boardSeats: "2",
        protectiveProvisions: true,
        informationRights: true,
        rofrCoSale: true,
        dragAlong: true,
      }));
      const d = tx.fund.create.mock.calls[0][0].data;
      expect(d.preMoneyValuation).toBe(40000000);
      expect(d.liquidationPreference).toBe("1x_non_participating");
      expect(d.antiDilutionType).toBe("broad_weighted");
      expect(d.optionPoolPct).toBe(0.15);
      expect(d.featureFlags.boardSeats).toBe(2);
      expect(d.featureFlags.protectiveProvisions).toBe(true);
      expect(d.featureFlags.informationRights).toBe(true);
      expect(d.featureFlags.rofrCoSale).toBe(true);
      expect(d.featureFlags.dragAlong).toBe(true);
    });

    it("creates SPV fund and updates economics separately", async () => {
      const tx = setupTx({
        fundReturn: { id: "fund-spv-001", name: "Acme SPV", entityMode: "STARTUP", teamId: "team-test-001" },
      });
      await POST(makeReq({
        companyName: "Acme",
        raiseMode: "STARTUP",
        instrumentType: "SPV",
        spvName: "Acme Target SPV",
        targetCompanyName: "Target Corp",
        dealDescription: "Series B co-invest",
        allocationAmount: "5000000",
        minimumLpInvestment: "50000",
        maxInvestors: "99",
        spvTerm: "5 years",
        spvMgmtFee: "2",
        spvCarry: "20",
        spvGpCommitment: "500000",
      }));

      const d = tx.fund.create.mock.calls[0][0].data;
      expect(d.name).toBe("Acme Target SPV");
      expect(d.fundSubType).toBe("SPV_COINVEST");
      expect(d.featureFlags.spvName).toBe("Acme Target SPV");
      expect(d.featureFlags.targetCompanyName).toBe("Target Corp");
      expect(d.featureFlags.dealDescription).toBe("Series B co-invest");
      expect(d.featureFlags.allocationAmount).toBe(5000000);
      expect(d.featureFlags.minimumLpInvestment).toBe(50000);
      expect(d.featureFlags.maxInvestors).toBe(99);
      expect(d.featureFlags.spvTerm).toBe("5 years");
      expect(d.featureFlags.spvMgmtFee).toBe(0.02);
      expect(d.featureFlags.spvCarry).toBe(0.2);
      expect(d.featureFlags.spvGpCommitment).toBe(500000);

      // SPV triggers a separate fund.update for economics
      expect(tx.fund.update).toHaveBeenCalledTimes(1);
      const u = tx.fund.update.mock.calls[0][0].data;
      expect(u.carryPct).toBe(0.2);
      expect(u.managementFeePct).toBe(0.02);
      expect(u.gpCommitmentAmount).toBe(500000);
    });

    it("does NOT call fund.update for non-SPV instruments", async () => {
      const tx = setupTx({
        fundReturn: { id: "fund-s-001", name: "Seed", entityMode: "STARTUP", teamId: "team-test-001" },
      });
      await POST(makeReq(STARTUP_BODY));
      expect(tx.fund.update).not.toHaveBeenCalled();
    });

    it("creates planned rounds from wizard data", async () => {
      const tx = setupTx({
        fundReturn: { id: "fund-s-001", name: "Seed", entityMode: "STARTUP", teamId: "team-test-001" },
      });
      await POST(makeReq({
        ...STARTUP_BODY,
        plannedRounds: [
          { roundName: "Series A", targetAmount: "10000000", instrumentType: "PRICED_ROUND" },
          { roundName: "Series B", targetAmount: "30000000" },
        ],
      }));
      // 1 active + 2 planned = 3 calls
      expect(tx.fundingRound.create).toHaveBeenCalledTimes(3);
      const planned1 = tx.fundingRound.create.mock.calls[1][0].data;
      expect(planned1.roundName).toBe("Series A");
      expect(planned1.roundOrder).toBe(2);
      expect(planned1.status).toBe("PLANNED");
      expect(planned1.instrumentType).toBe("PRICED_ROUND");

      const planned2 = tx.fundingRound.create.mock.calls[2][0].data;
      expect(planned2.roundName).toBe("Series B");
      expect(planned2.roundOrder).toBe(3);
    });

    it("skips planned rounds with empty or whitespace names", async () => {
      const tx = setupTx({
        fundReturn: { id: "fund-s-001", name: "Seed", entityMode: "STARTUP", teamId: "team-test-001" },
      });
      await POST(makeReq({
        ...STARTUP_BODY,
        plannedRounds: [
          { roundName: "  ", targetAmount: "5000000" },
          { roundName: "", targetAmount: "1000000" },
          { roundName: "Valid", targetAmount: "10000000" },
        ],
      }));
      // 1 active + 1 valid planned = 2
      expect(tx.fundingRound.create).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------
  // 7. DATAROOM_ONLY Mode
  // -------------------------------------------------------------------
  describe("DATAROOM_ONLY mode", () => {
    it("does NOT create fund, aggregate, funding rounds, or pricing tiers", async () => {
      const tx = setupTx();
      const res = await POST(makeReq(DATAROOM_ONLY_BODY));
      expect(res.status).toBe(200);
      expect(tx.fund.create).not.toHaveBeenCalled();
      expect(tx.fundAggregate.create).not.toHaveBeenCalled();
      expect(tx.fundingRound.create).not.toHaveBeenCalled();
      expect(tx.fundPricingTier.create).not.toHaveBeenCalled();
    });

    it("returns null fundId", async () => {
      setupTx();
      const res = await POST(makeReq(DATAROOM_ONLY_BODY));
      const body = await res.json();
      expect(body.fundId).toBeNull();
    });

    it("still creates Organization, Team, Dataroom, and Activation", async () => {
      const tx = setupTx();
      await POST(makeReq(DATAROOM_ONLY_BODY));
      expect(tx.organization.create).toHaveBeenCalledTimes(1);
      expect(tx.team.create).toHaveBeenCalledTimes(1);
      expect(tx.dataroom.create).toHaveBeenCalledTimes(1);
      expect(tx.fundroomActivation.create).toHaveBeenCalledTimes(1);
    });

    it("does not encrypt wire instructions even if bankName provided", async () => {
      setupTx();
      await POST(makeReq({ ...DATAROOM_ONLY_BODY, bankName: "Chase", accountNumber: "1234" }));
      const calls = mockEncryptTaxId.mock.calls.map((c: unknown[]) => c[0]);
      expect(calls).not.toContain("1234");
    });
  });

  // -------------------------------------------------------------------
  // 8. Wire Instruction Encryption
  // -------------------------------------------------------------------
  describe("Wire instruction encryption", () => {
    it("encrypts account number and routing number", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody()));
      expect(mockEncryptTaxId).toHaveBeenCalledWith("123456789");
      expect(mockEncryptTaxId).toHaveBeenCalledWith("021000021");
      const wire = tx.fund.create.mock.calls[0][0].data.wireInstructions;
      expect(wire.accountNumber).toBe("encrypted_123456789");
      expect(wire.routingNumber).toBe("encrypted_021000021");
    });

    it("stores full wire instruction object with all fields", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        swift: "CHASUS33",
        memoFormat: "Custom memo",
        wireIntermediaryBank: "Citibank",
        wireSpecialInstructions: "Reference fund",
        wireCurrency: "EUR",
      })));
      const wire = tx.fund.create.mock.calls[0][0].data.wireInstructions;
      expect(wire.bankName).toBe("Chase");
      expect(wire.accountName).toBe("Acme Capital LLC");
      expect(wire.swiftBic).toBe("CHASUS33");
      expect(wire.memoFormat).toBe("Custom memo");
      expect(wire.intermediaryBank).toBe("Citibank");
      expect(wire.specialInstructions).toBe("Reference fund");
      expect(wire.currency).toBe("EUR");
    });

    it("sets wireInstructions to undefined when bankName not provided", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({ bankName: undefined })));
      const d = tx.fund.create.mock.calls[0][0].data;
      expect(d.wireInstructions).toBeUndefined();
      expect(d.wireInstructionsUpdatedAt).toBeNull();
      expect(d.wireInstructionsUpdatedBy).toBeNull();
    });

    it("sets null for missing account/routing numbers", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        accountNumber: undefined,
        routingNumber: undefined,
      })));
      const wire = tx.fund.create.mock.calls[0][0].data.wireInstructions;
      expect(wire.accountNumber).toBeNull();
      expect(wire.routingNumber).toBeNull();
    });

    it("uses companyName as accountName fallback", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({ accountName: undefined })));
      expect(tx.fund.create.mock.calls[0][0].data.wireInstructions.accountName).toBe("Acme Capital LLC");
    });

    it("uses default USD currency and standard memo format", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({ wireCurrency: undefined, memoFormat: undefined })));
      const wire = tx.fund.create.mock.calls[0][0].data.wireInstructions;
      expect(wire.currency).toBe("USD");
      expect(wire.memoFormat).toBe("[Investor Name] - [Fund Name] - [Amount]");
    });

    it("sets wireInstructionsUpdatedAt and updatedBy when wire exists", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody()));
      const d = tx.fund.create.mock.calls[0][0].data;
      expect(d.wireInstructionsUpdatedAt).toBeInstanceOf(Date);
      expect(d.wireInstructionsUpdatedBy).toBe(USER_ID);
    });
  });

  // -------------------------------------------------------------------
  // 9. FundroomActivation
  // -------------------------------------------------------------------
  describe("FundroomActivation", () => {
    it("creates ACTIVE activation with full setupProgress for GP_FUND", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        inviteEmails: ["team@acme.com"],
        logoUrl: "https://logo.png",
      })));
      const a = tx.fundroomActivation.create.mock.calls[0][0].data;
      expect(a.status).toBe("ACTIVE");
      expect(a.activatedBy).toBe(USER_ID);
      expect(a.activatedAt).toBeInstanceOf(Date);
      expect(a.mode).toBe("GP_FUND");
      expect(a.fundId).toBe("fund-test-001");
      expect(a.wireInstructionsConfigured).toBe(true);
      expect(a.brandingConfigured).toBe(true);
      expect(a.setupCompletedAt).toBeInstanceOf(Date);
      expect(a.setupProgress).toEqual({
        companyInfo: true,
        branding: true,
        raiseType: true,
        teamInvites: true,
        dataroom: true,
        fund: true,
        lpOnboarding: true,
        integrations: true,
        wire: true,
        notifications: true,
      });
    });

    it("sets fund=false and lpOnboarding=false for DATAROOM_ONLY", async () => {
      const tx = setupTx();
      await POST(makeReq(DATAROOM_ONLY_BODY));
      const a = tx.fundroomActivation.create.mock.calls[0][0].data;
      expect(a.mode).toBe("DATAROOM_ONLY");
      expect(a.fundId).toBeNull();
      expect(a.setupProgress.fund).toBe(false);
      expect(a.setupProgress.lpOnboarding).toBe(false);
    });

    it("sets wire=false when no bankName", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({ bankName: undefined })));
      const a = tx.fundroomActivation.create.mock.calls[0][0].data;
      expect(a.wireInstructionsConfigured).toBe(false);
      expect(a.setupProgress.wire).toBe(false);
    });

    it("sets branding=false when no brandColor or logoUrl", async () => {
      const tx = setupTx();
      await POST(makeReq({ companyName: "NoBrand", raiseMode: "GP_FUND" }));
      const a = tx.fundroomActivation.create.mock.calls[0][0].data;
      expect(a.brandingConfigured).toBe(false);
      expect(a.setupProgress.branding).toBe(false);
    });

    it("sets teamInvites=false when no valid invite emails", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({ inviteEmails: ["", "  "] })));
      expect(tx.fundroomActivation.create.mock.calls[0][0].data.setupProgress.teamInvites).toBe(false);
    });

    it("counts valid invite emails correctly (filters empty strings)", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        inviteEmails: ["valid@test.com", "", "  ", "another@test.com"],
      })));
      expect(tx.fundroomActivation.create.mock.calls[0][0].data.setupProgress.teamInvites).toBe(true);
    });

    it("links activation to team ID", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody()));
      expect(tx.fundroomActivation.create.mock.calls[0][0].data.teamId).toMatch(/^team_/);
    });
  });

  // -------------------------------------------------------------------
  // 10. Dataroom Creation
  // -------------------------------------------------------------------
  describe("Dataroom creation", () => {
    it("creates dataroom with custom name", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({ dataroomName: "Custom DR" })));
      const d = tx.dataroom.create.mock.calls[0][0].data;
      expect(d.name).toBe("Custom DR");
      expect(d.pId).toMatch(/^dr_dr_/);
      expect(d.teamId).toMatch(/^team_/);
    });

    it("auto-generates dataroom name from company name", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({ dataroomName: undefined })));
      expect(tx.dataroom.create.mock.calls[0][0].data.name).toBe(
        "Acme Capital LLC \u2014 Fund Dataroom",
      );
    });

    it("uses 'Company' fallback when companyName is missing", async () => {
      const tx = setupTx();
      await POST(makeReq({ raiseMode: "GP_FUND" }));
      expect(tx.dataroom.create.mock.calls[0][0].data.name).toContain("Company");
    });
  });

  // -------------------------------------------------------------------
  // 11. Audit Events
  // -------------------------------------------------------------------
  describe("Audit events", () => {
    it("logs SETTINGS_UPDATED for organization creation", async () => {
      setupTx();
      await POST(makeReq(gpFundBody({
        regDExemption: "506C",
        inviteEmails: ["a@b.com", "c@d.com"],
      })));
      const orgAudit = mockLogAuditEvent.mock.calls.find(
        (c: unknown[]) =>
          (c[0] as Record<string, unknown>).eventType === "SETTINGS_UPDATED" &&
          ((c[0] as Record<string, Record<string, unknown>>).metadata).action === "organization_created",
      );
      expect(orgAudit).toBeDefined();
      expect(orgAudit[0].userId).toBe(USER_ID);
      expect(orgAudit[0].teamId).toMatch(/^team_/);
      expect(orgAudit[0].resourceType).toBe("Organization");
      expect(orgAudit[0].resourceId).toMatch(/^org_/);
      expect(orgAudit[0].metadata.orgName).toBe("Acme Capital LLC");
      expect(orgAudit[0].metadata.raiseMode).toBe("GP_FUND");
      expect(orgAudit[0].metadata.regDExemption).toBe("506C");
      expect(orgAudit[0].metadata.teamInviteCount).toBe(2);
    });

    it("logs Bad Actor certification with immutable chain", async () => {
      setupTx();
      await POST(makeReq(gpFundBody({ badActorCertified: true })));
      const cert = mockLogAuditEvent.mock.calls.find(
        (c: unknown[]) =>
          ((c[0] as Record<string, Record<string, unknown>>).metadata).action === "CERTIFY" &&
          ((c[0] as Record<string, Record<string, unknown>>).metadata).certification === "BAD_ACTOR_506D",
      );
      expect(cert).toBeDefined();
      expect(cert[0].metadata.certified).toBe(true);
      expect(cert[0].metadata.certificationText).toContain("Rule 506(d)");
      expect(cert[0].metadata.ipAddress).toBe("192.168.1.100");
      expect(cert[0].metadata.userAgent).toBe("Jest Test Agent");
      expect(cert[1]).toEqual({ useImmutableChain: true });
    });

    it("does NOT log Bad Actor certification when not certified", async () => {
      setupTx();
      await POST(makeReq(gpFundBody({ badActorCertified: false })));
      const cert = mockLogAuditEvent.mock.calls.find(
        (c: unknown[]) =>
          ((c[0] as Record<string, Record<string, unknown>>).metadata).certification === "BAD_ACTOR_506D",
      );
      expect(cert).toBeUndefined();
    });

    it("logs FUND_CREATED for created fund", async () => {
      setupTx();
      await POST(makeReq(gpFundBody()));
      const fundAudit = mockLogAuditEvent.mock.calls.find(
        (c: unknown[]) => (c[0] as Record<string, unknown>).eventType === "FUND_CREATED",
      );
      expect(fundAudit).toBeDefined();
      expect(fundAudit[0].resourceType).toBe("Fund");
      expect(fundAudit[0].resourceId).toBe("fund-test-001");
      expect(fundAudit[0].metadata.fundName).toBe("Acme Fund I");
      expect(fundAudit[0].metadata.fundStrategy).toBe("PE");
      expect(fundAudit[0].metadata.targetRaise).toBe("10000000");
    });

    it("does NOT log FUND_CREATED for DATAROOM_ONLY", async () => {
      setupTx();
      await POST(makeReq(DATAROOM_ONLY_BODY));
      const fundAudit = mockLogAuditEvent.mock.calls.find(
        (c: unknown[]) => (c[0] as Record<string, unknown>).eventType === "FUND_CREATED",
      );
      expect(fundAudit).toBeUndefined();
    });

    it("logs team invites queued with valid emails and roles", async () => {
      setupTx();
      await POST(makeReq(gpFundBody({
        inviteEmails: ["alice@acme.com", "bob@acme.com", "bad-email", ""],
        inviteRoles: ["ADMIN", "MANAGER", "ADMIN", "ADMIN"],
      })));
      const inv = mockLogAuditEvent.mock.calls.find(
        (c: unknown[]) =>
          ((c[0] as Record<string, Record<string, unknown>>).metadata).action === "team_invites_queued",
      );
      expect(inv).toBeDefined();
      expect(inv[0].eventType).toBe("ADMIN_ACTION");
      expect(inv[0].metadata.invites).toHaveLength(2);
      expect(inv[0].metadata.invites[0]).toEqual({ email: "alice@acme.com", role: "ADMIN" });
      expect(inv[0].metadata.invites[1]).toEqual({ email: "bob@acme.com", role: "MANAGER" });
    });

    it("defaults invite role to ADMIN when inviteRoles not provided", async () => {
      setupTx();
      await POST(makeReq(gpFundBody({ inviteEmails: ["new@test.com"] })));
      const inv = mockLogAuditEvent.mock.calls.find(
        (c: unknown[]) =>
          ((c[0] as Record<string, Record<string, unknown>>).metadata).action === "team_invites_queued",
      );
      expect(inv[0].metadata.invites[0].role).toBe("ADMIN");
    });

    it("does NOT log team invites when no valid emails", async () => {
      setupTx();
      await POST(makeReq(gpFundBody({ inviteEmails: ["", "  "] })));
      const inv = mockLogAuditEvent.mock.calls.find(
        (c: unknown[]) =>
          ((c[0] as Record<string, Record<string, unknown>>).metadata).action === "team_invites_queued",
      );
      expect(inv).toBeUndefined();
    });

    it("handles team invite audit failure gracefully (fire-and-forget)", async () => {
      setupTx();
      let callCount = 0;
      mockLogAuditEvent.mockImplementation(async (data: Record<string, unknown>) => {
        callCount++;
        if ((data.metadata as Record<string, unknown>)?.action === "team_invites_queued") {
          throw new Error("Audit write failed");
        }
      });
      const res = await POST(makeReq(gpFundBody({ inviteEmails: ["team@acme.com"] })));
      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------
  // 12. Analytics Server Event
  // -------------------------------------------------------------------
  describe("Analytics server event", () => {
    it("fires funnel_org_setup_completed with correct params", async () => {
      setupTx();
      await POST(makeReq(gpFundBody()));
      expect(mockPublishServerEvent).toHaveBeenCalledWith(
        "funnel_org_setup_completed",
        expect.objectContaining({
          userId: USER_ID,
          method: "GP_FUND",
        }),
      );
    });

    it("includes orgId and teamId in event", async () => {
      setupTx();
      await POST(makeReq(gpFundBody()));
      const evt = mockPublishServerEvent.mock.calls[0][1];
      expect(evt.orgId).toMatch(/^org_/);
      expect(evt.teamId).toMatch(/^team_/);
    });

    it("uses raiseMode as method", async () => {
      setupTx();
      await POST(makeReq(DATAROOM_ONLY_BODY));
      expect(mockPublishServerEvent).toHaveBeenCalledWith(
        "funnel_org_setup_completed",
        expect.objectContaining({ method: "DATAROOM_ONLY" }),
      );
    });

    it("handles server event failure gracefully (fire-and-forget)", async () => {
      setupTx();
      mockPublishServerEvent.mockRejectedValue(new Error("PostHog down"));
      const res = await POST(makeReq(gpFundBody()));
      expect(res.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------
  // 13. Response Shape
  // -------------------------------------------------------------------
  describe("Response shape", () => {
    it("returns success with all IDs and redirectUrl for GP_FUND", async () => {
      setupTx();
      const res = await POST(makeReq(gpFundBody()));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        success: true,
        orgId: expect.stringMatching(/^org_/),
        teamId: expect.stringMatching(/^team_/),
        fundId: "fund-test-001",
        dataroomId: "dr-test-001",
        redirectUrl: "/admin/dashboard",
      });
    });

    it("returns null fundId for DATAROOM_ONLY", async () => {
      setupTx();
      const res = await POST(makeReq(DATAROOM_ONLY_BODY));
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.fundId).toBeNull();
      expect(body.dataroomId).toBeDefined();
    });
  });

  // -------------------------------------------------------------------
  // 14. Error Handling
  // -------------------------------------------------------------------
  describe("Error handling", () => {
    it("returns 500 and reports error on transaction failure", async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error("Database connection failed"),
      );
      const res = await POST(makeReq(gpFundBody()));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Internal server error");
      expect(mockReportError).toHaveBeenCalledTimes(1);
      expect(mockReportError.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(mockReportError.mock.calls[0][0].message).toBe("Database connection failed");
    });

    it("returns 500 on org create failure inside transaction", async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: Function) => {
        return cb({
          organization: {
            create: jest.fn().mockRejectedValue(new Error("Unique constraint")),
          },
        });
      });
      const res = await POST(makeReq(gpFundBody()));
      expect(res.status).toBe(500);
      expect(mockReportError).toHaveBeenCalled();
    });

    it("does not leak error details in response", async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(
        new Error("Sensitive: postgres://user:pass@host/db"),
      );
      const res = await POST(makeReq(gpFundBody()));
      const body = await res.json();
      expect(body.error).toBe("Internal server error");
      expect(JSON.stringify(body)).not.toContain("postgres://");
      expect(JSON.stringify(body)).not.toContain("Sensitive");
    });
  });

  // -------------------------------------------------------------------
  // 15. Numeric Parsing
  // -------------------------------------------------------------------
  describe("Numeric parsing", () => {
    it("parses currency-formatted strings", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        targetRaise: "$50,000,000",
        minInvestment: "$100,000",
      })));
      const d = tx.fund.create.mock.calls[0][0].data;
      expect(d.targetRaise).toBe(50000000);
      expect(d.minimumInvestment).toBe(100000);
    });

    it("handles numeric values directly", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        targetRaise: 25000000,
        mgmtFee: 2,
        carry: 20,
      })));
      const d = tx.fund.create.mock.calls[0][0].data;
      expect(d.targetRaise).toBe(25000000);
      expect(d.managementFeePct).toBe(0.02);
      expect(d.carryPct).toBe(0.2);
    });

    it("handles empty/undefined values as null", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        mgmtFee: "",
        carry: undefined,
        hurdle: null,
      })));
      const d = tx.fund.create.mock.calls[0][0].data;
      expect(d.managementFeePct).toBeNull();
      expect(d.carryPct).toBeNull();
      expect(d.hurdleRate).toBeNull();
    });

    it("converts percentage fields by dividing by 100", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody({
        mgmtFee: "2.5",
        carry: "20",
        hurdle: "8",
      })));
      const d = tx.fund.create.mock.calls[0][0].data;
      expect(d.managementFeePct).toBeCloseTo(0.025);
      expect(d.carryPct).toBeCloseTo(0.2);
      expect(d.hurdleRate).toBeCloseTo(0.08);
    });
  });

  // -------------------------------------------------------------------
  // 16. Transaction Atomicity
  // -------------------------------------------------------------------
  describe("Transaction atomicity", () => {
    it("calls prisma.$transaction exactly once", async () => {
      setupTx();
      await POST(makeReq(gpFundBody()));
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("creates all entities within the single transaction", async () => {
      const tx = setupTx();
      await POST(makeReq(gpFundBody()));
      expect(tx.organization.create).toHaveBeenCalledTimes(1);
      expect(tx.organizationDefaults.create).toHaveBeenCalledTimes(1);
      expect(tx.team.create).toHaveBeenCalledTimes(1);
      expect(tx.userTeam.create).toHaveBeenCalledTimes(1);
      expect(tx.fund.create).toHaveBeenCalledTimes(1);
      expect(tx.fundAggregate.create).toHaveBeenCalledTimes(1);
      expect(tx.dataroom.create).toHaveBeenCalledTimes(1);
      expect(tx.fundroomActivation.create).toHaveBeenCalledTimes(1);
    });

    it("fires audit events AFTER the transaction completes", async () => {
      const callOrder: string[] = [];

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: Function) => {
        const tx = {
          organization: { create: jest.fn().mockImplementation(() => { callOrder.push("org"); return { id: "o1", name: "X" }; }) },
          organizationDefaults: { create: jest.fn().mockResolvedValue({}) },
          team: { create: jest.fn().mockImplementation(() => { callOrder.push("team"); return { id: "t1", name: "X" }; }) },
          userTeam: { create: jest.fn().mockResolvedValue({}) },
          fund: {
            create: jest.fn().mockImplementation(() => { callOrder.push("fund"); return { id: "f1", name: "F", teamId: "t1", entityMode: "FUND" }; }),
            update: jest.fn().mockResolvedValue({}),
          },
          fundAggregate: { create: jest.fn().mockResolvedValue({}) },
          fundingRound: { create: jest.fn().mockResolvedValue({}) },
          fundPricingTier: { create: jest.fn().mockResolvedValue({}) },
          dataroom: { create: jest.fn().mockImplementation(() => { callOrder.push("dataroom"); return { id: "d1", name: "D" }; }) },
          fundroomActivation: { create: jest.fn().mockResolvedValue({}) },
        };
        const result = await cb(tx);
        callOrder.push("$tx_done");
        return result;
      });

      mockLogAuditEvent.mockImplementation(async () => {
        callOrder.push("audit");
      });

      await POST(makeReq(gpFundBody()));

      const txDoneIdx = callOrder.indexOf("$tx_done");
      const firstAuditIdx = callOrder.indexOf("audit");
      expect(txDoneIdx).toBeGreaterThan(-1);
      expect(firstAuditIdx).toBeGreaterThan(-1);
      expect(txDoneIdx).toBeLessThan(firstAuditIdx);
    });
  });
});
