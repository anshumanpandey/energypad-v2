'use client';
import { formatMonth } from '@/domain/format-month';
import { useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Button } from './ui/button';
import { responseError, useMutation } from './forms';
import { emissionsColumns } from '@/domain/historic-emissions';
import { factorBases } from '@/domain/emission-factors';
import { MissingMonthConfirmation } from './missing-month-confirmation';
import type { MissingImportMonth } from '@/domain/import-missing-months';
type Preview = {
  committed: boolean;
  count: number;
  newCount: number;
  existingCount: number;
  signature: string;
  geography: string;
  basis: string;
  records: {
    row: number;
    site: string;
    month: string;
    fuel: string;
    factor: string;
    unit: string;
    existing: boolean;
  }[];
};
export function HistoricEmissionsImport({ orgId }: { orgId: string }) {
  const m = useMutation();
  const [file, setFile] = useState<File | null>(null);
  const [geography, setGeography] = useState('GB');
  const [basis, setBasis] = useState('LOCATION_BASED');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fillMissing, setFillMissing] = useState(false);
  const [missing, setMissing] = useState<MissingImportMonth[]>([]);
  async function upload(commit: boolean) {
    if (!file) throw new Error('Choose an XLSX workbook.');
    const signature = preview?.signature;
    setPreview(null);
    const query = new URLSearchParams({ geography, basis });
    const response = await fetch(
      `/api/v1/organisations/${orgId}/emissions-imports/${commit ? 'commit' : 'preview'}?${query}`,
      {
        method: 'POST',
        body: file,
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Fill-Missing-Months': String(fillMissing),
          ...(commit ? { 'X-Import-Signature': signature ?? '' } : {}),
        },
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
          <span className="eyebrow">EMISSIONS DATA</span>
          <h2>Import monthly emission factors</h2>
          <p>Import site-specific factors from your Emissions sheet.</p>
        </div>
        <span className="import-format">
          <FileSpreadsheet size={15} aria-hidden="true" />
          Excel · .xlsx
        </span>
      </div>
      <div className="import-layout">
        <div className="panel import-upload-card">
          <div className="import-card-heading">
            <span className="import-icon">
              <Upload size={21} aria-hidden="true" />
            </span>
            <div>
              <h3>Upload your workbook</h3>
              <p>Every populated cell is checked before saving.</p>
            </div>
          </div>
          <form
            className="stack-form"
            onSubmit={(event) => {
              event.preventDefault();
              void m.run(() => upload(false), 'Emission factors validated. Review before importing.');
            }}
          >
            <label className="import-file-field">
              Emissions workbook
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
            <div className="form-grid">
              <label>
                Geography code
                <input
                  required
                  maxLength={40}
                  pattern="[A-Za-z0-9_-]{2,40}"
                  value={geography}
                  disabled={m.pending}
                  onChange={(e) => {
                    setGeography(e.target.value);
                    setPreview(null);
                  }}
                />
              </label>
              <label>
                Reporting basis
                <select
                  value={basis}
                  disabled={m.pending}
                  onChange={(e) => {
                    setBasis(e.target.value);
                    setPreview(null);
                  }}
                >
                  {factorBases.map((value) => (
                    <option key={value} value={value}>
                      {value.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="muted">
              These settings apply to this import because they are not included in the workbook. Factors use kgCO₂e/kWh.
            </p>
            <div className="import-upload-footer">
              <span className="muted">XLSX · Up to 2 MB · 2,000 rows</span>
              <Button disabled={m.disabled || !file}>{m.pending ? 'Checking workbook…' : 'Validate emissions'}</Button>
            </div>
          </form>
        </div>
        <aside className="import-guide" aria-label="Emissions workbook requirements">
          <h3>Expected column order</h3>
          <ol className="import-column-list">
            {emissionsColumns.map((name, i) => (
              <li key={name}>
                <span>{String.fromCharCode(65 + i)}</span>
                {name}
              </li>
            ))}
          </ol>
          <p>
            Use the <strong>Emissions</strong> sheet. A1 may be blank or “Site Code”. Each site must already exist.
          </p>
          <p>
            Use Jan–Dec or 1–12, kWh, and a non-negative factor. Formatted cells and formulas with saved results are
            supported. Excel error cells must be fixed.
          </p>
        </aside>
      </div>
      {m.feedback}
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
        <section className="panel import-preview" aria-label="Emissions import preview">
          <h3>{preview.committed ? 'Emission factors imported' : 'Review emission factors'}</h3>
          <p>
            {preview.count} factors · {preview.newCount} {preview.committed ? 'added' : 'new'} · {preview.existingCount}{' '}
            already imported
          </p>
          <p>
            {preview.geography} · {preview.basis.replaceAll('_', ' ')} · kgCO₂e/kWh · Applies only to each listed site.
          </p>
          {!preview.committed && (
            <Button disabled={m.disabled} onClick={() => void m.run(() => upload(true), 'Emission factors imported.')}>
              Import emission factors
            </Button>
          )}
          <div className="import-table-scroll" style={{ overflowX: 'auto' }}>
            <table className="import-preview-table">
              <thead>
                <tr>
                  <th>Excel row</th>
                  <th>Site</th>
                  <th>Month</th>
                  <th>Utility</th>
                  <th>Factor (kgCO₂e/kWh)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.records.map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    <td>{r.site}</td>
                    <td>{formatMonth(r.month)}</td>
                    <td>{r.fuel}</td>
                    <td>{r.factor}</td>
                    <td>{r.existing ? 'Already imported' : preview.committed ? 'Imported' : 'New'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}
