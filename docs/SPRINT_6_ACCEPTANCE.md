# Sprint 6 acceptance

Current review: [Sprint 6 recheck, 25 September 2026](SPRINT_6_RECHECK.md). All four original audit findings are addressed. Both recheck follow-ups are addressed: carbon-evidence review navigation and retry/refresh recovery for verification pickers. Methodology approval remains a separate acceptance gate; OpenAI work remains deferred by user direction. The slices below are historical implementation and validation records.

## First slice: evidence-backed opportunity investigations

Opportunities is now a working investigation register. Waste & Savings links a selected saved run and optional carbon run into the creation form. Owners, admins and analysts may create an investigation for an active site, with a title and rationale. The creator is the initial owner. A run produces at most one investigation per organisation; competing runs are never automatically combined into an opportunity total.

Creation pins the complete `analytics-report-v1` savings report and content hash, retaining original readings, source/model/factor versions, pre/post-NRA results, currencies, unavailable impacts and UNVALIDATED status. This is a user-selected investigation, not an automatic detection claim, forecast of recoverable savings, approved action or verified saving. Subsequent source corrections do not alter its evidence.

The first workflow supports DETECTED → REVIEWING → REJECTED, or DETECTED → REJECTED. Every decision requires a note and exact previous-event ID. Review events append revisions with actor/time metadata; stale changes and terminal-state reopening are rejected. Request keys are bound to actor/scope/payload and support safe retries. Creation and decisions write audit events atomically under the organisation lock. Database constraints scope source runs, owners and event lineage; triggers protect evidence/history from update, delete and truncate and validate transitions.

Current membership and assigned-site access are checked for each read/write. Viewers and assigned site managers may read; they cannot create or review under the existing analysis-write policy. Reads include authorized archived sites, with writes disabled for archived sites. Owner display indicates a revoked membership. The register provides cursor pagination and immutable evidence/history drill-down.

Migration: `202609240006_opportunities`, tested in an isolated database and applied to the verified local development database at 127.0.0.1:55432/energiepad_v2. The existing local PostgreSQL service was restarted with its data retained. Integration coverage exercises creation/retry/deduplication, scoped access, historical evidence after source corrections, review/rejection, stale and forbidden transitions, database immutability and archived/revoked access. Unit tests cover input and transition contracts; browser coverage follows Waste & Savings into creation, review, reload persistence and rejection.

Validation result: 219 unit tests passed; the analysis/database integration suite, the end-to-end analysis/opportunity/report flow, typecheck, lint, formatting and diff checks passed. The mobile opportunity register was visually reviewed.

## Next slices

- Owner reassignment, action records and approval/implementation stages are delivered in the second slice below.
- Verification evidence records, revisions and guarded outcomes are delivered in the third slice below; final verification remains blocked pending methodological approval.
- Retained operational log/checklist/programme and curated-tip evidence links (FP18/31/32) are delivered in the fourth slice below.
- Initial tenant-scoped saved-result tools, structured citations and preview audit are delivered in the fifth slice below. Provider-backed generation and live adversarial validation remain open.

Sprint 6 is in progress. Existing numerical tolerance/workbook decisions remain accepted; separate methodological approval is still open. No AI provider has been configured or production deployment performed in this slice.

## Second slice: owners, action plans and operational approval

The operational lifecycle now supports DETECTED → REVIEWING → APPROVED → IN_PROGRESS → IMPLEMENTED, with rejection from each nonterminal stage. Only owners/admins may approve; analysis writers may prepare plans and record operational progress. IMPLEMENTED is terminal for this slice and is explicitly not verified savings. Existing saved analytical evidence remains UNVALIDATED and unchanged by approval.

`OpportunityWorkVersion` appends owner and action-plan revisions, bound to the exact prior plan and stage event. Initial assignment is still the creator; later reassignment chooses an active owner/admin/analyst in the same workspace. Each action has a stable ID, description, accountable member, optional real calendar due date, progress and completion evidence. Empty plans permit owner reassignment during investigation, but approval requires at least one saved action. Owner candidates require write access to the active site; view-only users cannot enumerate the candidate endpoint. Stored owner labels preserve the action assignment at that revision, while opportunity-owner display reflects the current membership profile.

Approval pins an exact saved plan. After approval, action identities/descriptions/dates cannot change; reassignment remains explicit and versioned. Progress may advance only during IN_PROGRESS, cannot move backwards, and completed evidence cannot be rewritten. Every action must be DONE with completion evidence before IMPLEMENTED. An active eligible opportunity/action owner is required for saving work and operational stage advances. Missing/revoked assignees, stale plans/stages and invalid transitions are rejected. Approval cannot be used as statistical-method approval or verification.

Each stage event stores the selected plan version. Work saves and stage changes share organisation locking, request-key/payload validation, scoped foreign keys and atomic audit writes. Work revisions and history are protected from update/delete/truncate; database lineage and stage constraints retain the original records. The work endpoint accepts a bounded 64 KiB JSON body for up to twenty actions; other JSON endpoints retain their existing limit.

Tests cover forward stages, immutable approved scope, valid dates and completion evidence, actor/assignee restrictions, plan/event conflicts, safe retries, reassignment, audit rollback, historical evidence and read-only terminal states. Migration: `202609250001_opportunity_work`, applied successfully to the verified local development database at 127.0.0.1:55432/energiepad_v2. No production deployment was performed.

Validation: all 223 unit tests, the analysis/database integration suite, the end-to-end analysis/action-plan/report flow, typecheck, lint, formatting and diff checks passed. Browser checks covered blocked approval without a plan, frozen approved fields, completion-evidence requirements, implementation and history after reload; mobile rendering was visually reviewed.

## Third slice: verification evidence and guarded outcomes

Implemented opportunities can now enter VERIFICATION by submitting a separate saved reporting run for the same meter and exact baseline. Its reporting months must follow the original investigation period and start after the recorded implementation completion date. Submission requires supporting references and an explanation, and pins the complete savings report, optional carbon evidence, report hash and completed action-plan revision. Revisions append new records; subsequent source corrections do not rewrite submitted evidence.

Submissions require current analysis-write permission and active-site access. Exact event, plan and previous-verification IDs prevent stale writes; payload-bound request keys permit safe retries. Scoped foreign keys, immutable records, organisation locking and atomic audit writes protect lineage. Owners/admins can reject a verification outcome with a recorded reason; analysts cannot decide the outcome. Archived and rejected records remain readable according to current site access.

Verified savings remains unavailable. Both the service and database reject VERIFIED outcomes while methodological approval is open, including attempts to submit a forged validated report label. The accepted 0.99 absolute workbook tolerance and user-confirmed native recalculation are unchanged; neither is treated as methodology approval. Submission stores an explicit blocked eligibility assessment and exposes experimental variance separately from verified savings.

Migration: `202609250002_opportunity_verification`, tested in isolation and applied to the verified local development database at 127.0.0.1:55432/energiepad_v2. Integration coverage exercises tenant/site/baseline boundaries, reporting periods, concurrent retries, stale revisions, audit rollback, immutable evidence after source corrections, outcome permissions and the database verification block. The next independent slice is retained operational log/checklist/programme and curated-tip evidence links; methodology acceptance remains a separate gate.

Validation: all 228 unit tests, the analysis/database integration suite, the end-to-end analysis/verification/report flow, typecheck, lint and formatting passed. Browser coverage exercised submission, reload persistence, amendment, blocked verification and rejection. No production deployment was performed.

## Fourth slice: operational, programme and tip evidence

Opportunities now accepts three kinds of supporting record: a pinned existing operational-log revision (FP18), a programme/checklist question with its answer list (FP31), and a sourced curated recommendation with category and applicable month (FP32). Each record belongs to the opportunity's organisation/site, preserves its end-use details, and can link to an action in the exact current saved plan. Programme and tip records support paired legacy source/record identities. Tip content is entered from a named source; the application does not claim automatic recommendations or measured savings.

Log snapshots retain their original operation, comments, dates, source, import/legacy identity and end-use record. Later log corrections leave linked evidence unchanged. Programme answers and tips likewise retain complete source snapshots. Amendments create immutable revisions of the same kind, requiring a correction note and rejecting superseded revisions. The form submits a complete replacement revision. The normal view shows the latest revisions; expandable history retains every earlier snapshot, author, time and hash. The log picker offers the latest 100 current site logs; the API also accepts a specific historical log revision belonging to that site.

Only current analysis writers can attach or amend evidence on an active site and nonterminal investigation. Read access follows the existing site/assigned-site policy, including authorized archived history. Exact stage/plan checks prevent stale writes; action and end-use IDs must belong to the selected plan/site. Request-key retries, organisation locking, atomic audit, scoped lineage foreign keys and database immutability protect records. Evidence submission does not advance the opportunity stage, complete an action or alter analytical/verified savings.

Migration: `202609250003_opportunity_supporting_evidence`, tested in isolation and applied to the verified local database at 127.0.0.1:55432/energiepad_v2. This slice provides manually retained evidence and provenance links, not a bulk legacy programme/tip migration, standalone programme builder or global tip catalogue. Tenant-scoped AI tools and citation/audit foundations remain the next Sprint 6 slice; methodology approval remains separate.

Validation: all 232 unit tests and the analysis/database integration suite passed. The browser analysis/opportunity/report flow passed with log attachment, action linking, checklist answers, sourced tips and reload persistence; the mobile supporting-evidence panel was inspected. Integration checks covered amendments/stale revisions, same-site source/action validation, concurrent retries, audit rollback, immutable source snapshots after corrections, closed/archived write denial and assigned-site historical reads. No production deployment was performed.

## Fifth slice: AI evidence tools and audit foundation

AI Analyst now provides an explicitly labelled deterministic evidence preview. The closed server dispatcher supports `saved_baseline` and `saved_savings` only. It retrieves an authorized saved result and copies supported summary values without recalculating them; zero, negative decimal values, unavailable impacts and UNVALIDATED status remain intact. Each fact cites a server-issued source identifier, reporting period and report fingerprint. Source JSON downloads recheck access and fingerprint through the existing report endpoint. A changed source report cannot silently replace the cited version; the stored preview facts remain immutable.

There is no connected AI provider or generated answer in this slice. Questions are not interpreted, cannot select tools or change scope, and are stored only as a SHA-256 fingerprint and character count. Prompt text and raw source evidence are not sent to any external service. A strict fact-selection contract permits only supplied fact IDs and rejects fabricated values, unknown citations, duplicate selections, SQL and caller-defined scope/URLs. This is a tested boundary for a later provider adapter, not live-model prompt-injection validation.

`AIInteraction` records the author, site/organisation, logical tool call, prompt fingerprint, result/citation snapshot and hash, request identity and explicit zero provider/token usage. Creation and the audit event commit atomically. Retries preserve one logical interaction, scoped request keys reject changed payloads, and database triggers prevent mutation/deletion/truncation. History is cursor-paged and private to its author; every request checks current membership and assigned-site access, including retries and archived historical evidence. This preview uses existing evidence-read access, not paid AI generation entitlements.

Migration: `202609250004_ai_evidence`, tested in isolation and applied to the verified local database at 127.0.0.1:55432/energiepad_v2. Remaining AI work includes a configured provider adapter, generated responses through grounded contracts, failed/provider-call traces, retention decisions, usage limits/entitlements and live adversarial tests. Opportunity/supporting-evidence tools and broader analytical tool families can extend the allowlist subsequently. Methodological approval remains separate; this feature never verifies savings or changes opportunity stages.

Validation: the full 238-test unit suite passed, followed by all seven AI evidence tests after adding a nonfinite-number guard (239 distinct tests covered). The analysis/database integration suite, typecheck, lint, formatting and diff checks passed. The end-to-end workflow passed after fixing same-site reselection leaving the preview form disabled; it covers saved-run and baseline previews, zero provider usage, archived evidence, source JSON download, form clearing and history after refresh. Mobile rendering was inspected. No production deployment was performed.

## Sixth slice: configured provider and grounded answers

A server-only OpenAI Responses adapter now requests strict structured selections from the supplied summary facts. The model can return ANSWER with known fact IDs or INSUFFICIENT with no facts. Server validation rejects unknown/duplicate IDs, extra fields, fabricated values and contradictory selections. Published labels, values, units, citations and limitations are copied from the frozen preview, not generated by the model. This is a constrained cited-answer flow, not free-form analytical narrative or causal interpretation.

Only the question, minimal summary facts, reporting period and validation status are sent to the fixed provider endpoint. No database tools, credentials, source notes, tenant identifiers or raw worksheets are supplied. Requests set `store: false`; this does not claim zero provider retention. Questions remain fingerprint-only in the application database. The adapter has a 45-second timeout, bounded response size and output-token budget, no automatic retry, and explicit refusal/incomplete/error handling. Known provider token usage and response/model identifiers survive validation failures; unknown usage remains null rather than zero. See [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

`AIGeneration` reserves each request and its audit event before the external call. Organisation locking enforces one logical request per key and a workspace-wide UTC daily attempt cap (default 20, configurable 1–1000). Attempts including failures count toward the cap. Existing plan AI entitlement is enforced server-side for new generation; billing-state integration remains Sprint 7. The preview must belong to the same author/site/workspace. Concurrent/retried requests return the existing pending/completed attempt and never make a second provider call. Completed results and usage append an immutable `AIGenerationOutcome` with an atomic audit event. Access is rechecked after the call; revoked callers receive no answer while the usage/outcome is retained.

A crash or completion-audit failure leaves the reservation pending. Repeating its key does not resend the request; reconciliation is an explicit operational follow-up, not an automatic retry that could duplicate charges. History currently shows the author's latest 20 attempts with current assigned-site access checks. The UI includes configuration/entitlement states, explicit provider disclosure, generation, refresh, insufficient/failed states, citations and usage.

Configuration requires `OPENAI_API_KEY` and `OPENAI_MODEL` in the server environment; neither is currently set locally. `AI_DAILY_ATTEMPT_LIMIT` defaults to 20. Choose a model supporting Responses structured outputs. Production uses `/etc/energiepad/runtime.env`; no secrets are stored in the repository and no production configuration or deployment was changed. Migration: `202609250005_ai_generation`, tested in isolation and applied to the verified local database at 127.0.0.1:55432/energiepad_v2. Live provider/model acceptance and adversarial tests remain pending configuration. Tests use injected providers and HTTP/browser stubs, not an actual OpenAI request.

Validation: all 244 unit tests, the analysis/database integration suite, typecheck, lint, formatting and diff checks passed. Browser coverage passed for disabled/unconfigured generation and stubbed cited answers, token display and form clearing; mobile rendering was inspected. Adapter tests cover strict request shape, refusal/truncation, malformed JSON, response-size and timeout limits, unknown usage and no automatic retries. Integration tests cover entitlement/cap, concurrency, privacy, invalid citations, reservation/completion audit failures, immutable outcomes and permission revocation during an external call. No live provider request or production deployment was performed.

## Seventh slice: opportunity evidence reports and previews

User direction: OpenAI API configuration and live integration acceptance are deferred. Existing provider code remains unconfigured; this slice does not require or call a model.

Each opportunity now offers a scoped JSON evidence export containing its original analytical evidence, stage history, action-plan versions, supporting logs/programme answers/tips and verification revisions. The report distinguishes operational stage/action completion from verified savings, which remains null. Current supporting-record counts exclude superseded revisions while the complete revision history remains in the source. Reporting dates describe the original saved analysis. Request keys and request hashes are excluded from the exported opportunity/history envelopes.

The deterministic evidence preview allowlist now includes `saved_opportunity`. It summarizes operational progress with a citation to an exact retained report snapshot. Unlike a current-state download, the preview's source endpoint returns the stored report even after later reviews, corrections or owner changes; its fingerprint is verified before export. Current-state exports can optionally require an expected fingerprint and reject changed evidence. Every source download rechecks membership/site access; preview source snapshots additionally require the original author. Archived reports remain available to currently authorized readers.

Migration: `202609250006_opportunity_evidence_tool`, tested in isolation and applied to the verified local database at 127.0.0.1:55432/energiepad_v2. The report reads under a repeatable-read transaction, with immutable preview persistence and atomic audit inherited from the evidence foundation. No calculations are rerun and no workflow states are advanced. OpenAI live acceptance and provider-specific follow-ups remain deferred; methodological approval is still separate.

Validation: all 246 unit tests, analysis/database integration tests, the browser workflow, typecheck, lint, formatting and diff checks passed. Browser coverage downloads the current investigation report and the retained preview source with supporting and verification history. Integration coverage confirms stage-change fingerprint rejection, unchanged retained downloads, private preview ownership, wrong-site/outsider denial and archived-history access. No external AI calls or production deployment were performed.

## Operational-log discovery (audit point 1)

Supporting evidence now pages through operational logs in groups of 25, searches event codes/operations without case sensitivity, and optionally includes superseded revisions. Exact revision-ID lookup selects an authorized current or historical revision directly. Search/paging retains the selected revision even when it is outside the results. Historical entries are labelled as superseded. Search and lookup buttons do not submit evidence; Enter in those inputs performs the lookup instead of submitting the enclosing form.

GET `/api/v1/organisations/:org/sites/:site/opportunities/supporting-options` accepts `cursor`, `query` (up to 100 characters), `historical=true|false` and optional exact `id`. Responses retain `energyUses`/`logs` and add `nextCursor` and revision status. Cursors are checked inside the selected tenant/site/search scope; ordering uses creation time and ID to handle ties. Queries run under repeatable-read isolation and preserve active-site/analysis-write access checks. Exact lookup cannot expose a different site's revision. Attachment continues to reauthorize and pin the selected source independently of the picker.

Integration coverage traverses 106 current records with tied timestamps without duplicates or gaps, finds a superseded revision, rejects foreign or mismatched-filter cursors/IDs and confirms an existing attachment is unchanged by source corrections. No database migration or external provider is required. OpenAI work remains deferred; audit points 2–4 and methodological approval remain open.

Validation for audit point 1: all 253 unit tests, analysis/database integration, the full analysis/opportunity browser workflow, typecheck, lint, formatting and diff checks passed. Browser coverage loads an older page, searches historical revisions, retains selection through an empty search, looks up the exact superseded revision and attaches its original comments to the action. No production deployment was performed.

## Saved carbon evidence in savings previews (audit point 2)

The savings preview form now accepts an optional saved carbon run ID. Other tools reject carbon selection. The existing savings report service enforces tenant/site and meter scope and matches exact consumption revisions before supplying carbon facts. Missing selection or incompatible reading revisions leave carbon facts unavailable.

Preview request hashes include the carbon selection, so changing or removing it on a retry conflicts. Citations obtain the carbon ID from the validated report; JSON source downloads include both saved IDs and the expected report fingerprint. Original immutable snapshots remain authoritative after factor or reading corrections. Existing previews without carbon IDs remain readable. No schema migration, external provider or methodology change is required.

Integration coverage checks compatible carbon values, wrong-site/meter denial, incompatible reading revisions, unchanged retries, changed-selection conflicts and source download fidelity. Unit coverage restricts carbon selection to savings and preserves carbon identity and values in citations. Browser coverage selects a saved carbon run, downloads its cited source, checks form reset and confirms the field is absent for baseline previews.

Next: audit point 3, verification run selection. Audit point 4 and methodological approval remain open; OpenAI work remains deferred.

Validation for audit point 2: all 254 unit tests, analysis/database integration, the full analysis browser workflow (including archived carbon evidence), typecheck, lint, formatting and diff checks passed. No production deployment was performed.

## Verification run selection (audit point 3)

Verification forms now ask for the implementation date before loading saved reporting runs for the opportunity's meter and exact baseline. Options show period, calculation status, validation status and saved ID. Original or overlapping runs and runs that start before a full calendar month after implementation are disabled with reasons. Lists load 25 entries at a time and retain the selection while older pages load. Empty eligible results explain how to create a suitable run or inspect older pages.

Selecting a reporting run loads optional saved carbon choices for its meter. Only snapshots with factors matching every calculated month and exact consumption revision are selectable. No carbon selection remains valid. Changing the date clears both selections; changing the reporting run clears carbon selection. The picker does not change the independent methodology gate.

GET opportunity `verification-options` requires an ISO implementation date and accepts an optional reporting run ID (for carbon choices) and cursor. Scope and cursor membership are rechecked in a repeatable-read transaction with active-site analysis-write access. Archived sites expose existing verification history without a form; picker requests are denied. Submission retains its independent period, baseline, meter, permission and stale-evidence checks.

Integration coverage verifies eligible/ineligible dates, original runs, foreign scope, incompatible baselines, invalid cursors, matching/incompatible carbon snapshots, reporting pagination with tied timestamps and archived-site denial. The browser workflow covers date filtering, disabled submission with no selection, visible baseline information, reporting selection, optional missing carbon, submission and revision.

Next: audit point 4, aligning request-size limits with valid text inputs. OpenAI integration remains deferred; methodology approval remains separate.

Validation for audit point 3: all 255 unit tests, analysis/database integration, the full analysis browser workflow, typecheck, lint, formatting and diff checks passed. No deployment or external provider calls were performed.

## Request byte budgets (audit point 4)

All five opportunity write endpoints now use named, route-specific caps: creation and review 32 KiB each, action plans 320 KiB, verification 64 KiB, and supporting evidence 160 KiB. The action-plan budget covers twenty maximal titles/completion records and the note; the programme budget covers twenty maximal answers and all provenance fields. Verification covers all ten references and the full explanation. Creation/review are included because escaped text could also exceed their former default caps.

Budgets allow six serialized JSON bytes per UTF-16 code unit plus keys, IDs and syntax. This covers UTF-8 text, escaped controls, astral characters and lone-surrogate escaping without reducing accepted field lengths. The finite caps still apply to transport padding and untrimmed excess whitespace. Streaming byte counting, HTTP 413 responses and schema-level validation are unchanged; other API routes keep their existing caps. The checked-in Lightsail preview proxy's 20 MiB cap exceeds these request budgets.

Forty-nine focused tests use the actual HTTP body reader: seven payload families at schema maxima under six encodings, each route cap exactly and one byte over, streamed oversized input with a false Content-Length and cancellation, and preservation of content-type/JSON/schema errors. This change does not require database mutations or UI changes.

All four independent Sprint 6 audit items are addressed. Methodology approval remains separate, and OpenAI integration/live acceptance remain deferred. Next: Sprint 7 planning and its outstanding commercial-policy decisions.

Validation for audit point 4: all 304 unit tests (42 files), typecheck, lint, formatting and diff checks passed. The boundary suite exercises the real streamed HTTP body reader. Database/browser suites were not rerun for this transport-cap change; their passing results for audit point 3 remain the preceding baseline. No deployment was performed.

## Investigation review navigation (recheck point 1)

“Review saved analysis” now includes the optional carbon run retained in the investigation's evidence, alongside the site and saved reporting run. The link uses structured URL query parameters; investigations without a saved carbon run omit the parameter. Destination authorization and reading-revision checks remain unchanged.

Browser regression coverage creates a carbon-backed investigation, corrects its emission factor, calculates a newer carbon run, and follows the link to confirm the original run IDs and exact pre/post carbon values. A separate investigation without carbon confirms the optional parameter stays absent. Recheck point 2, verification picker retry/refresh, remains open.

Validation for recheck point 1: the full analysis browser workflow passed, including original carbon values after factor correction/new calculation and the no-carbon link case. Typecheck, lint, formatting and diff checks passed. No database schema changes, production deployment or external provider calls were made.

## Verification picker recovery (recheck point 2)

Reporting and optional carbon selectors now provide Retry after a failed initial request and Refresh for successful/empty lists. Refresh starts at the first page and replaces its cursor; selecting an older immutable run is preserved separately from loaded options. Older-page results are deduplicated. Date/reporting-run changes still reset dependent choices, while refresh retains the current choices and unsaved references/explanation.

Each request has a generation guard, and picker state is keyed by the complete scoped URL. Responses from an older request or unmounted date/run scope cannot replace the current options. Buttons are non-submitting and respect loading/form-disabled states. Server scope, eligibility and submission checks remain unchanged.

Browser regression covers failed initial reporting/carbon requests and retry, discovering newly saved reporting and compatible carbon runs via refresh, retaining selections and draft text, ignoring a delayed refresh after a date change, and submitting the selected carbon evidence. Both numbered recheck follow-ups are now addressed; methodology approval and deferred OpenAI acceptance remain separate.

Validation for recheck point 2: the full analysis browser workflow passed, including persistent simulated outages until Retry, new-run discovery, delayed-response isolation, selection/draft preservation and the submitted carbon run ID. Typecheck, lint (without warnings), formatting and diff checks passed. No database schema changes, production deployment or external provider calls were performed.

## Pre–Sprint 7 point 2 — interrupted AI attempts and older history

Added author-private, tenant/site-scoped cursor history in pages of 20 through GET `ai-answers/history`. Cursors are scoped and validated; timestamp ties use IDs. Reads use repeatable-read isolation. The original latest-20 endpoint remains compatible. The UI loads older attempts, refreshes the first page and resets state when the site path changes.

POST `ai-answers/:id/reconcile` lets the original currently authorized author close a reservation older than 24 hours as FAILED / INTERRUPTED_OUTCOME_UNKNOWN. It does not send another provider request, infer zero charges, refund attempt quotas or delete evidence. The conservative 24-hour stale threshold exceeds the provider's 45-second request timeout. Recent attempts return 409. Existing outcomes are returned idempotently. Closure and audit are atomic under the organisation lock.

Normal completion uses the same lock. If a late provider response arrives after reconciliation, it cannot overwrite the retained outcome; its status, returned usage and response metadata are retained in a late-completion audit. Reusing the original request key still does not resend. A failed audit rolls back its associated state change. Reconciliation is an explicit unknown-outcome closure, not a claim to have recovered a provider answer or reconciled an invoice.

Database tests cover tied-page traversal, private cursors, wrong-site/user/tenant access, fresh-attempt rejection, concurrent reconciliation, audit rollback, late completion with retained usage, and retry without another provider call. Browser coverage uses stubs for older history and recovery. Live-provider adversarial acceptance remains open under the prior OpenAI deferral; no API key/model was configured or live request made. Point 2's operational gaps are addressed but its live-acceptance gate is not closed.

Validation: all 329 unit tests, the analysis PostgreSQL integration suite (including recovery/late-completion races and history privacy), the full analysis browser workflow (3.5 minutes), typecheck, lint, formatting and diff checks passed. No schema migration, production deployment or external AI calls were performed.
