# EnergiePad V2 feature parity

Sprint 0 discovery, 17 September 2026. These are proposed dispositions for review, not product-owner approvals. Evidence and endpoint/module catalogues are in [LEGACY_FEATURE_INVENTORY.md](LEGACY_FEATURE_INVENTORY.md); field transformations are in [MIGRATION_MAP.md](MIGRATION_MAP.md).

Retain means preserve the business concept. Redesign means preserve useful behaviour with a new workflow/data model. Replace means implement the capability using the V2 architecture. Retire means omit the old implementation or placeholder; it does not authorize deleting customer data. Module-index classifications are navigation aids; this capability matrix governs the proposed product scope.

## Capability matrix

| ID | Legacy capability and evidence | Disposition | V2 destination | Sprint | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| FP01 | Business registration/profile, auth routes and Business settings | Redesign | Organisation onboarding, separate user identity and memberships | 1 | Register, create org, invite, activate; two organisations can contain the same user without data leakage. |
| FP02 | JWT/localStorage auth; PrivateRoute | Replace | Auth adapter, server sessions, permission policy | 1 | Revoked/expired session fails; every role is enforced server-side. |
| FP03 | User Management monthly-read shell; nested users CRUD | Replace | Membership, invitations, role and site assignments | 1 | Owner/Admin permissions and assigned-site restrictions tested; no inferred legacy roles. |
| FP04 | Business contact/address/country/state/currency | Retain | Organisation profile and contact data | 1–2 | Field mapping reconciles all retained attributes; country/state IDs resolved to canonical references. |
| FP05 | Sites, site code/name/type/address/size | Retain | Portfolio → Site → Meter and historical site attributes | 2 | Tenant-scoped CRUD and unique codes; historical corrections do not erase prior results. |
| FP06 | Site population/workinghours; later monthly consumption drivers | Redesign | DriverObservation, SiteAttributeHistory, OperatingSchedule | 2–3 | Values retain period and source; ambiguous legacy precedence is flagged. |
| FP07 | Floors and business building area | Redesign | Optional site-space history or retained legacy extension | 2, 8 | Owner decides UI need; migration preserves data without inventing site association. |
| FP08 | BusinessTenant regular/irregular occupants | Retain | Occupancy driver history | 3 | Correct site/period/end-use mapping; never creates SaaS accounts from occupant counts. |
| FP09 | Building energy fuel/end-use/meter numbers | Redesign | EnergySource, Meter, EndUse and associations | 2–3 | Parse meter identifiers explicitly; overlapping end-use tags do not double-count energy. |
| FP10 | BusinessBrands time bands/rates/days; fuel pricing/VAT | Redesign | Tariff periods, currency/tax settings | 3 | Unit, rate basis and gross/net costs verified; no cross-currency sum without policy. |
| FP11 | Fuel sources/colors, uses and site links | Retain | Managed fuel/unit/end-use catalogs | 3, 8 | Existing labels map to stable identifiers; administrative changes are audited. |
| FP12 | L/m3/kWh and conversion factors | Redesign | Versioned unit conversion with source and normalized values | 3 | Identity conversion, dimensional checks, zero/invalid factors and precision tested. |
| FP13 | Monthly manual consumption; all-month UI expansion | Redesign | Validated consumption editor/bulk API | 3 | Preview repeated monthly entries; preserve actual/estimated status and corrections. |
| FP14 | Business and site workbook import | Replace | Data import wizard and secure invitations | 2 | Both fixture sheets map by headers; credential values never persist or appear in errors; retries are idempotent. |
| FP15 | Utility five-sheet and named-sheet imports | Replace | Versioned mapping templates and per-sheet batch pipeline | 2, 3, 5 | Sprint 3: named-sheet consumption/drivers/setpoints with reusable v1 mappings. Sprint 5: emissions/factors and targets/monitoring imports remain required alongside their models. Rows outside the selected batch remain intact; see WORKBOOK_IMPORT_TEMPLATES.md. |
| FP16 | Log, tenant and pattern imports | Replace | Driver/event imports | 3 | Row counts reconcile; no duplicated column-loop rows or silent 12-row truncation. |
| FP17 | Operating patterns/date ranges/setpoints | Redesign | OperatingSchedule and weather methodology inputs | 3 | Period overlap and driver completeness visible; base temperature/unit persisted. |
| FP18 | Building Energy Log form/read view and log API | Redesign | Operational events and investigation evidence | 3, 6 | Save/read roundtrip implemented; evidence links to site/period and eventual opportunities. |
| FP19 | DegreeDays provider and sample HDD/CDD/daylight arrays | Replace | Weather adapter and stored observations | 3 | Location/methodology correct; provider failure becomes readiness state; live calculations never use sample arrays. |
| FP20 | Single routine regression | Redesign | Deterministic one-driver model | 4 | Approved single-driver fixture, statistics and positive/negative significance tests. |
| FP21 | Multiple routine regression | Redesign | Deterministic HDD/CDD model | 4 | Approved two-driver fixture and correctly keyed driver alignment. |
| FP22 | Three-driver/NRA regression | Redesign | HDD/CDD/daylight model plus approved NRA | 4 | Approved workbook result set, per-period NRA, evidence/author/approval/version preserved. |
| FP23 | Older power/lighting/cooling and end-use-specific calculations | Redesign | Unified engine with explicit supported model policies | 4 | Characterize each legacy scenario; decide any method outside the three V2 formulas before porting. |
| FP24 | Energy Waste, financial/carbon impact, significance | Redesign | Waste & Savings and opportunity conversion | 5–6 | Sign and units correct; pre/post NRA shown; KPI evidence traces to immutable result. |
| FP25 | Utility League ranks, filters, costs and targets | Redesign | Site Performance / Benchmarking | 5 | Comparable sites/periods/units; sorting and missing-data treatment tested. |
| FP26 | Carbon Footprints, manually entered emission factors | Redesign | Versioned factor engine and Carbon dashboard | 5 | Factor validity/geography/unit provenance; old reports unchanged by updates. |
| FP27 | Portfolio across sites/fuels/months | Retain | Portfolio filters and summaries | 5 | Only authorized sites included; aggregate totals reconcile to underlying results. |
| FP28 | Monitoring records and target tables | Redesign | Targets, monitoring and verification | 5–6 | Separate targets from baseline predictions and actuals; distinguish the two legacy target mechanisms. |
| FP29 | Energy efficiency reports and getReport/reports variants | Redesign | Versioned site, portfolio, carbon, savings and baseline reports | 5, 7 | Declared period/input/model/factor metadata and consistent results across screens. |
| FP30 | PNG download and HTML-to-image | Replace | Shared report/export service; optional chart image | 5, 7 | Exports preserve displayed units/filters; chart PNG remains optional. |
| FP31 | Reviews/programmes/answers | Redesign | Structured evidence/checklists linked to actions | 6 | Preserve question, answers, site and end-use; do not automatically mark old answers as verified savings. |
| FP32 | Saving tips and business/site/month mappings | Redesign | Curated investigations and opportunity suggestions | 6 | Tip provenance preserved; recommendation is distinguishable from a measured saving. |
| FP33 | Marketing Home/About/Work/Progress/Team/Blog/Gallery/Contact/Recognitions | Retire from SaaS shell, proposed | Separate marketing property if required | 1 | Owner reviews retained content; no dependence in authenticated workflows. |
| FP34 | Energy Load, Load Costs, Behaviour Change links to # | Retire placeholders | No parity claim; future scope decision | 0 | Documented as placeholders; no invented production feature. |
| FP35 | React/CRA/Bootstrap/Redux/router/form implementation and duplicate JS files | Replace | Next.js, Tailwind/shadcn and typed UI boundaries | 1 onward | Responsive accessible workflows; deterministic logic outside UI. |
| FP36 | Knex/Postgres root and Sequelize/MySQL snapshot | Replace application persistence layer | PostgreSQL/Prisma and explicit migration adapters | 1, 8 | Tenant constraints and migrations tested; source data reconciliation separate from schema replacement. |

## New capabilities required by V2

These are specification requirements without equivalent implementation found in the reviewed source. This is not a claim about the live production service.

| Capability | Sprint | Gate |
| --- | --- | --- |
| Organisation memberships, six roles, site assignments, audit | 1 | Cross-tenant and IDOR tests across reads, writes and relationships. |
| First-class meters, import batches, quality workflow, correction lineage | 2–3 | Idempotency and source-to-normalized traceability. |
| Baseline/NRA approval, algorithm/input snapshots and immutable results | 4 | Repeatable historical calculations with approved golden fixtures. |
| Versioned emission factor administration | 5, 8 | New factor version cannot silently rewrite history. |
| Opportunity lifecycle and verified savings | 6 | Detected → Reviewing → Approved → In Progress → Implemented → Verification → Verified/Rejected with enforced transitions. |
| AI analytical tools, structured outputs, prompt/tool audit and injection controls | 6 | Tenant-scoped tools only, no model SQL, no invented deterministic values. |
| Stripe, plans/trials, entitlements, quotas, payment states | 7 | Signed/retried/out-of-order webhooks handled safely; limits enforced by services. |
| Scheduled reports and AI-assisted narrative metadata | 7 | Versioned results and correct recipient authorization. |
| Platform admin, support impersonation, security/health console | 8 | Reason, banner, expiry and immutable audit; no uncontrolled tenant access. |
| Retention/export/deletion, backup restore and migration cutover | 8 | Dry-run reconciliation, restore exercise and explicit rollback readiness. |

## Review gate

The inventory and proposed mappings are ready for review. Sprint 1 is not approved by this document. Confirm reference source/schema, ownership/role policy, auth provider and repository layout before foundation work. Resolve proposed retirement of marketing/placeholders and preservation/UI treatment of floors, tariffs and questionnaires. Missing fixtures and unapproved expected results/methodology block Sprint 4 acceptance (the prior CD11 formula/cache claim was withdrawn on 22 September); they do not prevent reviewing the foundation design.
