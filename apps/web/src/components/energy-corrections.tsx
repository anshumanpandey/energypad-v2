'use client';
import { useState } from 'react';
import { Button } from './ui/button';
import { request, useMutation } from './forms';
type Revision = {
  id: string;
  revision: number;
  supersedesId: string | null;
  correctionReason: string | null;
  authorId: string;
  createdAt: string;
};
export type ReadingRevision = Revision & {
  meterId: string;
  periodStart: string;
  periodEnd: string;
  sourceQuantity: string;
  sourceUnit: string;
  fuel: string;
  normalizedKwh: string;
  conversionFactor: string;
  conversionVersion: string;
  conversionId: string | null;
  netCost: string | null;
  vatPercent: string | null;
  vatCost: string | null;
  grossCost: string | null;
  currency: string | null;
  estimated: boolean;
  endUse: string;
  externalLegacyId: string;
  energyImportId: string | null;
  attributeSnapshot: Record<string, unknown>;
  qualityFlags: string[];
};
export type ConversionRevision = Revision & {
  meterId: string;
  sourceUnit: string;
  fuel: string;
  factor: string;
  validFrom: string;
  validUntil: string;
  source: string;
  replacement?: { id: string } | null;
};
function RevisionMeta({ value }: { value: Revision }) {
  return (
    <>
      <strong>Revision {value.revision}</strong>
      <p>{value.correctionReason ?? 'Original entry'}</p>
      <p className="field-hint" style={{ marginTop: 0, overflowWrap: 'anywhere' }}>
        Recorded {new Date(value.createdAt).toLocaleString()} · Author {value.authorId}
      </p>
    </>
  );
}
export function ReadingCorrections({
  base,
  record,
  manage,
  reload,
}: {
  base: string;
  record: ReadingRevision;
  manage: boolean;
  reload: () => Promise<void>;
}) {
  const m = useMutation();
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState<ReadingRevision[] | null>(null);
  return (
    <div className="stack-form">
      <span>Revision {record.revision}</span>
      {m.feedback}
      <Button
        variant="ghost"
        disabled={m.disabled}
        onClick={() =>
          void m.run(async () => {
            setHistory(await request(`${base}/records/${record.id}/history`, 'GET'));
          }, 'Reading history loaded.')
        }
      >
        View reading history
      </Button>
      {history && (
        <details open>
          <summary>Reading revision history</summary>
          {history.map((r) => (
            <article className="site-history-entry" key={r.id}>
              <RevisionMeta value={r} />
              <p>
                {r.sourceQuantity} {r.sourceUnit} → {r.normalizedKwh} kWh · {r.estimated ? 'Estimated' : 'Actual'}
              </p>
              <p>
                Net {r.netCost ?? 'Unknown'} · VAT {r.vatPercent ?? 'Unknown'}% / {r.vatCost ?? 'Unknown'} · Gross{' '}
                {r.grossCost ?? 'Unknown'} {r.currency}
              </p>
              <p>End use: {r.endUse || 'Not specified'}</p>
              <p>
                Conversion: {r.conversionFactor} kWh/{r.sourceUnit}
              </p>
              <details>
                <summary>Saved provenance</summary>
                <p style={{ overflowWrap: 'anywhere' }}>
                  Conversion version: {r.conversionVersion}
                  <br />
                  Origin import: {r.energyImportId ?? 'Manual entry'}
                  <br />
                  Legacy reference: {r.externalLegacyId || 'None'}
                </p>
                <p>
                  Population: {String(r.attributeSnapshot.population ?? 'Unknown')} · Weekly hours:{' '}
                  {String(r.attributeSnapshot.weeklyHours ?? 'Unknown')} · Floor area:{' '}
                  {String(r.attributeSnapshot.floorArea ?? 'Unknown')}
                </p>
                <p>{r.qualityFlags.join(' · ') || 'No input issues recorded'}</p>
              </details>
            </article>
          ))}
        </details>
      )}
      {manage && !editing && (
        <Button variant="secondary" disabled={m.disabled} onClick={() => setEditing(true)}>
          Correct reading
        </Button>
      )}
      {manage && editing && (
        <form
          className="stack-form"
          aria-label="Correct monthly reading"
          onSubmit={(e) => {
            e.preventDefault();
            const values = new FormData(e.currentTarget);
            void m.run(async () => {
              await request(`${base}/records/${record.id}/correct`, 'POST', {
                reason: values.get('reason'),
                useLatestConversion: values.get('useLatestConversion') === 'on',
                reading: {
                  meterId: record.meterId,
                  month: record.periodStart.slice(0, 7),
                  quantity: values.get('quantity'),
                  estimated: values.get('estimated') === 'on',
                  netCost: values.get('netCost') || null,
                  vatPercent: values.get('vatPercent') || null,
                  currency: values.get('currency') || null,
                  endUse: values.get('endUse'),
                  externalLegacyId: record.externalLegacyId,
                },
              });
              setEditing(false);
              await reload();
            }, 'Reading correction saved.');
          }}
        >
          <h3>
            Correct {record.periodStart.slice(0, 7)} · revision {record.revision}
          </h3>
          <p>
            The meter, month, original fuel/unit and site-attribute snapshot stay fixed. Save creates a new revision;
            previous values remain in history.
          </p>
          <fieldset className="stack-form" disabled={m.disabled}>
            <label>
              Corrected quantity ({record.sourceUnit})
              <input
                name="quantity"
                type="number"
                min="0"
                max="9999999999.999"
                step="0.001"
                defaultValue={record.sourceQuantity}
                required
              />
            </label>
            <label>
              Corrected net cost
              <input
                name="netCost"
                type="number"
                min="0"
                max="9999999999.999"
                step="0.001"
                defaultValue={record.netCost ?? ''}
              />
            </label>
            <label>
              Corrected currency
              <input name="currency" maxLength={3} defaultValue={record.currency ?? ''} />
            </label>
            <label>
              Corrected VAT (%)
              <input
                name="vatPercent"
                type="number"
                min="0"
                max="100"
                step="0.001"
                defaultValue={record.vatPercent ?? ''}
              />
            </label>
            <label>
              Corrected end use
              <input name="endUse" maxLength={100} defaultValue={record.endUse} />
            </label>
            <label className="checkbox-label">
              <input name="estimated" type="checkbox" defaultChecked={record.estimated} />
              Estimated reading
            </label>
            {!['kWh', 'MWh'].includes(record.sourceUnit) && (
              <label className="checkbox-label">
                <input name="useLatestConversion" type="checkbox" />
                Apply the current sourced conversion for this month
              </label>
            )}
            <p className="field-hint">
              The saved factor ({record.conversionFactor} kWh/{record.sourceUnit}) is retained unless you select the
              current conversion.
            </p>
            <label>
              Reading correction reason
              <textarea name="reason" minLength={3} maxLength={500} required />
            </label>
          </fieldset>
          <div className="button-row">
            <Button disabled={m.disabled}>Save reading correction</Button>
            <Button type="button" variant="secondary" disabled={m.disabled} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
export function ConversionCorrections({
  base,
  conversion,
  manage,
  reload,
}: {
  base: string;
  conversion: ConversionRevision;
  manage: boolean;
  reload: () => Promise<void>;
}) {
  const m = useMutation();
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState<ConversionRevision[] | null>(null);
  return (
    <div className="stack-form">
      <span>Revision {conversion.revision}</span>
      {m.feedback}
      <Button
        variant="ghost"
        disabled={m.disabled}
        onClick={() =>
          void m.run(async () => {
            setHistory(await request(`${base}/conversions/${conversion.id}/history`, 'GET'));
          }, 'Conversion history loaded.')
        }
      >
        View factor history
      </Button>
      {history && (
        <details open>
          <summary>Conversion revision history</summary>
          {history.map((c) => (
            <article className="site-history-entry" key={c.id}>
              <RevisionMeta value={c} />
              <p>
                {c.factor} kWh/{c.sourceUnit} · {c.fuel}
              </p>
              <p>
                {c.validFrom.slice(0, 7)} to {new Date(+new Date(c.validUntil) - 86400000).toISOString().slice(0, 7)}{' '}
                inclusive
              </p>
              <p>Source: {c.source}</p>
            </article>
          ))}
        </details>
      )}
      {manage && !editing && (
        <Button variant="secondary" disabled={m.disabled} onClick={() => setEditing(true)}>
          Correct conversion factor
        </Button>
      )}
      {manage && editing && (
        <form
          className="stack-form"
          aria-label="Correct conversion factor"
          onSubmit={(e) => {
            e.preventDefault();
            const values = new FormData(e.currentTarget);
            void m.run(async () => {
              await request(`${base}/conversions/${conversion.id}/correct`, 'POST', {
                reason: values.get('reason'),
                conversion: {
                  meterId: conversion.meterId,
                  firstMonth: values.get('firstMonth'),
                  lastMonth: values.get('lastMonth'),
                  factor: values.get('factor'),
                  source: values.get('source'),
                },
              });
              setEditing(false);
              await reload();
            }, 'Conversion correction saved.');
          }}
        >
          <p>
            This replaces the factor for new readings. Existing readings retain their saved factor. Correct each
            affected reading explicitly to apply the replacement.
          </p>
          <fieldset className="form-grid" disabled={m.disabled}>
            <label>
              Corrected kWh per {conversion.sourceUnit}
              <input
                name="factor"
                type="number"
                min="0.000001"
                max="100000"
                step="0.000001"
                defaultValue={conversion.factor}
                required
              />
            </label>
            <label>
              Corrected first month
              <input name="firstMonth" type="month" defaultValue={conversion.validFrom.slice(0, 7)} required />
            </label>
            <label>
              Corrected last month (inclusive)
              <input
                name="lastMonth"
                type="month"
                defaultValue={new Date(+new Date(conversion.validUntil) - 86400000).toISOString().slice(0, 7)}
                required
              />
            </label>
            <label>
              Corrected factor source
              <input name="source" minLength={3} maxLength={500} defaultValue={conversion.source} required />
            </label>
            <label>
              Conversion correction reason
              <textarea name="reason" minLength={3} maxLength={500} required />
            </label>
          </fieldset>
          <div className="button-row">
            <Button disabled={m.disabled}>Save conversion correction</Button>
            <Button type="button" variant="secondary" disabled={m.disabled} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
