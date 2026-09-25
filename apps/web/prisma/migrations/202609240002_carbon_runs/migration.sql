-- CreateTable
CREATE TABLE "CarbonRun" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "requestKey" UUID NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarbonRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarbonRun_organisationId_siteId_createdAt_idx" ON "CarbonRun"("organisationId", "siteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CarbonRun_organisationId_requestKey_key" ON "CarbonRun"("organisationId", "requestKey");

-- AddForeignKey
ALTER TABLE "CarbonRun" ADD CONSTRAINT "CarbonRun_siteId_organisationId_fkey" FOREIGN KEY ("siteId", "organisationId") REFERENCES "Site"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER carbon_run_immutable BEFORE UPDATE OR DELETE ON "CarbonRun" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER carbon_run_no_truncate BEFORE TRUNCATE ON "CarbonRun" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
