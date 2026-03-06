-- v3 Rebrand: Add new product modules, tiers, room types
-- Extends ProductModule enum with RAISEROOM and RAISE_CRM
-- Extends SubscriptionTier with PRO and BUSINESS
-- Extends AddOnType with PIPELINE_IQ_LITE_RESET
-- Adds RoomType enum and roomType field to Dataroom model

-- Add new ProductModule enum values
ALTER TYPE "ProductModule" ADD VALUE IF NOT EXISTS 'RAISEROOM';
ALTER TYPE "ProductModule" ADD VALUE IF NOT EXISTS 'RAISE_CRM';

-- Add new SubscriptionTier enum values
ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'PRO';
ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'BUSINESS';

-- Add new AddOnType enum value
ALTER TYPE "AddOnType" ADD VALUE IF NOT EXISTS 'PIPELINE_IQ_LITE_RESET';

-- Create RoomType enum
DO $$ BEGIN
  CREATE TYPE "RoomType" AS ENUM ('RAISE_ROOM', 'DATA_ROOM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add roomType column to Dataroom table with default DATA_ROOM
ALTER TABLE "Dataroom" ADD COLUMN IF NOT EXISTS "roomType" "RoomType" NOT NULL DEFAULT 'DATA_ROOM';
