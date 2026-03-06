-- Add teamId column to 6 financial models for multi-tenant defense-in-depth
-- teamId is denormalized from Fund.teamId for direct query filtering without JOINs

-- 1. Investment
ALTER TABLE "Investment" ADD COLUMN "teamId" TEXT;

-- 2. Investor
ALTER TABLE "Investor" ADD COLUMN "teamId" TEXT;

-- 3. Transaction
ALTER TABLE "Transaction" ADD COLUMN "teamId" TEXT;

-- 4. Distribution
ALTER TABLE "Distribution" ADD COLUMN "teamId" TEXT;

-- 5. CapitalCall
ALTER TABLE "CapitalCall" ADD COLUMN "teamId" TEXT;

-- 6. InvestmentTranche
ALTER TABLE "InvestmentTranche" ADD COLUMN "teamId" TEXT;

-- Backfill teamId from Fund.teamId for all existing records

-- Investment: fund is required, always has fundId
UPDATE "Investment" i
SET "teamId" = f."teamId"
FROM "Fund" f
WHERE i."fundId" = f."id" AND i."teamId" IS NULL;

-- Investor: fund is optional, only backfill where fundId exists
UPDATE "Investor" inv
SET "teamId" = f."teamId"
FROM "Fund" f
WHERE inv."fundId" = f."id" AND inv."teamId" IS NULL;

-- Transaction: fundId is optional
UPDATE "Transaction" t
SET "teamId" = f."teamId"
FROM "Fund" f
WHERE t."fundId" = f."id" AND t."teamId" IS NULL;

-- Distribution: fund is required
UPDATE "Distribution" d
SET "teamId" = f."teamId"
FROM "Fund" f
WHERE d."fundId" = f."id" AND d."teamId" IS NULL;

-- CapitalCall: fund is required
UPDATE "CapitalCall" cc
SET "teamId" = f."teamId"
FROM "Fund" f
WHERE cc."fundId" = f."id" AND cc."teamId" IS NULL;

-- InvestmentTranche: backfill via Investment → Fund
UPDATE "InvestmentTranche" it
SET "teamId" = f."teamId"
FROM "Investment" inv
JOIN "Fund" f ON inv."fundId" = f."id"
WHERE it."investmentId" = inv."id" AND it."teamId" IS NULL;

-- Add indexes for efficient team-scoped queries
CREATE INDEX "Investment_teamId_idx" ON "Investment"("teamId");
CREATE INDEX "Investor_teamId_idx" ON "Investor"("teamId");
CREATE INDEX "Transaction_teamId_idx" ON "Transaction"("teamId");
CREATE INDEX "Distribution_teamId_idx" ON "Distribution"("teamId");
CREATE INDEX "CapitalCall_teamId_idx" ON "CapitalCall"("teamId");
CREATE INDEX "InvestmentTranche_teamId_idx" ON "InvestmentTranche"("teamId");

-- Add foreign key constraints
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Investor" ADD CONSTRAINT "Investor_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Distribution" ADD CONSTRAINT "Distribution_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CapitalCall" ADD CONSTRAINT "CapitalCall_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvestmentTranche" ADD CONSTRAINT "InvestmentTranche_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
