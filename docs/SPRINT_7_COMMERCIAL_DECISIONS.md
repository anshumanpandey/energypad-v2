# Sprint 7 commercial decision sheet

Status: billing deferred by the user on 26 September 2026. Existing local assignments remain in force. The decisions below remain open; do not resume checkout/provider activation merely in response to “continue.” Independent Sprint 8 work may proceed. This sheet neither enables payments nor approves proposed rules.

## Existing plan definitions

| Plan         | Active sites | Included features beyond core    |
| ------------ | ------------ | -------------------------------- |
| Starter      | 5            | None                             |
| Growth       | 25           | Portfolio, AI, scheduled reports |
| Professional | 100          | Growth features, NRA, API        |
| Enterprise   | Unlimited    | Professional features, SSO       |

These are current code definitions, not available paid offers. Included features can still be unavailable because rollout, provider configuration or role permissions are separate. The Professional limit currently includes exactly 100 sites; confirm that boundary before publishing commercial terms. Persisted capacity overrides remain supported.

## Required offer decisions

| Plan         | Currency | Monthly amount | Annual amount | Monthly test price ID | Annual test price ID |
| ------------ | -------- | -------------- | ------------- | --------------------- | -------------------- |
| Starter      | Pending  | Pending        | Pending       | Pending               | Pending              |
| Growth       | Pending  | Pending        | Pending       | Pending               | Pending              |
| Professional | Pending  | Pending        | Pending       | Pending               | Pending              |
| Enterprise   | Pending  | Pending        | Pending       | Pending               | Pending              |

Specify whether Enterprise is self-service or handled through sales. An annual price must be supplied explicitly; do not infer a discount from monthly pricing. Record whether published amounts include tax. Configure test price IDs only after offers are approved and created in the intended Stripe test account; the local catalogue cannot verify account ownership, amount, currency or recurring interval by itself.

## Lifecycle proposal for review

The following is a proposed coherent starting policy, not an approved rule or active implementation:

- Upgrades: take effect only after successful payment; show any prorated amount before confirmation.
- Downgrades: take effect at renewal. Prevent scheduling a downgrade while active sites exceed the target limit; allow the owner to archive sites first, preserving history.
- Cancellation: stop renewal at the end of the paid period. Retain historical read/export access subject to current membership; block new paid-feature work after expiry.
- Unsuccessful payment: retain the last paid entitlement only for an explicitly approved grace period. Grace duration remains undecided; no arbitrary duration is assumed.
- Unknown/unmapped subscriptions: do not infer an upgrade, plan or grace entitlement. Require reconciliation before applying access changes.
- Existing local workspaces: keep their current assignment until an explicitly reviewed transition. Do not automatically charge or revoke them on billing rollout.

Additional required choices: trial eligibility, length, card requirement and expiry behavior; downgrade scope for feature loss; cancellation/refund policy; payment-recovery behavior; and whether inactive subscriptions retain site editing or only historical read/export access. Approval of the proposal above does not supply these missing choices.

## Usage and delivery

AI needs per-plan limits, counting window, failed-attempt treatment and overage behavior. The existing 20-attempt UTC daily default is an operational safety cap, not a published commercial allowance. OpenAI activation remains deferred.

Scheduled reports need per-plan schedule limits, allowed cadences, timezone behavior, permitted recipients, delivery channel and retry/failure policy. Saved reports must pin immutable result versions and recheck scope/recipient authorization before delivery. No email delivery is enabled by this document.

## Implementation order once decisions are supplied

1. Record approved offers/lifecycle decisions with version and provenance.
2. Add tenant-bound customer/subscription records and immutable state revisions retaining provider IDs, catalogue identity and evidence. Local assignments remain explicitly distinct.
3. Verify test prices with the provider; reject inconsistent/unmapped offers.
4. Add owner-only test checkout/portal and signed, durable webhook processing with duplicate/out-of-order reconciliation.
5. Apply approved subscription entitlements and quotas; preserve historical evidence.
6. Add scoped scheduled reports and run lifecycle/security acceptance before live activation.

Point 4 closes at commercial activation only when the decisions are approved, provider configuration is verified and dependent implementations/tests pass. The decision sheet itself is preparatory work.

## Report delivery decision — 26 September 2026

The user selected “Keep delivery manual for now.” Automatic recurrence and report email delivery remain disabled. Continue with explicit retained-report access/downloads and readiness checks; do not treat continued sprint work as approval to enable email or a recurring scheduler. Per-plan cadence, automatic recipient policy and provider retries are deferred until the user requests automatic delivery.
