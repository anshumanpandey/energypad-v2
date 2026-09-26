-- CreateTable
CREATE TABLE "BillingWebhookReceipt" (
    "id" UUID NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "providerSubscriptionId" TEXT,
    "providerCustomerId" TEXT,
    "providerCreatedAt" TIMESTAMPTZ(3) NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingWebhookReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingWebhookReceipt_providerAccountId_mode_receivedAt_idx" ON "BillingWebhookReceipt"("providerAccountId", "mode", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingWebhookReceipt_providerAccountId_mode_providerEventI_key" ON "BillingWebhookReceipt"("providerAccountId", "mode", "providerEventId");

ALTER TABLE "BillingWebhookReceipt" ADD CONSTRAINT billing_receipt_evidence CHECK (
  mode = 'test' AND "providerAccountId" ~ '^acct_[A-Za-z0-9]+$' AND
  "providerEventId" ~ '^evt_[A-Za-z0-9]+$' AND "payloadHash" ~ '^[a-f0-9]{64}$' AND
  length("eventType") BETWEEN 1 AND 100 AND
  (("providerSubscriptionId" IS NULL AND "providerCustomerId" IS NULL) OR
   ("providerSubscriptionId" IS NOT NULL AND "providerCustomerId" IS NOT NULL AND
    "providerSubscriptionId" ~ '^sub_[A-Za-z0-9]+$' AND "providerCustomerId" ~ '^cus_[A-Za-z0-9]+$'))
);
CREATE TRIGGER billing_receipt_immutable BEFORE UPDATE OR DELETE ON "BillingWebhookReceipt" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER billing_receipt_no_truncate BEFORE TRUNCATE ON "BillingWebhookReceipt" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
