-- AlterTable
ALTER TABLE "OpportunityEvent" ADD COLUMN     "verificationId" UUID;

-- CreateTable
CREATE TABLE "OpportunityVerification" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "meterId" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "workVersionId" UUID NOT NULL,
    "previousId" UUID,
    "revision" INTEGER NOT NULL,
    "implementationDate" DATE NOT NULL,
    "note" TEXT NOT NULL,
    "references" JSONB NOT NULL,
    "report" JSONB NOT NULL,
    "reportHash" TEXT NOT NULL,
    "eligibility" JSONB NOT NULL,
    "authorId" UUID NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityVerification_id_opportunityId_organisationId_sit_key" ON "OpportunityVerification"("id", "opportunityId", "organisationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityVerification_previousId_opportunityId_organisati_key" ON "OpportunityVerification"("previousId", "opportunityId", "organisationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityVerification_opportunityId_revision_key" ON "OpportunityVerification"("opportunityId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityVerification_organisationId_requestKey_key" ON "OpportunityVerification"("organisationId", "requestKey");

-- AddForeignKey
ALTER TABLE "OpportunityEvent" ADD CONSTRAINT "OpportunityEvent_verificationId_opportunityId_organisation_fkey" FOREIGN KEY ("verificationId", "opportunityId", "organisationId", "siteId") REFERENCES "OpportunityVerification"("id", "opportunityId", "organisationId", "siteId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OpportunityVerification" ADD CONSTRAINT "OpportunityVerification_opportunityId_organisationId_siteI_fkey" FOREIGN KEY ("opportunityId", "organisationId", "siteId") REFERENCES "Opportunity"("id", "organisationId", "siteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityVerification" ADD CONSTRAINT "OpportunityVerification_runId_organisationId_siteId_meterI_fkey" FOREIGN KEY ("runId", "organisationId", "siteId", "meterId") REFERENCES "AnalysisRun"("id", "organisationId", "siteId", "meterId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityVerification" ADD CONSTRAINT "OpportunityVerification_workVersionId_opportunityId_organi_fkey" FOREIGN KEY ("workVersionId", "opportunityId", "organisationId", "siteId") REFERENCES "OpportunityWorkVersion"("id", "opportunityId", "organisationId", "siteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityVerification" ADD CONSTRAINT "OpportunityVerification_previousId_opportunityId_organisat_fkey" FOREIGN KEY ("previousId", "opportunityId", "organisationId", "siteId") REFERENCES "OpportunityVerification"("id", "opportunityId", "organisationId", "siteId") ON DELETE NO ACTION ON UPDATE NO ACTION;


ALTER TABLE "OpportunityEvent" DROP CONSTRAINT "OpportunityEvent_status_check";
ALTER TABLE "OpportunityEvent" ADD CONSTRAINT "OpportunityEvent_status_check" CHECK (status IN ('DETECTED','REVIEWING','APPROVED','IN_PROGRESS','IMPLEMENTED','VERIFICATION','VERIFIED','REJECTED'));
CREATE OR REPLACE FUNCTION validate_opportunity_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "OpportunityEvent"; work "OpportunityWorkVersion";
BEGIN
  IF NEW."previousId" IS NULL THEN
    IF NEW.revision <> 1 OR NEW.status <> 'DETECTED' THEN RAISE EXCEPTION 'Invalid initial opportunity event'; END IF;
  ELSE
    SELECT * INTO prior FROM "OpportunityEvent" WHERE id = NEW."previousId" AND "opportunityId" = NEW."opportunityId" AND "organisationId" = NEW."organisationId" AND "siteId" = NEW."siteId";
    IF NOT FOUND OR NEW.revision <> prior.revision + 1 OR NOT (
      (prior.status = 'DETECTED' AND NEW.status IN ('REVIEWING','REJECTED')) OR
      (prior.status = 'REVIEWING' AND NEW.status IN ('APPROVED','REJECTED')) OR
      (prior.status = 'APPROVED' AND NEW.status IN ('IN_PROGRESS','REJECTED')) OR
      (prior.status = 'IN_PROGRESS' AND NEW.status IN ('IMPLEMENTED','REJECTED')) OR
      (prior.status = 'IMPLEMENTED' AND NEW.status = 'VERIFICATION') OR
      (prior.status = 'VERIFICATION' AND NEW.status IN ('VERIFICATION','VERIFIED','REJECTED'))
    ) THEN RAISE EXCEPTION 'Invalid opportunity transition'; END IF;
  END IF;
  IF NEW.status IN ('APPROVED','IN_PROGRESS','IMPLEMENTED') THEN
    SELECT * INTO work FROM "OpportunityWorkVersion" WHERE id = NEW."workVersionId" AND "opportunityId" = NEW."opportunityId" AND "organisationId" = NEW."organisationId" AND "siteId" = NEW."siteId";
    IF NOT FOUND OR jsonb_array_length(work.actions) = 0 THEN RAISE EXCEPTION 'Action plan required'; END IF;
    IF NEW.status = 'IMPLEMENTED' AND EXISTS (SELECT 1 FROM jsonb_array_elements(work.actions) a WHERE a->>'status' IS DISTINCT FROM 'DONE' OR length(coalesce(a->>'completionEvidence','')) < 10) THEN RAISE EXCEPTION 'Completed action evidence required'; END IF;
  END IF;
  IF NEW.status = 'VERIFIED' THEN RAISE EXCEPTION 'Methodological approval is required before verified savings'; END IF;
  IF NEW.status = 'VERIFICATION' OR prior.status = 'VERIFICATION' THEN
    IF NEW."verificationId" IS NULL OR NOT EXISTS (
      SELECT 1 FROM "OpportunityVerification" v WHERE v.id = NEW."verificationId" AND v."opportunityId" = NEW."opportunityId"
        AND v."organisationId" = NEW."organisationId" AND v."siteId" = NEW."siteId" AND v."workVersionId" = NEW."workVersionId"
    ) THEN RAISE EXCEPTION 'Scoped verification evidence required'; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION validate_opportunity_verification() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "OpportunityVerification"; stage TEXT;
BEGIN
  SELECT status INTO stage FROM "OpportunityEvent" WHERE "opportunityId" = NEW."opportunityId" AND "organisationId" = NEW."organisationId" AND "siteId" = NEW."siteId" ORDER BY revision DESC LIMIT 1;
  IF stage IS NULL OR stage NOT IN ('IMPLEMENTED','VERIFICATION') THEN RAISE EXCEPTION 'Implementation required before verification'; END IF;
  IF NEW."previousId" IS NULL THEN
    IF NEW.revision <> 1 THEN RAISE EXCEPTION 'Invalid initial verification revision'; END IF;
  ELSE
    SELECT * INTO prior FROM "OpportunityVerification" WHERE id = NEW."previousId" AND "opportunityId" = NEW."opportunityId" AND "organisationId" = NEW."organisationId" AND "siteId" = NEW."siteId";
    IF NOT FOUND OR NEW.revision <> prior.revision + 1 THEN RAISE EXCEPTION 'Invalid verification lineage'; END IF;
  END IF;
  IF NEW.eligibility->>'status' IS DISTINCT FROM 'BLOCKED' THEN RAISE EXCEPTION 'Verification methodology is not approved'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER opportunity_verification_lineage BEFORE INSERT ON "OpportunityVerification" FOR EACH ROW EXECUTE FUNCTION validate_opportunity_verification();
CREATE TRIGGER opportunity_verification_immutable BEFORE UPDATE OR DELETE ON "OpportunityVerification" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER opportunity_verification_no_truncate BEFORE TRUNCATE ON "OpportunityVerification" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
