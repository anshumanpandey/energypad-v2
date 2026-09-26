# Pre–Sprint 7 readiness review — 25 September 2026

Scope: current source, Sprint 3–6 acceptance records, compatibility decisions and Sprint 7 design. Sprint 7's read-only billing and policy/catalogue foundations have already started; this review checks what remains before accepting the preceding work or activating commercial behavior. It does not certify production readiness.

The four original Sprint 6 findings and two recheck findings are addressed. The four Sprint 5 recheck items are also recorded as addressed. This review found no additional implementation defect in the inspected paths. Remaining items below are known acceptance dependencies and scope boundaries, not newly discovered regressions.

## 1. Savings methodology and the positive verification path remain incomplete

`apps/web/src/domain/opportunity-verification.ts:33–50` always returns BLOCKED and throws on a VERIFIED request, even for a report labelled VALIDATED. The database independently rejects VERIFIED in `202609250002_opportunity_verification/migration.sql:80`. This correctly prevents unsupported claims, but the Sprint 6 detected-through-verified acceptance gate cannot pass.

Completion requires an explicit versioned methodology decision (including statistical labels/boundaries and numerical edge policies), a corresponding validated-result path and coordinated server/database eligibility changes. Then add positive end-to-end verification acceptance alongside negative, stale-evidence, role and tenant checks. Do not simply remove either guard or relabel existing immutable results.

The approved absolute difference of 0.99, confirmed recalculation, 305 numerical comparisons and 36 exact significance classifications remain accepted. They are not requests for more workbook uploads and do not substitute for methodology approval. Relevant unresolved policy context is CD12/CD14/CD15 and SPRINT_4_ENGINE.md.

Impact: blocks full verification acceptance and claims of validated/verified savings. Independent billing foundations can continue.

## 2. Live AI acceptance and provider operations remain deliberately deferred

The user explicitly deferred OpenAI integration. Deterministic evidence previews and fake-provider tests are implemented, but do not establish live-provider acceptance. As recorded in SPRINT_6_ACCEPTANCE.md, crash/completion-audit failures can leave reservations pending; repeated keys reuse them without another provider call. `ai-generation.ts:35–43` exposes only the latest 20 author-scoped attempts, without historical pagination.

When the user resumes this scope, complete live adversarial/citation acceptance, a safe pending-attempt reconciliation process and older-history access. Preserve usage/audit retention and avoid automatic duplicate charged requests. Do not activate/configure OpenAI as part of this review.

Impact: excludes full live-AI acceptance, but is an authorized deferral rather than a prerequisite for unrelated commercial development.

## 3. Real-source migration reconciliation is still outstanding

Sprint 3 adapters and synthetic reconciliation checks exist, but real production exports/schema review, mapping decisions and count/total reconciliation are not accepted. See LEGACY_ENERGY_MIGRATION.md and SPRINT_3_ACCEPTANCE.md. Existing provenance records and idempotent import tests do not certify real-source parity.

Completion requires reviewed source exports and a dry-run reconciliation report, followed by the Sprint 8 migration/cutover acceptance work. Do not import production data merely to close this review.

Impact: blocks production migration/cutover, not independent Sprint 7 implementation.

## 4. Commercial decisions and provider configuration are missing for activation

SPRINT_7_DESIGN.md lists unapproved prices/currencies and test price IDs; trial eligibility/duration/card/expiry; upgrade proration, downgrade timing and over-limit behavior; cancellation/payment-failure grace; AI and scheduled-report quotas; the 100-site boundary; and tax/invoice ownership. The local test catalogue validator neither populates approved offers nor verifies them with Stripe.

Resolve these decisions before implementing their dependent behavior. Durable subscription state, provider price verification, checkout/portal, signed idempotent and ordered webhook handling, subscription-based access, and scheduled reports are Sprint 7 deliverables, not missing Sprint 6 fixes. Keep existing assigned-plan access until a commercial policy is approved.

Impact: blocks commercial activation and policy-dependent implementation; schema and independent foundations can proceed.

## Validation and recommendation

Fresh focused run: 77 tests across opportunities, verification, supporting evidence, AI evidence and request byte limits passed. Source review confirmed both methodological guards and the AI reservation/history boundaries. No fresh browser, database integration, workbook comparison or external-provider test was run for this review. Prior acceptance runs remain historical evidence.

Proceed with independent Sprint 7 work while retaining items 1–3 as explicitly open or deferred gates. Do not mark Sprint 6 fully accepted or activate payments based on the existing local plan assignment. No application behavior was changed during this review.

Point 1 follow-up: a concrete decision proposal is now available in SAVINGS_METHODOLOGY_V1_PROPOSAL.md. It enumerates exact statistical/edge rules, conservative verification eligibility, immutable assessment requirements and coordinated server/database activation tests. It remains proposed; preparing it does not close point 1 or authorize relabelling results.

Point 2 follow-up: paged private history and audited stale-attempt closure are implemented; see the final section of SPRINT_6_ACCEPTANCE.md. Closure preserves unknown provider outcome/charges and never resends. Live-provider acceptance remains deferred, so point 2 is only partially closed.

Point 3 follow-up (26 September): prepared PRODUCTION_RECONCILIATION.md with source intake, explicit mapping decisions, read-only preview commands and evidence/acceptance fields. Source export/schema paths, target workspace and reviewed mappings have been requested. The real-source gate remains open; no production import is authorized by preparing this record.
