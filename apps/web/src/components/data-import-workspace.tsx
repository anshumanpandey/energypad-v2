'use client';
import { useState } from 'react';
import { Building2, ChartColumn, FileSpreadsheet, Upload, CheckCircle2, ChevronDown, ArrowRight } from 'lucide-react';
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
      <div className="data-import-tabs" role="tablist" aria-label="Data imports">
        {['sites', 'consumption'].map((value) => (
          <button
            type="button"
            key={value}
            role="tab"
            tabIndex={tab === value ? 0 : -1}
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
            {value === 'sites' ? (
              <Building2 size={18} aria-hidden="true" />
            ) : (
              <ChartColumn size={18} aria-hidden="true" />
            )}
            {value === 'sites' ? 'Sites' : 'Consumption'}
          </button>
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
    <section className="consumption-import">
      <div className="import-intro">
        <div>
          <span className="eyebrow">CONSUMPTION DATA</span>
          <h2>Import historic consumption</h2>
          <p>Bring your monthly readings into one place.</p>
        </div>
        <span className="import-format">
          <FileSpreadsheet size={15} aria-hidden="true" /> Excel · .xlsx
        </span>
      </div>
      <ol className="import-steps" aria-label="Import progress">
        {['Choose workbook', 'Review readings', 'Import data'].map((step, index) => (
          <li key={step} aria-current={(preview?.committed ? 2 : preview ? 1 : 0) === index ? 'step' : undefined}>
            <span>{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <div className="import-layout">
        <div className="panel import-upload-card">
          <div className="import-card-heading">
            <span className="import-icon">
              <Upload size={21} aria-hidden="true" />
            </span>
            <div>
              <h3>Upload your workbook</h3>
              <p>We’ll check every cell before you import.</p>
            </div>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void m.run(() => upload(false), 'Workbook validated. Review before importing.');
            }}
          >
            <label className="import-file-field">
              <span>Consumption workbook</span>
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
            <div className="import-upload-footer">
              <span className="muted">XLSX · Up to 2 MB · 2,000 rows</span>
              <Button type="submit" disabled={m.disabled || !file}>
                {m.pending ? 'Checking workbook…' : 'Validate consumption'} <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </div>
          </form>
        </div>
        <aside className="import-guide" aria-label="Workbook requirements">
          <h3>Before you upload</h3>
          <ul>
            <li>
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>
                Use the <strong>Historic Consumption</strong> sheet.
              </span>
            </li>
            <li>
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>
                Keep the template’s <strong>A–M column order</strong>.
              </span>
            </li>
            <li>
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>
                Match existing <strong>sites and meters</strong>.
              </span>
            </li>
          </ul>
          <div className="import-key-facts">
            <span>
              Total cost <strong>Includes VAT</strong>
            </span>
            <span>
              Operating hours <strong>Hours per day</strong>
            </span>
          </div>
        </aside>
      </div>
      <details className="import-help">
        <summary>
          <FileSpreadsheet size={18} aria-hidden="true" />
          <span>Template columns &amp; format rules</span>
          <ChevronDown size={17} aria-hidden="true" />
        </summary>
        <div className="import-help-content">
          <div>
            <h3>Column order</h3>
            <ol className="import-column-list">
              {historicColumns.map((name, index) => (
                <li key={name}>
                  <span>{String.fromCharCode(65 + index)}</span>
                  {name}
                </li>
              ))}
            </ol>
          </div>
          <div className="import-rules">
            <h3>Format rules</h3>
            <p>
              <strong>Meter matching.</strong> MPAN/MPRN must match an active meter code. Leave it blank only when one
              meter matches the utility and unit. Solar PV is a separate fuel source.
            </p>
            <p>
              <strong>Costs.</strong> Total Cost includes VAT. Supply VAT Cost as an amount, including zero when
              applicable. Fill both cost columns or leave both blank. Currency comes from the site, or the organisation
              when unset.
            </p>
            <p>
              <strong>Conversion.</strong> The factor must match the meter’s configured kWh conversion for that month.
            </p>
            <p>
              <strong>Population &amp; hours.</strong> Both are optional. Hours are per day (0–24). Values are retained
              with the reading; site history and driver observations stay unchanged.
            </p>
            <p>
              <strong>Excel cells.</strong> Formatting and saved formula results are supported. Correct error cells and
              formulas without saved results. Other worksheets are ignored.
            </p>
          </div>
        </div>
      </details>
      <div className="import-feedback">{m.feedback}</div>
      {preview && (
        <section className="panel import-preview">
          <div className="import-card-heading">
            <span className="import-icon">
              <CheckCircle2 size={21} aria-hidden="true" />
            </span>
            <div>
              <h3>{preview.committed ? 'Import complete' : 'Review your readings'}</h3>
              <p role="status">
                {preview.committed
                  ? `Imported ${preview.count} consumption readings. This workbook will not be imported twice.`
                  : `${preview.count} readings ready to import. No data has been saved yet.`}
              </p>
            </div>
          </div>
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
              <div className="import-preview-footer">
                <span className="muted">All rows are validated. Import when you’re ready.</span>
                <Button
                  disabled={m.pending}
                  onClick={() => void m.run(() => upload(true), 'Consumption import completed.')}
                >
                  Import {preview.count} readings <ArrowRight size={16} aria-hidden="true" />
                </Button>
              </div>
            </>
          )}
        </section>
      )}
    </section>
  );
}
