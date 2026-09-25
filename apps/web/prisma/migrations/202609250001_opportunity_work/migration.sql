-- AlterTable
ALTER TABLE "OpportunityEvent" ADD COLUMN     "workVersionId" UUID;

-- CreateTable
CREATE TABLE "OpportunityWorkVersion" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "previousId" UUID,
    "revision" INTEGER NOT NULL,
    "ownerMembershipId" UUID NOT NULL,
    "actions" JSONB NOT NULL,
    "note" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityWorkVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityWorkVersion_id_opportunityId_organisationId_site_key" ON "OpportunityWorkVersion"("id", "opportunityId", "organisationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityWorkVersion_previousId_opportunityId_organisatio_key" ON "OpportunityWorkVersion"("previousId", "opportunityId", "organisationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityWorkVersion_opportunityId_revision_key" ON "OpportunityWorkVersion"("opportunityId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityWorkVersion_organisationId_requestKey_key" ON "OpportunityWorkVersion"("organisationId", "requestKey");

-- AddForeignKey
ALTER TABLE "OpportunityEvent" ADD CONSTRAINT "OpportunityEvent_workVersionId_opportunityId_organisationI_fkey" FOREIGN KEY ("workVersionId", "opportunityId", "organisationId", "siteId") REFERENCES "OpportunityWorkVersion"("id", "opportunityId", "organisationId", "siteId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OpportunityWorkVersion" ADD CONSTRAINT "OpportunityWorkVersion_opportunityId_organisationId_siteId_fkey" FOREIGN KEY ("opportunityId", "organisationId", "siteId") REFERENCES "Opportunity"("id", "organisationId", "siteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityWorkVersion" ADD CONSTRAINT "OpportunityWorkVersion_ownerMembershipId_organisationId_fkey" FOREIGN KEY ("ownerMembershipId", "organisationId") REFERENCES "Membership"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityWorkVersion" ADD CONSTRAINT "OpportunityWorkVersion_previousId_opportunityId_organisati_fkey" FOREIGN KEY ("previousId", "opportunityId", "organisationId", "siteId") REFERENCES "OpportunityWorkVersion"("id", "opportunityId", "organisationId", "siteId") ON DELETE NO ACTION ON UPDATE NO ACTION;


ALTER TABLE "OpportunityEvent" DROP CONSTRAINT "OpportunityEvent_status_check";
ALTER TABLE "OpportunityEvent" ADD CONSTRAINT "OpportunityEvent_status_check" CHECK (status IN ('DETECTED','REVIEWING','APPROVED','IN_PROGRESS','IMPLEMENTED','REJECTED'));
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
      (prior.status = 'IN_PROGRESS' AND NEW.status IN ('IMPLEMENTED','REJECTED'))
    ) THEN RAISE EXCEPTION 'Invalid opportunity transition'; END IF;
  END IF;
  IF NEW.status IN ('APPROVED','IN_PROGRESS','IMPLEMENTED') THEN
    SELECT * INTO work FROM "OpportunityWorkVersion" WHERE id = NEW."workVersionId" AND "opportunityId" = NEW."opportunityId" AND "organisationId" = NEW."organisationId" AND "siteId" = NEW."siteId";
    IF NOT FOUND OR jsonb_array_length(work.actions) = 0 THEN RAISE EXCEPTION 'Action plan required'; END IF;
    IF NEW.status = 'IMPLEMENTED' AND EXISTS (SELECT 1 FROM jsonb_array_elements(work.actions) a WHERE a->>'status' IS DISTINCT FROM 'DONE' OR length(coalesce(a->>'completionEvidence','')) < 10) THEN RAISE EXCEPTION 'Completed action evidence required'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION validate_opportunity_work() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "OpportunityWorkVersion";
BEGIN
  IF jsonb_typeof(NEW.actions) <> 'array' THEN RAISE EXCEPTION 'Actions must be an array'; END IF;
  IF NEW."previousId" IS NULL THEN
    IF NEW.revision <> 1 THEN RAISE EXCEPTION 'Invalid initial work revision'; END IF;
  ELSE
    SELECT * INTO prior FROM "OpportunityWorkVersion" WHERE id = NEW."previousId" AND "opportunityId" = NEW."opportunityId" AND "organisationId" = NEW."organisationId" AND "siteId" = NEW."siteId";
    IF NOT FOUND OR NEW.revision <> prior.revision + 1 THEN RAISE EXCEPTION 'Invalid work lineage'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER opportunity_work_lineage BEFORE INSERT ON "OpportunityWorkVersion" FOR EACH ROW EXECUTE FUNCTION validate_opportunity_work();
CREATE TRIGGER opportunity_work_immutable BEFORE UPDATE OR DELETE ON "OpportunityWorkVersion" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER opportunity_work_no_truncate BEFORE TRUNCATE ON "OpportunityWorkVersion" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
