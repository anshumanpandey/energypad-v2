'use client';
import { useState } from 'react';
import { request } from './forms';
import { Button } from './ui/button';
import type { SupportingOptions } from './opportunity-supporting';
type Log = SupportingOptions['logs'][number];
export function OperationalLogPicker({
  path,
  initial,
  disabled,
}: {
  path: string;
  initial: SupportingOptions;
  disabled: boolean;
}) {
  const [logs, setLogs] = useState(initial.logs);
  const [cursor, setCursor] = useState(initial.nextCursor ?? null);
  const [selected, setSelected] = useState<Log | null>(null);
  const [query, setQuery] = useState('');
  const [historical, setHistorical] = useState(false);
  const [applied, setApplied] = useState({ query: '', historical: false });
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function load(mode: 'search' | 'more' | 'id') {
    if (busy || disabled) return;
    setBusy(true);
    setError('');
    const filters = mode === 'more' ? applied : { query, historical };
    const params = new URLSearchParams(
      mode === 'id'
        ? { id: id.trim() }
        : {
            query: filters.query,
            historical: String(filters.historical),
            ...(mode === 'more' && cursor ? { cursor } : {}),
          },
    );
    try {
      const data: SupportingOptions = await request(`${path}?${params}`, 'GET');
      if (mode === 'id') setSelected(data.logs[0]);
      else {
        setLogs(
          mode === 'more' ? [...new Map([...logs, ...data.logs].map((log) => [log.id, log])).values()] : data.logs,
        );
        setCursor(data.nextCursor ?? null);
        setApplied(filters);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load logs.');
    } finally {
      setBusy(false);
    }
  }
  const choices = selected && !logs.some((log) => log.id === selected.id) ? [selected, ...logs] : logs;
  return (
    <div className="stack-form" role="group" aria-label="Find operational logs">
      <fieldset disabled={disabled || busy} className="stack-form">
        <label>
          Search log code or operation
          <input
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void load('search');
              }
            }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input
            style={{ width: 16, height: 16, minHeight: 0 }}
            type="checkbox"
            checked={historical}
            onChange={(e) => setHistorical(e.target.checked)}
          />{' '}
          Include historical revisions
        </label>
        <Button type="button" variant="secondary" onClick={() => void load('search')}>
          Search logs
        </Button>
        <p>
          {logs.length} loaded results · {applied.historical ? 'All revisions' : 'Current revisions'}
          {applied.query ? ` · Search: ${applied.query}` : ''}. Your selected revision remains available when searching
          or paging.
        </p>
        <Button type="button" variant="secondary" disabled={!cursor} onClick={() => void load('more')}>
          Load older logs
        </Button>
        <label>
          Exact operational log revision ID
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (id.trim()) void load('id');
              }
            }}
          />
        </label>
        <Button type="button" variant="secondary" disabled={!id.trim()} onClick={() => void load('id')}>
          Find log by ID
        </Button>
      </fieldset>
      <label>
        Operational log revision
        <select
          name="operationalEventId"
          required
          value={selected?.id ?? ''}
          onChange={(e) => setSelected(choices.find((log) => log.id === e.target.value) ?? null)}
        >
          <option value="">Select a log revision</option>
          {choices.map((log) => (
            <option key={log.id} value={log.id}>
              {log.eventCode} · {log.operation} · revision {log.revision}
              {log.superseded ? ' (superseded)' : ''}
            </option>
          ))}
        </select>
      </label>
      {busy && <p role="status">Loading logs…</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
