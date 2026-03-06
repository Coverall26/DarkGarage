-- Add batch tracking fields to Envelope for bulk send
ALTER TABLE "Envelope" ADD COLUMN "batchId" TEXT;
ALTER TABLE "Envelope" ADD COLUMN "batchName" TEXT;

-- Index for batch dashboard queries
CREATE INDEX "Envelope_batchId_idx" ON "Envelope"("batchId");
