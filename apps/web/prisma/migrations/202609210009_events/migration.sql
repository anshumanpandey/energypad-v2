CREATE TABLE "EventImportBatch" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL,
 "fingerprint" TEXT NOT NULL, "result" JSONB NOT NULL, "status" TEXT NOT NULL,
 "createdBy" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "committedAt" TIMESTAMPTZ(3),
 UNIQUE("id","organisationId","siteId"), UNIQUE("siteId","fingerprint"),
 FOREIGN KEY("siteId","organisationId") REFERENCES "Site"("id","organisationId")
);
CREATE TABLE "OperationalEvent" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL, "energyUseId" UUID NOT NULL,
 "validFrom" DATE NOT NULL, "validUntil" DATE NOT NULL, "eventCode" TEXT NOT NULL, "operation" TEXT NOT NULL, "comments" TEXT NOT NULL,
 "source" TEXT NOT NULL, "legacySource" TEXT NOT NULL DEFAULT '', "legacyId" TEXT NOT NULL DEFAULT '',
 "authorId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "revision" INTEGER NOT NULL DEFAULT 1, "supersedesId" UUID, "correctionReason" TEXT, "importBatchId" UUID,
 UNIQUE("id","organisationId"), UNIQUE("supersedesId","organisationId"),
 FOREIGN KEY("siteId","organisationId") REFERENCES "Site"("id","organisationId"),
 FOREIGN KEY("energyUseId","organisationId","siteId") REFERENCES "SiteEnergyUse"("id","organisationId","siteId"),
 FOREIGN KEY("importBatchId","organisationId","siteId") REFERENCES "EventImportBatch"("id","organisationId","siteId"),
 FOREIGN KEY("supersedesId","organisationId") REFERENCES "OperationalEvent"("id","organisationId"),
 CHECK("validUntil">"validFrom"), CHECK(length(trim("operation")) BETWEEN 1 AND 500), CHECK(length("comments")<=4000),
 CHECK("legacyId"='' OR length(trim("legacySource"))>0)
);
CREATE INDEX "OperationalEvent_organisationId_siteId_energyUseId_idx" ON "OperationalEvent"("organisationId","siteId","energyUseId");
CREATE UNIQUE INDEX event_legacy_root ON "OperationalEvent"("organisationId","legacySource","legacyId") WHERE "supersedesId" IS NULL AND "legacyId"<>'';
CREATE FUNCTION validate_event_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "OperationalEvent"%ROWTYPE;
BEGIN
 IF NEW."supersedesId" IS NULL THEN
  IF NEW."revision"<>1 OR NEW."correctionReason" IS NOT NULL THEN RAISE EXCEPTION 'Invalid original revision'; END IF;
 ELSE
  SELECT * INTO STRICT prior FROM "OperationalEvent" WHERE id=NEW."supersedesId";
  IF NEW."revision"<>prior."revision"+1 OR NEW."organisationId"<>prior."organisationId" OR NEW."siteId"<>prior."siteId" OR NEW."energyUseId"<>prior."energyUseId" OR NEW."eventCode"<>prior."eventCode" OR NEW."legacySource"<>prior."legacySource" OR NEW."legacyId"<>prior."legacyId" OR NEW."importBatchId" IS DISTINCT FROM prior."importBatchId" OR COALESCE(length(trim(NEW."correctionReason")),0)<3 THEN RAISE EXCEPTION 'Invalid event lineage'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER event_lineage BEFORE INSERT ON "OperationalEvent" FOR EACH ROW EXECUTE FUNCTION validate_event_revision();
CREATE TRIGGER event_immutable BEFORE UPDATE OR DELETE ON "OperationalEvent" FOR EACH ROW EXECUTE FUNCTION prevent_driver_revision_changes();
CREATE TRIGGER event_no_truncate BEFORE TRUNCATE ON "OperationalEvent" FOR EACH STATEMENT EXECUTE FUNCTION prevent_driver_revision_changes();

CREATE UNIQUE INDEX event_code_root ON "OperationalEvent"("siteId","eventCode") WHERE "supersedesId" IS NULL;
