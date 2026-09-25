'use client';
import { useEffect, useRef, useState } from 'react';
import { request } from './forms';
import { Button } from './ui/button';
import type { VerificationOption, VerificationOptions } from '@/domain/opportunity-verification';

export function VerificationRunPicker({
  path,
  implementationDate,
  runId,
  onSelect,
}: {
  path: string;
  implementationDate: string;
  runId?: string;
  onSelect?: (id: string) => void;
}) {
  const params = new URLSearchParams({ implementationDate, ...(runId ? { runId } : {}) });
  const url = `${path}?${params}`;
  return <RunPicker key={url} url={url} carbon={!!runId} onSelect={onSelect} />;
}
function RunPicker({ url, carbon, onSelect }: { url: string; carbon: boolean; onSelect?: (id: string) => void }) {
  const [options, setOptions] = useState<VerificationOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<VerificationOption | null>(null);
  const generation = useRef({ value: 0 });
  useEffect(() => {
    const tracker = generation.current;
    const current = ++tracker.value;
    void request(url, 'GET')
      .then((data: VerificationOptions) => {
        if (tracker.value === current) setOptions(data);
      })
      .catch((error) => {
        if (tracker.value === current) setError(error.message);
      })
      .finally(() => {
        if (tracker.value === current) setLoading(false);
      });
    return () => {
      tracker.value++;
    };
  }, [url]);
  async function load(cursor?: string) {
    const current = ++generation.current.value;
    setLoading(true);
    setError('');
    try {
      const next: VerificationOptions = await request(`${url}${cursor ? `&cursor=${cursor}` : ''}`, 'GET');
      if (generation.current.value !== current) return;
      setOptions((previous) => ({
        ...next,
        items: cursor
          ? [...new Map([...(previous?.items ?? []), ...next.items].map((item) => [item.id, item])).values()]
          : next.items,
      }));
    } catch (error) {
      if (generation.current.value === current)
        setError(error instanceof Error ? error.message : 'Unable to load saved runs.');
    } finally {
      if (generation.current.value === current) setLoading(false);
    }
  }
  // Eligibility is determined by immutable evidence and this picker's date/run
  // scope. Preserve a selected older run when refreshing the first page.
  const choices =
    selected && !options?.items.some((item) => item.id === selected.id)
      ? [selected, ...(options?.items ?? [])]
      : (options?.items ?? []);

  return (
    <div className="stack-form">
      {options && !carbon && (
        <p>
          Meter: {options.meter} · Exact baseline: {options.baselineId}
        </p>
      )}
      <label>
        {carbon ? 'Verification carbon run (optional)' : 'Verification reporting run'}
        <select
          name={carbon ? 'carbonRunId' : 'runId'}
          required={!carbon}
          value={selected?.id ?? ''}
          disabled={!options}
          onChange={(event) => {
            setSelected(choices.find((item) => item.id === event.target.value) ?? null);
            onSelect?.(event.target.value);
          }}
        >
          <option value="">{carbon ? 'No carbon evidence' : 'Choose a saved reporting run'}</option>
          {choices.map((option) => (
            <option key={option.id} value={option.id} disabled={!option.eligible}>
              {option.label}
              {option.reason ? ` · ${option.reason}` : ''}
            </option>
          ))}
        </select>
      </label>
      {loading && <p role="status">Loading saved {carbon ? 'carbon' : 'reporting'} runs…</p>}
      {!loading && options && !options.items.some((item) => item.eligible) && (
        <p>
          {carbon
            ? 'No compatible carbon run in the loaded results. Carbon evidence is optional; save a carbon run using the reporting readings and applicable factors, or check older runs.'
            : 'No eligible reporting run in the loaded results. Save a run for this exact baseline after the investigation and implementation date, or check older runs.'}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <Button type="button" disabled={loading} onClick={() => void load()}>
        {error && !options ? 'Retry' : 'Refresh'} {carbon ? 'carbon' : 'reporting'} runs
      </Button>
      {options?.nextCursor && (
        <Button type="button" disabled={loading} onClick={() => void load(options.nextCursor!)}>
          Load older {carbon ? 'carbon' : 'reporting'} runs
        </Button>
      )}
    </div>
  );
}
