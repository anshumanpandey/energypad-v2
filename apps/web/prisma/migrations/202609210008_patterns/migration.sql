CREATE TABLE "PatternImportBatch" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL,
 "fingerprint" TEXT NOT NULL, "result" JSONB NOT NULL, "status" TEXT NOT NULL,
 "createdBy" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "committedAt" TIMESTAMPTZ(3),
 UNIQUE("id","organisationId","siteId"), UNIQUE("siteId","fingerprint"),
 FOREIGN KEY("siteId","organisationId") REFERENCES "Site"("id","organisationId")
);
CREATE TABLE "OperatingPattern" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL, "energyUseId" UUID NOT NULL,
 "validFrom" DATE NOT NULL, "validUntil" DATE NOT NULL, "daysOnYear" INTEGER, "temperature" DECIMAL(6,3), "temperatureUnit" TEXT NOT NULL, "temperatureContext" TEXT NOT NULL,
 "source" TEXT NOT NULL, "legacySource" TEXT NOT NULL DEFAULT '', "legacyId" TEXT NOT NULL DEFAULT '',
 "authorId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "revision" INTEGER NOT NULL DEFAULT 1, "supersedesId" UUID, "correctionReason" TEXT, "importBatchId" UUID,
 UNIQUE("id","organisationId"), UNIQUE("supersedesId","organisationId"),
 FOREIGN KEY("siteId","organisationId") REFERENCES "Site"("id","organisationId"),
 FOREIGN KEY("energyUseId","organisationId","siteId") REFERENCES "SiteEnergyUse"("id","organisationId","siteId"),
 FOREIGN KEY("importBatchId","organisationId","siteId") REFERENCES "PatternImportBatch"("id","organisationId","siteId"),
 FOREIGN KEY("supersedesId","organisationId") REFERENCES "OperatingPattern"("id","organisationId"),
 CHECK("validUntil">"validFrom"), CHECK("daysOnYear" BETWEEN 0 AND 366),
 CHECK("temperatureUnit" IN ('C','F','UNKNOWN')), CHECK("temperatureContext" IN ('HEATING','COOLING','OTHER','UNKNOWN')), CHECK("temperature" IS NOT NULL OR ("temperatureUnit"='UNKNOWN' AND "temperatureContext"='UNKNOWN')),
 CHECK("legacyId"='' OR length(trim("legacySource"))>0)
);
CREATE INDEX "OperatingPattern_organisationId_siteId_energyUseId_idx" ON "OperatingPattern"("organisationId","siteId","energyUseId");
CREATE UNIQUE INDEX pattern_legacy_root ON "OperatingPattern"("organisationId","legacySource","legacyId") WHERE "supersedesId" IS NULL AND "legacyId"<>'';
CREATE FUNCTION validate_pattern_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "OperatingPattern"%ROWTYPE;
BEGIN
 IF NEW."supersedesId" IS NULL THEN
  IF NEW."revision"<>1 OR NEW."correctionReason" IS NOT NULL THEN RAISE EXCEPTION 'Invalid original revision'; END IF;
 ELSE
  SELECT * INTO STRICT prior FROM "OperatingPattern" WHERE id=NEW."supersedesId";
  IF NEW."revision"<>prior."revision"+1 OR NEW."organisationId"<>prior."organisationId" OR NEW."siteId"<>prior."siteId" OR NEW."energyUseId"<>prior."energyUseId" OR NEW."legacySource"<>prior."legacySource" OR NEW."legacyId"<>prior."legacyId" OR NEW."importBatchId" IS DISTINCT FROM prior."importBatchId" OR COALESCE(length(trim(NEW."correctionReason")),0)<3 THEN RAISE EXCEPTION 'Invalid pattern lineage'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER pattern_lineage BEFORE INSERT ON "OperatingPattern" FOR EACH ROW EXECUTE FUNCTION validate_pattern_revision();
CREATE TRIGGER pattern_immutable BEFORE UPDATE OR DELETE ON "OperatingPattern" FOR EACH ROW EXECUTE FUNCTION prevent_driver_revision_changes();
CREATE TRIGGER pattern_no_truncate BEFORE TRUNCATE ON "OperatingPattern" FOR EACH STATEMENT EXECUTE FUNCTION prevent_driver_revision_changes();
