'use client';
import { useState } from 'react';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
import { fuels } from '@/domain/tariffs';
import { factorBases } from '@/domain/emission-factors';
export type EmissionFactor = {
  id: string;
  fuel: string;
  geography: string;
  basis: string;
  unit: string;
  factor: string;
  source: string;
  validFrom: string;
  validUntil: string;
  revision: number;
  supersedesId: string | null;
  correctionReason: string | null;
  authorId: string;
  createdAt: string;
};
const lastDay = (v: string) => new Date(+new Date(v) - 86400000).toISOString().slice(0, 10);
export function EmissionFactorWorkspace({
  orgId,
  records,
  manage,
}: {
  orgId: string;
  records: EmissionFactor[];
  manage: boolean;
}) {
  const mutation = useMutation();
  const [editing, setEditing] = useState<EmissionFactor | null>(null);
  const [history, setHistory] = useState(false);
  const replaced = new Set(records.map((r) => r.supersedesId));
  return (
    <>
      {mutation.feedback}
      {manage && (
        <section className="panel">
          <h2>{editing ? 'Correct emission factor' : 'Add emission factor'}</h2>
          <form
            key={editing?.id ?? 'new'}
            className="stack-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const fields = Object.fromEntries(new FormData(form));
              const { reason, ...values } = fields;
              const factor = editing ? { ...values, fuel: editing.fuel, basis: editing.basis } : values;
              void mutation.run(async () => {
                await request(
                  `organisations/${orgId}/emission-factors${editing ? `/${editing.id}/correct` : ''}`,
                  'POST',
                  editing ? { factor, reason } : factor,
                );
                form.reset();
                setEditing(null);
              }, 'Emission factor saved.');
            }}
          >
            <div className="form-grid">
              <label>
                Fuel
                <select disabled={!!editing} name="fuel" defaultValue={editing?.fuel ?? 'ELECTRICITY'}>
                  {fuels.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
              <label>
                Geography code
                <input
                  name="geography"
                  required
                  maxLength={40}
                  placeholder="GB"
                  defaultValue={editing?.geography ?? ''}
                  readOnly={!!editing}
                />
              </label>
              <label>
                Reporting basis
                <select disabled={!!editing} name="basis" defaultValue={editing?.basis ?? 'LOCATION_BASED'}>
                  {factorBases.map((b) => (
                    <option key={b} value={b}>
                      {b.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Unit
                <input name="unit" value="kgCO2e/kWh" readOnly />
              </label>
              <label>
                Factor
                <input
                  name="factor"
                  required
                  inputMode="decimal"
                  pattern="[0-9]{1,9}(\.[0-9]{1,9})?"
                  defaultValue={editing?.factor ?? ''}
                />
              </label>
              <label>
                First day
                <input name="firstDay" type="date" required defaultValue={editing?.validFrom.slice(0, 10) ?? ''} />
              </label>
              <label>
                Last day (inclusive)
                <input name="lastDay" type="date" required defaultValue={editing ? lastDay(editing.validUntil) : ''} />
              </label>
            </div>
            <label>
              Source and methodology reference
              <textarea
                name="source"
                rows={3}
                style={{ border: '1px solid #d8dfda', borderRadius: 8, padding: 12, width: '100%' }}
                required
                minLength={3}
                maxLength={1000}
                defaultValue={editing?.source ?? ''}
                placeholder="Publisher, publication year, table or URL, and emissions boundary"
              />
            </label>
            {editing && (
              <label>
                Correction reason
                <input name="reason" required minLength={3} maxLength={500} />
              </label>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button type="submit" disabled={mutation.disabled}>
                {mutation.pending ? 'Saving…' : 'Save factor'}
              </Button>
              {editing && (
                <Button type="button" variant="secondary" disabled={mutation.disabled} onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </section>
      )}
      <section className="panel">
        <h2>Emission factors</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            style={{ width: 16, height: 16, minHeight: 0, margin: 0 }}
            type="checkbox"
            checked={history}
            onChange={(e) => setHistory(e.target.checked)}
          />{' '}
          Include superseded versions
        </label>
        {!records.length ? (
          <p>No emission factors yet. Add a published factor with its source and effective dates.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="import-preview-table">
              <thead>
                <tr>
                  <th>Fuel / geography</th>
                  <th>Factor</th>
                  <th>Effective dates</th>
                  <th>Source / version</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records
                  .filter((r) => history || !replaced.has(r.id))
                  .map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>
                          {r.fuel} · {r.geography}
                        </strong>
                        <br />
                        {r.basis.replaceAll('_', ' ')}
                      </td>
                      <td>
                        {r.factor} {r.unit}
                      </td>
                      <td>
                        {r.validFrom.slice(0, 10)} to {lastDay(r.validUntil)}
                      </td>
                      <td>
                        {r.source}
                        <br />
                        <strong>
                          Revision {r.revision} · {replaced.has(r.id) ? 'Superseded' : 'Current'}
                        </strong>
                        {r.correctionReason && <p>{r.correctionReason}</p>}
                        <details>
                          <summary>Provenance</summary>
                          <p>
                            Version: {r.id}
                            <br />
                            Author: {r.authorId}
                            <br />
                            Recorded: {r.createdAt}
                          </p>
                        </details>
                      </td>
                      <td>
                        {manage && !replaced.has(r.id) && (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={mutation.disabled}
                            onClick={() => setEditing(r)}
                          >
                            Correct
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
