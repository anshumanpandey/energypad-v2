CREATE TABLE "MonthlyPlanVersion" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('TARGET','MONITORING')), month TEXT NOT NULL CHECK (month ~ '^(19|20|21)[0-9]{2}-(0[1-9]|1[0-2])$'), fuel TEXT NOT NULL, unit TEXT NOT NULL,
 payload JSONB NOT NULL, "requestKey" UUID NOT NULL, revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
 "supersedesId" UUID, "correctionReason" TEXT, "authorId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE (id,"organisationId","siteId"), UNIQUE ("supersedesId","organisationId","siteId"), UNIQUE ("organisationId","requestKey",month),
 FOREIGN KEY ("siteId","organisationId") REFERENCES "Site"(id,"organisationId") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("supersedesId","organisationId","siteId") REFERENCES "MonthlyPlanVersion"(id,"organisationId","siteId") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX monthly_plan_scope ON "MonthlyPlanVersion"("organisationId","siteId",month);
CREATE UNIQUE INDEX monthly_plan_original ON "MonthlyPlanVersion"("organisationId","siteId",kind,fuel,month,(CASE WHEN kind='TARGET' THEN unit ELSE '' END)) WHERE "supersedesId" IS NULL;
CREATE FUNCTION validate_monthly_plan() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "MonthlyPlanVersion"; use_entry JSONB;
BEGIN
 PERFORM 1 FROM "Organisation" WHERE id=NEW."organisationId" FOR UPDATE;
 IF NEW."supersedesId" IS NOT NULL THEN
  SELECT * INTO prior FROM "MonthlyPlanVersion" WHERE id=NEW."supersedesId" AND "organisationId"=NEW."organisationId" AND "siteId"=NEW."siteId";
  IF NOT FOUND OR (prior.kind,prior.fuel,prior.month,prior.unit) IS DISTINCT FROM (NEW.kind,NEW.fuel,NEW.month,NEW.unit) OR NEW.revision<>prior.revision+1 OR length(trim(coalesce(NEW."correctionReason",'')))<3 THEN RAISE EXCEPTION 'Invalid monthly plan correction'; END IF;
 ELSE
  IF NEW.revision<>1 OR NEW."correctionReason" IS NOT NULL THEN RAISE EXCEPTION 'Invalid original monthly plan'; END IF;
 END IF;
 FOR use_entry IN SELECT * FROM jsonb_array_elements(NEW.payload->'energyUses') LOOP
  IF NOT EXISTS (SELECT 1 FROM "SiteEnergyUse" WHERE id=(use_entry->>'id')::uuid AND "organisationId"=NEW."organisationId" AND "siteId"=NEW."siteId" AND fuel=NEW.fuel) THEN RAISE EXCEPTION 'Invalid monthly plan end-use scope'; END IF;
 END LOOP;
 RETURN NEW;
END; $$;
CREATE TRIGGER monthly_plan_validate BEFORE INSERT ON "MonthlyPlanVersion" FOR EACH ROW EXECUTE FUNCTION validate_monthly_plan();
CREATE TRIGGER monthly_plan_immutable BEFORE UPDATE OR DELETE ON "MonthlyPlanVersion" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER monthly_plan_no_truncate BEFORE TRUNCATE ON "MonthlyPlanVersion" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
ALTER TABLE "CarbonWorkbookBatch" DROP CONSTRAINT "CarbonWorkbookBatch_check";
ALTER TABLE "CarbonWorkbookBatch" ADD CHECK (kind IN ('emissions','targets','monthlyTargets','monitoring') AND status IN ('READY','INVALID','COMMITTED'));
