-- CreateTable
CREATE TABLE "ReportDeliveryCheck" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "attempt" INTEGER NOT NULL,
    "requestKey" UUID NOT NULL,
    "token" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CHECKING',
    "code" TEXT,
    "leaseUntil" TIMESTAMPTZ(3) NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ReportDeliveryCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportDeliveryCheck_token_key" ON "ReportDeliveryCheck"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ReportDeliveryCheck_jobId_attempt_key" ON "ReportDeliveryCheck"("jobId", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportDeliveryCheck_jobId_requestKey_key" ON "ReportDeliveryCheck"("jobId", "requestKey");

-- AddForeignKey
ALTER TABLE "ReportDeliveryCheck" ADD CONSTRAINT "ReportDeliveryCheck_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ReportDeliveryJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "ReportDeliveryCheck" ADD CONSTRAINT report_delivery_check_shape CHECK (
 attempt > 0 AND status IN ('CHECKING', 'READY_NO_SEND', 'BLOCKED', 'INTERRUPTED') AND
 isfinite("startedAt") AND isfinite("leaseUntil") AND "leaseUntil" > "startedAt" AND
 ((status = 'CHECKING' AND "finishedAt" IS NULL AND code IS NULL) OR
  (status <> 'CHECKING' AND "finishedAt" IS NOT NULL AND isfinite("finishedAt") AND "finishedAt" >= "startedAt" AND code IS NOT NULL))
);
CREATE UNIQUE INDEX report_delivery_one_check ON "ReportDeliveryCheck"("jobId") WHERE status = 'CHECKING';
CREATE FUNCTION guard_report_delivery_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest integer;
BEGIN
 IF TG_OP = 'INSERT' THEN
   PERFORM id FROM "ReportDeliveryJob" WHERE id = NEW."jobId" FOR UPDATE;
   SELECT COALESCE(max(attempt), 0) INTO latest FROM "ReportDeliveryCheck" WHERE "jobId" = NEW."jobId";
   IF NEW.status <> 'CHECKING' OR NEW.attempt <> latest + 1 THEN RAISE EXCEPTION 'Invalid delivery check claim'; END IF;
 ELSE
   IF OLD.status <> 'CHECKING' OR NEW.status = 'CHECKING' OR
     (to_jsonb(NEW) - ARRAY['status','code','finishedAt']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','code','finishedAt']) THEN
     RAISE EXCEPTION 'Delivery check evidence is immutable';
   END IF;
   IF NEW.status = 'INTERRUPTED' AND NEW."finishedAt" < OLD."leaseUntil" THEN RAISE EXCEPTION 'Lease has not expired'; END IF;
   IF NEW.status <> 'INTERRUPTED' AND NEW."finishedAt" >= OLD."leaseUntil" THEN RAISE EXCEPTION 'Delivery check lease expired'; END IF;
   IF NEW.status = 'READY_NO_SEND' AND NOT EXISTS (
     SELECT 1 FROM "ReportDeliveryJob" j JOIN "ReportScheduleRevision" r ON r.id = j."revisionId"
     WHERE j.id = NEW."jobId" AND j.status = 'HELD' AND r.state = 'DRAFT' AND
     NOT EXISTS (SELECT 1 FROM "ReportScheduleRevision" newer WHERE newer."scheduleId" = r."scheduleId" AND newer.revision > r.revision)
   ) THEN RAISE EXCEPTION 'Only a current held job can be ready'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER report_delivery_check_guard BEFORE INSERT OR UPDATE ON "ReportDeliveryCheck" FOR EACH ROW EXECUTE FUNCTION guard_report_delivery_check();
CREATE TRIGGER report_delivery_check_no_delete BEFORE DELETE ON "ReportDeliveryCheck" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER report_delivery_check_no_truncate BEFORE TRUNCATE ON "ReportDeliveryCheck" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
