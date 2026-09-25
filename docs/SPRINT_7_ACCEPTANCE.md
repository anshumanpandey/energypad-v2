# Sprint 7 acceptance record

Status: in progress. The first increment delivers a read-only, owner-only assigned-plan and usage overview. Subscription lifecycle, Stripe, effective billing-state entitlements, commercial quotas and scheduled reports remain open.

## Delivered

- Billing page with assigned plan, active-site usage, remaining/unlimited capacity and explicit over-limit status.
- Plan inclusion labels distinguish entitlements from feature availability and paid-subscription state.
- Owner-scoped GET billing API; current membership checks on every read.
- One consistent transaction for plan and capacity reads; archived sites excluded.
- No prices, subscription dates, trial claims or payment actions inferred from the assigned plan.

## Acceptance coverage

Foundation integration covers every non-owner role, cross-tenant requests, membership revocation, archived sites, unlimited plans, plan changes and over-limit capacity. The browser test covers account/workspace creation, owner navigation, live capacity after site creation/archive, the read-only subscription notice, mobile overflow and signed-out API rejection.

Commercial lifecycle acceptance is not established by these checks. See SPRINT_7_DESIGN.md for the remaining sequence and required decisions. Sprint 6 methodology approval and deferred OpenAI acceptance remain separate.

Validation: all 11 foundation PostgreSQL integration scenarios, the dedicated billing browser workflow, typecheck, lint, formatting and diff checks passed. Mobile layout was visually inspected. No full unit-suite rerun was needed for this read-only increment; the preceding 304-test baseline remains recorded under Sprint 6. No production deployment or external billing/AI calls occurred.
