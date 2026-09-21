CREATE TABLE "DriverImportBatch" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL,
 "fingerprint" TEXT NOT NULL, "result" JSONB NOT NULL,
 "status" TEXT NOT NULL CHECK ("status" IN ('INVALID','READY','COMMITTED')),
 "createdBy" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "committedAt" TIMESTAMPTZ(3),
 FOREIGN KEY ("siteId", "organisationId") REFERENCES "Site"("id", "organisationId")
);
CREATE UNIQUE INDEX "DriverImportBatch_id_organisationId_key" ON "DriverImportBatch"("id", "organisationId");
CREATE UNIQUE INDEX "DriverImportBatch_siteId_fingerprint_key" ON "DriverImportBatch"("siteId", "fingerprint");
CREATE TABLE "DriverObservation" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL,
 "month" DATE NOT NULL CHECK (EXTRACT(DAY FROM "month") = 1),
 "driver" TEXT NOT NULL CHECK ("driver" IN ('POPULATION','OPERATING_HOURS')),
 "value" DECIMAL(14,3) NOT NULL CHECK ("value" >= 0),
 "source" TEXT NOT NULL, "authorId" UUID NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "importBatchId" UUID,
 CHECK ("driver" <> 'OPERATING_HOURS' OR "value" <= EXTRACT(DAY FROM ("month" + INTERVAL '1 month - 1 day')) * 24),
 FOREIGN KEY ("siteId", "organisationId") REFERENCES "Site"("id", "organisationId"),
 FOREIGN KEY ("importBatchId", "organisationId") REFERENCES "DriverImportBatch"("id", "organisationId")
);
CREATE UNIQUE INDEX "DriverObservation_siteId_month_driver_key" ON "DriverObservation"("siteId", "month", "driver");
CREATE INDEX "DriverObservation_organisationId_siteId_idx" ON "DriverObservation"("organisationId", "siteId");
CREATE TABLE "OperatingSchedule" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL,
 "name" TEXT NOT NULL, "validFrom" DATE NOT NULL, "validUntil" DATE NOT NULL,
 "weeklyHours" DECIMAL(6,3) NOT NULL CHECK ("weeklyHours" BETWEEN 0 AND 168),
 "source" TEXT NOT NULL, "authorId" UUID NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("validFrom" < "validUntil"),
 FOREIGN KEY ("siteId", "organisationId") REFERENCES "Site"("id", "organisationId")
);
CREATE INDEX "OperatingSchedule_organisationId_siteId_validFrom_idx" ON "OperatingSchedule"("organisationId", "siteId", "validFrom");
