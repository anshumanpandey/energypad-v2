-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "address" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMPTZ(3),
ADD COLUMN     "country" TEXT,
ADD COLUMN     "currency" CHAR(3),
ADD COLUMN     "externalLegacyId" TEXT,
ADD COLUMN     "portfolioId" UUID,
ADD COLUMN     "postCode" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "town" TEXT,
ADD COLUMN     "type" TEXT;

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteAttributeHistory" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "population" DECIMAL(14,3),
    "floorArea" DECIMAL(14,3),
    "weeklyHours" DECIMAL(7,3),
    "vatPercent" DECIMAL(6,3),
    "authorId" UUID NOT NULL,
    "importBatchId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteAttributeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meter" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fuel" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Meter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "sheets" JSONB NOT NULL,
    "mapping" JSONB,
    "result" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_id_organisationId_key" ON "Portfolio"("id", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_organisationId_name_key" ON "Portfolio"("organisationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SiteAttributeHistory_siteId_effectiveFrom_key" ON "SiteAttributeHistory"("siteId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Meter_siteId_code_key" ON "Meter"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Meter_id_organisationId_key" ON "Meter"("id", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_organisationId_fingerprint_key" ON "ImportBatch"("organisationId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_id_organisationId_key" ON "ImportBatch"("id", "organisationId");

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_portfolioId_organisationId_fkey" FOREIGN KEY ("portfolioId", "organisationId") REFERENCES "Portfolio"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAttributeHistory" ADD CONSTRAINT "SiteAttributeHistory_siteId_organisationId_fkey" FOREIGN KEY ("siteId", "organisationId") REFERENCES "Site"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAttributeHistory" ADD CONSTRAINT "SiteAttributeHistory_importBatchId_organisationId_fkey" FOREIGN KEY ("importBatchId", "organisationId") REFERENCES "ImportBatch"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meter" ADD CONSTRAINT "Meter_siteId_organisationId_fkey" FOREIGN KEY ("siteId", "organisationId") REFERENCES "Site"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "SiteAttributeHistory" ADD CONSTRAINT "site_attribute_ranges" CHECK (
 ("population" IS NULL OR "population" >= 0) AND
 ("floorArea" IS NULL OR "floorArea" >= 0) AND
 ("weeklyHours" IS NULL OR "weeklyHours" BETWEEN 0 AND 168) AND
 ("vatPercent" IS NULL OR "vatPercent" BETWEEN 0 AND 100)
);
CREATE FUNCTION prevent_site_history_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Site attribute history is append-only'; END;
$$;
CREATE TRIGGER site_history_immutable BEFORE UPDATE OR DELETE ON "SiteAttributeHistory"
FOR EACH ROW EXECUTE FUNCTION prevent_site_history_changes();
CREATE TRIGGER site_history_no_truncate BEFORE TRUNCATE ON "SiteAttributeHistory"
FOR EACH STATEMENT EXECUTE FUNCTION prevent_site_history_changes();
ALTER TABLE "ImportBatch" ADD CONSTRAINT "import_status_valid" CHECK ("status" IN ('UPLOADED','INVALID','READY','COMMITTED'));
