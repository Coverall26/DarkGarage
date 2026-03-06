-- Add SCHEDULED status to EnvelopeStatus enum
ALTER TYPE "EnvelopeStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED' BEFORE 'SENT';

-- Add scheduledSendAt field to Envelope model
ALTER TABLE "Envelope" ADD COLUMN "scheduledSendAt" TIMESTAMP(3);

-- Index for cron job to efficiently find SCHEDULED envelopes due for sending
CREATE INDEX "Envelope_status_scheduledSendAt_idx" ON "Envelope"("status", "scheduledSendAt");
