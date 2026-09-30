ALTER TABLE "EmissionFactorVersion" ADD COLUMN "siteId" UUID;
ALTER TABLE "EmissionFactorVersion" ADD CONSTRAINT "EmissionFactorVersion_siteId_organisationId_fkey" FOREIGN KEY ("siteId", "organisationId") REFERENCES "Site"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE OR REPLACE FUNCTION validate_emission_factor_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "EmissionFactorVersion"%ROWTYPE;
BEGIN
 PERFORM id FROM "Organisation" WHERE id=NEW."organisationId" FOR UPDATE;
 IF NEW."supersedesId" IS NULL THEN
  IF NEW.revision <> 1 OR NEW."correctionReason" IS NOT NULL THEN RAISE EXCEPTION 'Invalid original factor'; END IF;
 ELSE
  SELECT * INTO STRICT prior FROM "EmissionFactorVersion" WHERE id=NEW."supersedesId" AND "organisationId"=NEW."organisationId";
  IF NEW.revision <> prior.revision+1 OR NEW.fuel <> prior.fuel OR NEW.geography <> prior.geography OR NEW.basis <> prior.basis OR NEW.unit <> prior.unit OR NEW."siteId" IS DISTINCT FROM prior."siteId" OR COALESCE(length(trim(NEW."correctionReason")),0)<3 THEN RAISE EXCEPTION 'Invalid factor lineage'; END IF;
 END IF;
 IF EXISTS (SELECT 1 FROM "EmissionFactorVersion" f WHERE f."organisationId"=NEW."organisationId" AND f.fuel=NEW.fuel AND (f."siteId" IS NULL OR NEW."siteId" IS NULL OR f."siteId"=NEW."siteId") AND f.geography=NEW.geography AND f.basis=NEW.basis AND f.unit=NEW.unit AND f."validFrom"<NEW."validUntil" AND f."validUntil">NEW."validFrom" AND (NEW."supersedesId" IS NULL OR f.id<>NEW."supersedesId") AND NOT EXISTS (SELECT 1 FROM "EmissionFactorVersion" r WHERE r."supersedesId"=f.id AND r."organisationId"=f."organisationId")) THEN RAISE EXCEPTION 'Overlapping current factors'; END IF;
 RETURN NEW;
END; $$;
