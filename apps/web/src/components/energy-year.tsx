'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';

const EnergyYearContext = createContext<{ year: number; setYear: (year: number) => void } | null>(null);

export function EnergyYearProvider({ children }: { children: ReactNode }) {
  const [year, setYear] = useState(new Date().getUTCFullYear());
  return <EnergyYearContext.Provider value={{ year, setYear }}>{children}</EnergyYearContext.Provider>;
}

export function useEnergyYear() {
  return useContext(EnergyYearContext);
}
