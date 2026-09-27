-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "ownerMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportScheduleRevision" (
    "id" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "previousId" UUID,
    "state" TEXT NOT NULL,
    "archiveId" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "recipientMembershipIds" UUID[],
    "timezone" TEXT NOT NULL,
    "requestKey" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportScheduleRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportDeliveryJob" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "occurrenceAt" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportDeliveryJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportSchedule_id_organisationId_siteId_key" ON "ReportSchedule"("id", "organisationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportScheduleRevision_previousId_key" ON "ReportScheduleRevision"("previousId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportScheduleRevision_scope_key" ON "ReportScheduleRevision"("id", "scheduleId", "organisationId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportScheduleRevision_scheduleId_revision_key" ON "ReportScheduleRevision"("scheduleId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "ReportScheduleRevision_organisationId_requestKey_key" ON "ReportScheduleRevision"("organisationId", "requestKey");

-- CreateIndex
CREATE INDEX "ReportDeliveryJob_organisationId_status_occurrenceAt_idx" ON "ReportDeliveryJob"("organisationId", "status", "occurrenceAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportDeliveryJob_revisionId_occurrenceAt_key" ON "ReportDeliveryJob"("revisionId", "occurrenceAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportArchive_schedule_reference_key" ON "ReportArchive"("id", "organisationId", "siteId", "fingerprint");

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_siteId_organisationId_fkey" FOREIGN KEY ("siteId", "organisationId") REFERENCES "Site"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_ownerMembershipId_organisationId_fkey" FOREIGN KEY ("ownerMembershipId", "organisationId") REFERENCES "Membership"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportScheduleRevision" ADD CONSTRAINT "ReportScheduleRevision_scheduleId_organisationId_siteId_fkey" FOREIGN KEY ("scheduleId", "organisationId", "siteId") REFERENCES "ReportSchedule"("id", "organisationId", "siteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportScheduleRevision" ADD CONSTRAINT "ReportScheduleRevision_archive_fkey" FOREIGN KEY ("archiveId", "organisationId", "siteId", "fingerprint") REFERENCES "ReportArchive"("id", "organisationId", "siteId", "fingerprint") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportScheduleRevision" ADD CONSTRAINT "ReportScheduleRevision_previous_fkey" FOREIGN KEY ("previousId", "scheduleId", "organisationId", "siteId") REFERENCES "ReportScheduleRevision"("id", "scheduleId", "organisationId", "siteId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReportDeliveryJob" ADD CONSTRAINT "ReportDeliveryJob_revision_fkey" FOREIGN KEY ("revisionId", "scheduleId", "organisationId", "siteId") REFERENCES "ReportScheduleRevision"("id", "scheduleId", "organisationId", "siteId") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "ReportScheduleRevision" ADD CONSTRAINT report_schedule_revision_shape CHECK (
  revision > 0 AND state IN ('DRAFT', 'CANCELLED') AND "requestHash" ~ '^[a-f0-9]{64}$' AND
  "recipientMembershipIds" IS NOT NULL AND cardinality("recipientMembershipIds") BETWEEN 1 AND 100 AND array_ndims("recipientMembershipIds") = 1
);
ALTER TABLE "ReportDeliveryJob" ADD CONSTRAINT report_delivery_held_only CHECK (status IN ('HELD', 'CANCELLED') AND isfinite("occurrenceAt"));

CREATE FUNCTION validate_report_schedule_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior "ReportScheduleRevision"; recipient_count integer;
BEGIN
  PERFORM id FROM "ReportSchedule" WHERE id = NEW."scheduleId" FOR UPDATE;
  SELECT * INTO prior FROM "ReportScheduleRevision" WHERE "scheduleId" = NEW."scheduleId" ORDER BY revision DESC LIMIT 1;
  IF prior.id IS NULL THEN
    IF NEW.revision <> 1 OR NEW."previousId" IS NOT NULL OR NEW.state <> 'DRAFT' THEN
      RAISE EXCEPTION 'Invalid first report schedule revision';
    END IF;
  ELSIF prior.state = 'CANCELLED' OR NEW.revision <> prior.revision + 1 OR NEW."previousId" IS DISTINCT FROM prior.id THEN
    RAISE EXCEPTION 'Invalid report schedule lineage';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = NEW.timezone) THEN
    RAISE EXCEPTION 'Invalid report schedule time zone';
  END IF;
  SELECT count(*) INTO recipient_count FROM "Membership" WHERE "organisationId" = NEW."organisationId" AND id = ANY(NEW."recipientMembershipIds");
  IF NEW.state = 'DRAFT' AND recipient_count <> cardinality(NEW."recipientMembershipIds") THEN
    RAISE EXCEPTION 'Recipients must be distinct workspace memberships';
  END IF;
  IF NEW.state = 'CANCELLED' AND
     (NEW."archiveId", NEW.fingerprint, NEW."recipientMembershipIds", NEW.timezone) IS DISTINCT FROM
     (prior."archiveId", prior.fingerprint, prior."recipientMembershipIds", prior.timezone) THEN
    RAISE EXCEPTION 'Cancellation cannot replace schedule evidence';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER report_schedule_lineage BEFORE INSERT ON "ReportScheduleRevision" FOR EACH ROW EXECUTE FUNCTION validate_report_schedule_revision();

CREATE FUNCTION validate_report_delivery_job() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest "ReportScheduleRevision";
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'HELD' OR NEW.status <> 'CANCELLED' OR
       (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
      RAISE EXCEPTION 'Only held report jobs can be cancelled';
    END IF;
  ELSE
    PERFORM id FROM "ReportSchedule" WHERE id = NEW."scheduleId" FOR UPDATE;
    SELECT * INTO latest FROM "ReportScheduleRevision" WHERE "scheduleId" = NEW."scheduleId" ORDER BY revision DESC LIMIT 1;
    IF latest.id IS DISTINCT FROM NEW."revisionId" OR latest.state <> 'DRAFT' OR NEW.status <> 'HELD' THEN
      RAISE EXCEPTION 'Report jobs must reference the current draft and remain held';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER report_delivery_job_guard BEFORE INSERT OR UPDATE ON "ReportDeliveryJob" FOR EACH ROW EXECUTE FUNCTION validate_report_delivery_job();

CREATE FUNCTION cancel_superseded_report_jobs() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "ReportDeliveryJob" SET status = 'CANCELLED' WHERE "scheduleId" = NEW."scheduleId" AND "revisionId" <> NEW.id AND status = 'HELD';
  RETURN NEW;
END $$;
CREATE TRIGGER report_schedule_cancel_superseded AFTER INSERT ON "ReportScheduleRevision" FOR EACH ROW EXECUTE FUNCTION cancel_superseded_report_jobs();
CREATE TRIGGER report_schedule_identity_immutable BEFORE UPDATE OR DELETE ON "ReportSchedule" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER report_schedule_revision_immutable BEFORE UPDATE OR DELETE ON "ReportScheduleRevision" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER report_delivery_job_no_delete BEFORE DELETE ON "ReportDeliveryJob" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER report_schedule_no_truncate BEFORE TRUNCATE ON "ReportSchedule" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER report_schedule_revision_no_truncate BEFORE TRUNCATE ON "ReportScheduleRevision" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER report_delivery_job_no_truncate BEFORE TRUNCATE ON "ReportDeliveryJob" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
