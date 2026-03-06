-- CreateEnum: ProductModule
CREATE TYPE "ProductModule" AS ENUM ('DATAROOM', 'SIGNSUITE', 'DOCROOMS', 'PIPELINE_IQ_LITE', 'PIPELINE_IQ', 'FUNDROOM');

-- CreateEnum: AddOnType
CREATE TYPE "AddOnType" AS ENUM ('PIPELINE_IQ', 'AI_CRM', 'REMOVE_BRANDING', 'CUSTOM_DOMAIN', 'PRIORITY_SUPPORT');

-- CreateTable: OrgProductModule
CREATE TABLE "OrgProductModule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "module" "ProductModule" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "limitValue" INTEGER,
    "limitType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgProductModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: OrgAddOn
CREATE TABLE "OrgAddOn" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "addOnType" "AddOnType" NOT NULL,
    "stripeSubscriptionItemId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgAddOn_pkey" PRIMARY KEY ("id")
);

-- Add sourceModule to Contact
ALTER TABLE "Contact" ADD COLUMN "sourceModule" "ProductModule";

-- Add sourceModule to Envelope
ALTER TABLE "Envelope" ADD COLUMN "sourceModule" "ProductModule";

-- CreateIndex: OrgProductModule unique constraint
CREATE UNIQUE INDEX "OrgProductModule_orgId_module_key" ON "OrgProductModule"("orgId", "module");

-- CreateIndex: OrgProductModule lookup
CREATE INDEX "OrgProductModule_orgId_enabled_idx" ON "OrgProductModule"("orgId", "enabled");

-- CreateIndex: OrgAddOn unique constraint
CREATE UNIQUE INDEX "OrgAddOn_orgId_addOnType_key" ON "OrgAddOn"("orgId", "addOnType");

-- CreateIndex: OrgAddOn lookup
CREATE INDEX "OrgAddOn_orgId_active_idx" ON "OrgAddOn"("orgId", "active");

-- AddForeignKey: OrgProductModule -> Organization
ALTER TABLE "OrgProductModule" ADD CONSTRAINT "OrgProductModule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: OrgAddOn -> Organization
ALTER TABLE "OrgAddOn" ADD CONSTRAINT "OrgAddOn_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
