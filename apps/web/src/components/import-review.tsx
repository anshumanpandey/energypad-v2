'use client';
import { useEffect, useState } from 'react';
import type { ApiDataset } from '@/domain/api-import';
import { ImportRecordsTable } from './import-records-table';
import { Button } from './ui/button';
import { ImportRequestError, responseError, useMutation } from './forms';
import { factorBases } from '@/domain/emission-factors';
import { MissingMonthConfirmation } from './missing-month-confirmation';
import type { MissingImportMonth } from '@/domain/import-missing-months';

const allSheets = [
  { dataset: 'emissions', name: 'Emissions', path: 'emissions-imports' },
  { dataset: 'targets', name: 'Targets', path: 'target-imports' },
  { dataset: 'drivers', name: 'Drivers', path: 'driver-classification-imports' },
  { dataset: 'consumption', name: 'Historic Consumption', path: 'consumption-imports' },
] as const;
type Result = {
  signature: string;
  records: Record<string, unknown>[];
  missingMonths?: MissingImportMonth[];
  count: number;
  created?: number;
  newCount?: number;
  updated?: number;
  unchanged?: number;
  existingCount?: number;
};

export function ImportReview({
  orgId,
  dataset = null,
  initialFile = null,
  onBusy,
}: {
  orgId: string;
  dataset?: ApiDataset | null;
  initialFile?: File | null;
  onBusy?: (busy: boolean) => void;
}) {
  const m = useMutation();
  useEffect(() => {
    if (m.pending) {
      onBusy?.(true);
      return () => onBusy?.(false);
    }
  }, [m.pending, onBusy]);
  const sheets = dataset ? allSheets.filter((sheet) => sheet.dataset === dataset) : allSheets;
  const [file, setFile] = useState<File | null>(initialFile);
  const [geography, setGeography] = useState('GB');
  const [basis, setBasis] = useState('LOCATION_BASED');
  const [preview, setPreview] = useState<Result[] | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState(false);
  const [fillMissing, setFillMissing] = useState(false);
  const [missing, setMissing] = useState<MissingImportMonth[]>([]);
  function reset() {
    setPreview(null);
    setSaved([]);
    setDone(false);
    setFillMissing(false);
    setMissing([]);
  }
  async function send(index: number, signature?: string): Promise<Result> {
    const sheet = sheets[index];
    const query = sheet.dataset === 'emissions' ? `?${new URLSearchParams({ geography, basis })}` : '';
    const response = await fetch(
      `/api/v1/organisations/${orgId}/${sheet.path}/${signature === undefined ? 'preview' : 'commit'}${query}`,
      {
        method: 'POST',
        body: file,
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Fill-Missing-Months': String(fillMissing),
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
    setProgress(dataset ? `Checking ${dataset}…` : 'Checking all four sheets…');
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
      const validated = results.map((result) => (result as PromiseFulfilledResult<Result>).value);
      setPreview(validated);
      setMissing(
        validated.flatMap((result, i) =>
          (result.missingMonths ?? []).map((item) => ({ ...item, scope: `${sheets[i].name} · ${item.scope}` })),
        ),
      );
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
    <section className="consumption-import" aria-label={dataset ? `${dataset} API import` : 'Workbook upload'}>
      <div className="panel stack-form">
        {!dataset && (
          <>
            <h2>Excel sheet import</h2>
            <p>
              Download the template, fill Emissions, Targets, Drivers and Historic Consumption, then upload the
              completed workbook once. Review all four sheets and import them with one click.
            </p>
            <p>
              Use an existing site name in the first column, including columns labelled Site Code. Keep the worksheet
              headers and the Drivers headers on row 6. Setpoints are not imported here.
            </p>
            <p>
              The latest template uses site-wide emission factors (kgCO2e/kWh) and site-wide targets (kWh and kgCO2e).
              Heating and Cooling readings are imported into separate meters.
            </p>
            <Button asChild variant="secondary">
              <a href="/templates/historic-data.xlsx" download="site_mit site historic data V2 drivers sheet.xlsx">
                Download Template
              </a>
            </Button>
          </>
        )}
        {file && (
          <p role="status">
            {dataset ? 'Fetched data' : 'Selected workbook'}: {file.name}
          </p>
        )}
        <form
          className="stack-form"
          onSubmit={(event) => {
            event.preventDefault();
            void m.run(validate, 'Data validated. Review before importing.');
          }}
        >
          {!dataset && (
            <>
              <label>
                Workbook
                <input
                  type="file"
                  accept=".xlsx"
                  disabled={m.disabled}
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    reset();
                  }}
                />
              </label>
            </>
          )}
          {(!dataset || dataset === 'emissions') && (
            <>
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
            </>
          )}
          <Button disabled={m.disabled || !file}>{dataset ? `Validate ${dataset} data` : 'Validate workbook'}</Button>
        </form>
      </div>
      {progress && <p role="status">{progress}</p>}
      {m.feedback}
      {!done && (
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
      {(preview || saved.length > 0) && (
        <section className="panel" aria-label={dataset ? `${dataset} API preview` : 'Workbook import preview'}>
          <h3>{done ? 'Data imported' : dataset ? `Review ${dataset}` : 'Review all four sheets'}</h3>
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
            <Button disabled={m.disabled} onClick={() => void m.run(commit, 'Data imported successfully.')}>
              {dataset ? `Import ${dataset} records` : 'Import all four sheets'}
            </Button>
          )}
          {preview &&
            sheets.map((sheet, index) => (
              <ImportRecordsTable
                key={`${sheet.dataset}-${preview[index].signature}`}
                dataset={sheet.dataset}
                records={preview[index].records}
              />
            ))}
        </section>
      )}
    </section>
  );
}
