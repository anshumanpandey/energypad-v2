'use client';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button } from './ui/button';
import { MetricChart } from './metric-chart';
import type { ReportingResult } from '@/domain/analysis/reporting';
import { GraphMonthProvider, GraphMonthSelect } from './graph-month';

const subscribe = () => () => {};
export function WasteSavingsViews({ rows, children }: { rows: ReportingResult['rows']; children: ReactNode }) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [view, setView] = useState('graph');
  const [month, setMonth] = useState('');
  const visible = rows.filter((row) => !month || row.month.endsWith(`-${month}`));
  const points = (key: 'actualKwh' | 'expectedKwh' | 'adjustedExpectedKwh' | 'postNraVarianceKwh') =>
    visible.map((row) => ({
      month: row.month,
      value: row.status === 'CALCULATED' ? row[key] : null,
      note: row.status === 'BLOCKED' ? row.issues.map((issue) => issue.message).join('; ') : row.direction,
    }));
  return (
    <GraphMonthProvider>
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
        {view === 'graph' && <GraphMonthSelect />}
      </div>
      <div hidden={view !== 'graph'} style={view !== 'graph' ? { display: 'none' } : undefined} className="graphs-grid">
        <MetricChart
          title="Actual consumption"
          unit="kWh"
          points={points('actualKwh')}
          tone="energy"
          description="Saved actual monthly consumption."
        />
        <MetricChart
          title="Expected consumption"
          unit="kWh"
          points={points('expectedKwh')}
          tone="energy"
          description="Consumption predicted by the baseline model."
        />
        <MetricChart
          title="Adjusted expected consumption"
          unit="kWh"
          points={points('adjustedExpectedKwh')}
          tone="energy"
          description="Expected consumption after the saved non-routine adjustment."
        />
        <MetricChart
          title="Monthly waste & savings"
          unit="kWh"
          points={points('postNraVarianceKwh')}
          tone="waste"
          description="Positive values show savings; negative values show waste. Missing results remain unavailable."
        />
      </div>
      <div className="waste-savings-view" hidden={view !== 'table'}>
        {month && (
          <style>{`.waste-savings-view tr[data-month]:not([data-month$="-${month}"]) { display: none; }`}</style>
        )}
        {children}
      </div>
    </GraphMonthProvider>
  );
}
