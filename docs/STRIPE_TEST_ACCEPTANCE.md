# Stripe test-account acceptance

Status: BLOCKED on configuration and reviewed test identities. Synthetic tests do not constitute real provider acceptance. Prices and lifecycle policy remain unapproved; payment activation remains disabled.

## 1. Local configuration preflight

Run `npm run billing:readiness` from apps/web. It makes no network/database calls and prints only field names/statuses and the catalogue fingerprint/count. It does not expose keys, account IDs, price IDs, catalogue version labels or malformed input. Exit 0 means local read/webhook configuration syntax is complete, 2 means missing/disabled prerequisites, and 1 means invalid configuration or arguments. None of these outcomes proves provider access or authorizes live payments.

Required server values: STRIPE_TEST_SECRET_KEY, STRIPE_TEST_ACCOUNT_ID, STRIPE_TEST_WEBHOOK_SECRET, BILLING_PRICE_CATALOGUE. Leave STRIPE_WEBHOOK_RECEIPTS_ENABLED false until the intended database has all billing migrations and the endpoint secret/account pairing is verified. No secrets belong in a reviewed binding manifest or chat.

## 2. Identify the acceptance target

Record the test account, intended application/database environment, organisation and currently authorized owner, test customer/subscription, approved test catalogue and reviewed workspace/customer association. Confirm the three billing migrations are applied to that intended environment before local writes. A test key alone does not make a production application database safe to modify.

## 3. Verify and bind

Use `billing:bind` with the bounded reviewed manifest documented in SPRINT_7_DESIGN.md. Record the resulting local customer/subscription IDs and immutable initial observation/audit. Confirm current account/customer/subscription and mapped price terms match. This command writes local state but performs only Stripe GET requests. Repeat the same binding and confirm reuse without an additional binding revision or audit.

## 4. Signed delivery and reconciliation

Configure the test endpoint for customer.subscription.created/updated/deleted only after deployment/configuration is ready. Check raw-body signature acceptance; invalid signature and live/Connect events must fail. Verify an authentic test delivery creates a durable receipt. Redelivery of the same event must reuse it. Receipt 200 means stored, not processed.

Run `billing:reconcile` for the reviewed workspace/owner. Confirm a successful job, its exact receipt observation key, retained catalogue/evidence hashes and atomic audit. Deliver an older real test event after a newer state exists; confirm reconciliation reads current state rather than restoring the event snapshot. Confirm duplicate/retried processing cannot create a second observation for the same receipt. Review unmatched/unsupported inbox items explicitly; an empty worker pass does not certify the whole inbox processed.

## 5. Record the verdict

Retain sanitized receipt/job/revision/audit IDs and test outcomes in a private acceptance report. Record failed checks as failures, not as missing optional details. Provider rate-limit/recovery and simulated crash/permission failure tests already have isolated coverage; record which scenarios were exercised against the real test account separately.

Passing this acceptance covers read-only identity retrieval, reviewed local bindings and webhook reconciliation only. It does not accept checkout, proration, trials, scheduled reports, invoicing, payment-failure access/grace rules, live charges or production cutover. Those require their own implementation and approved commercial decisions.
