'use client';
import { useState } from 'react';
import { ImportWorkspace } from './import-workspace';
import { Button } from './ui/button';
import { responseError, useMutation } from './forms';
import { historicColumns } from '@/domain/historic-consumption';
type Preview = {
  committed: boolean;
  count: number;
  signature: string;
  records: {
    row: number;
    site: string;
    month: string;
    quantity: string;
    unit: string;
    netCost: string | null;
    grossCost: string | null;
    currency: string | null;
  }[];
};
export function DataImportWorkspace({ orgId, batches }: { orgId: string; batches: { id: string; status: string }[] }) {
  const [tab, setTab] = useState('sites');
  return (
    <>
      <div className="form-actions" role="tablist" aria-label="Data imports">
        {['sites', 'consumption'].map((value) => (
          <Button
            key={value}
            role="tab"
            tabIndex={tab === value ? 0 : -1}
            variant={tab === value ? 'primary' : 'secondary'}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next =
                event.key === 'Home'
                  ? 'sites'
                  : event.key === 'End'
                    ? 'consumption'
                    : value === 'sites'
                      ? 'consumption'
                      : 'sites';
              setTab(next);
              document.getElementById(`tab-${next}`)?.focus();
            }}
            id={`tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`panel-${value}`}
            onClick={() => setTab(value)}
          >
            {value === 'sites' ? 'Sites' : 'Consumption'}
          </Button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'sites' ? <ImportWorkspace orgId={orgId} batches={batches} /> : <HistoricImport orgId={orgId} />}
      </div>
    </>
  );
}
function HistoricImport({ orgId }: { orgId: string }) {
  const m = useMutation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  async function upload(commit: boolean) {
    if (!file) throw new Error('Choose an XLSX workbook.');
    const signature = preview?.signature;
    setPreview(null);
    const response = await fetch(
      `/api/v1/organisations/${orgId}/consumption-imports/${commit ? 'commit' : 'preview'}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          ...(commit ? { 'X-Import-Signature': signature ?? '' } : {}),
        },
        body: file,
      },
    );
    const result = await response.json();
    if (!response.ok) throw responseError(result);
    setPreview(result);
  }
  return (
    <section className="panel">
      <h2>Import historic consumption</h2>
      <p>
        Upload an XLSX workbook with a Historic Consumption sheet. Columns A–M must follow this exact order. Other
        sheets are ignored.
      </p>
      <ol>
        {historicColumns.map((name, index) => (
          <li key={name}>
            <strong>{String.fromCharCode(65 + index)}:</strong> {name}
          </li>
        ))}
      </ol>
      <p>
        Total Cost includes VAT; VAT Cost is a monetary amount. Costs use the site currency, or the organisation
        currency when unset. Operating Hours are hours per day (0–24).
      </p>
      <p>
        Use existing site codes and meter codes in MPAN/MPRN. Leave MPAN/MPRN blank only when exactly one meter matches
        the utility and unit. Conversion Factor must match the configured kWh conversion. Population and daily hours are
        retained as source information; this import does not change site history or driver observations.
      </p>
      <p>
        Excel formatting and saved formula results are supported. Error cells and formulas without saved results must be
        corrected. Cost, population and operating hours may be blank; provide both cost columns together.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void m.run(() => upload(false), 'Workbook validated. Review before importing.');
        }}
      >
        <label>
          Consumption workbook
          <input
            type="file"
            accept=".xlsx"
            required
            disabled={m.pending}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
        </label>
        <div className="form-actions">
          <Button type="submit" disabled={m.pending || !file}>
            Validate consumption
          </Button>
        </div>
      </form>
      {m.feedback}
      {preview && (
        <>
          <p role="status">
            {preview.committed
              ? `Imported ${preview.count} consumption readings. This workbook will not be imported twice.`
              : `${preview.count} readings ready to import. No data has been saved yet.`}
          </p>
          {!preview.committed && (
            <>
              <div className="analysis-table">
                <table>
                  <thead>
                    <tr>
                      {['Excel row', 'Site', 'Month', 'Consumption', 'Net cost', 'Total including VAT'].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.records.map((r) => (
                      <tr key={r.row}>
                        <td>{r.row}</td>
                        <td>{r.site}</td>
                        <td>{r.month}</td>
                        <td>
                          {r.quantity} {r.unit}
                        </td>
                        <td>
                          {r.netCost ?? '—'} {r.currency}
                        </td>
                        <td>
                          {r.grossCost ?? '—'} {r.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                disabled={m.pending}
                onClick={() => void m.run(() => upload(true), 'Consumption import completed.')}
              >
                Import {preview.count} readings
              </Button>
            </>
          )}
        </>
      )}
    </section>
  );
}
