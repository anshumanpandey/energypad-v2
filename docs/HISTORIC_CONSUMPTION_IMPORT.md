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
- Utility types include Grid Electricity, Solar PV, Gas, Diesel, Oil, LPG,
  Biomass, Heat and Other. Diesel maps to OIL; Solar PV maps to the independent SOLAR_PV fuel.
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
in groups of 50. Existing meter-month readings and duplicate rows are rejected.
A confirmation signature detects changed meter/conversion/currency context.
Retrying an already committed workbook does not create duplicate records.

Limits: 2 MB XLSX upload, 10 MB expanded, 2,000 data rows, 50 physical columns,
10 sheets, and 40 validation/commit requests per organisation per hour. Existing
workbook security checks, write freeze, organisation permission checks, audit and
import-retention tracking apply.

Verification: `tests/historic-consumption.test.ts`,
`scripts/historic-consumption-integration.ts` (included in `test:integration`), and
`tests/e2e/historic-consumption.spec.ts`.
