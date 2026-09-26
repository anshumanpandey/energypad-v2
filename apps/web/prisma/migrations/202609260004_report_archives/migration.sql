-- CreateTable
CREATE TABLE "ReportArchive" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "family" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "report" JSONB NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportArchive_organisationId_siteId_createdAt_id_idx" ON "ReportArchive"("organisationId", "siteId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReportArchive_organisationId_requestKey_key" ON "ReportArchive"("organisationId", "requestKey");

-- AddForeignKey
ALTER TABLE "ReportArchive" ADD CONSTRAINT "ReportArchive_siteId_organisationId_fkey" FOREIGN KEY ("siteId", "organisationId") REFERENCES "Site"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReportArchive" ADD CONSTRAINT report_archive_evidence CHECK (
 family IN ('energy','baseline','savings') AND fingerprint ~ '^[a-f0-9]{64}$' AND "requestHash" ~ '^[a-f0-9]{64}$' AND
 jsonb_typeof(report) = 'object' AND report->>'organisationId' IS NOT DISTINCT FROM "organisationId"::text AND
 report->>'siteId' IS NOT DISTINCT FROM "siteId"::text AND report->>'family' IS NOT DISTINCT FROM family
);
CREATE TRIGGER report_archive_immutable BEFORE UPDATE OR DELETE ON "ReportArchive" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER report_archive_no_truncate BEFORE TRUNCATE ON "ReportArchive" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
