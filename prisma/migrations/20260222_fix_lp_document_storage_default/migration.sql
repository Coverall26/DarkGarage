-- AlterTable: Change LPDocument storageType default from REPLIT to S3_PATH
ALTER TABLE "LPDocument" ALTER COLUMN "storageType" SET DEFAULT 'S3_PATH';
