-- CreateTable
CREATE TABLE "BillingCustomer" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "providerCustomerId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSubscription" (
    "id" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "providerSubscriptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingSubscriptionRevision" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "organisationId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "previousId" UUID,
    "observationKey" TEXT NOT NULL,
    "providerStatus" TEXT NOT NULL,
    "providerPriceId" TEXT NOT NULL,
    "catalogueVersion" TEXT NOT NULL,
    "catalogueFingerprint" TEXT NOT NULL,
    "mappedPlanKey" "PlanKey" NOT NULL,
    "evidence" JSONB NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingSubscriptionRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingCustomer_id_organisationId_providerAccountId_mode_key" ON "BillingCustomer"("id", "organisationId", "providerAccountId", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCustomer_providerAccountId_mode_providerCustomerId_key" ON "BillingCustomer"("providerAccountId", "mode", "providerCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCustomer_organisationId_providerAccountId_mode_key" ON "BillingCustomer"("organisationId", "providerAccountId", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscription_providerAccountId_mode_providerSubscrip_key" ON "BillingSubscription"("providerAccountId", "mode", "providerSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscription_id_organisationId_key" ON "BillingSubscription"("id", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscriptionRevision_id_subscriptionId_organisationI_key" ON "BillingSubscriptionRevision"("id", "subscriptionId", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscriptionRevision_subscriptionId_revision_key" ON "BillingSubscriptionRevision"("subscriptionId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscriptionRevision_subscriptionId_observationKey_key" ON "BillingSubscriptionRevision"("subscriptionId", "observationKey");

-- CreateIndex
CREATE UNIQUE INDEX "BillingSubscriptionRevision_previousId_key" ON "BillingSubscriptionRevision"("previousId");

-- AddForeignKey
ALTER TABLE "BillingCustomer" ADD CONSTRAINT "BillingCustomer_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscription" ADD CONSTRAINT "BillingSubscription_customerId_organisationId_providerAcco_fkey" FOREIGN KEY ("customerId", "organisationId", "providerAccountId", "mode") REFERENCES "BillingCustomer"("id", "organisationId", "providerAccountId", "mode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscriptionRevision" ADD CONSTRAINT "BillingSubscriptionRevision_subscriptionId_organisationId_fkey" FOREIGN KEY ("subscriptionId", "organisationId") REFERENCES "BillingSubscription"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingSubscriptionRevision" ADD CONSTRAINT "BillingSubscriptionRevision_previousId_subscriptionId_orga_fkey" FOREIGN KEY ("previousId", "subscriptionId", "organisationId") REFERENCES "BillingSubscriptionRevision"("id", "subscriptionId", "organisationId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Test mode only until commercial activation is explicitly implemented.
ALTER TABLE "BillingCustomer" ADD CONSTRAINT billing_customer_mode CHECK (mode = 'test');
ALTER TABLE "BillingCustomer" ADD CONSTRAINT billing_customer_identity CHECK (length("providerAccountId") BETWEEN 1 AND 255 AND length("providerCustomerId") BETWEEN 1 AND 255);
ALTER TABLE "BillingSubscription" ADD CONSTRAINT billing_subscription_identity CHECK (length("providerSubscriptionId") BETWEEN 1 AND 255);
ALTER TABLE "BillingSubscriptionRevision" ADD CONSTRAINT billing_revision_evidence CHECK (
  revision > 0 AND length("observationKey") BETWEEN 1 AND 255 AND
  length("providerStatus") BETWEEN 1 AND 100 AND length("providerPriceId") BETWEEN 1 AND 255 AND
  length("catalogueVersion") BETWEEN 1 AND 80 AND
  "catalogueFingerprint" ~ '^[a-f0-9]{64}$' AND "evidenceHash" ~ '^[a-f0-9]{64}$' AND
  jsonb_typeof(evidence) = 'object'
);
CREATE FUNCTION validate_billing_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest "BillingSubscriptionRevision";
BEGIN
  PERFORM 1 FROM "BillingSubscription" WHERE id = NEW."subscriptionId" AND "organisationId" = NEW."organisationId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Scoped subscription required'; END IF;
  SELECT * INTO latest FROM "BillingSubscriptionRevision" WHERE "subscriptionId" = NEW."subscriptionId" ORDER BY revision DESC LIMIT 1;
  IF FOUND THEN
    IF NEW."previousId" IS DISTINCT FROM latest.id OR NEW.revision <> latest.revision + 1 THEN
      RAISE EXCEPTION 'Latest subscription revision required';
    END IF;
  ELSIF NEW."previousId" IS NOT NULL OR NEW.revision <> 1 THEN
    RAISE EXCEPTION 'Initial subscription revision required';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER billing_revision_lineage BEFORE INSERT ON "BillingSubscriptionRevision" FOR EACH ROW EXECUTE FUNCTION validate_billing_revision();
CREATE TRIGGER billing_customer_immutable BEFORE UPDATE OR DELETE ON "BillingCustomer" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER billing_customer_no_truncate BEFORE TRUNCATE ON "BillingCustomer" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER billing_subscription_immutable BEFORE UPDATE OR DELETE ON "BillingSubscription" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER billing_subscription_no_truncate BEFORE TRUNCATE ON "BillingSubscription" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER billing_revision_immutable BEFORE UPDATE OR DELETE ON "BillingSubscriptionRevision" FOR EACH ROW EXECUTE FUNCTION prevent_emission_factor_changes();
CREATE TRIGGER billing_revision_no_truncate BEFORE TRUNCATE ON "BillingSubscriptionRevision" FOR EACH STATEMENT EXECUTE FUNCTION prevent_emission_factor_changes();
