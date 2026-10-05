'use client';
import { EnergyYearProvider, useEnergyYear } from './energy-year';
import { AnalysisWorkspace } from './analysis-workspace';
import type { ComponentProps } from 'react';

function YearSelection() {
  const selection = useEnergyYear()!;
  return (
    <label>
      Reporting year
      <input
        aria-label="Waste reporting year"
        type="number"
        min={1901}
        max={2199}
        value={selection.year}
        onChange={(event) => {
          const year = Number(event.target.value);
          if (Number.isInteger(year) && year >= 1901 && year <= 2199) selection.setYear(year);
        }}
      />
    </label>
  );
}
export function WasteCalculationBuilder(props: ComponentProps<typeof AnalysisWorkspace>) {
  return (
    <EnergyYearProvider>
      <details className="panel stack-form">
        <summary>Create a site calculation</summary>
        <YearSelection />
        <AnalysisWorkspace {...props} wizard />
      </details>
    </EnergyYearProvider>
  );
}
