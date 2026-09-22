-- AlterTable
ALTER TABLE "ConsumptionRecord" ADD COLUMN     "energyUseId" UUID,
ADD COLUMN     "energyUseSnapshot" JSONB;

-- AlterTable
ALTER TABLE "SiteEnergyUse" ADD COLUMN     "endUseCatalogId" UUID,
ADD COLUMN     "fuelCatalogId" UUID;

-- CreateTable
CREATE TABLE "EnergyCatalogVersion" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fuel" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "legacySource" TEXT NOT NULL DEFAULT '',
    "legacyId" TEXT NOT NULL DEFAULT '',
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" UUID,
    "correctionReason" TEXT,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnergyCatalogVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnergyCatalogVersion_organisationId_kind_code_idx" ON "EnergyCatalogVersion"("organisationId", "kind", "code");

-- CreateIndex
CREATE UNIQUE INDEX "EnergyCatalogVersion_id_organisationId_key" ON "EnergyCatalogVersion"("id", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "EnergyCatalogVersion_supersedesId_organisationId_key" ON "EnergyCatalogVersion"("supersedesId", "organisationId");

-- AddForeignKey
ALTER TABLE "ConsumptionRecord" ADD CONSTRAINT "ConsumptionRecord_energyUseId_organisationId_siteId_fkey" FOREIGN KEY ("energyUseId", "organisationId", "siteId") REFERENCES "SiteEnergyUse"("id", "organisationId", "siteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteEnergyUse" ADD CONSTRAINT "SiteEnergyUse_fuelCatalogId_organisationId_fkey" FOREIGN KEY ("fuelCatalogId", "organisationId") REFERENCES "EnergyCatalogVersion"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteEnergyUse" ADD CONSTRAINT "SiteEnergyUse_endUseCatalogId_organisationId_fkey" FOREIGN KEY ("endUseCatalogId", "organisationId") REFERENCES "EnergyCatalogVersion"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergyCatalogVersion" ADD CONSTRAINT "EnergyCatalogVersion_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergyCatalogVersion" ADD CONSTRAINT "EnergyCatalogVersion_supersedesId_organisationId_fkey" FOREIGN KEY ("supersedesId", "organisationId") REFERENCES "EnergyCatalogVersion"("id", "organisationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE UNIQUE INDEX "EnergyCatalog_original_code" ON "EnergyCatalogVersion"("organisationId","kind","code") WHERE "supersedesId" IS NULL;
CREATE UNIQUE INDEX "EnergyCatalog_original_legacy" ON "EnergyCatalogVersion"("organisationId","kind","legacySource","legacyId") WHERE "supersedesId" IS NULL AND "legacyId" <> '';
ALTER TABLE "EnergyCatalogVersion" ADD CHECK ("kind" IN ('FUEL','END_USE') AND "color" ~ '^#[0-9A-F]{6}$');
CREATE FUNCTION validate_catalog_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "EnergyCatalogVersion"%ROWTYPE;
BEGIN
 IF NEW."supersedesId" IS NULL THEN
  IF NEW.revision <> 1 OR NEW."correctionReason" IS NOT NULL THEN RAISE EXCEPTION 'Invalid original catalog revision'; END IF;
 ELSE
  SELECT * INTO STRICT prior FROM "EnergyCatalogVersion" WHERE id=NEW."supersedesId";
  IF NEW.revision <> prior.revision+1 OR NEW."organisationId" <> prior."organisationId" OR NEW.kind <> prior.kind OR NEW.code <> prior.code OR NEW.fuel <> prior.fuel OR NEW."legacySource" <> prior."legacySource" OR NEW."legacyId" <> prior."legacyId" OR COALESCE(length(trim(NEW."correctionReason")),0)<3 THEN RAISE EXCEPTION 'Invalid catalog revision lineage'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER catalog_lineage BEFORE INSERT ON "EnergyCatalogVersion" FOR EACH ROW EXECUTE FUNCTION validate_catalog_revision();
CREATE TRIGGER catalog_immutable BEFORE UPDATE OR DELETE ON "EnergyCatalogVersion" FOR EACH ROW EXECUTE FUNCTION prevent_tariff_changes();
CREATE TRIGGER catalog_no_truncate BEFORE TRUNCATE ON "EnergyCatalogVersion" FOR EACH STATEMENT EXECUTE FUNCTION prevent_tariff_changes();
CREATE FUNCTION validate_site_catalog() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."fuelCatalogId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "EnergyCatalogVersion" WHERE id=NEW."fuelCatalogId" AND kind='FUEL' AND fuel=NEW.fuel AND "organisationId"=NEW."organisationId") THEN RAISE EXCEPTION 'Invalid fuel catalog reference'; END IF;
 IF NEW."endUseCatalogId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "EnergyCatalogVersion" WHERE id=NEW."endUseCatalogId" AND kind='END_USE' AND fuel=NEW.fuel AND "organisationId"=NEW."organisationId") THEN RAISE EXCEPTION 'Invalid end-use catalog reference'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER site_catalog_scope BEFORE INSERT ON "SiteEnergyUse" FOR EACH ROW EXECUTE FUNCTION validate_site_catalog();
CREATE FUNCTION validate_reading_use() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."energyUseId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "SiteEnergyUse" WHERE id=NEW."energyUseId" AND fuel=NEW.fuel AND "siteId"=NEW."siteId" AND "organisationId"=NEW."organisationId") THEN RAISE EXCEPTION 'Invalid reading end-use reference'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER reading_use_scope BEFORE INSERT ON "ConsumptionRecord" FOR EACH ROW EXECUTE FUNCTION validate_reading_use();
