CREATE TABLE "WeatherConfiguration" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL, "version" INTEGER NOT NULL CHECK ("version">0),
 "latitude" DECIMAL(9,6) NOT NULL CHECK ("latitude" BETWEEN -90 AND 90),
 "longitude" DECIMAL(9,6) NOT NULL CHECK ("longitude" BETWEEN -180 AND 180),
 "timezone" TEXT NOT NULL, "heatingBase" DECIMAL(6,3) NOT NULL CHECK ("heatingBase" BETWEEN -50 AND 50),
 "coolingBase" DECIMAL(6,3) NOT NULL CHECK ("coolingBase" BETWEEN -50 AND 50), "source" TEXT NOT NULL,
 "authorId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("siteId", "organisationId") REFERENCES "Site"("id", "organisationId")
);
CREATE UNIQUE INDEX "WeatherConfiguration_siteId_version_key" ON "WeatherConfiguration"("siteId", "version");
CREATE UNIQUE INDEX "WeatherConfiguration_id_siteId_organisationId_key" ON "WeatherConfiguration"("id", "siteId", "organisationId");
CREATE TABLE "WeatherYear" (
 "id" UUID PRIMARY KEY, "organisationId" UUID NOT NULL, "siteId" UUID NOT NULL, "configurationId" UUID NOT NULL,
 "year" INTEGER NOT NULL CHECK ("year" BETWEEN 1940 AND 2199), "methodology" TEXT NOT NULL,
 "provenance" JSONB NOT NULL, "daily" JSONB NOT NULL, "monthly" JSONB NOT NULL, "inputHash" TEXT NOT NULL,
 "authorId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("configurationId", "siteId", "organisationId") REFERENCES "WeatherConfiguration"("id", "siteId", "organisationId")
);
CREATE UNIQUE INDEX "WeatherYear_configurationId_year_methodology_key" ON "WeatherYear"("configurationId", "year", "methodology");
CREATE INDEX "WeatherYear_organisationId_siteId_year_idx" ON "WeatherYear"("organisationId", "siteId", "year");
CREATE FUNCTION prevent_weather_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Weather settings and results are immutable; create a new version'; END;
$$;
CREATE TRIGGER weather_config_immutable BEFORE UPDATE OR DELETE ON "WeatherConfiguration" FOR EACH ROW EXECUTE FUNCTION prevent_weather_changes();
CREATE TRIGGER weather_config_no_truncate BEFORE TRUNCATE ON "WeatherConfiguration" FOR EACH STATEMENT EXECUTE FUNCTION prevent_weather_changes();
CREATE TRIGGER weather_year_immutable BEFORE UPDATE OR DELETE ON "WeatherYear" FOR EACH ROW EXECUTE FUNCTION prevent_weather_changes();
CREATE TRIGGER weather_year_no_truncate BEFORE TRUNCATE ON "WeatherYear" FOR EACH STATEMENT EXECUTE FUNCTION prevent_weather_changes();
