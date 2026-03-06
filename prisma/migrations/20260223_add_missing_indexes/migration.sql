-- Add missing indexes for query performance

-- Account: index on userId for session lookups
CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");

-- VerificationToken: index on expires for cleanup queries
CREATE INDEX IF NOT EXISTS "VerificationToken_expires_idx" ON "VerificationToken"("expires");

-- Invitation: index on teamId for team-scoped lookups
CREATE INDEX IF NOT EXISTS "Invitation_teamId_idx" ON "Invitation"("teamId");

-- Invitation: index on expires for cleanup/expiry queries
CREATE INDEX IF NOT EXISTS "Invitation_expires_idx" ON "Invitation"("expires");

-- Integration: index on category for discovery/filtering
CREATE INDEX IF NOT EXISTS "Integration_category_idx" ON "Integration"("category");
