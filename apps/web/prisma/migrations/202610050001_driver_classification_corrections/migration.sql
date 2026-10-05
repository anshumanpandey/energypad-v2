CREATE UNIQUE INDEX "SiteDriverClassification_id_organisationId_key" ON "SiteDriverClassification"("id", "organisationId");
CREATE TABLE "SiteDriverClassificationCorrection" (
  "id" UUID NOT NULL PRIMARY KEY,
  "organisationId" UUID NOT NULL,
  "classificationId" UUID NOT NULL,
  "values" JSONB NOT NULL,
  "authorId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SiteDriverClassificationCorrection_classification_fkey"
    FOREIGN KEY ("classificationId", "organisationId") REFERENCES "SiteDriverClassification"("id", "organisationId") ON DELETE RESTRICT
);
CREATE INDEX "SiteDriverClassificationCorrection_classificationId_createdAt_idx" ON "SiteDriverClassificationCorrection"("classificationId", "createdAt");
CREATE TRIGGER driver_classification_correction_immutable BEFORE UPDATE OR DELETE ON "SiteDriverClassificationCorrection" FOR EACH ROW EXECUTE FUNCTION prevent_driver_classification_changes();
CREATE TRIGGER driver_classification_correction_no_truncate BEFORE TRUNCATE ON "SiteDriverClassificationCorrection" FOR EACH STATEMENT EXECUTE FUNCTION prevent_driver_classification_changes();
