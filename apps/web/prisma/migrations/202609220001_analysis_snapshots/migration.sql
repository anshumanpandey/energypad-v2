CREATE TABLE "BaselineVersion" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL, "meterId" UUID NOT NULL, "energyUseId" UUID,
 "supersedesId" UUID, "revision" INTEGER NOT NULL DEFAULT 1, "inputHash" TEXT NOT NULL,
 "snapshot" JSONB NOT NULL, "fit" JSONB NOT NULL, "compatibility" TEXT NOT NULL DEFAULT 'UNVALIDATED',
 "authorId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("id","organisationId","siteId","meterId"), UNIQUE("supersedesId","organisationId","siteId","meterId"), UNIQUE("organisationId","inputHash"),
 FOREIGN KEY("meterId","siteId","organisationId") REFERENCES "Meter"("id","siteId","organisationId"),
 FOREIGN KEY("energyUseId","organisationId","siteId") REFERENCES "SiteEnergyUse"("id","organisationId","siteId"),
 FOREIGN KEY("supersedesId","organisationId","siteId","meterId") REFERENCES "BaselineVersion"("id","organisationId","siteId","meterId"),
 CHECK("compatibility"='UNVALIDATED'), CHECK("inputHash" ~ '^[0-9a-f]{64}$')
);
CREATE TABLE "AnalysisRun" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL, "meterId" UUID NOT NULL, "baselineId" UUID NOT NULL,
 "inputHash" TEXT NOT NULL, "snapshot" JSONB NOT NULL, "compatibility" TEXT NOT NULL DEFAULT 'UNVALIDATED',
 "authorId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("id","organisationId","siteId","meterId"), UNIQUE("organisationId","inputHash"),
 FOREIGN KEY("baselineId","organisationId","siteId","meterId") REFERENCES "BaselineVersion"("id","organisationId","siteId","meterId"),
 CHECK("compatibility"='UNVALIDATED'), CHECK("inputHash" ~ '^[0-9a-f]{64}$')
);
CREATE TABLE "AnalysisResult" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL, "meterId" UUID NOT NULL, "runId" UUID NOT NULL, "output" JSONB NOT NULL,
 UNIQUE("runId","organisationId","siteId","meterId"),
 FOREIGN KEY("runId","organisationId","siteId","meterId") REFERENCES "AnalysisRun"("id","organisationId","siteId","meterId")
);
CREATE FUNCTION validate_baseline_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "BaselineVersion"%ROWTYPE;
BEGIN
 IF NEW."supersedesId" IS NULL THEN
  IF NEW."revision"<>1 THEN RAISE EXCEPTION 'Invalid initial baseline revision'; END IF;
 ELSE
  SELECT * INTO STRICT prior FROM "BaselineVersion" WHERE id=NEW."supersedesId";
  IF NEW."revision"<>prior."revision"+1 OR NEW."energyUseId" IS DISTINCT FROM prior."energyUseId" THEN RAISE EXCEPTION 'Invalid baseline lineage'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER baseline_lineage BEFORE INSERT ON "BaselineVersion" FOR EACH ROW EXECUTE FUNCTION validate_baseline_revision();
CREATE TRIGGER baseline_immutable BEFORE UPDATE OR DELETE ON "BaselineVersion" FOR EACH ROW EXECUTE FUNCTION prevent_driver_revision_changes();
CREATE TRIGGER baseline_no_truncate BEFORE TRUNCATE ON "BaselineVersion" FOR EACH STATEMENT EXECUTE FUNCTION prevent_driver_revision_changes();
CREATE TRIGGER analysis_run_immutable BEFORE UPDATE OR DELETE ON "AnalysisRun" FOR EACH ROW EXECUTE FUNCTION prevent_driver_revision_changes();
CREATE TRIGGER analysis_run_no_truncate BEFORE TRUNCATE ON "AnalysisRun" FOR EACH STATEMENT EXECUTE FUNCTION prevent_driver_revision_changes();
CREATE TRIGGER analysis_result_immutable BEFORE UPDATE OR DELETE ON "AnalysisResult" FOR EACH ROW EXECUTE FUNCTION prevent_driver_revision_changes();
CREATE TRIGGER analysis_result_no_truncate BEFORE TRUNCATE ON "AnalysisResult" FOR EACH STATEMENT EXECUTE FUNCTION prevent_driver_revision_changes();
