'use client';
import { applyEnergyTemplate, saveEnergyTemplate, parseTemplateText } from '@/domain/workbook-template';
import { downloadMapping } from './workbook-template';
import { useState } from 'react';
import { energyImportFields, type EnergyMapping } from '@/domain/energy-import';
import type { ImportSheet, RowIssue } from '@/domain/sites';
import { request, useMutation } from './forms';
import { Button } from './ui/button';
type Meter = { id: string; name: string; unit: string; archivedAt: string | null };
type Batch = {
  id: string;
  meterId: string;
  status: string;
  sheets: ImportSheet[];
  mapping?: EnergyMapping;
  result?: {
    count?: number;
    issues?: RowIssue[];
    records?: {
      row: number;
      data: { month: string; quantity: string };
      prepared: {
        normalizedKwh: string;
        sourceUnit: string;
        netCost: string | null;
        grossCost: string | null;
        currency: string | null;
        qualityFlags: string[];
        endUse: string;
        energyUseSnapshot?: { code?: string; name?: string } | null;
      };
    }[];
  };
};
const labels: Record<(typeof energyImportFields)[number], string> = {
  month: 'Month (YYYY-MM)',
  quantity: 'Quantity',
  unit: 'Source unit',
  estimated: 'Reading status (actual / estimated)',
  netCost: 'Net cost',
  vatPercent: 'VAT (%)',
  currency: 'Currency',
  endUse: 'Original end-use label',
  energyUseCode: 'Registered site end-use code',
  externalLegacyId: 'Legacy reference',
};
export function EnergyImportWorkspace({
  base,
  meters,
  onCommitted,
}: {
  base: string;
  meters: Meter[];
  onCommitted: () => Promise<void>;
}) {
  const m = useMutation();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [mapping, setMapping] = useState<EnergyMapping>({ sheet: 0, columns: {}, defaults: {}, confirmed: true });
  const [confirmed, setConfirmed] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [recent, setRecent] = useState<{ id: string; meterId: string; status: string; createdAt: string }[]>([]);
  function open(result: Batch) {
    setBatch(result);
    setMapping(result.mapping ?? { sheet: 0, columns: {}, defaults: {}, confirmed: true });
    setConfirmed(false);
    setFresh(false);
  }
  const sheet = batch?.sheets[mapping.sheet];
  function update(next: EnergyMapping) {
    setMapping(next);
    setFresh(false);
  }
  function downloadErrors() {
    const rows = [
      ['row', 'field', 'message'],
      ...(batch?.result?.issues ?? []).map((i) => [String(i.row), i.field, i.message]),
    ];
    const csv = rows.map((row) => row.map((v) => `"${v.replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'consumption-errors.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="panel stack-form">
      <h2>Import consumption workbook</h2>
      <p>
        Import 1–120 monthly rows for one meter from XLSX (maximum 2 MB). Use month text such as 2020-01, and net costs.
        Formatted cells and saved formula results are supported; recalculate and save before uploading. Credential
        columns are discarded before staging.
      </p>
      {m.feedback}
      <fieldset disabled={m.disabled} className="stack-form" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const file = form.get('workbook') as File;
            void m.run(async () => {
              const response = await fetch(`${base}?meterId=${encodeURIComponent(String(form.get('meterId')))}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
                body: file,
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.title ?? 'Upload failed.');
              open(result);
            }, 'Workbook staged. Map its columns to continue.');
          }}
        >
          <div className="form-grid">
            <label>
              Import meter
              <select aria-label="Import meter" name="meterId" required>
                {meters
                  .filter((meter) => !meter.archivedAt)
                  .map((meter) => (
                    <option key={meter.id} value={meter.id}>
                      {meter.name} ({meter.unit})
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Consumption workbook
              <input name="workbook" type="file" accept=".xlsx" required />
            </label>
          </div>
          <Button disabled={m.disabled || !meters.some((meter) => !meter.archivedAt)}>
            Upload consumption workbook
          </Button>
        </form>
        <div className="button-row">
          <Button
            variant="secondary"
            disabled={m.disabled}
            onClick={() =>
              void m.run(
                async () => setRecent(await request(base.replace('/api/v1/', ''), 'GET')),
                'Recent imports loaded.',
              )
            }
          >
            Load recent consumption imports
          </Button>
        </div>
        {recent.map((item) => (
          <div className="button-row" key={item.id}>
            <span>
              {meters.find((meter) => meter.id === item.meterId)?.name} · {item.status} · {item.createdAt.slice(0, 10)}
            </span>
            <Button
              variant="ghost"
              disabled={m.disabled}
              onClick={() =>
                void m.run(async () => open(await request(`${base.replace('/api/v1/', '')}/${item.id}`, 'GET')))
              }
            >
              Open import
            </Button>
          </div>
        ))}
        {batch?.status === 'COMMITTED' ? (
          <p role="status">Consumption import complete: {batch.result?.count} readings created.</p>
        ) : (
          batch &&
          sheet && (
            <>
              <h3>Map consumption columns</h3>
              <p>
                Target meter: {meters.find((meter) => meter.id === batch.meterId)?.name}. Map a column or supply a
                default. Column values take precedence; blanks remain blank.
              </p>
              <label>
                Consumption sheet
                <select
                  aria-label="Consumption sheet"
                  value={mapping.sheet}
                  onChange={(e) => {
                    update({ sheet: Number(e.target.value), columns: {}, defaults: {}, confirmed: true });
                    setConfirmed(false);
                  }}
                >
                  {batch.sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name} ({s.rows.length} rows)
                    </option>
                  ))}
                </select>
              </label>
              <div className="button-row">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    void m.run(async () => {
                      downloadMapping(saveEnergyTemplate(batch.sheets, mapping), 'consumption-mapping-v1.json');
                    }, 'Mapping template saved. Reuse it with the same worksheet and column names.')
                  }
                >
                  Save mapping template v1
                </Button>
                <label>
                  Load saved mapping template
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      setFresh(false);
                      setConfirmed(false);
                      void m.run(async () => {
                        if (file.size > 16_384) throw new Error('Use a mapping template smaller than 16 KB.');
                        update(applyEnergyTemplate(batch.sheets, parseTemplateText(await file.text())));
                      }, 'Template loaded. Review the mapping and confirm this meter before validating.');
                    }}
                  />
                </label>
              </div>
              <p>
                Templates match worksheet and header names, even if columns move. They do not select a meter or approve
                an import. Only the selected sheet is imported.
              </p>
              <div className="form-grid">
                {energyImportFields.map((field) => (
                  <fieldset className="import-mapping-field" key={field}>
                    <legend>{labels[field]}</legend>
                    <label>
                      Column
                      <select
                        aria-label={`${labels[field]} column`}
                        value={mapping.columns[field] ?? ''}
                        onChange={(e) => {
                          const columns = { ...mapping.columns };
                          if (e.target.value === '') delete columns[field];
                          else columns[field] = Number(e.target.value);
                          update({ ...mapping, columns });
                        }}
                      >
                        <option value="">Use default / leave blank</option>
                        {sheet.headers.map((header, index) => (
                          <option key={index} value={index}>
                            {header || `Column ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Default
                      <input
                        aria-label={`${labels[field]} default`}
                        value={mapping.defaults[field] ?? ''}
                        maxLength={500}
                        onChange={(e) =>
                          update({ ...mapping, defaults: { ...mapping.defaults, [field]: e.target.value } })
                        }
                      />
                    </label>
                  </fieldset>
                ))}
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => {
                    setConfirmed(e.target.checked);
                    setFresh(false);
                  }}
                />
                I confirm these rows belong to this meter, use its source unit, and any costs exclude VAT.
              </label>
              <Button
                disabled={m.disabled || !confirmed}
                onClick={() =>
                  void m.run(async () => {
                    const result = await request(
                      `${base.replace('/api/v1/', '')}/${batch.id}/preview`,
                      'POST',
                      mapping,
                    );
                    setBatch(result);
                    setFresh(true);
                  }, 'Validation complete.')
                }
              >
                Validate consumption import
              </Button>
              {fresh && batch.result && (
                <>
                  <h3>Consumption preview</h3>
                  <p>
                    {batch.result.records?.length ?? 0} rows previewed · {batch.result.issues?.length ?? 0} errors.
                    Showing the first 50 rows.
                  </p>
                  {!!batch.result.issues?.length && (
                    <>
                      <Button variant="secondary" type="button" onClick={downloadErrors}>
                        Download consumption errors
                      </Button>
                      <ul>
                        {batch.result.issues.slice(0, 20).map((issue, index) => (
                          <li key={index}>
                            Row {issue.row} · {issue.field}: {issue.message}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <div style={{ overflowX: 'auto' }}>
                    <table className="import-preview-table">
                      <thead>
                        <tr>
                          <th>Row / month</th>
                          <th>Quantity</th>
                          <th>kWh</th>
                          <th>Net / gross</th>
                          <th>End-use association</th>
                          <th>Quality</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batch.result.records?.slice(0, 50).map((row) => (
                          <tr key={row.row}>
                            <td>
                              {row.row} · {row.data.month}
                            </td>
                            <td>
                              {row.data.quantity} {row.prepared.sourceUnit}
                            </td>
                            <td>{row.prepared.normalizedKwh}</td>
                            <td>
                              {row.prepared.netCost ?? 'Unknown'} / {row.prepared.grossCost ?? 'Unknown'}{' '}
                              {row.prepared.currency}
                            </td>
                            <td>
                              {row.prepared.energyUseSnapshot?.code
                                ? `${row.prepared.energyUseSnapshot.code} · ${row.prepared.energyUseSnapshot.name}`
                                : 'Unlinked'}
                              <br />
                              Original label: {row.prepared.endUse || 'None'}
                            </td>
                            <td>{row.prepared.qualityFlags.join(' · ') || 'No input issues detected'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button
                    disabled={m.disabled || !confirmed || batch.status !== 'READY'}
                    onClick={() =>
                      void m.run(async () => {
                        setBatch(await request(`${base.replace('/api/v1/', '')}/${batch.id}/commit`, 'POST'));
                        await onCommitted();
                      }, 'Consumption import saved.')
                    }
                  >
                    Commit consumption import
                  </Button>
                </>
              )}
            </>
          )
        )}
      </fieldset>
    </section>
  );
}
