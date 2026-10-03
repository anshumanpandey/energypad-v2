'use client';
import { useState } from 'react';
import { Button } from './ui/button';
import { ImportRequestError, responseError, useMutation } from './forms';
import { factorBases } from '@/domain/emission-factors';

const sheets = [
  { name: 'Emissions', path: 'emissions-imports' },
  { name: 'Targets', path: 'target-imports' },
  { name: 'Drivers', path: 'driver-classification-imports' },
  { name: 'Historic Consumption', path: 'consumption-imports' },
] as const;
type Result = {
  signature: string;
  count: number;
  created?: number;
  newCount?: number;
  updated?: number;
  unchanged?: number;
  existingCount?: number;
};

export function WorkbookImport({ orgId }: { orgId: string }) {
  const m = useMutation();
  const [file, setFile] = useState<File | null>(null);
  const [geography, setGeography] = useState('GB');
  const [basis, setBasis] = useState('LOCATION_BASED');
  const [preview, setPreview] = useState<Result[] | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState(false);
  function reset() {
    setPreview(null);
    setSaved([]);
    setDone(false);
  }
  async function send(index: number, signature?: string): Promise<Result> {
    const sheet = sheets[index];
    const query = index === 0 ? `?${new URLSearchParams({ geography, basis })}` : '';
    const response = await fetch(
      `/api/v1/organisations/${orgId}/${sheet.path}/${signature === undefined ? 'preview' : 'commit'}${query}`,
      {
        method: 'POST',
        body: file,
        headers: {
          'Content-Type': 'application/octet-stream',
          ...(signature === undefined ? {} : { 'X-Import-Signature': signature }),
        },
      },
    );
    const data = await response.json();
    if (!response.ok) throw responseError(data);
    return data;
  }
  async function validate() {
    if (!file) throw new Error('Choose an XLSX workbook.');
    setPreview(null);
    setDone(false);
    setProgress('Checking all four sheets…');
    try {
      const results = await Promise.allSettled(sheets.map((_, index) => send(index)));
      const failed = results.flatMap((result, index) =>
        result.status === 'rejected' ? [{ name: sheets[index].name, error: result.reason }] : [],
      );
      if (failed.length)
        throw new ImportRequestError(
          failed
            .map(
              ({ name, error }) =>
                `${name}: ${error instanceof Error ? error.message : 'Could not validate this sheet.'}`,
            )
            .join(' '),
          failed.flatMap(({ error }) => (error instanceof ImportRequestError ? error.cellErrors : [])),
        );
      setPreview(results.map((result) => (result as PromiseFulfilledResult<Result>).value));
      setSaved([]);
    } finally {
      setProgress('');
    }
  }
  async function commit() {
    if (!preview || !file) throw new Error('Validate the workbook first.');
    const completed: string[] = [];
    try {
      for (let index = 0; index < sheets.length; index++) {
        setProgress(`Importing ${sheets[index].name}…`);
        await send(index, preview[index].signature);
        completed.push(sheets[index].name);
        setSaved([...completed]);
      }
      setDone(true);
    } catch (error) {
      setPreview(null);
      throw new ImportRequestError(
        `${completed.length ? `Saved: ${completed.join(', ')}. ` : ''}The import stopped at ${sheets[completed.length].name}. ${error instanceof Error ? error.message : 'Please try again.'} Validate the workbook again to safely retry the remaining data.`,
        error instanceof ImportRequestError ? error.cellErrors : [],
      );
    } finally {
      setProgress('');
    }
  }
  return (
    <section className="consumption-import" aria-label="Workbook upload">
      <div className="panel stack-form">
        <h2>Upload all four sheets together</h2>
        <p>
          Download the template, fill Emissions, Targets, Drivers and Historic Consumption, then upload the completed
          workbook once. Review all four sheets and import them with one click.
        </p>
        <p>
          Use an existing site name in the first column, including columns labelled Site Code. Keep the worksheet
          headers and the Drivers headers on row 6. Setpoints are not imported here.
        </p>
        <Button asChild variant="secondary">
          <a href="/templates/historic-data.xlsx" download="site_mit site historic data V2 drivers sheet.xlsx">
            Download Template
          </a>
        </Button>
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            void m.run(validate, 'All four sheets validated. Review before importing.');
          }}
        >
          <label>
            Workbook
            <input
              type="file"
              accept=".xlsx"
              required
              disabled={m.disabled}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                reset();
              }}
            />
          </label>
          <label>
            Geography code
            <input
              value={geography}
              required
              minLength={2}
              maxLength={40}
              disabled={m.disabled}
              onChange={(event) => {
                setGeography(event.target.value);
                reset();
              }}
            />
          </label>
          <label>
            Reporting basis
            <select
              value={basis}
              disabled={m.disabled}
              onChange={(event) => {
                setBasis(event.target.value);
                reset();
              }}
            >
              {factorBases.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <p>Geography and reporting basis apply to the Emissions sheet.</p>
          <Button disabled={m.disabled || !file}>Validate workbook</Button>
        </form>
      </div>
      {progress && <p role="status">{progress}</p>}
      {m.feedback}
      {(preview || saved.length > 0) && (
        <section className="panel" aria-label="Workbook import preview">
          <h3>{done ? 'Workbook imported' : 'Review all four sheets'}</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="import-preview-table">
              <thead>
                <tr>
                  <th scope="col">Sheet</th>
                  <th scope="col">Records</th>
                  <th scope="col">New</th>
                  <th scope="col">Updates</th>
                  <th scope="col">Unchanged</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {sheets.map((sheet, index) => {
                  const result = preview?.[index];
                  return (
                    <tr key={sheet.name}>
                      <th scope="row">{sheet.name}</th>
                      <td>{result?.count ?? '—'}</td>
                      <td>{result?.created ?? result?.newCount ?? '—'}</td>
                      <td>{result?.updated ?? (result ? 0 : '—')}</td>
                      <td>{result?.unchanged ?? result?.existingCount ?? '—'}</td>
                      <td>{saved.includes(sheet.name) ? 'Imported' : result ? 'Ready' : 'Needs validation'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {preview && !done && (
            <Button disabled={m.disabled} onClick={() => void m.run(commit, 'All four sheets imported successfully.')}>
              Import all four sheets
            </Button>
          )}
        </section>
      )}
    </section>
  );
}
