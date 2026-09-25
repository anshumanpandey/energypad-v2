'use client';
import { useState } from 'react';
import { Button } from './ui/button';
import type { CarbonSummary } from '@/domain/carbon';
export function CarbonReportDownload({ path, definition }: { path: string; definition: CarbonSummary['definition'] }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function download(format: 'csv' | 'json') {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const query = new URLSearchParams({
        year: String(definition.year),
        geography: definition.geography,
        basis: definition.basis,
        format,
      });
      const response = await fetch(`/api/v1/${path}/report?${query}`);
      if (!response.ok) {
        const problem = await response.json();
        throw new Error(problem.title ?? 'Unable to export report.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `carbon-report-${definition.year}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to export report.');
    } finally {
      setPending(false);
    }
  }
  return (
    <div style={{ marginTop: 16, marginBottom: 16 }}>
      <p>
        Exports recheck current permissions and coverage, which may differ from the displayed check. JSON preserves
        exact decimal strings and full run evidence; CSV includes coverage and monthly evidence rows.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => void download('csv')}>
          Download carbon CSV
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => void download('json')}>
          Download carbon JSON
        </Button>
      </div>
      {pending && <p role="status">Preparing report…</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
