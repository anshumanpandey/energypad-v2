# Versioned workbook mappings (FP15)

Sprint 3 implements reusable JSON mapping templates for consumption, monthly drivers and operating patterns/setpoints. XLSX remains the source format. Templates are portable files, versioned separately from source workbooks; they do not contain target organisation, site or meter IDs and cannot approve a write.

## Import workflow

- **Consumption:** upload for the chosen meter, select a sheet and map its columns/defaults. Save mapping template v1. Load that file on another staged workbook to resolve the same worksheet/header names even when their positions change. Review meter, units, net-cost basis and defaults, then validate and commit as usual. Loading a template clears confirmation and invalidates the displayed preview.
- **Drivers and patterns:** upload a workbook and enter an exact worksheet name when it has multiple sheets, or load a JSON mapping template specifying the name. Download the starter template, edit its source header names and explicit defaults as needed, and reuse it. A ready preview offers “Save this mapping template.” Review the selected/excluded sheet list and every row before confirming the commit.
- Single-sheet driver/pattern files without a template retain their existing exact destination-column contracts. A named-sheet selection does not relax row validation. Custom source columns require an explicit mapping template.

A workbook may contain five legacy tabs (or up to ten bounded sheets). Each selected sheet is a separately reviewed, atomic batch, and consumption remains one meter per batch. Other sheets are explicitly excluded, not reported as imported. This is not an all-sheet transaction or a positional decoder for an unreviewed legacy workbook. Every sheet, including excluded ones, still passes the workbook safety limits; formula cells require reviewed saved results; formulas are not evaluated during upload.

## Template v1 contract

```json
{
  "version": 1,
  "kind": "drivers",
  "sheetName": "Attendance",
  "columns": { "month": "Period", "value": "Average people" },
  "defaults": { "driver": "POPULATION", "source": "Reviewed attendance register" }
}
```

`kind` is `consumption`, `drivers`, `patterns`, `emissions` or `targets`. `columns` maps supported destination fields to exact source header names. `defaults` supplies explicit text only when no column is mapped; blank cells in a mapped column stay blank. Sheet and header names must resolve uniquely. Unknown versions, wrong import kinds, unsupported destination fields, missing sheets/headers and duplicate mapped headers are rejected. Templates are limited to 16 KB; workbooks retain the 2 MB / 10 MB expanded-content limits and existing row limits (120 consumption, 240 driver/pattern rows).

Consumption destinations: month, quantity, unit, estimated, netCost, vatPercent, currency, endUse, energyUseCode, externalLegacyId.

Driver destinations: month, driver, value, source. Population is a monthly average; operating hours is a monthly total. Values are never derived from patterns or occupancy.

Pattern destinations: firstDay, lastDay, energyUseCode, daysOnYear, temperature, temperatureUnit, temperatureContext, source, legacySource, legacyId. Unknown/zero semantics and reviewed temperature context remain unchanged.

Driver/pattern batch results retain the version, chosen worksheet, mapping/defaults and excluded worksheet names. Fingerprints cover the selected mapped sheet: changes confined to excluded sheets do not create duplicate imports. Existing domain checks, scoped permissions, transaction rollback and retry protection remain in force. A template is not a credential or a target mapping; keep source-sensitive defaults in restricted files.

## Explicit sprint allocation

FP15 remains retained across Sprints 2, 3 and 5:

| Destination | Delivery / remaining acceptance |
| --- | --- |
| Sites | Sprint 2 existing staging/mapping pipeline |
| Consumption, drivers, setpoints | Sprint 3 named-sheet selection and reusable v1 mappings; normal preview/atomic per-batch commit; records outside the selected batch unchanged |
| Emissions / versioned factors | Sprint 5 implemented for versioned factors: named-sheet mapping, versioned templates, scoped preview, atomic commit, correction lineage and retry tests |
| Targets / monitoring | Sprint 5 implemented for absolute annual carbon targets: named-sheet mapping, versioned templates, unit/period validation, scoped preview, atomic commit, corrections and retry tests; additional target metrics remain open |

The Sprint 5 factor and absolute-carbon-target import contracts are now implemented as described below. Calculated outputs, additional target metrics and undocumented legacy worksheet semantics are not implicitly covered. The source workbook's actual sheet/header semantics still require reviewed mappings. Full production source reconciliation remains a separate gate.

## Sprint 5 carbon destinations

Version 1 templates also support `emissions` and `targets`. Both imports are available in the Carbon page's selected site, with a 120-row batch limit, review confirmation and atomic commit receipts.

Emission destinations: fuel, geography, basis, unit, factor, source, firstDay, lastDay, supersedesId, reason. Unit must be `kgCO2e/kWh`; factors are organisation-wide.

Target destinations: meterCode, year, geography, basis, unit, name, limitKgCO2e, source, supersedesId, reason. Unit must be `kgCO2e`; meterCode must belong to the selected site. Targets are absolute annual carbon limits. Correction IDs reference existing destination versions and require reasons; leave both correction fields blank for new records. A template carries column names/defaults, not authorization to import or correct a record.

Use exact destination headers without a template, or map exact source header names through a template. Optional correction headers may be omitted from a workbook and from its mapping. Downloaded starter mappings enumerate all supported fields; remove optional mappings if those headers are absent. Preview displays row values, scope, selected/excluded sheets and errors. Formatted cells and cached formula results are supported by the shared reader; recalculate and save first. Changing a file or mapping clears the displayed preview/confirmation. Calculated emissions and target assessments remain reproducible application results, not editable imported outputs.

## Monthly consumption targets and utility monitoring

Use Targets & Monitoring (or the Carbon import destination selector) with v1 kind `monthlyTargets` or `monitoring`.

| Field | Meaning |
| --- | --- |
| month | YYYY-MM; YYYY-ALL repeats the same value in twelve previewed months |
| fuel | Registered V2 fuel category, e.g. ELECTRICITY |
| unit | kWh, MWh, m3, litre or kg |
| energy | Non-negative monthly source-unit quantity; up to nine decimals |
| carbon | kgCO2e; optional for consumption targets, required for monitoring; zero is valid |
| conversionFactor | Explicit kWh/source-unit factor: 1 for kWh, 1000 for MWh; source required for physical units |
| source | Target/monitoring and conversion provenance/reference |
| energyUseCodes | Monitoring only: semicolon-separated same-site/same-fuel end-use codes |
| externalLegacyId | Optional source record reference |
| supersedesId, reason | Both needed to correct one current saved month; ALL cannot correct multiple IDs |

Named-sheet mapping/defaults and saved templates work as for other imports. Source rows are capped at 120 (at most 1,440 expanded destination months). Previewed end-use mappings cannot silently change at commit. All months commit atomically; no all-sheet transaction is inferred. Different target source-unit representations are retained separately and are not added together in benchmarking.

Review legacy factor mappings explicitly: the old monitoring Excel reader in `src/lib/excel/UtilityEmissionExcelClient.ts` assigned its energy value to `conversionFactor`. That assignment is not adopted as a valid dimensional conversion. V2 requires a reviewed kWh/source-unit factor and preserves the original record reference/source instead of silently repeating the old import error.
