'use client';
import { useState } from 'react';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
import { WorkbookTemplateFields, workbookSelection, WorkbookSelectionSummary } from './workbook-template';
import type { CarbonImportKind, CarbonImportPreview } from '@/domain/carbon-imports';
type Batch = {
  id: string;
  status: string;
  kind: string;
  result: CarbonImportPreview;
  receipt: { row: number; id: string; revision: number }[] | null;
};
export function CarbonImports({
  base,
  canFactors,
  onCommitted,
  monthlyOnly = false,
}: {
  monthlyOnly?: boolean;
  base: string;
  canFactors: boolean;
  onCommitted: () => void;
}) {
  const [kind, setKind] = useState<CarbonImportKind>(
    monthlyOnly ? 'monthlyTargets' : canFactors ? 'emissions' : 'targets',
  );
  const [batch, setBatch] = useState<Batch | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const mutation = useMutation();
  return (
    <section aria-label="Carbon workbook imports" style={{ marginTop: 24 }}>
      <h3>{monthlyOnly ? 'Import monthly plans' : 'Import targets, monitoring or factors'}</h3>
      <p>
        One selected worksheet per batch, up to 120 source rows. Monthly records belong to this site. Calculated results
        and assessments are not imported.
      </p>
      {!monthlyOnly && (
        <p>
          Annual carbon targets require a registered meterCode and unit kgCO2e. Organisation emission factors require
          kgCO2e/kWh.
        </p>
      )}
      <p>
        Monthly targets and monitoring use month YYYY-MM or YYYY-ALL, fuel, unit, energy, carbon (kgCO2e),
        conversionFactor (kWh per unit) and source. Monitoring can link semicolon-separated energyUseCodes. ALL repeats
        the supplied value in each month; it does not divide an annual amount.
      </p>
      <p>
        Corrections require supersedesId and reason. Blank correction columns create new records. Styled cells and saved
        formula results are supported; recalculate and save the workbook before upload.
      </p>
      {mutation.feedback}
      <label>
        Carbon import destination
        <select
          value={kind}
          disabled={mutation.disabled}
          onChange={(e) => {
            setKind(e.target.value as CarbonImportKind);
            setBatch(null);
            setConfirmed(false);
          }}
        >
          {!monthlyOnly && canFactors && <option value="emissions">Emission factors (organisation-wide)</option>}
          {!monthlyOnly && <option value="targets">Annual carbon targets (this site)</option>}
          <option value="monthlyTargets">Monthly consumption/carbon targets</option>
          <option value="monitoring">Monthly utility monitoring plans</option>
        </select>
      </label>
      <form
        key={kind}
        className="stack-form"
        onChange={() => {
          setBatch(null);
          setConfirmed(false);
        }}
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          setBatch(null);
          setConfirmed(false);
          void mutation.run(async () => {
            const data = new FormData(form);
            const file = data.get('workbook');
            if (!(file instanceof File) || !file.size) throw new Error('Choose an XLSX workbook.');
            if (file.size > 2_000_000) throw new Error('Upload a workbook smaller than 2 MB.');
            const selection = await workbookSelection(form);
            const response = await fetch(`/api/v1/${base}/carbon/imports?kind=${kind}&${selection}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
              body: file,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.title ?? 'Unable to preview workbook.');
            setBatch(result);
          }, 'Workbook preview ready for review.');
        }}
      >
        <fieldset disabled={mutation.disabled} className="stack-form" style={{ border: 0, padding: 0 }}>
          <label>
            Carbon workbook
            <input name="workbook" type="file" accept=".xlsx" required />
          </label>
          <WorkbookTemplateFields kind={kind} />
          <Button type="submit" disabled={mutation.disabled}>
            Preview carbon workbook
          </Button>
        </fieldset>
      </form>
      {batch && (
        <div aria-label="Carbon import preview">
          <p>
            <strong>{batch.status}</strong> · {batch.result.records.length} valid rows · {batch.result.issues.length}{' '}
            errors
          </p>
          <WorkbookSelectionSummary selection={batch.result.selection} />
          {batch.result.issues.map((issue, i) => (
            <p role="alert" key={i}>
              Row {issue.row}: {issue.message}
            </p>
          ))}
          <div style={{ overflowX: 'auto' }}>
            <table className="import-preview-table">
              <thead>
                <tr>
                  <th>Workbook row</th>
                  <th>Mapped values</th>
                  <th>Operation</th>
                </tr>
              </thead>
              <tbody>
                {batch.result.records.map((row, index) => (
                  <tr key={`${row.row}-${index}`}>
                    <td>{row.row}</td>
                    <td>
                      {Object.entries(row.data)
                        .filter(([key]) => key !== 'requestKey')
                        .map(([key, value]) => (
                          <div key={key}>
                            <strong>{key}:</strong> {value}
                          </div>
                        ))}
                    </td>
                    <td>{row.supersedesId ? `Correct ${row.supersedesId}: ${row.reason}` : 'Create'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {batch.status === 'READY' && (
            <>
              <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  style={{ width: 16, height: 16, minHeight: 0 }}
                  checked={confirmed}
                  disabled={mutation.disabled}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I reviewed all rows, units, scope and corrections.
              </label>
              <Button
                type="button"
                disabled={mutation.disabled || !confirmed}
                onClick={() =>
                  void mutation.run(async () => {
                    setBatch(await request(`${base}/carbon/imports/${batch.id}/commit`, 'POST', { confirmed: true }));
                    setConfirmed(false);
                    onCommitted();
                  }, 'Carbon workbook committed.')
                }
              >
                Commit carbon import
              </Button>
            </>
          )}
          {batch.receipt && (
            <div>
              <h4>Committed row receipt</h4>
              {batch.receipt.map((row) => (
                <p key={row.id}>
                  Row {row.row} → {row.id} · Revision {row.revision}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
