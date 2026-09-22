CREATE TABLE "LegacyTariffBatch" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL REFERENCES "Organisation"("id") ON DELETE RESTRICT,
 "adapter" TEXT NOT NULL, "source" TEXT NOT NULL, "inputHash" TEXT NOT NULL,
 "authorId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "receipt" JSONB NOT NULL,
 UNIQUE ("organisationId", "adapter", "inputHash")
);
CREATE TRIGGER legacy_batch_immutable BEFORE UPDATE OR DELETE ON "LegacyTariffBatch" FOR EACH ROW EXECUTE FUNCTION prevent_tariff_changes();
CREATE TRIGGER legacy_batch_no_truncate BEFORE TRUNCATE ON "LegacyTariffBatch" FOR EACH STATEMENT EXECUTE FUNCTION prevent_tariff_changes();
