-- CreateTable
CREATE TABLE "Opportunity" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "meterId" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "ownerMembershipId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityEvent" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "previousId" UUID,
    "revision" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Opportunity_organisationId_siteId_createdAt_idx" ON "Opportunity"("organisationId", "siteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_id_organisationId_siteId_key" ON "Opportunity"("id", "organisationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_organisationId_requestKey_key" ON "Opportunity"("organisationId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_organisationId_runId_key" ON "Opportunity"("organisationId", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityEvent_id_opportunityId_organisationId_siteId_key" ON "OpportunityEvent"("id", "opportunityId", "organisationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityEvent_previousId_opportunityId_organisationId_si_key" ON "OpportunityEvent"("previousId", "opportunityId", "organisationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityEvent_opportunityId_revision_key" ON "OpportunityEvent"("opportunityId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityEvent_organisationId_requestKey_key" ON "OpportunityEvent"("organisationId", "requestKey");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_runId_organisationId_siteId_meterId_fkey" FOREIGN KEY ("runId", "organisationId", "siteId", "meterId") REFERENCES "AnalysisRun"("id", "organisationId", "siteId", "meterId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_ownerMembershipId_organisationId_fkey" FOREIGN KEY ("ownerMembershipId", "organisationId") REFERENCES "Membership"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityEvent" ADD CONSTRAINT "OpportunityEvent_opportunityId_organisationId_siteId_fkey" FOREIGN KEY ("opportunityId", "organisationId", "siteId") REFERENCES "Opportunity"("id", "organisationId", "siteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityEvent" ADD CONSTRAINT "OpportunityEvent_previousId_opportunityId_organisationId_s_fkey" FOREIGN KEY ("previousId", "opportunityId", "organisationId", "siteId") REFERENCES "OpportunityEvent"("id", "opportunityId", "organisationId", "siteId") ON DELETE NO ACTION ON UPDATE NO ACTION;


ALTER TABLE "OpportunityEvent" ADD CONSTRAINT "OpportunityEvent_status_check" CHECK (status IN ('DETECTED', 'REVIEWING', 'REJECTED'));
CREATE FUNCTION validate_opportunity_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "OpportunityEvent";
BEGIN
  IF NEW."previousId" IS NULL THEN
    IF NEW.revision <> 1 OR NEW.status <> 'DETECTED' THEN RAISE EXCEPTION 'Invalid initial opportunity event'; END IF;
  ELSE
    SELECT * INTO prior FROM "OpportunityEvent" WHERE id = NEW."previousId" AND "opportunityId" = NEW."opportunityId" AND "organisationId" = NEW."organisationId" AND "siteId" = NEW."siteId";
    IF NOT FOUND OR NEW.revision <> prior.revision + 1 OR NOT (
      (prior.status = 'DETECTED' AND NEW.status IN ('REVIEWING', 'REJECTED')) OR
      (prior.status = 'REVIEWING' AND NEW.status = 'REJECTED')
    ) THEN RAISE EXCEPTION 'Invalid opportunity transition'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER opportunity_event_lineage BEFORE INSERT ON "OpportunityEvent" FOR EACH ROW EXECUTE FUNCTION validate_opportunity_event();
CREATE TRIGGER opportunity_immutable BEFORE UPDATE OR DELETE ON "Opportunity" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER opportunity_no_truncate BEFORE TRUNCATE ON "Opportunity" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER opportunity_event_immutable BEFORE UPDATE OR DELETE ON "OpportunityEvent" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER opportunity_event_no_truncate BEFORE TRUNCATE ON "OpportunityEvent" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
