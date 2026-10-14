'use client';
import { useState } from 'react';
import { apiDatasetLabels, type ApiDataset } from '@/domain/api-import';
import { Button } from './ui/button';

const columns: Record<ApiDataset, [string, string][]> = {
  consumption: [
    ['site', 'Site'],
    ['month', 'Month'],
    ['meter', 'Meter'],
    ['quantity', 'Consumption'],
    ['unit', 'Unit'],
    ['previousQuantity', 'Previous consumption'],
    ['netCost', 'Net cost'],
    ['grossCost', 'Total cost incl. VAT'],
    ['currency', 'Currency'],
    ['action', 'Action'],
  ],
  emissions: [
    ['site', 'Site'],
    ['month', 'Month'],
    ['fuel', 'Utility'],
    ['factor', 'Emission factor'],
    ['unit', 'Unit'],
  ],
  targets: [
    ['site', 'Site'],
    ['month', 'Month'],
    ['fuel', 'Utility'],
    ['energy', 'Target energy'],
    ['unit', 'Unit'],
    ['carbon', 'Target carbon (kgCO₂e)'],
    ['cost', 'Net cost'],
    ['grossCost', 'Total cost incl. VAT'],
    ['currency', 'Currency'],
    ['action', 'Action'],
  ],
  drivers: [
    ['siteName', 'Site'],
    ['year', 'Year'],
    ['heating', 'Heating'],
    ['cooling', 'Cooling'],
    ['population', 'Population'],
    ['operatingHours', 'Operating hours'],
    ['daylighting', 'Daylighting'],
    ['buildingSize', 'Building size'],
  ],
};
export function ImportRecordsTable({ dataset, records }: { dataset: ApiDataset; records: Record<string, unknown>[] }) {
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const visible = records.slice(page * pageSize, (page + 1) * pageSize);
  return (
    <section className="import-records" aria-label={`${apiDatasetLabels[dataset]} records to import`}>
      <h4>
        {apiDatasetLabels[dataset]} · {records.length} records
      </h4>
      <div
        className="import-records-scroll"
        tabIndex={0}
        role="region"
        aria-label={`${apiDatasetLabels[dataset]} data table`}
      >
        <table className="import-preview-table">
          <thead>
            <tr>
              <th scope="col">Source row</th>
              {columns[dataset].map(([key, label]) => (
                <th key={key} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              <tr key={index}>
                <td>{String(row.row ?? '—')}</td>
                {columns[dataset].map(([key]) => (
                  <td key={key}>
                    {row[key] === null || row[key] === undefined || row[key] === '' ? '—' : String(row[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {records.length > pageSize && (
        <div className="api-import-actions">
          <Button type="button" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous records
          </Button>
          <span role="status">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, records.length)} of {records.length}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={(page + 1) * pageSize >= records.length}
            onClick={() => setPage(page + 1)}
          >
            Next records
          </Button>
        </div>
      )}
    </section>
  );
}
