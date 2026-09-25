-- CreateTable
CREATE TABLE "CarbonTargetVersion" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "meterId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "geography" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "limitKgCO2e" DECIMAL(30,12) NOT NULL,
    "source" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" UUID,
    "correctionReason" TEXT,
    "requestKey" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarbonTargetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarbonTargetAssessment" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "actualKgCO2e" TEXT NOT NULL,
    "varianceKgCO2e" TEXT NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarbonTargetAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarbonTargetVersion_organisationId_siteId_idx" ON "CarbonTargetVersion"("organisationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "CarbonTargetVersion_id_organisationId_siteId_key" ON "CarbonTargetVersion"("id", "organisationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "CarbonTargetVersion_supersedesId_organisationId_siteId_key" ON "CarbonTargetVersion"("supersedesId", "organisationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "CarbonTargetVersion_organisationId_requestKey_key" ON "CarbonTargetVersion"("organisationId", "requestKey");

-- CreateIndex
CREATE INDEX "CarbonTargetAssessment_organisationId_siteId_idx" ON "CarbonTargetAssessment"("organisationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "CarbonTargetAssessment_targetId_runId_key" ON "CarbonTargetAssessment"("targetId", "runId");

-- CreateIndex
CREATE UNIQUE INDEX "CarbonRun_id_organisationId_siteId_key" ON "CarbonRun"("id", "organisationId", "siteId");

-- AddForeignKey
ALTER TABLE "CarbonTargetVersion" ADD CONSTRAINT "CarbonTargetVersion_meterId_siteId_organisationId_fkey" FOREIGN KEY ("meterId", "siteId", "organisationId") REFERENCES "Meter"("id", "siteId", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarbonTargetVersion" ADD CONSTRAINT "CarbonTargetVersion_supersedesId_organisationId_siteId_fkey" FOREIGN KEY ("supersedesId", "organisationId", "siteId") REFERENCES "CarbonTargetVersion"("id", "organisationId", "siteId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CarbonTargetAssessment" ADD CONSTRAINT "CarbonTargetAssessment_targetId_organisationId_siteId_fkey" FOREIGN KEY ("targetId", "organisationId", "siteId") REFERENCES "CarbonTargetVersion"("id", "organisationId", "siteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarbonTargetAssessment" ADD CONSTRAINT "CarbonTargetAssessment_runId_organisationId_siteId_fkey" FOREIGN KEY ("runId", "organisationId", "siteId") REFERENCES "CarbonRun"("id", "organisationId", "siteId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CarbonTargetVersion" ADD CHECK ("limitKgCO2e" >= 0 AND year BETWEEN 1900 AND 2199);
CREATE UNIQUE INDEX carbon_target_identity ON "CarbonTargetVersion"("organisationId", "siteId", "meterId", year, geography, basis) WHERE "supersedesId" IS NULL;
CREATE FUNCTION validate_carbon_target_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "CarbonTargetVersion"%ROWTYPE;
BEGIN
 IF NEW."supersedesId" IS NULL THEN
  IF NEW.revision <> 1 OR NEW."correctionReason" IS NOT NULL THEN RAISE EXCEPTION 'Invalid original target'; END IF;
 ELSE
  SELECT * INTO STRICT prior FROM "CarbonTargetVersion" WHERE id=NEW."supersedesId" AND "organisationId"=NEW."organisationId" AND "siteId"=NEW."siteId";
  IF NEW.revision <> prior.revision+1 OR NEW."meterId" <> prior."meterId" OR NEW.year <> prior.year OR NEW.geography <> prior.geography OR NEW.basis <> prior.basis OR COALESCE(length(trim(NEW."correctionReason")),0)<3 THEN RAISE EXCEPTION 'Invalid target lineage'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER carbon_target_lineage BEFORE INSERT ON "CarbonTargetVersion" FOR EACH ROW EXECUTE FUNCTION validate_carbon_target_revision();
CREATE TRIGGER carbon_target_immutable BEFORE UPDATE OR DELETE ON "CarbonTargetVersion" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER carbon_target_no_truncate BEFORE TRUNCATE ON "CarbonTargetVersion" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER carbon_assessment_immutable BEFORE UPDATE OR DELETE ON "CarbonTargetAssessment" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER carbon_assessment_no_truncate BEFORE TRUNCATE ON "CarbonTargetAssessment" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
ALTER TABLE "CarbonTargetAssessment" ADD CHECK (status IN ('MET','EXCEEDED'));
