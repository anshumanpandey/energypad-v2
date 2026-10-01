'use client';
import { useState } from 'react';
import { Button } from './ui/button';
import { responseError, useMutation } from './forms';
import { targetColumns } from '@/domain/target-import';
import { utilityLabel } from '@/domain/consumption-sort';
import type { TargetImportService } from '@/server/target-import';
type Preview = Awaited<ReturnType<TargetImportService['process']>>;
export function TargetImport({ orgId }: { orgId: string }) {
  const m = useMutation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  async function upload(commit: boolean) {
    if (!file) throw new Error('Choose an XLSX workbook.');
    const signature = preview?.signature;
    setPreview(null);
    const response = await fetch(`/api/v1/organisations/${orgId}/target-imports/${commit ? 'commit' : 'preview'}`, {
      method: 'POST',
      body: file,
      headers: {
        'Content-Type': 'application/octet-stream',
        ...(commit ? { 'X-Import-Signature': signature ?? '' } : {}),
      },
    });
    const data = await response.json();
    if (!response.ok) throw responseError(data);
    setPreview(data);
  }
  return (
    <section className="consumption-import">
      <div className="import-intro">
        <div>
          <span className="eyebrow">MONTHLY TARGETS</span>
          <h2>Import energy and carbon targets</h2>
          <p>Upload the Targets sheet to save monthly targets for each site and utility.</p>
        </div>
      </div>
      <div className="import-layout">
        <div className="panel import-upload-card stack-form">
          <label>
            Targets workbook
            <input
              type="file"
              accept=".xlsx"
              disabled={m.disabled}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
              }}
            />
          </label>
          <Button disabled={m.disabled || !file} onClick={() => void m.run(() => upload(false), 'Targets validated.')}>
            Validate targets
          </Button>
          <p className="muted">Validation does not save data. Review the rows before importing.</p>
        </div>
        <aside className="import-guide">
          <h3>Required format</h3>
          <p>Sheet: Targets · Headers on row 1 · Fixed column order A–G</p>
          <ol>
            {targetColumns.map((column) => (
              <li key={column}>{column}</li>
            ))}
          </ol>
          <p>
            Energy uses kWh or MWh; carbon uses kilograms. Both targets must be non-negative numbers. Saved formula
            results and formatted numeric cells are supported.
          </p>
          <p>
            Site codes must already exist in this workspace. Diesel uses the Oil utility, as in consumption imports.
          </p>
        </aside>
      </div>
      {m.feedback}
      {preview && (
        <section className="panel import-preview" aria-label="Targets import preview">
          <h3>{preview.committed ? 'Targets imported' : 'Review targets'}</h3>
          <p>
            {preview.count} rows · {preview.created} new · {preview.updated}{' '}
            {preview.committed ? 'updated' : 'to update'} · {preview.unchanged} unchanged
          </p>
          {!preview.committed && (
            <div className="import-preview-footer">
              <span>Matching targets will be updated; previous revisions stay in history.</span>
              <Button
                disabled={m.disabled}
                onClick={() => void m.run(() => upload(true), 'Targets imported successfully.')}
              >
                Import {preview.count} targets
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
                    <td>{row.month}</td>
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
