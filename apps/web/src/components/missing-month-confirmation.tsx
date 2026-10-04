'use client';
import type { MissingImportMonth } from '@/domain/import-missing-months';

export function MissingMonthConfirmation({
  missing,
  confirmed,
  disabled,
  onChange,
}: {
  missing: MissingImportMonth[];
  confirmed: boolean;
  disabled: boolean;
  onChange: (confirmed: boolean) => void;
}) {
  if (!missing.length) return null;
  return (
    <section className="notice stack-form" aria-label="Missing month warnings">
      <p role="status">
        <strong>{missing.length} missing month(s) in this workbook.</strong> Missing values stay absent unless you
        confirm zero filling. Existing saved values are retained.
      </p>
      <details>
        <summary>Review missing months</summary>
        <ul>
          {missing.map((item, i) => (
            <li key={i}>
              {item.site} · {item.month} · {item.scope}
            </li>
          ))}
        </ul>
      </details>
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />{' '}
        I confirm: fill missing months with 0
      </label>
      <p>
        After changing this choice, validate again to review the records before importing. Confirmed zeroes are marked
        as missing-data replacements.
      </p>
    </section>
  );
}
