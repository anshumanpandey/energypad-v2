CREATE TABLE "EnergyImportBatch" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL, "meterId" UUID NOT NULL,
 "fingerprint" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'UPLOADED' CHECK ("status" IN ('UPLOADED','INVALID','READY','COMMITTED')),
 "sheets" JSONB NOT NULL, "mapping" JSONB, "result" JSONB, "createdBy" UUID NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "committedAt" TIMESTAMPTZ(3),
 FOREIGN KEY ("meterId", "siteId", "organisationId") REFERENCES "Meter"("id", "siteId", "organisationId")
);
CREATE UNIQUE INDEX "EnergyImportBatch_id_organisationId_key" ON "EnergyImportBatch"("id", "organisationId");
CREATE UNIQUE INDEX "EnergyImportBatch_meterId_fingerprint_key" ON "EnergyImportBatch"("meterId", "fingerprint");
CREATE INDEX "EnergyImportBatch_organisationId_siteId_idx" ON "EnergyImportBatch"("organisationId", "siteId");
ALTER TABLE "ConsumptionRecord" ADD COLUMN "energyImportId" UUID;
ALTER TABLE "ConsumptionRecord" ADD CONSTRAINT "ConsumptionRecord_energyImport_fkey" FOREIGN KEY ("energyImportId", "organisationId") REFERENCES "EnergyImportBatch"("id", "organisationId");
