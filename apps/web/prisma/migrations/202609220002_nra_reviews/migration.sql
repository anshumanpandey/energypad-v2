CREATE TABLE "NraReview" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL, "meterId" UUID NOT NULL,
 "runId" UUID NOT NULL, "requestId" UUID NOT NULL, "previousId" UUID, "revision" INTEGER NOT NULL,
 "decision" TEXT NOT NULL CHECK ("decision" IN ('APPROVED','REJECTED','REVOKED')),
 "reason" TEXT NOT NULL CHECK (length(trim("reason")) BETWEEN 1 AND 2000),
 "reviewerId" UUID NOT NULL REFERENCES "User"("id"), "policyVersion" TEXT NOT NULL DEFAULT 'nra-review-v1',
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE("organisationId","requestId"), UNIQUE("runId","revision"),
 FOREIGN KEY("runId","organisationId","siteId","meterId") REFERENCES "AnalysisRun"("id","organisationId","siteId","meterId")
);
CREATE FUNCTION validate_nra_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "NraReview"%ROWTYPE; source "AnalysisRun"%ROWTYPE;
BEGIN
 SELECT * INTO STRICT source FROM "AnalysisRun" WHERE id=NEW."runId";
 IF source."authorId"=NEW."reviewerId" THEN RAISE EXCEPTION 'Independent reviewer required'; END IF;
 IF source.snapshot #>> '{request,policy,nra}' IS NULL OR source.snapshot #>> '{request,policy,nra}'='NONE'
 OR jsonb_typeof(source.snapshot #> '{request,nraContext}') IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'NRA context required'; END IF;
 SELECT * INTO prior FROM "NraReview" WHERE "runId"=NEW."runId" ORDER BY revision DESC LIMIT 1;
 IF NEW."previousId" IS DISTINCT FROM prior.id OR NEW.revision<>COALESCE(prior.revision,0)+1 THEN RAISE EXCEPTION 'Stale NRA review'; END IF;
 IF NEW.decision='REVOKED' AND prior.decision IS DISTINCT FROM 'APPROVED' THEN RAISE EXCEPTION 'Only an approval may be revoked'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER nra_review_lineage BEFORE INSERT ON "NraReview" FOR EACH ROW EXECUTE FUNCTION validate_nra_review();
CREATE TRIGGER nra_review_immutable BEFORE UPDATE OR DELETE ON "NraReview" FOR EACH ROW EXECUTE FUNCTION prevent_driver_revision_changes();
CREATE TRIGGER nra_review_no_truncate BEFORE TRUNCATE ON "NraReview" FOR EACH STATEMENT EXECUTE FUNCTION prevent_driver_revision_changes();
