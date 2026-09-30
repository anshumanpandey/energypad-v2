CREATE TABLE "SiteDriverClassification" (
 "id" UUID PRIMARY KEY,
 "organisationId" UUID NOT NULL,
 "siteId" UUID NOT NULL,
 "year" INTEGER NOT NULL CHECK ("year" BETWEEN 1900 AND 2199),
 "heating" TEXT NOT NULL CHECK ("heating" IN ('R','NR','N/A')),
 "cooling" TEXT NOT NULL CHECK ("cooling" IN ('R','NR','N/A')),
 "population" TEXT NOT NULL CHECK ("population" IN ('R','NR','N/A')),
 "operatingHours" TEXT NOT NULL CHECK ("operatingHours" IN ('R','NR','N/A')),
 "daylighting" TEXT NOT NULL CHECK ("daylighting" IN ('R','NR','N/A')),
 "buildingSize" TEXT NOT NULL CHECK ("buildingSize" IN ('R','NR','N/A')),
 "source" TEXT NOT NULL,
 "sourceRow" INTEGER NOT NULL,
 "authorId" UUID NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SiteDriverClassification_siteId_organisationId_fkey" FOREIGN KEY ("siteId","organisationId") REFERENCES "Site"("id","organisationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SiteDriverClassification_organisationId_siteId_year_key" ON "SiteDriverClassification"("organisationId","siteId","year");
CREATE FUNCTION prevent_driver_classification_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Imported driver classifications are immutable'; END; $$;
CREATE TRIGGER driver_classification_immutable BEFORE UPDATE OR DELETE ON "SiteDriverClassification" FOR EACH ROW EXECUTE FUNCTION prevent_driver_classification_changes();
CREATE TRIGGER driver_classification_no_truncate BEFORE TRUNCATE ON "SiteDriverClassification" FOR EACH STATEMENT EXECUTE FUNCTION prevent_driver_classification_changes();
