-- CreateTable
CREATE TABLE "AIGeneration" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "previewId" UUID NOT NULL,
    "promptHash" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIGenerationOutcome" (
    "id" UUID NOT NULL,
    "generationId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIGenerationOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIGeneration_organisationId_createdAt_idx" ON "AIGeneration"("organisationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIGeneration_organisationId_requestKey_key" ON "AIGeneration"("organisationId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "AIGenerationOutcome_generationId_key" ON "AIGenerationOutcome"("generationId");

-- CreateIndex
CREATE UNIQUE INDEX "AIInteraction_id_organisationId_siteId_key" ON "AIInteraction"("id", "organisationId", "siteId");

-- AddForeignKey
ALTER TABLE "AIGeneration" ADD CONSTRAINT "AIGeneration_previewId_organisationId_siteId_fkey" FOREIGN KEY ("previewId", "organisationId", "siteId") REFERENCES "AIInteraction"("id", "organisationId", "siteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIGenerationOutcome" ADD CONSTRAINT "AIGenerationOutcome_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "AIGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AIGenerationOutcome" ADD CONSTRAINT "AIOutcome_status" CHECK(status IN ('ANSWER','INSUFFICIENT','FAILED'));
CREATE TRIGGER ai_generation_immutable BEFORE UPDATE OR DELETE ON "AIGeneration" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER ai_generation_no_truncate BEFORE TRUNCATE ON "AIGeneration" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER ai_outcome_immutable BEFORE UPDATE OR DELETE ON "AIGenerationOutcome" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER ai_outcome_no_truncate BEFORE TRUNCATE ON "AIGenerationOutcome" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
