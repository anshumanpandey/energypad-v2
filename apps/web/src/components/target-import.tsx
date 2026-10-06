'use client';
import { formatMonth } from '../domain/format-month';
import { useState } from 'react';
import { FileSpreadsheet, Upload, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { responseError, useMutation } from './forms';
import { targetColumns } from '@/domain/target-import';
import { utilityLabel } from '@/domain/consumption-sort';
import type { TargetImportService } from '@/server/target-import';
import { MissingMonthConfirmation } from './missing-month-confirmation';
import type { MissingImportMonth } from '@/domain/import-missing-months';
type Preview = Awaited<ReturnType<TargetImportService['process']>>;
export function TargetImport({ orgId }: { orgId: string }) {
  const m = useMutation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [fillMissing, setFillMissing] = useState(false);
  const [missing, setMissing] = useState<MissingImportMonth[]>([]);
  async function upload(commit: boolean) {
    if (!file) throw new Error('Choose an XLSX workbook.');
    const signature = preview?.signature;
    setPreview(null);
    const response = await fetch(`/api/v1/organisations/${orgId}/target-imports/${commit ? 'commit' : 'preview'}`, {
      method: 'POST',
      body: file,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Fill-Missing-Months': String(fillMissing),
        ...(commit ? { 'X-Import-Signature': signature ?? '' } : {}),
      },
    });
    const data = await response.json();
    if (!response.ok) throw responseError(data);
    setPreview(data);
    setMissing(data.missingMonths ?? []);
  }
  return (
    <section className="consumption-import">
      <div className="import-intro">
        <div>
          <span className="eyebrow">MONTHLY TARGETS</span>
          <h2>Import energy and carbon targets</h2>
          <p>Upload the Targets sheet to save monthly targets for each site and utility.</p>
        </div>
        <span className="import-format">
          <FileSpreadsheet size={15} aria-hidden="true" /> Excel · .xlsx
        </span>
      </div>
      <ol className="import-steps" aria-label="Import progress">
        {['Choose workbook', 'Review targets', 'Import data'].map((step, index) => (
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
              <p>Every populated cell is checked before saving.</p>
            </div>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void m.run(() => upload(false), 'Targets validated. Review before importing.');
            }}
          >
            <label className="import-file-field">
              Targets workbook
              <input
                type="file"
                accept=".xlsx"
                required
                disabled={m.disabled}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                  setMissing([]);
                  setFillMissing(false);
                }}
              />
            </label>
            <div className="import-upload-footer">
              <span className="muted">XLSX · Up to 2 MB · 2,000 rows</span>
              <Button type="submit" disabled={m.disabled || !file}>
                {m.pending ? 'Checking workbook…' : 'Validate targets'} <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </div>
          </form>
        </div>
        <aside className="import-guide" aria-label="Targets workbook requirements">
          <h3>Expected column order</h3>
          <ol className="import-column-list">
            {targetColumns.map((column, index) => (
              <li key={column}>
                <span>{String.fromCharCode(65 + index)}</span>
                {column}
              </li>
            ))}
          </ol>
          <p>
            Use the <strong>Targets</strong> sheet with headers on row 1. Enter an existing site name in the first
            column.
          </p>
          <p>
            Energy uses kWh or MWh; carbon uses kilograms. Both targets must be non-negative numbers. Saved formula
            results and formatted numeric cells are supported.
          </p>
          <p>Diesel uses the Oil utility, as in consumption imports.</p>
        </aside>
      </div>
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
        <section className="panel import-preview" aria-label="Targets import preview">
          <div className="import-card-heading">
            <span className="import-icon">
              <CheckCircle2 size={21} aria-hidden="true" />
            </span>
            <div>
              <h3>{preview.committed ? 'Targets imported' : 'Review targets'}</h3>
              <p>
                {preview.count} rows · {preview.created} new · {preview.updated}{' '}
                {preview.committed ? 'updated' : 'to update'} · {preview.unchanged} unchanged
              </p>
            </div>
          </div>
          {!preview.committed && (
            <div className="import-preview-footer">
              <span className="muted">Matching targets will be updated; previous revisions stay in history.</span>
              <Button
                disabled={m.disabled}
                onClick={() => void m.run(() => upload(true), 'Targets imported successfully.')}
              >
                Import {preview.count} targets <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </div>
          )}
          <div className="analysis-table">
            <table>
              <thead>
                <tr>
                  {['Excel row', 'Action', 'Site', 'Month', 'Utility', 'Energy target', 'Carbon target (kg)'].map(
                    (label) => (
                      <th key={label}>{label}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {preview.records.map((row) => (
                  <tr key={row.row}>
                    <td>{row.row}</td>
                    <td>{row.action}</td>
                    <td>{row.site}</td>
                    <td>{formatMonth(row.month)}</td>
                    <td>{utilityLabel(row.fuel)}</td>
                    <td>
                      {row.energy} {row.unit}
                    </td>
                    <td>{row.carbon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.committed && (
            <p>Saved targets are available on Targets &amp; Monitoring for the matching site and year.</p>
          )}
        </section>
      )}
    </section>
  );
}
