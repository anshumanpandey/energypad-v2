CREATE UNIQUE INDEX "Meter_id_siteId_organisationId_key" ON "Meter"("id", "siteId", "organisationId");
CREATE TABLE "ConsumptionRecord" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL, "meterId" UUID NOT NULL,
 "periodStart" DATE NOT NULL, "periodEnd" DATE NOT NULL,
 "sourceQuantity" DECIMAL(16,3) NOT NULL CHECK ("sourceQuantity" >= 0), "sourceUnit" TEXT NOT NULL,
 "fuel" TEXT NOT NULL, "normalizedKwh" DECIMAL(19,3) NOT NULL CHECK ("normalizedKwh" >= 0),
 "conversionFactor" DECIMAL(16,6) NOT NULL CHECK ("conversionFactor" > 0), "conversionVersion" TEXT NOT NULL,
 "estimated" BOOLEAN NOT NULL DEFAULT false, "netCost" DECIMAL(16,3), "vatPercent" DECIMAL(6,3),
 "vatCost" DECIMAL(16,3), "grossCost" DECIMAL(16,3), "currency" CHAR(3),
 "endUse" TEXT NOT NULL, "externalLegacyId" TEXT NOT NULL, "attributeSnapshot" JSONB NOT NULL,
 "qualityFlags" JSONB NOT NULL, "authorId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ConsumptionRecord_site_fkey" FOREIGN KEY ("siteId", "organisationId") REFERENCES "Site"("id", "organisationId"),
 CONSTRAINT "ConsumptionRecord_meter_fkey" FOREIGN KEY ("meterId", "siteId", "organisationId") REFERENCES "Meter"("id", "siteId", "organisationId"),
 CHECK ("periodStart" = date_trunc('month', "periodStart")::date AND "periodEnd" = ("periodStart" + interval '1 month')::date),
 CHECK ("netCost" IS NULL OR ("netCost" >= 0 AND "currency" IS NOT NULL)),
 CHECK ("vatPercent" IS NULL OR "vatPercent" BETWEEN 0 AND 100)
);
CREATE UNIQUE INDEX "ConsumptionRecord_meterId_periodStart_key" ON "ConsumptionRecord"("meterId", "periodStart");
CREATE INDEX "ConsumptionRecord_organisationId_siteId_periodStart_idx" ON "ConsumptionRecord"("organisationId", "siteId", "periodStart");
