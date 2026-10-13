ALTER TABLE "Organisation" ADD COLUMN "apiImportUrls" JSONB NOT NULL DEFAULT '{}';
UPDATE "Organisation" SET "apiImportUrls" = jsonb_build_object(
  'consumption', "apiImportUrl", 'emissions', "apiImportUrl", 'targets', "apiImportUrl", 'drivers', "apiImportUrl"
) WHERE "apiImportUrl" IS NOT NULL;
