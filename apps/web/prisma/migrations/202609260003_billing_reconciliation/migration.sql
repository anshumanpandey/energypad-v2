-- CreateTable
CREATE TABLE "BillingReconciliationJob" (
    "id" UUID NOT NULL,
    "receiptId" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" UUID,
    "leaseUntil" TIMESTAMPTZ(3),
    "lastCode" TEXT,
    "revisionId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BillingReconciliationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingReconciliationJob_receiptId_key" ON "BillingReconciliationJob"("receiptId");

-- CreateIndex
CREATE INDEX "BillingReconciliationJob_organisationId_status_availableAt_idx" ON "BillingReconciliationJob"("organisationId", "status", "availableAt");

-- AddForeignKey
ALTER TABLE "BillingReconciliationJob" ADD CONSTRAINT "BillingReconciliationJob_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "BillingWebhookReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingReconciliationJob" ADD CONSTRAINT "BillingReconciliationJob_subscriptionId_organisationId_fkey" FOREIGN KEY ("subscriptionId", "organisationId") REFERENCES "BillingSubscription"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingReconciliationJob" ADD CONSTRAINT "BillingReconciliationJob_revisionId_subscriptionId_organis_fkey" FOREIGN KEY ("revisionId", "subscriptionId", "organisationId") REFERENCES "BillingSubscriptionRevision"("id", "subscriptionId", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingReconciliationJob" ADD CONSTRAINT billing_job_state CHECK (
  attempts >= 0 AND status IN ('PENDING','RUNNING','RETRY','SUCCEEDED') AND
  ((status = 'RUNNING' AND "leaseToken" IS NOT NULL AND "leaseUntil" IS NOT NULL) OR
   (status <> 'RUNNING' AND "leaseToken" IS NULL AND "leaseUntil" IS NULL)) AND
  ((status = 'SUCCEEDED' AND "revisionId" IS NOT NULL) OR (status <> 'SUCCEEDED' AND "revisionId" IS NULL))
);
CREATE FUNCTION validate_billing_job() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id OR NEW."receiptId" <> OLD."receiptId" OR NEW."organisationId" <> OLD."organisationId" OR NEW."subscriptionId" <> OLD."subscriptionId" OR OLD.status = 'SUCCEEDED' THEN
      RAISE EXCEPTION 'Immutable billing job binding or completed outcome';
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "BillingWebhookReceipt" r JOIN "BillingSubscription" s
    ON s."providerAccountId" = r."providerAccountId" AND s.mode = r.mode AND s."providerSubscriptionId" = r."providerSubscriptionId"
    JOIN "BillingCustomer" c ON c.id = s."customerId" AND c."providerCustomerId" = r."providerCustomerId"
    WHERE r.id = NEW."receiptId" AND s.id = NEW."subscriptionId" AND s."organisationId" = NEW."organisationId") THEN
    RAISE EXCEPTION 'Receipt does not match subscription binding';
  END IF;
  IF NEW.status = 'SUCCEEDED' AND NOT EXISTS (
    SELECT 1 FROM "BillingSubscriptionRevision" v WHERE v.id = NEW."revisionId" AND v."subscriptionId" = NEW."subscriptionId"
      AND v."organisationId" = NEW."organisationId" AND v."observationKey" = 'receipt:' || NEW."receiptId"::text
  ) THEN RAISE EXCEPTION 'Receipt observation required for completion'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER billing_job_binding BEFORE INSERT OR UPDATE ON "BillingReconciliationJob" FOR EACH ROW EXECUTE FUNCTION validate_billing_job();
CREATE TRIGGER billing_job_no_delete BEFORE DELETE ON "BillingReconciliationJob" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER billing_job_no_truncate BEFORE TRUNCATE ON "BillingReconciliationJob" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
