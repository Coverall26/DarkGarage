-- AlterTable: Add SignSuite NDA gate fields to Link
ALTER TABLE "Link" ADD COLUMN "enableSignSuiteNda" BOOLEAN DEFAULT false;
ALTER TABLE "Link" ADD COLUMN "signSuiteNdaDocumentId" TEXT;

-- AlterTable: Add SignSuite NDA gate fields to LinkPreset
ALTER TABLE "LinkPreset" ADD COLUMN "enableSignSuiteNda" BOOLEAN DEFAULT false;
ALTER TABLE "LinkPreset" ADD COLUMN "signSuiteNdaDocumentId" TEXT;

-- CreateTable: NdaSigningRecord
CREATE TABLE "NdaSigningRecord" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "viewId" TEXT,
    "envelopeId" TEXT,
    "signerEmail" TEXT NOT NULL,
    "signerName" TEXT,
    "signedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "filingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NdaSigningRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: NdaSigningRecord unique viewId
CREATE UNIQUE INDEX "NdaSigningRecord_viewId_key" ON "NdaSigningRecord"("viewId");

-- CreateIndex: NdaSigningRecord indexes
CREATE INDEX "NdaSigningRecord_linkId_idx" ON "NdaSigningRecord"("linkId");
CREATE INDEX "NdaSigningRecord_signerEmail_idx" ON "NdaSigningRecord"("signerEmail");
CREATE INDEX "NdaSigningRecord_envelopeId_idx" ON "NdaSigningRecord"("envelopeId");

-- AddForeignKey: NdaSigningRecord → Link
ALTER TABLE "NdaSigningRecord" ADD CONSTRAINT "NdaSigningRecord_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "Link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: NdaSigningRecord → View
ALTER TABLE "NdaSigningRecord" ADD CONSTRAINT "NdaSigningRecord_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "View"("id") ON DELETE SET NULL ON UPDATE CASCADE;
