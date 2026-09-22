import React from 'react';
export type MigrationEvidenceData = {
  source: string;
  reference: string;
  original: Record<string, string | number | null>;
  decision: { reason: string };
  reconciliation: Record<string, string | number | null>;
};
export function MigrationEvidence({ data }: { data?: MigrationEvidenceData | null }) {
  if (!data) return null;
  const fields = {
    date: 'Original reading date',
    created_at: 'Source created',
    updated_at: 'Source updated',
    consumption: 'Source quantity',
    fuelUnit: 'Source unit',
    conversionFactor: 'Supplied conversion factor',
    totalCost: 'Supplied total cost',
    vat: 'Supplied VAT rate',
    vatCost: 'Supplied VAT amount',
    population: 'Supplied population',
    workingHours: 'Supplied working hours',
  };
  return (
    <details>
      <summary>Original migration evidence</summary>
      <p>
        {data.source} · {data.reference}
      </p>
      <dl>
        {Object.entries(fields).map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{String(data.original[key] ?? 'Unknown')}</dd>
          </div>
        ))}
      </dl>
      <p>
        Calculated VAT at migration: {String(data.reconciliation.calculatedVatCost ?? 'Unknown')} · Difference from
        supplied VAT: {String(data.reconciliation.vatDifference ?? 'Not comparable')}
      </p>
      <p>
        Calculated total on reviewed basis: {String(data.reconciliation.calculatedTotalCost ?? 'Unknown')} · Difference
        from source total: {String(data.reconciliation.costDifference ?? 'Not comparable')}
      </p>
      <p>Review decision: {data.decision.reason}</p>
      <p>
        This evidence describes the original import. Subsequent reading corrections retain it separately from current
        calculated amounts.
      </p>
    </details>
  );
}
