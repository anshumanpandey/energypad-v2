'use client';
import { useState } from 'react';
import { Building2, ChartColumn, FileSpreadsheet, Upload, CheckCircle2, ChevronDown, ArrowRight } from 'lucide-react';
import { ImportWorkspace } from './import-workspace';
import { HistoricEmissionsImport } from './historic-emissions-import';
import { DriverClassificationImport } from './driver-classification-import';
import { TargetImport } from './target-import';
import { WorkbookImport } from './workbook-import';
import { Button } from './ui/button';
import { responseError, useMutation } from './forms';
import { historicCompactColumns } from '@/domain/historic-consumption';
import { MissingMonthConfirmation } from './missing-month-confirmation';
import type { MissingImportMonth } from '@/domain/import-missing-months';
type Preview = {
  committed: boolean;
  count: number;
  created: number;
  updated: number;
  unchanged: number;
  signature: string;
  defaultMeters: { id: string; site: string; name: string; unit: string }[];
  records: {
    row: number;
    action: 'New' | 'Update' | 'Unchanged';
    meter: string;
    previousQuantity: string | null;
    site: string;
    month: string;
    quantity: string;
    unit: string;
    netCost: string | null;
    grossCost: string | null;
    currency: string | null;
  }[];
};
export function DataImportWorkspace({
  orgId,
  batches,
  workflow = false,
}: {
  orgId: string;
  batches: { id: string; status: string }[];
  workflow?: boolean;
}) {
  const [tab, setTab] = useState('sites');
  const tabs = ['sites', 'consumption', 'emissions', 'drivers', 'targets'];
  if (workflow) return <WorkbookImport orgId={orgId} />;
  return (
    <>
      <div className="data-import-tabs" role="tablist" aria-label="Data imports">
        {tabs.map((value) => (
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
                  ? tabs[0]
                  : event.key === 'End'
                    ? tabs[tabs.length - 1]
                    : tabs[(tabs.indexOf(value) + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
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
            {value === 'sites'
              ? 'Sites'
              : value === 'consumption'
                ? 'Consumption'
                : value === 'emissions'
                  ? 'Emissions'
                  : value === 'drivers'
                    ? 'Drivers'
                    : 'Targets'}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'sites' ? (
          <ImportWorkspace orgId={orgId} batches={batches} />
        ) : tab === 'consumption' ? (
          <HistoricImport orgId={orgId} />
        ) : tab === 'emissions' ? (
          <HistoricEmissionsImport orgId={orgId} />
        ) : tab === 'drivers' ? (
          <DriverClassificationImport orgId={orgId} />
        ) : (
          <TargetImport orgId={orgId} />
        )}
      </div>
    </>
  );
}
export function HistoricImport({
  orgId,
  workbookLabel = 'Consumption workbook',
}: {
  orgId: string;
  workbookLabel?: string;
}) {
  const m = useMutation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fillMissing, setFillMissing] = useState(false);
  const [missing, setMissing] = useState<MissingImportMonth[]>([]);
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
          'X-Fill-Missing-Months': String(fillMissing),
          ...(commit ? { 'X-Import-Signature': signature ?? '' } : {}),
        },
        body: file,
      },
    );
    const result = await response.json();
    if (!response.ok) throw responseError(result);
    setPreview(result);
    setMissing(result.missingMonths ?? []);
  }
  return (
    <section className="consumption-import">
      <div className="import-intro">
        <div>
          <span className="eyebrow">CONSUMPTION DATA</span>
          <h2>Import historic consumption</h2>
          <p>Bring your monthly readings into one place.</p>
          <a href="/templates/consumption-latest.xlsx" download="site_mit site historic data V2 drivers sheet.xlsx">
            Download latest consumption template
          </a>
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
              <span>{workbookLabel}</span>
              <input
                type="file"
                accept=".xlsx"
                required
                disabled={m.pending}
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setPreview(null);
                  setMissing([]);
                  setFillMissing(false);
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
                Keep the template’s <strong>A–L column order</strong>.
              </span>
            </li>
            <li>
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>
                Match an existing <strong>site</strong>; missing meters are created on import.
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
              {historicCompactColumns.map((name, index) => (
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
              <strong>Layout.</strong> The new template has 12 columns, with Consumption in F. Older 13-column files are
              also supported: MPAN/MPRN in F is ignored and Consumption stays in G.
            </p>
            <p>
              <strong>Meter matching.</strong> An existing meter is selected by site, utility and unit. If none matches,
              a default meter is created when you confirm the import. Multiple matches still require resolution. Solar
              PV is a separate fuel source. New meters using physical units use the workbook’s conversion factor for
              each imported month.
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
      {!preview?.committed && (
        <MissingMonthConfirmation
          missing={missing}
          confirmed={fillMissing}
          disabled={m.disabled}
          onChange={(value) => {
            setFillMissing(value);
            setPreview(null);
          }}
        />
      )}
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
                  ? `Imported ${preview.count} consumption readings. ${preview.created} new, ${preview.updated} updated, ${preview.unchanged} unchanged.`
                  : `${preview.count} readings: ${preview.created} new, ${preview.updated} to update, ${preview.unchanged} unchanged. No data has been saved yet.`}
              </p>
            </div>
          </div>
          {!preview.committed && preview.defaultMeters?.length > 0 && (
            <div className="notice">
              <div>
                <strong>{preview.defaultMeters.length} default meter(s) will be created on import</strong>
                <ul>
                  {preview.defaultMeters.map((meter) => (
                    <li key={meter.id}>
                      {meter.site}: {meter.name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {!preview.committed && (
            <>
              <div className="import-preview-footer">
                <span className="muted">Matching readings will be updated. Previous revisions remain in history.</span>
                <Button
                  disabled={m.pending}
                  onClick={() => void m.run(() => upload(true), 'Consumption import completed.')}
                >
                  Import {preview.count} readings <ArrowRight size={16} aria-hidden="true" />
                </Button>
              </div>
              <div className="analysis-table">
                <table>
                  <thead>
                    <tr>
                      {[
                        'Excel row',
                        'Action',
                        'Site',
                        'Meter',
                        'Month',
                        'Previous consumption',
                        'Consumption',
                        'Net cost',
                        'Total including VAT',
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.records.map((r) => (
                      <tr key={r.row}>
                        <td>{r.row}</td>
                        <td>{r.action}</td>
                        <td>{r.site}</td>
                        <td>{r.meter}</td>
                        <td>{r.month}</td>
                        <td>{r.previousQuantity === null ? '—' : `${r.previousQuantity} ${r.unit}`}</td>
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
            </>
          )}
        </section>
      )}
    </section>
  );
}
