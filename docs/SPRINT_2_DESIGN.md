# Sprint 2 — sites and import

## Delivery

Extend the isolated V2 app with organisation-owned portfolios, sites, meters and effective-dated site attributes. Owners/Admins manage records and imports. Other roles read according to existing site assignments. Deletion archives resources so audit and history remain available. Tenant composite foreign keys and organisation locks protect related writes and plan site limits.

Add an XLSX wizard: upload → sheet selection → column mapping/defaults → validation and preview → atomic commit. Persist only sanitized cells, never the original workbook or credential columns. Imported business identities do not create organisations or grant memberships. A user explicitly selects the current organisation, optionally filters the site sheet by a source business email, and supplies missing codes/defaults. Password columns are discarded before staging, reported by a generic notice, and never included in previews/errors/audits. Existing secure invitation flow remains the identity workflow.

Import scope is new site records; meter setup is available manually. Consumption, weather and calculations belong to Sprint 3+. Workbook formulas are rejected as input rather than evaluated. Uploads, decompressed size, sheets, rows and cells are bounded. Row-level errors contain row/field/reason only and are downloadable as CSV. Mapping validates on the server; commit revalidates under the organisation lock. A batch commits at most once, and repeated identical sanitized uploads resolve to the same organisation-scoped batch. Existing site codes cause an explicit conflict, never an implicit update.

## Data and defaults

Site retains code/name and adds portfolio, type, address, postcode, town, country/region, currency, legacy reference and archival time. SiteAttributeHistory stores population, floor area (m²), weekly operating hours, VAT percentage, effective date, author and source batch. No missing numeric value becomes zero; effective dates and source units must be supplied explicitly. Unknown historical effective dates remain absent until supplied. Meters hold name/code, fuel/unit, site and archival time. Catalog normalization/conversion is Sprint 3.

## Gates

Real PostgreSQL tests cover CRUD, site assignment reads, foreign IDs and relationships, immutable history, limits, archive behavior, import validation, credential exclusion and repeated/concurrent commit. Workbook tests inspect the real business fixture without outputting credentials. Browser tests exercise manual setup and the import wizard. Run lint, typecheck, unit/integration/browser tests and production build; apply only additive local V2 migrations. Preserve legacy sources and calculation fixtures.
