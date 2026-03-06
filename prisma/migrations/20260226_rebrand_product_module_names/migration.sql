-- Rebrand: Rename product module enum values
-- PIPELINE_IQ -> RAISE_CRM, PIPELINE_IQ_LITE -> (removed, merged into RAISE_CRM), DOCROOMS -> (removed, merged into DATAROOM)
-- Add new RAISEROOM value

-- Step 1: Add new enum values to ProductModule
ALTER TYPE "ProductModule" ADD VALUE IF NOT EXISTS 'RAISE_CRM';
ALTER TYPE "ProductModule" ADD VALUE IF NOT EXISTS 'RAISEROOM';

-- Step 2: Add new enum value to AddOnType
ALTER TYPE "AddOnType" ADD VALUE IF NOT EXISTS 'RAISE_CRM';

-- Step 3: Migrate existing data from old enum values to new ones
-- OrgProductModule: PIPELINE_IQ -> RAISE_CRM, PIPELINE_IQ_LITE -> RAISE_CRM, DOCROOMS -> DATAROOM
UPDATE "OrgProductModule" SET "module" = 'RAISE_CRM' WHERE "module" = 'PIPELINE_IQ';
UPDATE "OrgProductModule" SET "module" = 'RAISE_CRM' WHERE "module" = 'PIPELINE_IQ_LITE';
UPDATE "OrgProductModule" SET "module" = 'DATAROOM' WHERE "module" = 'DOCROOMS';

-- Contact.sourceModule: PIPELINE_IQ -> RAISE_CRM, PIPELINE_IQ_LITE -> RAISE_CRM, DOCROOMS -> DATAROOM
UPDATE "Contact" SET "sourceModule" = 'RAISE_CRM' WHERE "sourceModule" = 'PIPELINE_IQ';
UPDATE "Contact" SET "sourceModule" = 'RAISE_CRM' WHERE "sourceModule" = 'PIPELINE_IQ_LITE';
UPDATE "Contact" SET "sourceModule" = 'DATAROOM' WHERE "sourceModule" = 'DOCROOMS';

-- Envelope.sourceModule: PIPELINE_IQ -> RAISE_CRM, PIPELINE_IQ_LITE -> RAISE_CRM, DOCROOMS -> DATAROOM
UPDATE "Envelope" SET "sourceModule" = 'RAISE_CRM' WHERE "sourceModule" = 'PIPELINE_IQ';
UPDATE "Envelope" SET "sourceModule" = 'RAISE_CRM' WHERE "sourceModule" = 'PIPELINE_IQ_LITE';
UPDATE "Envelope" SET "sourceModule" = 'DATAROOM' WHERE "sourceModule" = 'DOCROOMS';

-- OrgAddOn: PIPELINE_IQ -> RAISE_CRM
UPDATE "OrgAddOn" SET "addOnType" = 'RAISE_CRM' WHERE "addOnType" = 'PIPELINE_IQ';

-- Note: Old enum values (PIPELINE_IQ, PIPELINE_IQ_LITE, DOCROOMS) cannot be removed from
-- PostgreSQL enums without recreating the type. They remain in the DB type but are no longer
-- used by the application. Prisma schema only declares the active values.
