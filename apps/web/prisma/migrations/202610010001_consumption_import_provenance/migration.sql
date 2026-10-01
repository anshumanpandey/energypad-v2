-- Keep original migration/source provenance immutable while recording each import correction's source.
ALTER TABLE "ConsumptionRecord" ADD COLUMN "importProvenance" JSONB;
