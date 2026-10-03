-- User-requested reclassification of every consumption reading as Actual.
-- Only the reading flag and its obsolete quality flag change; saved analysis/audit snapshots stay intact.
BEGIN;
ALTER TABLE "ConsumptionRecord" DISABLE TRIGGER reading_immutable;
UPDATE "ConsumptionRecord"
SET "estimated" = false,
    "qualityFlags" = "qualityFlags" - 'Estimated reading'
WHERE "estimated" OR "qualityFlags" ? 'Estimated reading';
ALTER TABLE "ConsumptionRecord" ENABLE TRIGGER reading_immutable;
ALTER TABLE "ConsumptionRecord" ADD CONSTRAINT "ConsumptionRecord_actual_only" CHECK ("estimated" = false);
COMMIT;
