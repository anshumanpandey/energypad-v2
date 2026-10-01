# Historic consumption import

Owners and admins can use **Data → Consumption** to validate and import the
`Historic Consumption` worksheet. Other sheets are ignored. No data is saved until
the preview is confirmed; all rows commit in one transaction.

The current template uses columns A–L: Site Code, Year, Month, Energy Use,
Utility Type, Consumption, Fuel Unit, Total Cost, VAT Cost, Conversion Factor,
Population, Operating Hours. Consumption starts in F.

Older A–M workbooks remain supported, with an ignored MPAN/MPRN column at F and
Consumption in G. The importer detects the layout from the headers. Header
comparison ignores casing and surrounding spaces but never reorders columns.
Validation errors retain the original workbook’s cell addresses in both layouts.

- Site Code identifies an existing active site in the current organisation.
- Year is 1900–2199; Month is Jan–Dec or 1–12.
- In the older layout only, MPAN/MPRN (F), including its header and contents,
  is ignored. In the new layout, F is imported as Consumption. An active meter is matched by site, utility and source unit. If no meter matches,
  the preview proposes a default meter and confirmation creates it atomically with
  the readings. Multiple matches are rejected. Sites must already exist. Preview
  rolls back provisional meters, conversions and audit entries; it saves no domain data.
- Utility types include Grid Electricity, Solar PV, Gas, Diesel, Oil, Petrol, LPG,
  Biomass, Heat and Other. Diesel maps to OIL; Solar PV maps to the independent SOLAR_PV fuel. Petrol maps to the independent PETROL fuel.
  Solar PV rows only match Solar PV meters, never grid-electricity meters.
- Units are kWh, MWh, m3 (also m³), litre (also l), and kg.
- Quantities and costs are non-negative numbers with at most three decimals;
  conversion factors allow six decimals. Excel display formatting does not round
  the underlying value. Cached formula results are accepted; error cells and
  formulas without cached results are listed for correction.
- Total Cost **includes VAT**. Net cost is Total Cost minus VAT Cost. Both cost
  columns must be supplied together, or both blank. The exact VAT amount is
  retained without deriving a rounded VAT percentage. Currency comes from the
  site, falling back to the organisation.
- Conversion Factor is kWh per source unit. It must agree with the configured
  conversion covering that month (1 for kWh, 1000 for MWh). Existing meters using other units require a sourced conversion first. For new
  default meters, the workbook factor is stored as a sourced conversion for each
  imported month. Mismatches are reported in the actual Conversion Factor column.
- Population and Operating Hours are optional. Operating Hours means **hours per
  day**, between 0 and 24. Both are retained in each reading's source provenance;
  no weekly hours, monthly driver observations, or site history are inferred.

All invalid cells are listed with worksheet, cell reference and reason, paginated
in groups of 50. Existing meter-month readings are updated through correction revisions; duplicate rows within one workbook are rejected.
A confirmation signature detects changed meter/conversion/currency context.
Retrying an already committed workbook does not create duplicate records.

Limits: 2 MB XLSX upload, 10 MB expanded, 2,000 data rows, 50 physical columns,
10 sheets, and 40 validation/commit requests per organisation per hour. Existing
workbook security checks, write freeze, organisation permission checks, audit and
import-retention tracking apply.

Verification: `tests/historic-consumption.test.ts`,
`scripts/historic-consumption-integration.ts` (included in `test:integration`), and
`tests/e2e/historic-consumption.spec.ts`.

## Emissions worksheet

**Data → Emissions** validates the fixed A–F layout: Site Code, Year, Month,
Utility Type, Fuel Unit, Emission Factor. A1 may be blank (as in the supplied
template) or `Site Code`. Other headers are required in that exact order, ignoring
case and surrounding spaces. Other worksheets are ignored.

Each factor is kgCO₂e/kWh, scoped to the existing active site in A, the fuel in D,
and the complete calendar month in B–C. The fuel aliases and year/month rules are
the same as consumption imports. Fuel Unit must be kWh. Factors are non-negative
numbers with at most nine integer and nine decimal digits; zero is valid.
Choose geography and reporting basis before validation because the worksheet
does not contain them. Defaults shown in the form are GB and LOCATION_BASED.

Preview saves no factors. All failing cells are returned with original addresses,
including Excel errors, unsupported units, unknown sites and both occurrences of
duplicate site/month/fuel rows. Conflicting saved factors are reported in F.
Identical existing monthly factors are skipped on re-import. Shared factors that
overlap a site-specific factor are rejected to avoid ambiguous carbon calculations.
Confirmation revalidates the workbook and database state and commits all new
factors and audit entries atomically. The original workbook is not stored.

Imported factors appear in the factor library with their site and workbook/row
provenance. Carbon calculations, summaries and trends use only shared factors or
factors belonging to the selected site. Corrections preserve site scope and
invalidate calculations using the previous factor version. Site managers can see
only shared factors and factors for their assigned sites.

The Graphs page calculates monthly emissions directly from current consumption
and matching factors without requiring a saved carbon run. Select the imported
site, year, geography and reporting basis. All active meters must have a complete
monthly reading and factor for a monthly site total; missing inputs are explained
in the chart data table rather than treated as zero. Viewing the graph does not
create or modify saved carbon runs, reports or their historical evidence.

The same workbook limits and owner/admin permissions apply. Apply migration
`202609290001_site_emission_factors` before serving the updated app.

Verification: `tests/historic-emissions.test.ts`,
`scripts/historic-emissions-integration.ts` (included in `test:integration`), and
`tests/e2e/historic-emissions.spec.ts`. Set `EMISSIONS_REFERENCE_PATH` when running
the integration script to also validate and import the supplied 72-row reference
into its disposable database.

## Drivers worksheet

**Data → Drivers** imports annual driver classifications, separate from monthly
population and operating-hour measurements. Use the `Drivers` sheet with headers
on row 6 and data from row 7. Rows 1–5 contain the reference legend and are not
imported. Columns A–H must be Site, Year, Heating, Cooling, Population, Operating
Hours, Daylighting and Building Size. Header case and surrounding spaces are
ignored. Blank trailing formatted rows/columns are ignored.

Site must identify exactly one active site by code or name in the current
workspace. Year is 1900–2199. All six classifications are required: `R` (Routine),
`NR` (Non-routine), or literal `N/A` (Not applicable). An Excel `#N/A` error is not
a valid classification. Formulas with saved results and formatting are supported.
All invalid cells retain their source addresses, including headers on row 6.

Owners/admins validate, review, then confirm the import. No classifications are
saved on preview or on any invalid row. Confirmation rechecks site mappings and
saved values, then stores all rows atomically with source worksheet, row and
author provenance. Duplicate site/year rows are rejected even when different
aliases identify the same site. Identical saved rows are skipped; conflicting
saved values are reported against their individual cells and are never silently
overwritten. Saved classifications remain visible in the Drivers tab after reload.
Importing classifications does not select an analysis model or create numeric
driver observations.

Apply migration `202609300001_driver_classifications` before serving this feature.
Verification: `tests/driver-classifications.test.ts`,
`scripts/driver-classifications-integration.ts` (part of `test:integration`), and
`tests/e2e/driver-classifications.spec.ts`. Set `DRIVERS_REFERENCE_PATH` to exercise
the supplied five-site, thirty-classification reference in the isolated database.

### Updating existing consumption

Re-importing a row for the same site, resolved meter, utility and month updates the
current reading through an audited correction revision. Previous versions remain
available to saved reports and reading history. The preview shows New, Update or
Unchanged for each row, the meter, and the previous consumption quantity.
Identical rows are skipped. A workbook containing invalid rows is rejected as a
whole, and changed data since preview requires validation again. Retrying the same
confirmed import does not create duplicate revisions. A previously imported file
can be explicitly previewed again to restore its values after later corrections.

Apply migration `202610010001_consumption_import_provenance` before deployment.
Original `sourceProvenance` stays immutable; `importProvenance` identifies the latest
workbook values and is preserved by subsequent manual corrections.
