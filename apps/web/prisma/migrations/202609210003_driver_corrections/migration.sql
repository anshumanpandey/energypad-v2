ALTER TABLE "DriverObservation" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "supersedesId" UUID, ADD COLUMN "correctionReason" TEXT;
CREATE UNIQUE INDEX "DriverObservation_id_organisationId_key" ON "DriverObservation"("id","organisationId");
CREATE UNIQUE INDEX "DriverObservation_supersedesId_organisationId_key" ON "DriverObservation"("supersedesId","organisationId");
ALTER TABLE "DriverObservation" ADD FOREIGN KEY ("supersedesId","organisationId") REFERENCES "DriverObservation"("id","organisationId");
CREATE FUNCTION validate_observation_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "DriverObservation"%ROWTYPE;
BEGIN
 IF NEW."supersedesId" IS NULL THEN
  IF NEW."revision" <> 1 OR NEW."correctionReason" IS NOT NULL THEN RAISE EXCEPTION 'Invalid original revision'; END IF;
 ELSE
  SELECT * INTO STRICT prior FROM "DriverObservation" WHERE id=NEW."supersedesId";
  IF NEW."revision" <> prior."revision"+1 OR NEW."organisationId" <> prior."organisationId" OR NEW."siteId" <> prior."siteId" OR COALESCE(length(trim(NEW."correctionReason")),0)<3 OR NEW."month" <> prior."month" OR NEW."driver" <> prior."driver" OR NEW."importBatchId" IS DISTINCT FROM prior."importBatchId" THEN RAISE EXCEPTION 'Invalid correction lineage'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER observation_lineage BEFORE INSERT ON "DriverObservation" FOR EACH ROW EXECUTE FUNCTION validate_observation_revision();
ALTER TABLE "OperatingSchedule" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "supersedesId" UUID, ADD COLUMN "correctionReason" TEXT;
CREATE UNIQUE INDEX "OperatingSchedule_id_organisationId_key" ON "OperatingSchedule"("id","organisationId");
CREATE UNIQUE INDEX "OperatingSchedule_supersedesId_organisationId_key" ON "OperatingSchedule"("supersedesId","organisationId");
ALTER TABLE "OperatingSchedule" ADD FOREIGN KEY ("supersedesId","organisationId") REFERENCES "OperatingSchedule"("id","organisationId");
CREATE FUNCTION validate_schedule_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "OperatingSchedule"%ROWTYPE;
BEGIN
 IF NEW."supersedesId" IS NULL THEN
  IF NEW."revision" <> 1 OR NEW."correctionReason" IS NOT NULL THEN RAISE EXCEPTION 'Invalid original revision'; END IF;
 ELSE
  SELECT * INTO STRICT prior FROM "OperatingSchedule" WHERE id=NEW."supersedesId";
  IF NEW."revision" <> prior."revision"+1 OR NEW."organisationId" <> prior."organisationId" OR NEW."siteId" <> prior."siteId" OR COALESCE(length(trim(NEW."correctionReason")),0)<3 THEN RAISE EXCEPTION 'Invalid correction lineage'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER schedule_lineage BEFORE INSERT ON "OperatingSchedule" FOR EACH ROW EXECUTE FUNCTION validate_schedule_revision();
DROP INDEX "DriverObservation_siteId_month_driver_key";
CREATE UNIQUE INDEX "DriverObservation_original_month_key" ON "DriverObservation"("siteId","month","driver") WHERE "supersedesId" IS NULL;
CREATE FUNCTION prevent_driver_revision_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Driver revisions are immutable; create a correction'; END; $$;
CREATE TRIGGER observation_immutable BEFORE UPDATE OR DELETE ON "DriverObservation" FOR EACH ROW EXECUTE FUNCTION prevent_driver_revision_changes();
CREATE TRIGGER observation_no_truncate BEFORE TRUNCATE ON "DriverObservation" FOR EACH STATEMENT EXECUTE FUNCTION prevent_driver_revision_changes();
CREATE TRIGGER schedule_immutable BEFORE UPDATE OR DELETE ON "OperatingSchedule" FOR EACH ROW EXECUTE FUNCTION prevent_driver_revision_changes();
CREATE TRIGGER schedule_no_truncate BEFORE TRUNCATE ON "OperatingSchedule" FOR EACH STATEMENT EXECUTE FUNCTION prevent_driver_revision_changes();
