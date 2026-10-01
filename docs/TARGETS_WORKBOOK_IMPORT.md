# Targets workbook import

Use **Data → Targets** to validate and import the `Targets` sheet. Row 1 must contain these headers in this fixed order (header casing and surrounding whitespace are ignored):

| Column | Header | Value |
| --- | --- | --- |
| A | Site Code | Existing active site code in this workspace |
| B | Year | 1900–2199 |
| C | Month | Jan–Dec or 1–12 |
| D | Utility Type | Grid Electricity, Solar PV, Gas, Diesel, Oil, Petrol, LPG, Biomass, Heat or Other |
| E | Fuel Unit | kWh or MWh |
| F | Target Energy | Non-negative quantity in column E's unit |
| G | Target Carbon (Kg) | Non-negative monthly carbon quantity in kilograms |

Energy and carbon are required; zero is valid. Amounts support up to 15 integer digits and nine decimal places. Diesel maps to the existing Oil utility. MWh converts to kWh at 1000; other units cannot be imported because this template has no conversion-factor field. Formatted numeric cells and cached formula results use the shared workbook reader. Excel error cells and formulas without usable saved results are listed as failed cells.

Validation lists cell addresses and all detected issues, including missing sites, duplicate site/month/utility/unit rows and unexpected columns. Nothing is saved when errors exist. After validation, the Import button above the preview saves to the existing monthly TARGET records, visible under **Targets & Monitoring**. No meter is required.

Identical targets are skipped. Changed targets create audited correction revisions; older versions remain available. Commit checks the preview against current database state. Repeated or concurrent identical commits do not create duplicate versions. Imports require organisation update permission and retain tenant isolation and write-freeze protections.

The supplied `abc site historic data V2 pls petrol data.xlsx` contains conflicting Gas entries at rows 26 and 50 for site_mit, January 2023. Row 50 has Gas in D50 at the start of a Diesel block. Confirm the intended utility and correct the workbook before importing. The source workbook is not modified by the importer.

Validation: `tests/target-import.test.ts`, `scripts/target-import-integration.ts`, and `tests/e2e/target-import.spec.ts`. The integration script is included in `npm run test:integration`. Setting `TARGETS_REFERENCE_PATH` to the supplied workbook verifies its duplicate errors, then imports 72 targets using an in-memory test copy with D50 set to Diesel.
