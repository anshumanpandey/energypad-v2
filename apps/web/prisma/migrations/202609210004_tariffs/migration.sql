-- CreateTable
CREATE TABLE "SiteEnergyUse" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fuel" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "legacySource" TEXT NOT NULL DEFAULT '',
    "fuelLegacyId" TEXT NOT NULL DEFAULT '',
    "endUseLegacyId" TEXT NOT NULL DEFAULT '',
    "associationLegacyId" TEXT NOT NULL DEFAULT '',
    "associationLegacyTable" TEXT NOT NULL DEFAULT '',
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteEnergyUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TariffVersion" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "energyUseId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "validFrom" DATE NOT NULL,
    "validUntil" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "rateUnit" TEXT NOT NULL,
    "taxBasis" TEXT NOT NULL,
    "vatPercent" DECIMAL(6,3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "legacySource" TEXT NOT NULL DEFAULT '',
    "pricingLegacyId" TEXT NOT NULL DEFAULT '',
    "bands" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" UUID,
    "correctionReason" TEXT,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TariffVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteEnergyUse_id_organisationId_siteId_key" ON "SiteEnergyUse"("id", "organisationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteEnergyUse_organisationId_siteId_code_key" ON "SiteEnergyUse"("organisationId", "siteId", "code");

-- CreateIndex
CREATE INDEX "TariffVersion_organisationId_siteId_energyUseId_idx" ON "TariffVersion"("organisationId", "siteId", "energyUseId");

-- CreateIndex
CREATE UNIQUE INDEX "TariffVersion_id_organisationId_key" ON "TariffVersion"("id", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "TariffVersion_supersedesId_organisationId_key" ON "TariffVersion"("supersedesId", "organisationId");

-- AddForeignKey
ALTER TABLE "SiteEnergyUse" ADD CONSTRAINT "SiteEnergyUse_siteId_organisationId_fkey" FOREIGN KEY ("siteId", "organisationId") REFERENCES "Site"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffVersion" ADD CONSTRAINT "TariffVersion_energyUseId_organisationId_siteId_fkey" FOREIGN KEY ("energyUseId", "organisationId", "siteId") REFERENCES "SiteEnergyUse"("id", "organisationId", "siteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TariffVersion" ADD CONSTRAINT "TariffVersion_supersedesId_organisationId_fkey" FOREIGN KEY ("supersedesId", "organisationId") REFERENCES "TariffVersion"("id", "organisationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE UNIQUE INDEX "SiteEnergyUse_legacy_association_key" ON "SiteEnergyUse"("organisationId","siteId","legacySource","associationLegacyTable","associationLegacyId") WHERE "associationLegacyId" <> '';
CREATE UNIQUE INDEX "SiteEnergyUse_legacy_use_key" ON "SiteEnergyUse"("organisationId","siteId","legacySource","fuelLegacyId","endUseLegacyId") WHERE "fuelLegacyId" <> '' AND "endUseLegacyId" <> '';
ALTER TABLE "TariffVersion" ADD CONSTRAINT "TariffVersion_validity_check" CHECK ("validUntil" > "validFrom" AND "vatPercent" BETWEEN 0 AND 100 AND "taxBasis" IN ('NET','GROSS') AND "rateUnit" IN ('kWh','MWh','m3','litre','kg'));
CREATE FUNCTION validate_tariff_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "TariffVersion"%ROWTYPE;
BEGIN
 IF NEW."supersedesId" IS NULL THEN
  IF NEW."revision" <> 1 OR NEW."correctionReason" IS NOT NULL THEN RAISE EXCEPTION 'Invalid original tariff revision'; END IF;
 ELSE
  SELECT * INTO STRICT prior FROM "TariffVersion" WHERE id=NEW."supersedesId";
  IF NEW."revision" <> prior."revision"+1 OR NEW."organisationId" <> prior."organisationId" OR NEW."siteId" <> prior."siteId" OR NEW."energyUseId" <> prior."energyUseId" OR COALESCE(length(trim(NEW."correctionReason")),0)<3 THEN RAISE EXCEPTION 'Invalid tariff correction lineage'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER tariff_lineage BEFORE INSERT ON "TariffVersion" FOR EACH ROW EXECUTE FUNCTION validate_tariff_revision();
CREATE FUNCTION prevent_tariff_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Energy use identities and tariff revisions are immutable'; END; $$;
CREATE TRIGGER tariff_immutable BEFORE UPDATE OR DELETE ON "TariffVersion" FOR EACH ROW EXECUTE FUNCTION prevent_tariff_changes();
CREATE TRIGGER tariff_no_truncate BEFORE TRUNCATE ON "TariffVersion" FOR EACH STATEMENT EXECUTE FUNCTION prevent_tariff_changes();
CREATE TRIGGER energy_use_immutable BEFORE UPDATE OR DELETE ON "SiteEnergyUse" FOR EACH ROW EXECUTE FUNCTION prevent_tariff_changes();
CREATE TRIGGER energy_use_no_truncate BEFORE TRUNCATE ON "SiteEnergyUse" FOR EACH STATEMENT EXECUTE FUNCTION prevent_tariff_changes();
