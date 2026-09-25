# Sprint 6 acceptance

## First slice: evidence-backed opportunity investigations

Opportunities is now a working investigation register. Waste & Savings links a selected saved run and optional carbon run into the creation form. Owners, admins and analysts may create an investigation for an active site, with a title and rationale. The creator is the initial owner. A run produces at most one investigation per organisation; competing runs are never automatically combined into an opportunity total.

Creation pins the complete `analytics-report-v1` savings report and content hash, retaining original readings, source/model/factor versions, pre/post-NRA results, currencies, unavailable impacts and UNVALIDATED status. This is a user-selected investigation, not an automatic detection claim, forecast of recoverable savings, approved action or verified saving. Subsequent source corrections do not alter its evidence.

The first workflow supports DETECTED → REVIEWING → REJECTED, or DETECTED → REJECTED. Every decision requires a note and exact previous-event ID. Review events append revisions with actor/time metadata; stale changes and terminal-state reopening are rejected. Request keys are bound to actor/scope/payload and support safe retries. Creation and decisions write audit events atomically under the organisation lock. Database constraints scope source runs, owners and event lineage; triggers protect evidence/history from update, delete and truncate and validate transitions.

Current membership and assigned-site access are checked for each read/write. Viewers and assigned site managers may read; they cannot create or review under the existing analysis-write policy. Reads include authorized archived sites, with writes disabled for archived sites. Owner display indicates a revoked membership. The register provides cursor pagination and immutable evidence/history drill-down.

Migration: `202609240006_opportunities`, tested in an isolated database and applied to the verified local development database at 127.0.0.1:55432/energiepad_v2. The existing local PostgreSQL service was restarted with its data retained. Integration coverage exercises creation/retry/deduplication, scoped access, historical evidence after source corrections, review/rejection, stale and forbidden transitions, database immutability and archived/revoked access. Unit tests cover input and transition contracts; browser coverage follows Waste & Savings into creation, review, reload persistence and rejection.

Validation result: 219 unit tests passed; the analysis/database integration suite, the end-to-end analysis/opportunity/report flow, typecheck, lint, formatting and diff checks passed. The mobile opportunity register was visually reviewed.

## Next slices

- Owner reassignment, action records and approval/implementation stages, with explicit evidence and permissions.
- Verification records and guarded final outcomes; experimental calculations must not become verified savings through a workflow label alone.
- Retained operational log/checklist/programme and curated-tip links (FP18/31/32).
- Tenant-scoped AI tools, structured evidence citations, prompt/tool/usage audit and adversarial isolation tests.

Sprint 6 is in progress. Existing numerical tolerance/workbook decisions remain accepted; separate methodological approval is still open. No AI provider has been configured or production deployment performed in this slice.
