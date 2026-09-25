-- CreateTable
CREATE TABLE "AIInteraction" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "mode" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "resourceId" UUID NOT NULL,
    "promptHash" TEXT NOT NULL,
    "promptCharacters" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "resultHash" TEXT NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIInteraction_organisationId_siteId_authorId_createdAt_idx" ON "AIInteraction"("organisationId", "siteId", "authorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIInteraction_organisationId_requestKey_key" ON "AIInteraction"("organisationId", "requestKey");

-- AddForeignKey
ALTER TABLE "AIInteraction" ADD CONSTRAINT "AIInteraction_siteId_organisationId_fkey" FOREIGN KEY ("siteId", "organisationId") REFERENCES "Site"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "AIInteraction" ADD CONSTRAINT "AIInteraction_preview_check" CHECK (mode = 'EVIDENCE_PREVIEW' AND tool IN ('saved_baseline','saved_savings') AND "promptCharacters" BETWEEN 5 AND 2000 AND (result->>'mode') IS NOT DISTINCT FROM 'EVIDENCE_PREVIEW' AND (result->'usage') IS NOT DISTINCT FROM '{"provider":null,"model":null,"inputTokens":0,"outputTokens":0,"providerCalls":0,"toolCalls":1}'::jsonb);
CREATE TRIGGER ai_interaction_immutable BEFORE UPDATE OR DELETE ON "AIInteraction" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER ai_interaction_no_truncate BEFORE TRUNCATE ON "AIInteraction" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
