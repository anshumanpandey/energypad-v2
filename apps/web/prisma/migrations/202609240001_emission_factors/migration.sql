-- CreateTable
CREATE TABLE "EmissionFactorVersion" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "fuel" TEXT NOT NULL,
    "geography" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kgCO2e/kWh',
    "factor" DECIMAL(18,9) NOT NULL,
    "source" TEXT NOT NULL,
    "validFrom" DATE NOT NULL,
    "validUntil" DATE NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" UUID,
    "correctionReason" TEXT,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmissionFactorVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmissionFactorVersion_organisationId_fuel_geography_basis_idx" ON "EmissionFactorVersion"("organisationId", "fuel", "geography", "basis");

-- CreateIndex
CREATE UNIQUE INDEX "EmissionFactorVersion_id_organisationId_key" ON "EmissionFactorVersion"("id", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "EmissionFactorVersion_supersedesId_organisationId_key" ON "EmissionFactorVersion"("supersedesId", "organisationId");

-- AddForeignKey
ALTER TABLE "EmissionFactorVersion" ADD CONSTRAINT "EmissionFactorVersion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmissionFactorVersion" ADD CONSTRAINT "EmissionFactorVersion_supersedesId_organisationId_fkey" FOREIGN KEY ("supersedesId", "organisationId") REFERENCES "EmissionFactorVersion"("id", "organisationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "EmissionFactorVersion" ADD CHECK (factor >= 0 AND "validUntil" > "validFrom" AND unit = 'kgCO2e/kWh');
CREATE FUNCTION validate_emission_factor_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "EmissionFactorVersion"%ROWTYPE;
BEGIN
 PERFORM id FROM "Organisation" WHERE id=NEW."organisationId" FOR UPDATE;
 IF NEW."supersedesId" IS NULL THEN
  IF NEW.revision <> 1 OR NEW."correctionReason" IS NOT NULL THEN RAISE EXCEPTION 'Invalid original factor'; END IF;
 ELSE
  SELECT * INTO STRICT prior FROM "EmissionFactorVersion" WHERE id=NEW."supersedesId" AND "organisationId"=NEW."organisationId";
  IF NEW.revision <> prior.revision+1 OR NEW.fuel <> prior.fuel OR NEW.geography <> prior.geography OR NEW.basis <> prior.basis OR NEW.unit <> prior.unit OR COALESCE(length(trim(NEW."correctionReason")),0)<3 THEN RAISE EXCEPTION 'Invalid factor lineage'; END IF;
 END IF;
 IF EXISTS (SELECT 1 FROM "EmissionFactorVersion" f WHERE f."organisationId"=NEW."organisationId" AND f.fuel=NEW.fuel AND f.geography=NEW.geography AND f.basis=NEW.basis AND f.unit=NEW.unit AND f."validFrom"<NEW."validUntil" AND f."validUntil">NEW."validFrom" AND (NEW."supersedesId" IS NULL OR f.id<>NEW."supersedesId") AND NOT EXISTS (SELECT 1 FROM "EmissionFactorVersion" r WHERE r."supersedesId"=f.id AND r."organisationId"=f."organisationId")) THEN RAISE EXCEPTION 'Overlapping current factors'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER emission_factor_lineage BEFORE INSERT ON "EmissionFactorVersion" FOR EACH ROW EXECUTE FUNCTION validate_emission_factor_revision();
CREATE FUNCTION prevent_emission_factor_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Emission factor versions are immutable'; END; $$;
CREATE TRIGGER emission_factor_immutable BEFORE UPDATE OR DELETE ON "EmissionFactorVersion" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER emission_factor_no_truncate BEFORE TRUNCATE ON "EmissionFactorVersion" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
