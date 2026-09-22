ALTER TABLE "ConsumptionRecord" ADD COLUMN "sourceProvenance" JSONB;
CREATE FUNCTION preserve_reading_source_provenance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original JSONB;
BEGIN
 IF NEW."supersedesId" IS NOT NULL THEN
  SELECT "sourceProvenance" INTO original FROM "ConsumptionRecord" WHERE id=NEW."supersedesId";
  IF NEW."sourceProvenance" IS DISTINCT FROM original THEN RAISE EXCEPTION 'Preserve original migration provenance'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER reading_source_provenance BEFORE INSERT ON "ConsumptionRecord" FOR EACH ROW EXECUTE FUNCTION preserve_reading_source_provenance();
CREATE TABLE "LegacyEnergyBatch" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL REFERENCES "Organisation"("id") ON DELETE RESTRICT,
 "inputHash" TEXT NOT NULL, "authorId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "receipt" JSONB NOT NULL,
 UNIQUE("id","organisationId"), UNIQUE("organisationId","inputHash")
);
CREATE TABLE "LegacyEnergyRow" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL REFERENCES "Organisation"("id") ON DELETE RESTRICT,
 "batchId" UUID NOT NULL, "source" TEXT NOT NULL, "table" TEXT NOT NULL, "legacyId" TEXT NOT NULL,
 "evidence" JSONB NOT NULL, "targets" JSONB NOT NULL,
 FOREIGN KEY("batchId","organisationId") REFERENCES "LegacyEnergyBatch"("id","organisationId"),
 UNIQUE("organisationId","source","table","legacyId")
);
CREATE TRIGGER legacy_energy_batch_immutable BEFORE UPDATE OR DELETE ON "LegacyEnergyBatch" FOR EACH ROW EXECUTE FUNCTION prevent_driver_revision_changes();
CREATE TRIGGER legacy_energy_batch_no_truncate BEFORE TRUNCATE ON "LegacyEnergyBatch" FOR EACH STATEMENT EXECUTE FUNCTION prevent_driver_revision_changes();
CREATE TRIGGER legacy_energy_row_immutable BEFORE UPDATE OR DELETE ON "LegacyEnergyRow" FOR EACH ROW EXECUTE FUNCTION prevent_driver_revision_changes();
CREATE TRIGGER legacy_energy_row_no_truncate BEFORE TRUNCATE ON "LegacyEnergyRow" FOR EACH STATEMENT EXECUTE FUNCTION prevent_driver_revision_changes();
