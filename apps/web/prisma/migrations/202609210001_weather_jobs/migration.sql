CREATE TABLE "WeatherJob" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL, "configurationId" UUID NOT NULL,
 "year" INTEGER NOT NULL CHECK ("year" BETWEEN 1940 AND 2199), "methodology" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'QUEUED' CHECK ("status" IN ('QUEUED','RUNNING','RETRY_WAIT','SUCCEEDED','FAILED')),
 "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" BETWEEN 0 AND 3), "totalAttempts" INTEGER NOT NULL DEFAULT 0 CHECK ("totalAttempts" >= "attempts"),
 "requestedBy" UUID NOT NULL, "correlationId" UUID NOT NULL,
 "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "leaseToken" UUID, "leaseUntil" TIMESTAMPTZ(3),
 "lastErrorCode" TEXT, "lastError" TEXT, "resultId" UUID REFERENCES "WeatherYear"("id"),
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" TIMESTAMPTZ(3),
 CHECK (("status" = 'RUNNING' AND "leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL) OR ("status" <> 'RUNNING' AND "leaseToken" IS NULL AND "leaseUntil" IS NULL)),
 FOREIGN KEY ("configurationId", "siteId", "organisationId") REFERENCES "WeatherConfiguration"("id", "siteId", "organisationId")
);
CREATE UNIQUE INDEX "WeatherJob_configurationId_year_methodology_key" ON "WeatherJob"("configurationId", "year", "methodology");
CREATE INDEX "WeatherJob_status_availableAt_idx" ON "WeatherJob"("status", "availableAt");
CREATE INDEX "WeatherJob_organisationId_siteId_year_idx" ON "WeatherJob"("organisationId", "siteId", "year");
