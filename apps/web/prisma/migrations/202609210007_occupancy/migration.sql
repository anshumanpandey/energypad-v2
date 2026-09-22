CREATE TABLE "OccupancyImportBatch" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL,
 "fingerprint" TEXT NOT NULL, "result" JSONB NOT NULL, "status" TEXT NOT NULL,
 "createdBy" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "committedAt" TIMESTAMPTZ(3),
 UNIQUE("id","organisationId","siteId"), UNIQUE("siteId","fingerprint"),
 FOREIGN KEY("siteId","organisationId") REFERENCES "Site"("id","organisationId")
);
CREATE TABLE "OccupancyObservation" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL, "energyUseId" UUID NOT NULL,
 "validFrom" DATE NOT NULL, "validUntil" DATE NOT NULL, "regularCount" INTEGER, "irregularCount" INTEGER,
 "source" TEXT NOT NULL, "legacySource" TEXT NOT NULL DEFAULT '', "legacyId" TEXT NOT NULL DEFAULT '',
 "authorId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "revision" INTEGER NOT NULL DEFAULT 1, "supersedesId" UUID, "correctionReason" TEXT, "importBatchId" UUID,
 UNIQUE("id","organisationId"), UNIQUE("supersedesId","organisationId"),
 FOREIGN KEY("siteId","organisationId") REFERENCES "Site"("id","organisationId"),
 FOREIGN KEY("energyUseId","organisationId","siteId") REFERENCES "SiteEnergyUse"("id","organisationId","siteId"),
 FOREIGN KEY("importBatchId","organisationId","siteId") REFERENCES "OccupancyImportBatch"("id","organisationId","siteId"),
 FOREIGN KEY("supersedesId","organisationId") REFERENCES "OccupancyObservation"("id","organisationId"),
 CHECK("validUntil">"validFrom"), CHECK("regularCount" IS NOT NULL OR "irregularCount" IS NOT NULL),
 CHECK("regularCount" BETWEEN 0 AND 999999999), CHECK("irregularCount" BETWEEN 0 AND 999999999),
 CHECK("legacyId"='' OR length(trim("legacySource"))>0)
);
CREATE INDEX "OccupancyObservation_organisationId_siteId_energyUseId_idx" ON "OccupancyObservation"("organisationId","siteId","energyUseId");
CREATE UNIQUE INDEX occupancy_legacy_root ON "OccupancyObservation"("organisationId","legacySource","legacyId") WHERE "supersedesId" IS NULL AND "legacyId"<>'';
CREATE FUNCTION validate_occupancy_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "OccupancyObservation"%ROWTYPE;
BEGIN
 IF NEW."supersedesId" IS NULL THEN
  IF NEW."revision"<>1 OR NEW."correctionReason" IS NOT NULL THEN RAISE EXCEPTION 'Invalid original revision'; END IF;
 ELSE
  SELECT * INTO STRICT prior FROM "OccupancyObservation" WHERE id=NEW."supersedesId";
  IF NEW."revision"<>prior."revision"+1 OR NEW."organisationId"<>prior."organisationId" OR NEW."siteId"<>prior."siteId" OR NEW."energyUseId"<>prior."energyUseId" OR NEW."validFrom"<>prior."validFrom" OR NEW."validUntil"<>prior."validUntil" OR NEW."legacySource"<>prior."legacySource" OR NEW."legacyId"<>prior."legacyId" OR NEW."importBatchId" IS DISTINCT FROM prior."importBatchId" OR COALESCE(length(trim(NEW."correctionReason")),0)<3 THEN RAISE EXCEPTION 'Invalid occupancy lineage'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER occupancy_lineage BEFORE INSERT ON "OccupancyObservation" FOR EACH ROW EXECUTE FUNCTION validate_occupancy_revision();
CREATE TRIGGER occupancy_immutable BEFORE UPDATE OR DELETE ON "OccupancyObservation" FOR EACH ROW EXECUTE FUNCTION prevent_driver_revision_changes();
CREATE TRIGGER occupancy_no_truncate BEFORE TRUNCATE ON "OccupancyObservation" FOR EACH STATEMENT EXECUTE FUNCTION prevent_driver_revision_changes();
