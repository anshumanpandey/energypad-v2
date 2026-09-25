import { z } from 'zod';
import { uuid } from './policy';
import { factorBases } from './emission-factors';
export const carbonInput = z
  .object({
    meterId: uuid,
    year: z.number().int().min(1900).max(2199),
    geography: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,40}$/),
    basis: z.enum(factorBases),
    requestKey: uuid,
  })
  .strict();
export type CarbonSnapshot = {
  definition: z.infer<typeof carbonInput>;
  meter: { id: string; name: string; fuel: string };
  status: 'COMPLETE' | 'BLOCKED';
  totalKgCO2e: string | null;
  rows: {
    month: string;
    issue: string | null;
    readingId?: string;
    readingRevision?: number;
    normalizedKwh?: string;
    conversionVersion?: string;
    estimated?: boolean;
    factorId?: string;
    factorRevision?: number;
    factor?: string;
    source?: string;
    kgCO2e?: string;
  }[];
};

export const carbonSummaryInput = carbonInput.omit({ meterId: true, requestKey: true });
export type CarbonSummary = {
  fingerprint?: string;
  definition: z.infer<typeof carbonSummaryInput>;
  checkedAt: string;
  status: 'COMPLETE' | 'INCOMPLETE' | 'EMPTY';
  totalKgCO2e: string | null;
  meters: {
    meterId: string;
    name: string;
    fuel: string;
    status: 'READY' | 'MISSING' | 'BLOCKED' | 'OUTDATED';
    runId: string | null;
    calculatedAt: string | null;
    kgCO2e: string | null;
    estimatedMonths: number;
    issue: string | null;
  }[];
};

export type PortfolioCarbonSummary = {
  fingerprint?: string;
  portfolio: { id: string; name: string };
  definition: z.infer<typeof carbonSummaryInput>;
  checkedAt: string;
  scope: 'PORTFOLIO_ACTIVE_SITES' | 'ASSIGNED_ACTIVE_SITES';
  status: 'COMPLETE' | 'INCOMPLETE' | 'EMPTY';
  totalKgCO2e: string | null;
  sites: { id: string; name: string; code: string; summary: CarbonSummary }[];
};
