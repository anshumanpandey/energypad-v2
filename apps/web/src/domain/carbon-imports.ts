import { z } from 'zod';
import type { WorkbookTemplate } from './workbook-template';
export const carbonImportKind = z.enum(['emissions', 'targets', 'monthlyTargets', 'monitoring']);
export type CarbonImportKind = z.infer<typeof carbonImportKind>;
export type CarbonImportPreview = {
  selection: WorkbookTemplate & { excludedSheets: string[] };
  records: { row: number; data: Record<string, string | number>; supersedesId?: string; reason?: string }[];
  issues: { row: number; message: string }[];
};
