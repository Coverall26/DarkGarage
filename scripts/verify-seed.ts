/**
 * Verify Seed Data — Bermuda Franchise Group
 *
 * Validates that all required seed records exist and have correct relationships.
 * Run after seeding to verify database integrity.
 *
 * Usage:
 *   npx ts-node scripts/verify-seed.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CheckResult {
  name: string;
  status: "PASS" | "FAIL" | "WARN";
  detail: string;
}

const results: CheckResult[] = [];

function pass(name: string, detail: string) {
  results.push({ name, status: "PASS", detail });
}

function fail(name: string, detail: string) {
  results.push({ name, status: "FAIL", detail });
}

function warn(name: string, detail: string) {
  results.push({ name, status: "WARN", detail });
}

async function main() {
  console.log("\n  FundRoom AI — Seed Data Verification");
  console.log("  =====================================\n");

  // 1. Organization
  const org = await prisma.organization.findUnique({
    where: { slug: "bermuda-franchise" },
  });
  if (org) {
    pass("Organization", `Found: ${org.name} (${org.slug})`);

    if (org.productMode === "FUND") {
      pass("Org.productMode", "FUND");
    } else {
      fail("Org.productMode", `Expected FUND, got ${org.productMode}`);
    }

    if (org.regulationDExemption === "506C") {
      pass("Org.regulationDExemption", "506C");
    } else {
      warn("Org.regulationDExemption", `Expected 506C, got ${org.regulationDExemption}`);
    }
  } else {
    fail("Organization", "Not found (slug: bermuda-franchise)");
    printResults();
    return;
  }

  // 2. Organization Defaults
  const orgDefaults = await prisma.organizationDefaults.findFirst({
    where: { organizationId: org.id },
  });
  if (orgDefaults) {
    pass("OrganizationDefaults", "Found");
  } else {
    fail("OrganizationDefaults", "Not found");
  }

  // 3. Security Policy
  const secPolicy = await prisma.organizationSecurityPolicy.findFirst({
    where: { organizationId: org.id },
  });
  if (secPolicy) {
    pass("SecurityPolicy", "Found");
  } else {
    fail("SecurityPolicy", "Not found");
  }

  // 4. Team
  const team = await prisma.team.findFirst({
    where: { organizationId: org.id },
  });
  if (team) {
    pass("Team", `Found: ${team.name}`);
  } else {
    fail("Team", "Not found");
    printResults();
    return;
  }

  // 5. Brand
  const brand = await prisma.brand.findUnique({
    where: { teamId: team.id },
  });
  if (brand) {
    pass("Brand", `Found (brandColor: ${brand.brandColor})`);
  } else {
    warn("Brand", "Not found — some UI elements may show default styling");
  }

  // 6. Team Members
  const members = await prisma.userTeam.findMany({
    where: { teamId: team.id },
    include: { user: { select: { email: true } } },
  });
  if (members.length >= 2) {
    pass("Team Members", `${members.length} members: ${members.map((m) => m.user.email).join(", ")}`);
  } else {
    fail("Team Members", `Expected >= 2 members, found ${members.length}`);
  }

  // Check admin (OWNER)
  const owner = members.find((m) => m.role === "OWNER");
  if (owner) {
    pass("Team OWNER", owner.user.email);
  } else {
    fail("Team OWNER", "No OWNER role found");
  }

  // Check GP demo user
  const gpAdmin = members.find((m) => m.user.email === "joe@bermudafranchisegroup.com");
  if (gpAdmin) {
    pass("GP Demo User", `Role: ${gpAdmin.role}`);
  } else {
    warn("GP Demo User", "joe@bermudafranchisegroup.com not in team");
  }

  // 7. Fund
  const fund = await prisma.fund.findFirst({
    where: { teamId: team.id },
  });
  if (fund) {
    pass("Fund", `Found: ${fund.name}`);

    if (fund.targetRaise) {
      pass("Fund.targetRaise", `$${Number(fund.targetRaise).toLocaleString()}`);
    } else {
      fail("Fund.targetRaise", "Not set");
    }

    if (fund.managementFeePct) {
      pass("Fund.managementFeePct", `${Number(fund.managementFeePct) * 100}%`);
    } else {
      warn("Fund.managementFeePct", "Not set");
    }
  } else {
    fail("Fund", "Not found");
    printResults();
    return;
  }

  // 8. Fund Aggregate
  const agg = await prisma.fundAggregate.findFirst({
    where: { fundId: fund.id },
  });
  if (agg) {
    pass("FundAggregate", `Committed: $${Number(agg.totalCommitted).toLocaleString()}, Inbound: $${Number(agg.totalInbound).toLocaleString()}`);
  } else {
    fail("FundAggregate", "Not found");
  }

  // 9. Pricing Tiers
  const tiers = await prisma.fundPricingTier.findMany({
    where: { fundId: fund.id },
    orderBy: { tranche: "asc" },
  });
  if (tiers.length >= 6) {
    pass("Pricing Tiers", `${tiers.length} tiers`);
    const activeTier = tiers.find((t) => t.isActive);
    if (activeTier) {
      pass("Active Tier", `Tranche ${activeTier.tranche}: ${activeTier.name} @ $${Number(activeTier.pricePerUnit).toLocaleString()}`);
    } else {
      warn("Active Tier", "No active pricing tier");
    }
  } else {
    fail("Pricing Tiers", `Expected >= 6, found ${tiers.length}`);
  }

  // 10. Funding Rounds
  const rounds = await prisma.fundingRound.findMany({
    where: { fundId: fund.id },
  });
  if (rounds.length >= 5) {
    pass("Funding Rounds", `${rounds.length} rounds`);
  } else {
    warn("Funding Rounds", `Expected >= 5, found ${rounds.length}`);
  }

  // 11. Dataroom
  const dataroom = await prisma.dataroom.findFirst({
    where: { teamId: team.id },
  });
  if (dataroom) {
    pass("Dataroom", `Found: ${dataroom.name} (pId: ${dataroom.pId})`);
  } else {
    fail("Dataroom", "Not found");
  }

  // 12. Dataroom Folders
  if (dataroom) {
    const folders = await prisma.dataroomFolder.findMany({
      where: { dataroomId: dataroom.id },
    });
    if (folders.length >= 7) {
      pass("Dataroom Folders", `${folders.length} folders`);
    } else {
      warn("Dataroom Folders", `Expected >= 7, found ${folders.length}`);
    }
  }

  // 13. Offering Page
  const offering = await prisma.offeringPage.findUnique({
    where: { slug: "bermuda-club-fund" },
  });
  if (offering) {
    pass("OfferingPage", `Found: /offering/${offering.slug} (public: ${offering.isPublic})`);
    if (offering.fundId === fund.id) {
      pass("OfferingPage.fundId", "Matches fund");
    } else {
      fail("OfferingPage.fundId", "Fund ID mismatch");
    }
  } else {
    warn("OfferingPage", "Not found — /offering/bermuda-club-fund will 404");
  }

  // 14. Demo LP Investors
  const investors = await prisma.investor.findMany({
    where: { fundId: fund.id },
    include: { user: { select: { email: true } } },
  });
  if (investors.length >= 6) {
    pass("Demo Investors", `${investors.length} investors`);
  } else {
    warn("Demo Investors", `Expected >= 6, found ${investors.length}`);
  }

  // Check demo-investor@example.com specifically
  const demoLP = investors.find((i) => i.user.email === "demo-investor@example.com");
  if (demoLP) {
    pass("Demo LP User", `Accreditation: ${demoLP.accreditationStatus}, NDA: ${demoLP.ndaSigned}`);
  } else {
    warn("Demo LP User", "demo-investor@example.com not found");
  }

  // 15. Investments
  const investments = await prisma.investment.findMany({
    where: { fundId: fund.id },
  });
  if (investments.length >= 5) {
    pass("Investments", `${investments.length} investments`);
  } else {
    warn("Investments", `Expected >= 5, found ${investments.length}`);
  }

  // 16. Transactions
  const transactions = await prisma.transaction.findMany({
    where: { fundId: fund.id },
  });
  if (transactions.length >= 1) {
    pass("Transactions", `${transactions.length} transactions`);
  } else {
    warn("Transactions", `Expected >= 1, found ${transactions.length}`);
  }

  // 17. Signature Documents
  const signDocs = await prisma.signatureDocument.findMany({
    where: { fundId: fund.id, requiredForOnboarding: true },
  });
  if (signDocs.length >= 2) {
    pass("Signature Documents", `${signDocs.length} required for onboarding`);
  } else {
    fail("Signature Documents", `Expected >= 2 (NDA + Sub Ag), found ${signDocs.length}`);
  }

  // 18. Document Templates
  const templates = await prisma.documentTemplate.findMany({
    where: { teamId: team.id },
  });
  if (templates.length >= 2) {
    pass("Document Templates", `${templates.length} templates`);
  } else {
    warn("Document Templates", `Expected >= 2, found ${templates.length}`);
  }

  // 19. Custom Domains
  const domains = await prisma.domain.findMany({
    where: { teamId: team.id },
  });
  if (domains.length >= 2) {
    pass("Custom Domains", `${domains.length} domains`);
  } else {
    warn("Custom Domains", `Expected >= 2, found ${domains.length}`);
  }

  // 20. FundroomActivation
  const activation = await prisma.fundroomActivation.findFirst({
    where: { teamId: team.id },
  });
  if (activation) {
    pass("FundroomActivation", `Status: ${activation.status}`);
    if (activation.status === "ACTIVE") {
      pass("Activation.status", "ACTIVE");
    } else {
      fail("Activation.status", `Expected ACTIVE, got ${activation.status}`);
    }
  } else {
    fail("FundroomActivation", "Not found — paywall will block LP access");
  }

  // 21. PlatformSettings
  const platformSettings = await prisma.platformSettings.findFirst({
    where: { key: "global" },
  });
  if (platformSettings) {
    pass("PlatformSettings", "Found");
  } else {
    warn("PlatformSettings", "Not found — using default settings");
  }

  // 22. LP Documents
  const lpDocs = await prisma.lPDocument.findMany({
    where: { fundId: fund.id },
  });
  if (lpDocs.length >= 1) {
    pass("LP Documents", `${lpDocs.length} sample documents`);
  } else {
    warn("LP Documents", "No sample LP documents found");
  }

  // 23. GP User Password
  const gpUser = await prisma.user.findUnique({
    where: { email: "joe@bermudafranchisegroup.com" },
  });
  if (gpUser?.password) {
    pass("GP User Password", "Set (can login with credentials)");
  } else {
    fail("GP User Password", "Not set — GP cannot login with password");
  }

  // 24. Admin User Password
  const adminUser = await prisma.user.findUnique({
    where: { email: "rciesco@fundroom.ai" },
  });
  if (adminUser?.password) {
    pass("Admin User Password", "Set");
  } else {
    warn("Admin User Password", "Not set — admin must use magic link");
  }

  printResults();
}

function printResults() {
  console.log("");

  const passes = results.filter((r) => r.status === "PASS");
  const warnings = results.filter((r) => r.status === "WARN");
  const failures = results.filter((r) => r.status === "FAIL");

  for (const r of results) {
    const icon =
      r.status === "PASS" ? "  [PASS]" : r.status === "WARN" ? "  [WARN]" : "  [FAIL]";
    console.log(`${icon} ${r.name}: ${r.detail}`);
  }

  console.log("");
  console.log(`  Summary: ${passes.length} passed, ${warnings.length} warnings, ${failures.length} failures`);

  if (failures.length > 0) {
    console.log("\n  SEED VERIFICATION FAILED — fix issues above and re-run seed.\n");
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log("\n  SEED VERIFICATION PASSED WITH WARNINGS — review items above.\n");
  } else {
    console.log("\n  SEED VERIFICATION PASSED — all checks green.\n");
  }
}

main()
  .catch((e) => {
    console.error("  Error verifying seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
