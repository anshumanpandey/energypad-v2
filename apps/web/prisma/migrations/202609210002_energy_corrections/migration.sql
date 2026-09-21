ALTER TABLE "ConsumptionRecord" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
 ADD COLUMN "supersedesId" UUID, ADD COLUMN "correctionReason" TEXT;
ALTER TABLE "UnitConversionVersion" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
 ADD COLUMN "supersedesId" UUID, ADD COLUMN "correctionReason" TEXT;
DROP INDEX "ConsumptionRecord_meterId_periodStart_key";
CREATE UNIQUE INDEX "ConsumptionRecord_original_period_key" ON "ConsumptionRecord"("meterId","periodStart") WHERE "supersedesId" IS NULL;
CREATE UNIQUE INDEX "ConsumptionRecord_id_organisationId_key" ON "ConsumptionRecord"("id","organisationId");
CREATE UNIQUE INDEX "ConsumptionRecord_supersedesId_organisationId_key" ON "ConsumptionRecord"("supersedesId","organisationId");
ALTER TABLE "ConsumptionRecord" ADD FOREIGN KEY ("supersedesId","organisationId") REFERENCES "ConsumptionRecord"("id","organisationId");
DROP INDEX "UnitConversionVersion_meterId_sourceUnit_fuel_validFrom_key";
CREATE UNIQUE INDEX "UnitConversionVersion_supersedesId_organisationId_key" ON "UnitConversionVersion"("supersedesId","organisationId");
ALTER TABLE "UnitConversionVersion" ADD FOREIGN KEY ("supersedesId","organisationId") REFERENCES "UnitConversionVersion"("id","organisationId");
CREATE FUNCTION validate_reading_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "ConsumptionRecord"%ROWTYPE;
BEGIN
 IF NEW."supersedesId" IS NULL THEN
  IF NEW."revision" <> 1 OR NEW."correctionReason" IS NOT NULL THEN RAISE EXCEPTION 'Invalid original reading revision'; END IF;
 ELSE
  SELECT * INTO STRICT prior FROM "ConsumptionRecord" WHERE id=NEW."supersedesId";
  IF NEW."revision" <> prior."revision"+1 OR NEW."organisationId" <> prior."organisationId" OR NEW."siteId" <> prior."siteId" OR NEW."meterId" <> prior."meterId" OR NEW."periodStart" <> prior."periodStart" OR NEW."periodEnd" <> prior."periodEnd" OR NEW."sourceUnit" <> prior."sourceUnit" OR NEW."fuel" <> prior."fuel" OR COALESCE(length(trim(NEW."correctionReason")),0)<3 THEN RAISE EXCEPTION 'Invalid reading correction lineage'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE FUNCTION validate_conversion_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "UnitConversionVersion"%ROWTYPE;
BEGIN
 IF NEW."supersedesId" IS NULL THEN
  IF NEW."revision" <> 1 OR NEW."correctionReason" IS NOT NULL THEN RAISE EXCEPTION 'Invalid original conversion revision'; END IF;
 ELSE
  SELECT * INTO STRICT prior FROM "UnitConversionVersion" WHERE id=NEW."supersedesId";
  IF NEW."revision" <> prior."revision"+1 OR NEW."organisationId" <> prior."organisationId" OR NEW."siteId" <> prior."siteId" OR NEW."meterId" <> prior."meterId" OR NEW."sourceUnit" <> prior."sourceUnit" OR NEW."fuel" <> prior."fuel" OR COALESCE(length(trim(NEW."correctionReason")),0)<3 THEN RAISE EXCEPTION 'Invalid conversion correction lineage'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER reading_lineage BEFORE INSERT ON "ConsumptionRecord" FOR EACH ROW EXECUTE FUNCTION validate_reading_revision();
CREATE TRIGGER conversion_lineage BEFORE INSERT ON "UnitConversionVersion" FOR EACH ROW EXECUTE FUNCTION validate_conversion_revision();
CREATE FUNCTION prevent_reading_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Consumption revisions are immutable; create a correction'; END; $$;
CREATE TRIGGER reading_immutable BEFORE UPDATE OR DELETE ON "ConsumptionRecord" FOR EACH ROW EXECUTE FUNCTION prevent_reading_changes();
CREATE TRIGGER reading_no_truncate BEFORE TRUNCATE ON "ConsumptionRecord" FOR EACH STATEMENT EXECUTE FUNCTION prevent_reading_changes();
