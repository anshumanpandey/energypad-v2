# Sprint 2 acceptance

## Delivered scope

- Portfolio create/read/update/archive, site create/read/update/archive and meter create/read/update/archive in the existing organisation workspace.
- Site fields include address, postcode, town, country/region, currency, type, portfolio and optional legacy reference. Effective-dated population, floor area, weekly hours and VAT snapshots preserve zero versus unknown, author and import provenance. Database triggers prohibit alteration/deletion of history.
- Owner/Admin mutations, assigned-site reads for Site Managers, active-site plan limits, composite tenant foreign keys and transactional audit events. Archiving a site clears assignments and pending invitation grants while retaining records/history.
- Data wizard: XLSX upload, sheet detection, column mapping/defaults, source-business selection, validation, preview, CSV row-error download and atomic commit. The original workbook is not persisted. Credential columns are discarded before staging and never included in errors or audit. Authentication and organisation selection are independent of workbook identities.
- Batch IDs and sanitized-content fingerprints support upload/commit retries. A batch commits only once. Commit rechecks role, codes and limits under the organisation lock; stale previews and duplicates fail without partial creation.
- Upload/parser limits: 2 MB input, 10 MB expanded ZIP, 500 ZIP entries, 10 sheets, 50 columns and 2,000 rows per sheet. Macros, external links, XML entity declarations, formulas and Excel error cells are rejected. Upload attempts are limited to 20 per organisation/hour.

## Acceptance mapping

| Gate | Implementation | Evidence |
| --- | --- | --- |
| Sites/meters/forms | `src/server/sites.ts`, `components/sites-workspace.tsx`, additive Prisma migration | Database CRUD/archival/history/tenant scenarios; browser manual site, history and meter workflow |
| Business workbook maps | `server/workbook.ts`, `domain/sites.ts`, Data wizard | Real `business_example_v3.xlsx` Hoja2 is mapped using explicit code prefix, effective date and source business email |
| Passwords excluded | Workbook reader removes credential columns before creating ImportBatch | Test reads fixture credential values only in memory and asserts absence from staging and audit; synthetic browser credential never appears in UI |
| Retry idempotent | Unique organisation/fingerprint, organisation lock, committed batch state | Duplicate upload and simultaneous commits create one site set and one commit audit |
| Tenant-safe/errors | API auth/origin/body limits, service checks, safe row errors | Foreign site/portfolio/meter/batch denial, assignment checks, malicious relationship FK rejection, CSV error download |
| Atomic commit | Revalidation and limits inside transaction | Stale code conflict and over-limit import leave no partial sites |

## Boundaries and decisions

Sprint 2 imports **new sites** into the currently selected organisation. Multi-business account migration is not an ordinary customer import; the business identity sheet cannot grant access, create organisations or rewrite account settings. Users select a source business email when the site sheet contains it, explicitly confirming its association. Use Team members to send secure invitations. This implements the specification's allowed credential-discard policy rather than retaining passwords or blocking every workbook containing them.

Site code defaults/prefixes and historical effective dates are explicit user inputs. Floor area must already be m² and hours must be weekly; the confirmation makes this assumption visible. No units, historical dates, energy quantities or analytical results are invented. Meter creation is manual. Consumption imports, conversion catalogs, weather and calculations are Sprint 3+.

Archival is the delete operation; codes remain reserved for reconciliation. Attribute entries are complete immutable snapshots, not incremental patches. Correct history through a new effective-dated entry; same-date overwrites are rejected. Structural portfolio grouping is available now; paid comparison analytics remain later work. Raw workbooks are not retained; sanitized staging retention and production storage/ingress operations remain deployment work.

No production migration, external email delivery, deployment or Git push is part of this sprint. Existing Sprint 1 form/navigation fixes remain preserved. The two missing regression workbooks and NRA fixture discrepancy remain Sprint 4 blockers.

## Executed verification

- 6 unit tests passed (foundation policy plus site/history/import validation).
- 19 real PostgreSQL integration scenarios passed (10 foundation + 9 Sprint 2), including the unchanged business workbook fixture and concurrent/idempotent commit.
- All 4 Playwright scenarios passed across final runs: the three foundation regressions, then the Sprint 2 workflow after its portfolio selector received an explicit accessible label. The workbook test helper uses `createRequire` to avoid a Node/Playwright CommonJS loading issue.
- Production build passed with Webpack. Lint, TypeScript and formatting passed; dependency installation audit reports 0 vulnerabilities with patched fflate and ExcelJS UUID override.
- The additive migration was applied to the dedicated local `energiepad_v2` database on port 55432. Existing workspace data was retained. The dev app runs on port 3100, and the Sites form was visually checked in the existing workspace. No sample customer data was inserted there.
- Import preview screenshot reviewed. The workbook fixture SHA-256 remains `1cf0a29d359ebbbed20336a4b579ef22c39e93686192feabada5201191764b6b`.

No remote CI run or production deployment is claimed.

## Form polish and acceptance follow-up

- Site and meter actions use consistent horizontal button rows. Site details use a responsive label/value grid, highlighted header and dated attribute cards.
- Currency input is trimmed and normalized to uppercase before server validation and persistence, including imports.
- Successful history and new-meter submissions reset their forms. Failed requests retain input; editing an existing meter does not reset it.
- Browser regression now exercises uppercase currency persistence, history and new-meter resets, and retained inputs on duplicate-date/code errors. Its history assertions match the new structured cards and explicitly check that population zero remains visible.
- Unit coverage now totals 7 passing tests. Existing database integration and build evidence above remains from the original sprint acceptance run.
- The expanded Sprint 2 browser scenario passed end to end on 18 September 2026 (44.8 seconds), using an isolated test database. It verifies persisted currency through the site detail endpoint; the list endpoint intentionally returns a smaller projection. No customer data was changed by this verification.
