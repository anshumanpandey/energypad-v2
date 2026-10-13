import ExcelJS from 'exceljs';
import { apiImportPayload } from '../domain/api-import';
import { historicCompactColumns } from '../domain/historic-consumption';
import { compactEmissionsColumns } from '../domain/historic-emissions';
import { compactTargetColumns } from '../domain/target-import';
import { classificationColumns, classificationFields } from '../domain/driver-classifications';

/** Reuse the workbook validators and signed, reviewed import flow for API data. */
export async function apiImportWorkbook(input: unknown) {
  const data = apiImportPayload.parse(input);
  const book = new ExcelJS.Workbook();
  const consumption = book.addWorksheet('Historic Consumption');
  consumption.addRow(historicCompactColumns);
  for (const r of data.consumption)
    consumption.addRow([
      r.site,
      r.year,
      r.month,
      r.energyUse,
      r.utility,
      r.consumption,
      r.unit,
      r.totalCost,
      r.vatCost,
      r.conversionFactor,
      r.population,
      r.operatingHours,
    ]);
  const emissions = book.addWorksheet('Emissions');
  emissions.addRow(compactEmissionsColumns);
  for (const r of data.emissions) emissions.addRow([r.site, r.year, r.month, r.emissionFactor]);
  const targets = book.addWorksheet('Targets');
  targets.addRow(compactTargetColumns);
  for (const r of data.targets) targets.addRow([r.site, r.year, r.month, r.energy, r.carbon]);
  const drivers = book.addWorksheet('Drivers');
  drivers.getRow(6).values = classificationColumns;
  for (const r of data.drivers) drivers.addRow([r.site, r.year, ...classificationFields.map((field) => r[field])]);
  return new Uint8Array(await book.xlsx.writeBuffer());
}
