# EnergiePad V2 — sites and import

An isolated Next.js application alongside the legacy Express/React applications. It has its own dependencies, database and migrations. Run commands **from this directory**, not the repository root. Nothing here migrates legacy data.

## Local development

Requires Node.js 22.12+ and npm. Node 22 is used in CI. Development and builds explicitly use Next.js’s Webpack compiler for portability in restricted environments.

```sh
cd apps/web
npm ci
npm run db:generate
npm run local:services
```

The last command starts PostgreSQL on `127.0.0.1:55432`, stores it under `.local/postgres`, and creates a private `.env` with a random auth secret if one does not exist. It does not change existing environment files. Leave that terminal running. The embedded PostgreSQL binary runs as your normal user; Docker and sudo are not required. Do not run it as root.

In another terminal, from `apps/web`:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

Open **http://localhost:3100** (use this hostname to match `AUTH_URL`). Sign in with an email address. In development, with no `RESEND_API_KEY`, email messages are captured as private JSON files under `.local/mail`. Open the newest file and follow the URL in its `text` field. Nothing is delivered to an external recipient. The inbox is deliberately not exposed through HTTP. Treat these files as credentials and delete expired messages when no longer needed.

After verification, create an organisation, invite a teammate, and open their invitation in a separate browser profile. Sign in with the **invited email** and accept. Settings and role management require Owner/Admin; only Owners can manage other Owners. Create another organisation from the sidebar and use the workspace selector to switch.

The plan seed is idempotent and creates only the four internal plan definitions. It does not create users, demo metrics, sites or credentials. Site/portfolio management, meters and site workbook imports are available. Energy data, analysis, reports, billing and legacy account migration remain later sprints.

To use an existing **dedicated V2** PostgreSQL server instead, copy `.env.example` to `.env`, set `DATABASE_URL` and a random `AUTH_SECRET`, and omit `local:services`. Never point the migration commands at a legacy or shared production database.

## Verification

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npx playwright install chromium
npm run test:e2e
npm audit --audit-level=high
```

Integration and browser tests each create a uniquely named disposable database. They do not reset `DATABASE_URL`. By default they start their own temporary PostgreSQL cluster; in CI, `TEST_DATABASE_ADMIN_URL` points to a test-only PostgreSQL service with permission to create/drop databases. The browser harness starts a separate app at `localhost:3101`, uses `.next-e2e`, captures email locally and deletes its database when it exits. Browser output lives under `test-results` and `playwright-report` (gitignored). Failed browser traces can contain test sign-in tokens; retain them only in private CI artifacts.

## Structure

- `src/domain/policy.ts`: validated inputs, role matrix and internal entitlements.
- `src/server/foundation.ts`: tenant-aware transactional use cases; usable independently of the UI.
- `src/server/auth.ts`, `mail.ts`: Auth.js database sessions and email delivery adapter.
- `src/server/http.ts`: authentication, origin enforcement, bounded input and safe problem responses.
- `src/app/api/v1/[...segments]/route.ts`: REST transport.
- `src/app`, `src/components`: responsive workspace and reusable Radix-based button primitive.
- `prisma`: PostgreSQL schema, migration and plan seed.
- `scripts`, `tests`: local runtime and security/browser tests.

Auth.js is pinned to `5.0.0-beta.32`; it is a deliberate pre-release dependency behind the auth boundary, requiring review before deployment. `.npmrc` omits unused peer dependencies, including the unused Nodemailer provider. Required peers are explicit dependencies. `deepmerge-ts` and `mysql2` overrides pin patched transitive Prisma utilities; migration/build checks cover the Prisma paths used here. ExcelJS’s uuid dependency is overridden to 11.1.1 to address its audit advisory; XLSX read/write tests exercise compatibility. Review overrides when upgrading these packages.

## Production configuration (not deployed)

Set a dedicated PostgreSQL `DATABASE_URL`, an HTTPS `AUTH_URL`, a cryptographically random `AUTH_SECRET`, a Resend `RESEND_API_KEY` and `EMAIL_FROM` using a verified sender domain. Mail capture is disabled in production; missing delivery configuration fails closed. Restrict the application database role to normal DML, and use a separate migration role so the application cannot disable triggers. Set the trusted proxy/host configuration for the chosen host and redact auth callback/invitation URLs in ingress logs. The app does not log raw tokens.

Migrate and seed before starting the app. Production backup/restore, retention, legal policies, abuse controls at the ingress, observability and legacy cutover remain deployment/Sprint 8 work. This implementation does not send real email, deploy, configure billing, or import legacy accounts.

See [Sprint 1 design](../../docs/SPRINT_1_DESIGN.md), [security model](../../docs/V2_SECURITY.md) and [acceptance evidence](../../docs/SPRINT_1_ACCEPTANCE.md).

## Sprint 2 workflow

Owners/Admins can create portfolios, add sites, maintain meter records and append site attribute snapshots. Archive removes a resource from active use while preserving history and audit. Site managers only read assigned sites. Portfolio grouping is available as a structural feature; paid portfolio analytics remain future work.

Data accepts XLSX files up to 2 MB, with up to 10 sheets, 50 columns and 2,000 rows per sheet (10 MB expanded ZIP limit). Header row is row 1. Password/credential columns are discarded before database staging; the raw workbook is not saved. Formula/error cells are rejected. Choose a sheet, map fields/defaults, select the source business email when present, and confirm the sites belong to the current organisation. Supply missing codes or a prefix and an effective date for any historical attributes. Units must already be m² and hours/week. Download row errors, correct mapping or re-upload corrected data, then validate and commit. Commit rechecks site codes and the plan limit atomically. Repeated identical sanitized uploads reuse a batch; a committed batch cannot be imported twice.

Imports create new sites only. Existing codes, including archived codes, are rejected rather than updated. Business-account sheets do not create accounts or organisations; invitations remain the account activation workflow. Original fixture credentials never become customer identities. Consumption import and calculations are Sprint 3+. No original workbook or calculation fixture is rewritten.

See [Sprint 2 design](../../docs/SPRINT_2_DESIGN.md) and [acceptance](../../docs/SPRINT_2_ACCEPTANCE.md).

### Optional 2020 demo energy data

Run `npm run db:seed:energy-2020 -- <organisation-uuid>` against the local development database. This creates `TEST-2020` / **Test Site — 2020 Demo**, historical attributes, one electricity meter and 12 synthetic estimated monthly readings for 2020 (113,900 kWh total). Costs use a synthetic GBP 0.15/kWh net rate and 20% VAT. These are demonstration values, not measured data or a real tariff.

The seed requires an existing workspace with a verified owner, uses the normal authorization/site-limit/audit services, and is separate from plan seeding. Repeated runs skip existing readings and never overwrite unrelated or changed records. It refuses production mode and non-local database hosts.

### Import monthly consumption

In **Energy**, select a site and load its records, then use **Import consumption workbook**. Select an active meter and upload an XLSX with a header row and 1–120 monthly readings in the chosen sheet. Map month (YYYY-MM text), quantity and source unit; supply `actual` or `estimated` as reading status. Optional fields include net cost, VAT percentage, currency, end use and legacy reference. Mapped columns take precedence over defaults. Units must match the selected meter; configure sourced factors first for physical units.

Validate and review the preview before committing. Download CSV errors to fix invalid rows. Each commit is atomic and retry-safe; reopening or changing mapping requires revalidation. Existing periods are rejected rather than overwritten. The importer discards credential columns and rejects formulas/macros/external links under the same limits as site imports.

### Monthly drivers and schedules

Load a site/year on Energy to see observed-driver completeness, enter monthly average population or monthly total operating hours, and record planned weekly schedules. A schedule is planned hours per week over inclusive dates; it does not supply actual monthly observations. Zero is valid. Keep unknown observations missing, and provide an explicit source for every entry. Existing driver/month records are not overwritten.

Driver imports accept an XLSX with one sheet and headers `month`, `driver`, `value`, `source` (in any order). Use text months such as `2020-02`, driver codes `POPULATION` or `OPERATING_HOURS`, numeric values and a source reference. Population is monthly average people; operating hours are monthly total elapsed site hours. Do not import legacy daily/weekly workingHours without resolving their basis. Up to 240 rows per workbook, 2 MB; no formulas. Preview all rows, fix reported errors and confirm the site/basis before committing. Recent imports can be reopened; repeated commits do not duplicate data. Owner/Admin writes and assigned-site read restrictions apply.

### Historical weather

On Energy, load a site/year and configure explicit coordinates, IANA timezone, heating/cooling bases (°C), and their source. Save a version, then fetch its completed calendar year. No site location or base is inferred. The request sends coordinates/timezone/dates to Open-Meteo. ERA5 reanalysis is modeled historical weather; no station identity is claimed. Every daily temperature/daylight value must be present and valid. Results include monthly means, HDD/CDD, daylight hours and provenance. Changing settings preserves old results, selectable by version. Missing months/days are never replaced with zero. Fetch supports 1940 onwards, allowing seven days after year end for publication.

Development without `OPEN_METEO_API_KEY` uses Open-Meteo's public evaluation endpoint. Set this server-only key in production with a subscription entitled to the Historical Weather API; the adapter uses the customer archive endpoint. See [Open-Meteo documentation](https://open-meteo.com/en/docs/historical-weather-api) and [commercial access](https://open-meteo.com/en/pricing). Keys are excluded from persisted provenance and sanitized errors. Requests time out after 25 seconds. Enrichment is queued for the separate weather worker described below.

Weather settings and results are immutable. The methodology is `daily-mean-degree-days-v1`: sum positive daily heating-base minus mean-temperature differences for HDD, and positive daily mean-temperature minus cooling-base differences for CDD. Daylight seconds are summed and converted to hours. Aggregates round to three decimals, and validated daily inputs are retained for reproduction. Existing consumption and observed-driver data are not rewritten.

### Weather worker

Run `npm run weather:worker` from `apps/web` alongside the web server, with the same `DATABASE_URL` and `OPEN_METEO_API_KEY`. The worker loads local `.env` for development; inject these variables for production and set `NODE_ENV=production`. Deploy a supervised long-running worker process with restart-on-failure and at least 30 seconds for graceful termination. No browser tab or incoming web request is needed to process queued work. Without a running worker, jobs remain safely queued and the UI shows that they are waiting.

The worker checks every two seconds, claims a job for 90 seconds, and recovers expired claims. Three attempts are allowed per cycle. Transient errors retry after 30/120 seconds, throttling after five minutes, and the organisation call limit after one hour. Configuration/access errors fail immediately. The Energy panel shows persisted status and polls every five seconds while jobs are active. An Owner/Admin may retry a failed job; this resets its cycle count, retains lifetime attempts/audit history and rechecks site access. Concurrent workers cannot save duplicate results or overwrite each other's completed jobs. SIGTERM/SIGINT lets the current request finish before disconnecting.

### Correct readings and conversion factors

On Energy, an Owner/Admin can choose **Correct reading** or **Correct conversion factor** and supply a reason. Saving creates a new revision; **View reading history** and **View factor history** retain previous values, author/time and provenance. Annual coverage counts the latest reading only. Cancel leaves the saved value unchanged.

Reading corrections keep the original meter, calendar month, source unit/fuel, site-attribute snapshot and import reference. They can change quantity, costs, VAT, currency, estimated status and end use. A physical-unit reading keeps its original factor unless **Apply the current sourced conversion for this month** is explicitly selected. Correcting a factor never silently recalculates existing readings.

Only full calendar months are supported; no billing-period proration or period reassignment is performed. Workbook imports create new periods; correct an imported reading individually to retain its origin. Monthly observations and operating schedules also offer correction forms and revision history. Observation month/driver/import origin stay fixed; schedule dates may change if they do not overlap another current schedule. Corrections require a reason and preserve prior values, author/time and sources. Only current observations count toward coverage; schedules do not populate actual observations.

### Site end uses and tariffs

Load a site in Energy and open **Tariffs and end uses**. Register a permanent site end-use code/name/fuel and source. Optional legacy identifiers require a named source system; association IDs also require their source table. The panel lists all saved tariff periods independently of the consumption year filter.

Add a tariff with explicit dates, currency, rate unit, VAT inclusion/percentage, timezone and source. Enter rates in major currency units (GBP rather than pence), select weekdays and add local time bands. End times are exclusive; 24:00 means midnight at the end of the selected day. Split overnight bands across days. Overlapping bands/periods are rejected; uncovered hours have no defined rate.

Use **Correct tariff** with a reason to save a new revision, and **View tariff history** to inspect prior rates and provenance. Corrections keep the site end use fixed. Tariffs do not automatically calculate bills, change consumption costs or allocate meter readings. Existing reading end-use labels remain independent. Shared catalog and explicit association support is described below; reviewed legacy migration adapters remain separate work.

### Shared energy catalogs and reading associations

Energy now offers an organisation-wide **Shared energy catalog** for fuel and end-use labels/colours/source identities. Owners and admins can add entries or correct their display values and retire them with a reason. Codes, fuel and legacy identities stay fixed. History is preserved; retirement prevents new site registrations.

When registering a site end use, optionally select current active catalog versions matching its fuel. That site use keeps the selected versions after later catalog edits. Manual readings can select a registered site end use; **Correct reading** can link or unlink older records. The existing original label remains separate, and history includes the saved association and catalog versions. Association does not allocate quantity or calculate costs.

Consumption imports accept an optional **Registered site end-use code** column/default. Codes are case-insensitive, resolved within the selected site and checked against the meter fuel. Review the resolved link and original label in the preview. Omit the code to import unlinked readings. Existing site uses remain valid for readings after their pinned catalog versions are retired.

### Legacy tariff/catalog dry run

Use `npm run migration:preview:tariffs -- <organisation-id> <verified-owner-or-admin-id> <bundle.json> <new-report.json>` for a read-only mapping and reconciliation report. It accepts a bounded six-table JSON export and explicit decisions for site/fuel/use identity, dates, weekdays, units and tax/rate basis. No application records are written. Existing destinations and ambiguous mappings are blockers; reports are private and never overwrite existing files.

See [LEGACY_TARIFF_DRY_RUN.md](../../docs/LEGACY_TARIFF_DRY_RUN.md) and the synthetic example there. Ready means ready for review, not committed or approved. After review, use `npm run migration:apply:tariffs -- <organisation-id> <verified-owner-or-admin-id> <bundle.json> <reviewed-report.json>`. It atomically writes destinations and a durable immutable receipt; identical retries reuse the batch. Independent existing records remain conflicts.

### Occupancy history

Energy → **Occupancy history** stores separate regular/irregular counts for an explicit inclusive date range and registered site end use. Use equal dates for a dated count; blank means unknown. Counts never populate monthly average population automatically. Owners/Admins can add or correct counts/source; history preserves old values and reasons.

Import one XLSX sheet with `firstDay, lastDay, energyUseCode, regularCount, irregularCount, source, legacySource, legacyId` headers (1–240 rows, 2 MB). Use YYYY-MM-DD text dates, whole counts and registered end-use codes. Legacy reference cells may be blank; an ID requires a namespace. Review the preview and confirm before committing. Duplicate identities, overlapping periods, invalid counts and unknown site end uses block the whole import. Recent imports support recovery and safe retry.

## End-use operating patterns

Energy → Operating patterns preserves inclusive validity dates, a registered site end use, annual active days (0–366 or unknown), and temperature/setpoint evidence (up to three decimals, original C/F/UNKNOWN unit and HEATING/COOLING/OTHER/UNKNOWN context). Blank stays unknown and zero is retained. No conversion, annual proration, daily schedule, observed operating hours or weather base is inferred. Source and namespaced legacy identity remain available.

Missing values/unresolved temperature semantics and annual days exceeding the validity interval are visible review warnings. The original annual value is retained, since it may describe a yearly pattern with a shorter validity range. Current intervals cannot overlap for the same site end use; adjacent intervals are allowed. Required-reason corrections can change dates, days, temperature/unit/context and source while preserving end use, legacy identity and import batch. History follows the immutable revision chain even when dates change. Author/time and audits are retained; database triggers reject update/delete/truncate and invalid lineage.

Owners/Admins may write; readers require site access. Imports use one XLSX sheet, 1–240 rows, 2 MB, with exactly `firstDay, lastDay, energyUseCode, daysOnYear, temperature, temperatureUnit, temperatureContext, source, legacySource, legacyId` columns. Use YYYY-MM-DD text dates; leave missing days/temperature blank, and explicitly use UNKNOWN for unresolved unit/context. Legacy references may be blank. Map legacy site/use IDs to the chosen site and registered code before upload. Preview shows every row, reconciliation counts, errors and review warnings. Commit rechecks current permissions/site/end-use/conflicts and writes all rows/audits/batch completion atomically. Recent imports, repeat uploads and concurrent retries are supported; existing records are never silently overwritten.

## Operational events and log imports

Energy → Operational events stores a stable uppercase site event code, registered site end use, inclusive first/last dates, operation (up to 500 characters), comments (up to 4,000), source and optional namespaced legacy identity. Same-day and overlapping events are valid. Dates do not identify an event: a code identifies its immutable revision chain. Comments are rendered as text, including markup-like evidence; no evidence is interpreted as approval, verified savings or a consumption adjustment.

Owner/Admin may record or correct an event with a required reason. Dates, operation, comments and source may change; event code, end use, legacy identity and import batch stay fixed. Prior revisions retain author/time, reason and audit evidence. Site-scoped readers may inspect current records and history. Composite foreign keys enforce site/use/batch ownership; database triggers protect revisions from update/delete/truncate.

The reviewed XLSX import takes one sheet, 1–240 rows, up to 2 MB, with `firstDay, lastDay, energyUseCode, eventCode, operation, comments, source, legacySource, legacyId` headers. Use YYYY-MM-DD text dates. Comments and legacy references may be blank; a legacy ID requires a namespace. Resolve source site/use IDs explicitly to the selected site and registered code. Preview shows all parsed rows and source/parsed/error counts. Duplicate codes or legacy IDs, invalid fields and unknown end uses block commit. Overlapping dates alone do not. Commit rechecks current access/site/mapping/conflicts and writes all events/audits/batch completion atomically. Recent imports can be reopened; identical uploads and concurrent/repeated commits are safe. Corrected imported events are not reverted by retries. Raw source exports remain separate reconciliation evidence.

Opportunity/investigation links follow Sprint 6; this milestone establishes the retained operational evidence destination without claiming measured savings.

### Reviewed consumption/meter migration

Audit point 4 now has an executable operator preview/apply workflow for BusinessFuelsSize and UtilityConsumptions. Explicit meter-token/site/fuel/use mappings, tax/unit/conversion decisions and driver basis/conflict rules preserve source evidence without inferred allocations. Original timestamps, supplied VAT/cost/factor/population/hours are stored separately from calculated readings and remain unchanged by corrections. Immutable receipts provide source-to-target reconciliation, grouped totals and safe retries. Destination meters and conversions must be registered before migration; no real source export has been imported. See docs/LEGACY_ENERGY_MIGRATION.md for the input format, commands, review requirements and scope limits.

### Named sheets and reusable import mappings

Energy consumption mappings can be saved and loaded as version 1 JSON templates. Driver and operating-pattern imports accept an exact worksheet name or a v1 mapping file, so a source workbook can hold multiple sheets while each selected sheet is reviewed and committed separately. The preview lists excluded sheets; a saved template never selects an organisation, site or meter or bypasses confirmation. See [WORKBOOK_IMPORT_TEMPLATES.md](../../docs/WORKBOOK_IMPORT_TEMPLATES.md) for mapping fields, limits and the explicit FP15 Sprint 3/Sprint 5 allocation.

### Sprint 4 fixture readiness

Run `npm run sprint4:readiness -- <fixture-directory> [new-report.json]` to check the three regression reference filenames and discovery hashes without changing their contents. Exit 2 means fixture/methodology review remains open; exit 1 is a command/output failure. This preparation check deliberately cannot certify numerical compatibility. See [SPRINT_4_DESIGN.md](../../docs/SPRINT_4_DESIGN.md) for contracts, dependencies and the next implementation slices.

### Experimental Sprint 4 regression kernel

`src/domain/analysis/regression.ts` provides pure one/two/three-driver OLS fitting and coefficient inference with explicit numerical policy and typed quality states. The authorized AnalysisService uses it for experimental application results; all outputs remain UNVALIDATED. Run `npm test -- tests/regression.test.ts` for the independent synthetic cases. Scope, method and remaining integration work are documented in [SPRINT_4_ENGINE.md](../../docs/SPRINT_4_ENGINE.md).

`src/domain/analysis/reporting.ts` adds experimental kWh predictions, hours/population NRA and explicit significance policy with scoped monthly evidence. Missing months and invalid ratios remain blocked. Run `npm test -- tests/reporting.test.ts` for reporting checks. Reporting remains UNVALIDATED in the Advanced Analysis workflow.

The internal `src/server/analysis/service.ts` assembles scoped persisted inputs, creates immutable baseline/run snapshots and provides authorized readiness/history reads. `202609220001_analysis_snapshots` adds the storage and database immutability constraints. All saved calculations remain UNVALIDATED in the authenticated analysis API and UI. Run `node --import tsx scripts/analysis-integration.ts` from `apps/web` to validate the service against an automatically created disposable database. That test applies all migrations only to its temporary database. See [SPRINT_4_DESIGN.md](../../docs/SPRINT_4_DESIGN.md) for permissions, snapshot identity and remaining workflow gates.

Advanced Analysis is now available from **Energy → Advanced Analysis**. It provides experimental readiness, baseline selection/saving, reporting runs and immutable history with visible UNVALIDATED status. Apply migrations before using the page in another environment. The local workspace migration has been applied. Run `npx playwright test tests/e2e/analysis.spec.ts` for the isolated desktop/mobile browser workflow. The previous internal-only notes describe the earlier implementation slice; workbook approval remains outstanding.

Analysis history loads 20 entries per page. Use **Load older baselines** or **Load older runs** to access earlier evidence. The experimental history API now returns `{ items, nextCursor }`, with `nextRunCursor` on each baseline; cursor/limit parameters are validated and scoped.

Owners, Admins and Analysts can save experimental baselines and reporting runs using the dedicated analysis permission. Viewers and assigned Site Managers can inspect readiness/history/results but cannot save. Organisation and source-data management permissions are unchanged.
