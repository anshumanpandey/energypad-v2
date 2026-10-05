'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

const GraphMonthContext = createContext<{ month: string; setMonth: (month: string) => void } | null>(null);

export function GraphMonthProvider({ children, initialMonth = '01' }: { children: ReactNode; initialMonth?: string }) {
  const [month, setMonth] = useState(initialMonth);
  return <GraphMonthContext.Provider value={{ month, setMonth }}>{children}</GraphMonthContext.Provider>;
}

export function useGraphMonth() {
  return useContext(GraphMonthContext)?.month ?? '01';
}

export function GraphMonthSelect() {
  const { month, setMonth } = useContext(GraphMonthContext)!;
  return (
    <label>
      Month
      <select aria-label="Month" value={month} onChange={(event) => setMonth(event.target.value)}>
        {[
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ].map((name, index) => (
          <option key={name} value={String(index + 1).padStart(2, '0')}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
