'use client';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { responseError, request, useMutation } from './forms';
import {
  classificationColumns,
  classificationFields,
  classificationLabels,
  type ClassificationRow,
} from '@/domain/driver-classifications';
type Row = ClassificationRow & { siteName: string };
type Saved = Omit<Row, 'site'> & { id: string; site: { code: string; name: string }; sourceRow: number };
type Preview = {
  committed: boolean;
  signature: string;
  count: number;
  newCount: number;
  existingCount: number;
  records: Row[];
};
function ClassificationTable({ records }: { records: Row[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="import-preview-table">
        <thead>
          <tr>
            {classificationColumns.map((name) => (
              <th key={name} scope="col">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={`${r.site}:${r.year}`}>
              <td>
                {r.siteName} ({r.site})
              </td>
              <td>{r.year}</td>
              {classificationFields.map((field) => (
                <td key={field}>
                  {r[field]} · {classificationLabels[r[field]]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function DriverClassificationImport({ orgId }: { orgId: string }) {
  const m = useMutation();
  const base = `organisations/${orgId}/driver-classification-imports`;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [loadError, setLoadError] = useState('');
  useEffect(() => {
    let active = true;
    request(base, 'GET')
      .then((rows) => {
        if (active) setSaved(rows);
      })
      .catch(() => {
        if (active) setLoadError('Saved classifications could not be loaded. Reload this page to try again.');
      });
    return () => {
      active = false;
    };
  }, [base]);
  async function upload(commit: boolean) {
    if (!file) throw new Error('Choose an XLSX workbook.');
    const signature = preview?.signature;
    setPreview(null);
    const response = await fetch(`/api/v1/${base}/${commit ? 'commit' : 'preview'}`, {
      method: 'POST',
      body: file,
      headers: {
        'Content-Type': 'application/octet-stream',
        ...(commit ? { 'X-Import-Signature': signature ?? '' } : {}),
      },
    });
    const result = await response.json();
    if (!response.ok) throw responseError(result);
    setPreview(result);
    if (result.committed) {
      try {
        setSaved(await request(base, 'GET'));
        setLoadError('');
      } catch {
        setLoadError('Import completed, but saved classifications could not be refreshed. Reload this page.');
      }
    }
  }
  return (
    <section className="consumption-import">
      <div className="import-intro">
        <div>
          <span className="eyebrow">SITE DRIVERS</span>
          <h2>Import driver classifications</h2>
          <p>Set the routine and non-routine drivers for each site and year.</p>
        </div>
      </div>
      <div className="import-layout">
        <div className="panel import-upload-card">
          <h3>Upload your workbook</h3>
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              void m.run(() => upload(false), 'Drivers validated. Review before importing.');
            }}
          >
            <label className="import-file-field">
              Drivers workbook
              <input
                type="file"
                accept=".xlsx"
                required
                disabled={m.pending}
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                }}
              />
            </label>
            <p>
              Use the <strong>Drivers</strong> sheet, with headers on row 6 and site data starting on row 7.
            </p>
            <div className="import-upload-footer">
              <span className="muted">XLSX · Up to 2 MB</span>
              <Button disabled={m.disabled || !file}>{m.pending ? 'Checking workbook…' : 'Validate drivers'}</Button>
            </div>
          </form>
        </div>
        <aside className="import-guide" aria-label="Driver format rules">
          <h3>Expected columns A–H</h3>
          <ol className="import-column-list">
            {classificationColumns.map((name, i) => (
              <li key={name}>
                <span>{String.fromCharCode(65 + i)}</span>
                {name}
              </li>
            ))}
          </ol>
          <p>
            <strong>R</strong> Routine · <strong>NR</strong> Non-routine · <strong>N/A</strong> Not applicable
          </p>
          <p>
            Site must match one existing active site code or name. These are annual classifications, separate from
            monthly population and operating-hour measurements.
          </p>
        </aside>
      </div>
      {m.feedback}
      {preview && (
        <section className="panel import-preview" aria-label="Driver classification preview">
          <h3>{preview.committed ? 'Driver classifications imported' : 'Review driver classifications'}</h3>
          <p>
            {preview.count} site/year rows · {preview.newCount} {preview.committed ? 'added' : 'new'} ·{' '}
            {preview.existingCount} already saved
          </p>
          <ClassificationTable records={preview.records} />
          {!preview.committed && (
            <Button
              disabled={m.disabled}
              onClick={() => void m.run(() => upload(true), 'Driver classifications saved.')}
            >
              Import drivers
            </Button>
          )}
        </section>
      )}
      <section className="panel import-preview" aria-label="Saved driver classifications">
        <h3>Saved driver classifications</h3>
        {loadError ? (
          <p role="alert">{loadError}</p>
        ) : saved === null ? (
          <p>Loading saved classifications…</p>
        ) : !saved.length ? (
          <p>No driver classifications imported yet.</p>
        ) : (
          <ClassificationTable
            records={saved.map((r) => ({ ...r, site: r.site.code, siteName: r.site.name, row: r.sourceRow }))}
          />
        )}
      </section>
    </section>
  );
}
