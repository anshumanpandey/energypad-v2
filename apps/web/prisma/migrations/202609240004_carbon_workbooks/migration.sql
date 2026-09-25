-- CreateTable
CREATE TABLE "CarbonWorkbookBatch" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "receipt" JSONB,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMPTZ(3),

    CONSTRAINT "CarbonWorkbookBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarbonWorkbookBatch_organisationId_siteId_fingerprint_idx" ON "CarbonWorkbookBatch"("organisationId", "siteId", "fingerprint");

-- AddForeignKey
ALTER TABLE "CarbonWorkbookBatch" ADD CONSTRAINT "CarbonWorkbookBatch_siteId_organisationId_fkey" FOREIGN KEY ("siteId", "organisationId") REFERENCES "Site"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CarbonWorkbookBatch" ADD CHECK (kind IN ('emissions','targets') AND status IN ('READY','INVALID','COMMITTED'));
CREATE UNIQUE INDEX carbon_workbook_committed ON "CarbonWorkbookBatch"("organisationId","siteId",fingerprint) WHERE status='COMMITTED';
CREATE FUNCTION protect_carbon_workbook() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'UPDATE' THEN RAISE EXCEPTION 'Carbon workbook evidence cannot be removed'; END IF;
 IF OLD.status <> 'READY' OR NEW.status <> 'COMMITTED' OR NEW."committedAt" IS NULL OR NEW.receipt IS NULL OR (to_jsonb(OLD)-ARRAY['status','committedAt','receipt']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['status','committedAt','receipt']) THEN RAISE EXCEPTION 'Only committing a ready batch is allowed'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER carbon_workbook_protect BEFORE UPDATE OR DELETE ON "CarbonWorkbookBatch" FOR EACH ROW EXECUTE FUNCTION protect_carbon_workbook();
CREATE TRIGGER carbon_workbook_no_truncate BEFORE TRUNCATE ON "CarbonWorkbookBatch" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
