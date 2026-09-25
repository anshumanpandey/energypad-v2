-- CreateTable
CREATE TABLE "OpportunitySupportingEvidence" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "previousId" UUID,
    "revision" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunitySupportingEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpportunitySupportingEvidence_opportunityId_createdAt_idx" ON "OpportunitySupportingEvidence"("opportunityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunitySupportingEvidence_id_opportunityId_organisation_key" ON "OpportunitySupportingEvidence"("id", "opportunityId", "organisationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunitySupportingEvidence_previousId_opportunityId_orga_key" ON "OpportunitySupportingEvidence"("previousId", "opportunityId", "organisationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunitySupportingEvidence_organisationId_requestKey_key" ON "OpportunitySupportingEvidence"("organisationId", "requestKey");

-- AddForeignKey
ALTER TABLE "OpportunitySupportingEvidence" ADD CONSTRAINT "OpportunitySupportingEvidence_opportunityId_organisationId_fkey" FOREIGN KEY ("opportunityId", "organisationId", "siteId") REFERENCES "Opportunity"("id", "organisationId", "siteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunitySupportingEvidence" ADD CONSTRAINT "OpportunitySupportingEvidence_previousId_opportunityId_org_fkey" FOREIGN KEY ("previousId", "opportunityId", "organisationId", "siteId") REFERENCES "OpportunitySupportingEvidence"("id", "opportunityId", "organisationId", "siteId") ON DELETE NO ACTION ON UPDATE NO ACTION;


ALTER TABLE "OpportunitySupportingEvidence" ADD CONSTRAINT "Supporting_kind_check" CHECK (kind IN ('LOG', 'PROGRAMME', 'TIP'));
CREATE FUNCTION validate_supporting_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "OpportunitySupportingEvidence"; stage TEXT;
BEGIN
  SELECT status INTO stage FROM "OpportunityEvent" WHERE "opportunityId" = NEW."opportunityId" AND "organisationId" = NEW."organisationId" AND "siteId" = NEW."siteId" ORDER BY revision DESC LIMIT 1;
  IF stage IS NULL OR stage IN ('VERIFIED','REJECTED') THEN RAISE EXCEPTION 'Investigation closed'; END IF;
  IF NEW."previousId" IS NULL THEN
    IF NEW.revision <> 1 THEN RAISE EXCEPTION 'Invalid initial evidence revision'; END IF;
  ELSE
    SELECT * INTO prior FROM "OpportunitySupportingEvidence" WHERE id = NEW."previousId" AND "opportunityId" = NEW."opportunityId" AND "organisationId" = NEW."organisationId" AND "siteId" = NEW."siteId";
    IF NOT FOUND OR prior.kind <> NEW.kind OR NEW.revision <> prior.revision + 1 THEN RAISE EXCEPTION 'Invalid evidence lineage'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER supporting_evidence_lineage BEFORE INSERT ON "OpportunitySupportingEvidence" FOR EACH ROW EXECUTE FUNCTION validate_supporting_evidence();
CREATE TRIGGER supporting_evidence_immutable BEFORE UPDATE OR DELETE ON "OpportunitySupportingEvidence" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER supporting_evidence_no_truncate BEFORE TRUNCATE ON "OpportunitySupportingEvidence" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
