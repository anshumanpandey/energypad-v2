'use client';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button } from './ui/button';
import { WasteCharts } from './waste-charts';
import type { ReportingResult } from '@/domain/analysis/reporting';

const subscribe = () => () => {};
export function WasteSavingsViews({
  rows,
  children,
  costs = [],
}: {
  rows: ReportingResult['rows'];
  children: ReactNode;
  costs?: { month: string; cost: number | null }[];
}) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [view, setView] = useState('graph');
  const [month, setMonth] = useState('');
  return (
    <>
      <div className="panel stack-form">
        <div role="group" aria-label="Waste & Savings view">
          <Button disabled={!hydrated} aria-pressed={view === 'graph'} onClick={() => setView('graph')}>
            Graph view
          </Button>
          <Button disabled={!hydrated} aria-pressed={view === 'table'} onClick={() => setView('table')}>
            Table view
          </Button>
        </div>
        <label>
          Result month
          <select aria-label="Waste result month" value={month} onChange={(event) => setMonth(event.target.value)}>
            <option value="">All months</option>
            {[...new Set(rows.map((row) => row.month.slice(5)))].map((value) => (
              <option key={value} value={value}>
                {new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(
                  new Date(Date.UTC(2000, Number(value) - 1, 1)),
                )}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div hidden={view !== 'graph'} style={view !== 'graph' ? { display: 'none' } : undefined}>
        <WasteCharts
          month={month}
          rows={rows.map((row) => ({
            month: row.month,
            actual: row.status === 'CALCULATED' ? row.actualKwh : null,
            adjusted: row.status === 'CALCULATED' ? row.adjustedExpectedKwh : null,
            variance: row.status === 'CALCULATED' ? row.postNraVarianceKwh : null,
            cost: costs.find((cost) => cost.month === row.month)?.cost ?? null,
          }))}
        />
      </div>
      <div className="waste-savings-view" hidden={view !== 'table'}>
        {month && (
          <style>{`.waste-savings-view tr[data-month]:not([data-month$="-${month}"]) { display: none; }`}</style>
        )}
        {children}
      </div>
    </>
  );
}
