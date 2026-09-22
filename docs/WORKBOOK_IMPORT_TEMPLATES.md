# Versioned workbook mappings (FP15)

Sprint 3 implements reusable JSON mapping templates for consumption, monthly drivers and operating patterns/setpoints. XLSX remains the source format. Templates are portable files, versioned separately from source workbooks; they do not contain target organisation, site or meter IDs and cannot approve a write.

## Import workflow

- **Consumption:** upload for the chosen meter, select a sheet and map its columns/defaults. Save mapping template v1. Load that file on another staged workbook to resolve the same worksheet/header names even when their positions change. Review meter, units, net-cost basis and defaults, then validate and commit as usual. Loading a template clears confirmation and invalidates the displayed preview.
- **Drivers and patterns:** upload a workbook and enter an exact worksheet name when it has multiple sheets, or load a JSON mapping template specifying the name. Download the starter template, edit its source header names and explicit defaults as needed, and reuse it. A ready preview offers “Save this mapping template.” Review the selected/excluded sheet list and every row before confirming the commit.
- Single-sheet driver/pattern files without a template retain their existing exact destination-column contracts. A named-sheet selection does not relax row validation. Custom source columns require an explicit mapping template.

A workbook may contain five legacy tabs (or up to ten bounded sheets). Each selected sheet is a separately reviewed, atomic batch, and consumption remains one meter per batch. Other sheets are explicitly excluded, not reported as imported. This is not an all-sheet transaction or a positional decoder for an unreviewed legacy workbook. Every sheet, including excluded ones, still passes the workbook safety limits; formulas must be converted to reviewed plain values before upload.

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

`kind` is `consumption`, `drivers` or `patterns`. `columns` maps supported destination fields to exact source header names. `defaults` supplies explicit text only when no column is mapped; blank cells in a mapped column stay blank. Sheet and header names must resolve uniquely. Unknown versions, wrong import kinds, unsupported destination fields, missing sheets/headers and duplicate mapped headers are rejected. Templates are limited to 16 KB; workbooks retain the 2 MB / 10 MB expanded-content limits and existing row limits (120 consumption, 240 driver/pattern rows).

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
| Emissions / versioned factors | Sprint 5, alongside the factor model: named-sheet mapping, versioned templates, scoped preview, atomic commit, correction lineage and retry tests |
| Targets / monitoring | Sprint 5, alongside target persistence: named-sheet mapping, versioned templates, units/period validation, scoped preview, atomic commit, correction lineage and retry tests |

This allocation resolves the former Sprints 2–3 promise for destinations whose models belong to Sprint 5; it does not mark emissions or targets as implemented or retire their imports. The source workbook's actual sheet/header semantics still require reviewed mappings. Full production source reconciliation remains a separate gate.
