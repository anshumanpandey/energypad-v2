CREATE TABLE "UnitConversionVersion" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL, "meterId" UUID NOT NULL,
 "sourceUnit" TEXT NOT NULL CHECK ("sourceUnit" IN ('m3', 'litre', 'kg')), "fuel" TEXT NOT NULL,
 "factor" DECIMAL(16,6) NOT NULL CHECK ("factor" > 0 AND "factor" <= 100000),
 "validFrom" DATE NOT NULL, "validUntil" DATE NOT NULL,
 "source" TEXT NOT NULL CHECK (length(trim("source")) >= 3), "authorId" UUID NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("meterId", "siteId", "organisationId") REFERENCES "Meter"("id", "siteId", "organisationId"),
 CHECK ("validUntil" > "validFrom" AND "validFrom" = date_trunc('month', "validFrom")::date AND "validUntil" = date_trunc('month', "validUntil")::date)
);
CREATE UNIQUE INDEX "UnitConversionVersion_id_organisationId_key" ON "UnitConversionVersion"("id", "organisationId");
CREATE UNIQUE INDEX "UnitConversionVersion_meterId_sourceUnit_fuel_validFrom_key" ON "UnitConversionVersion"("meterId", "sourceUnit", "fuel", "validFrom");
CREATE INDEX "UnitConversionVersion_organisationId_siteId_idx" ON "UnitConversionVersion"("organisationId", "siteId");
ALTER TABLE "ConsumptionRecord" ADD COLUMN "conversionId" UUID;
ALTER TABLE "ConsumptionRecord" ADD CONSTRAINT "ConsumptionRecord_conversion_fkey" FOREIGN KEY ("conversionId", "organisationId") REFERENCES "UnitConversionVersion"("id", "organisationId");
CREATE FUNCTION prevent_conversion_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Conversion versions are immutable'; END;
$$;
CREATE TRIGGER conversion_immutable BEFORE UPDATE OR DELETE ON "UnitConversionVersion" FOR EACH ROW EXECUTE FUNCTION prevent_conversion_changes();
CREATE TRIGGER conversion_no_truncate BEFORE TRUNCATE ON "UnitConversionVersion" FOR EACH STATEMENT EXECUTE FUNCTION prevent_conversion_changes();
