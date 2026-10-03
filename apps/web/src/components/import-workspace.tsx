'use client';
import { DateInput } from './ui/date-input';
import { responseError } from './forms';
import { useState, type FormEvent } from 'react';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
import {
  siteTemplateFields,
  siteTemplateAttributeFields,
  siteColumnIndex,
  type ImportSheet,
  type RowIssue,
  type SiteInput,
} from '@/domain/sites';
type Batch = {
  id: string;
  status: string;
  sheets: ImportSheet[];
  mapping?: { sheet: number } | null;
  result?: { records?: { row: number; data: SiteInput }[]; issues?: RowIssue[]; count?: number } | null;
};
const templateFields = [...siteTemplateFields, ...siteTemplateAttributeFields];
const importFields = templateFields.map(([field]) => field);
const fieldLabels: Record<string, string> = Object.fromEntries(templateFields);
export function ImportWorkspace({ orgId, batches }: { orgId: string; batches: { id: string; status: string }[] }) {
  const [batch, setBatch] = useState<Batch | null>(null),
    [sheet, setSheet] = useState(0),
    [validated, setValidated] = useState(false);
  const m = useMutation(),
    base = `organisations/${orgId}/imports`;
  function select(b: Batch) {
    setBatch(b);
    setSheet(b.mapping?.sheet ?? 0);
    setValidated(false);
  }
  const selected = batch?.sheets[sheet];
  const emailColumn = selected?.headers.findIndex((h) => h.toLowerCase() === 'businessemail') ?? -1;
  const sourceEmails = [
    ...new Set(selected?.rows.map((r) => r.cells[emailColumn]?.toLowerCase()).filter(Boolean) ?? []),
  ];
  function preview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!batch) return;
    const data = new FormData(e.currentTarget),
      columns: Record<string, number> = {},
      defaults: Record<string, string> = {};
    for (const field of importFields) {
      const col = data.get(`column:${field}`);
      if (col !== null && col !== '') columns[field] = Number(col);
      const value = String(data.get(`default:${field}`) ?? '');
      if (value) defaults[field] = value;
    }
    void m.run(async () => {
      const result = await request(`${base}/${batch.id}/preview`, 'POST', {
        sheet,
        columns,
        defaults,
        effectiveFrom: data.get('effectiveFrom'),
        businessEmail: data.get('businessEmail') ?? '',
        confirmCurrentOrganisation: data.get('confirm') === 'on',
      });
      setBatch(result);
      setValidated(result.status === 'READY');
    }, 'Preview updated. Review the rows before importing.');
  }
  function download() {
    const rows = batch?.result?.issues ?? [];
    const csv = [
      'Row,Field,Reason',
      ...rows.map((r) => [r.row, r.field, r.message].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="stack-form">
      {m.feedback}
      <section className="panel stack-form">
        <h2>Upload Sites</h2>
        <a href="/templates/sites.xlsx" download>
          Download Template
        </a>
        <p>
          Upload the site template with Site Name, Address Line 1, Address Line 2, City, State, Postcode, Population,
          and Work Hours per week (2 MB maximum, 2,000 rows per sheet). Password and credential columns are discarded
          before staging. User access is managed through Team members.
        </p>
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            const file = new FormData(e.currentTarget).get('workbook');
            if (!(file instanceof File)) return;
            void m.run(async () => {
              const response = await fetch(`/api/v1/${base}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
                body: file,
              });
              const data = await response.json();
              if (!response.ok) throw responseError(data);
              select(data);
            }, 'Workbook ready. Choose a sheet and map its columns.');
          }}
        >
          <label>
            Excel workbook
            <input name="workbook" type="file" accept=".xlsx" required />
          </label>
          <Button disabled={m.disabled}>Upload sites</Button>
        </form>
      </section>
      {batch && (
        <section className="panel stack-form">
          <p>
            Batch {batch.id} · {batch.status}
          </p>
          {batch.status === 'COMMITTED' ? (
            <p role="status">
              Import complete: {batch.result?.count} sites created. Repeating this batch will not create duplicates.
            </p>
          ) : (
            <>
              <h2>2. Map and validate</h2>
              <label>
                Site sheet
                <select
                  value={sheet}
                  onChange={(e) => {
                    setSheet(Number(e.target.value));
                    setValidated(false);
                  }}
                >
                  {batch.sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name} ({s.rows.length} rows)
                    </option>
                  ))}
                </select>
              </label>
              <form
                key={`${batch.id}:${sheet}`}
                onSubmit={preview}
                onChange={() => setValidated(false)}
                className="stack-form"
              >
                <p>
                  Template columns are matched automatically. Check the mapping or provide a default. Work hours must be
                  weekly.
                </p>
                <div className="form-grid">
                  {importFields.map((field) => {
                    const index = siteColumnIndex(selected?.headers ?? [], field);
                    return (
                      <fieldset key={field} className="import-mapping-field">
                        <legend>{fieldLabels[field]}</legend>
                        <label>
                          Source column for {fieldLabels[field]}
                          <select
                            aria-label={`Source column for ${fieldLabels[field]}`}
                            name={`column:${field}`}
                            defaultValue={index < 0 ? '' : index}
                          >
                            <option value="">Not mapped</option>
                            {selected?.headers.map((h, i) => (
                              <option key={i} value={i}>
                                {h || `Column ${i + 1}`}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Default for {fieldLabels[field]}
                          <input
                            aria-label={`Default for ${fieldLabels[field]}`}
                            name={`default:${field}`}
                            maxLength={300}
                          />
                        </label>
                      </fieldset>
                    );
                  })}
                </div>
                <label>
                  Attribute effective date
                  <DateInput name="effectiveFrom" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                </label>
                {sourceEmails.length > 0 && (
                  <label>
                    Source business email
                    <select name="businessEmail" required>
                      <option value="">Choose source business</option>
                      {sourceEmails.map((email) => (
                        <option key={email}>{email}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="checkbox-label">
                  <input type="checkbox" name="confirm" required />I confirm these sites belong to this workspace and
                  the mapped units are correct.
                </label>
                <Button disabled={m.disabled}>Validate and preview</Button>
              </form>
              {batch.result?.issues && (
                <>
                  <h2>3. Review preview</h2>
                  <p>
                    {batch.result.records?.length ?? 0} parsed rows · {batch.result.issues.length} errors
                  </p>
                  {batch.result.issues.length > 0 && (
                    <>
                      <Button variant="secondary" onClick={download}>
                        Download row errors
                      </Button>
                      <ul className="import-row-errors" aria-label="Row validation errors">
                        {batch.result.issues.map((i, n) => (
                          <li key={n}>
                            Row {i.row}, {i.field}: {i.message}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <div style={{ overflowX: 'auto' }}>
                    <table className="import-preview-table">
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Name</th>
                          <th>Location</th>
                          <th>Attributes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batch.result.records?.slice(0, 50).map((r) => (
                          <tr key={r.row}>
                            <td>{r.row}</td>
                            <td>{r.data.name}</td>
                            <td>
                              {[r.data.address, r.data.addressLine2, r.data.town, r.data.region, r.data.postCode]
                                .filter(Boolean)
                                .join(', ')}
                            </td>
                            <td>
                              {r.data.attributes
                                ? `From ${r.data.attributes.effectiveFrom}: population ${r.data.attributes.population ?? 'unknown'}, area ${r.data.attributes.floorArea ?? 'unknown'} m², hours ${r.data.attributes.weeklyHours ?? 'unknown'}/week`
                                : 'No history supplied'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(batch.result.records?.length ?? 0) > 50 && (
                    <p>Showing the first 50 rows. All validated rows will be imported.</p>
                  )}
                  <Button
                    disabled={m.disabled || !validated}
                    onClick={() =>
                      void m.run(async () => {
                        setBatch(await request(`${base}/${batch.id}/commit`, 'POST'));
                        setValidated(false);
                      }, 'Import complete.')
                    }
                  >
                    Create all sites
                  </Button>
                </>
              )}
            </>
          )}
        </section>
      )}
      <section className="panel stack-form">
        <h2>Recent imports</h2>
        {batches.length ? (
          batches.map((b) => (
            <Button
              variant="secondary"
              key={b.id}
              disabled={m.disabled}
              onClick={() =>
                void m.run(async () => {
                  select(await request(`${base}/${b.id}`, 'GET'));
                }, '')
              }
            >
              {b.id} · {b.status}
            </Button>
          ))
        ) : (
          <p>No imports yet.</p>
        )}
      </section>
    </div>
  );
}
