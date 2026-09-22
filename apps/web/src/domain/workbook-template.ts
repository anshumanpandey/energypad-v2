import { z } from 'zod';
import { DomainError } from './policy';
import type { ImportSheet } from './sites';
import { energyImportFields, energyMappingInput, type EnergyMapping } from './energy-import';

export const workbookFields = {
  consumption: energyImportFields,
  drivers: ['month', 'driver', 'value', 'source'],
  patterns: [
    'firstDay',
    'lastDay',
    'energyUseCode',
    'daysOnYear',
    'temperature',
    'temperatureUnit',
    'temperatureContext',
    'source',
    'legacySource',
    'legacyId',
  ],
} as const;
export type WorkbookKind = keyof typeof workbookFields;
export const workbookTemplate = z
  .object({
    version: z.literal(1),
    kind: z.enum(['consumption', 'drivers', 'patterns']),
    sheetName: z.string().trim().min(1).max(31),
    columns: z.record(z.string().max(100), z.string().trim().min(1).max(100)),
    defaults: z.record(z.string().max(100), z.string().max(500)),
  })
  .strict()
  .superRefine((t, ctx) => {
    const fields: readonly string[] = workbookFields[t.kind];
    for (const field of [...Object.keys(t.columns), ...Object.keys(t.defaults)])
      if (!fields.includes(field)) ctx.addIssue({ code: 'custom', message: `Unsupported ${t.kind} field: ${field}` });
  });
export type WorkbookTemplate = z.output<typeof workbookTemplate>;
export function selectWorkbookSheet(sheets: ImportSheet[], name?: string): ImportSheet {
  if (!name) {
    if (sheets.length !== 1)
      throw new DomainError('SHEET_REQUIRED', 'Enter the exact worksheet name for a workbook with multiple sheets.');
    return sheets[0];
  }
  const matches = sheets.filter((s) => s.name === name);
  if (matches.length !== 1)
    throw new DomainError('SHEET_NAME', 'The template or selected worksheet name must match exactly one sheet.');
  return matches[0];
}
export function templateMapping(sheets: ImportSheet[], input: unknown, kind: WorkbookKind) {
  const template = workbookTemplate.parse(input);
  if (template.kind !== kind) throw new DomainError('TEMPLATE_KIND', `Use a ${kind} template.`);
  const sheet = selectWorkbookSheet(sheets, template.sheetName);
  const columns: Record<string, number> = {};
  for (const [field, header] of Object.entries(template.columns)) {
    const matches = sheet.headers.flatMap((value, index) => (value.trim() === header ? [index] : []));
    if (matches.length !== 1)
      throw new DomainError(
        'TEMPLATE_HEADER',
        `Mapped header "${header}" must occur exactly once in the selected sheet.`,
      );
    columns[field] = matches[0];
  }
  return { template, sheet, columns };
}
export function applyEnergyTemplate(sheets: ImportSheet[], input: unknown): EnergyMapping {
  const { template, sheet, columns } = templateMapping(sheets, input, 'consumption');
  return energyMappingInput.parse({
    sheet: sheets.indexOf(sheet),
    columns,
    defaults: template.defaults,
    confirmed: true,
  });
}
export function saveEnergyTemplate(sheets: ImportSheet[], mapping: EnergyMapping): WorkbookTemplate {
  const sheet = sheets[mapping.sheet];
  if (!sheet) throw new DomainError('SHEET_NAME', 'Select a worksheet first.');
  const template = workbookTemplate.parse({
    version: 1,
    kind: 'consumption',
    sheetName: sheet.name,
    columns: Object.fromEntries(
      Object.entries(mapping.columns).map(([field, index]) => [field, sheet.headers[index!]]),
    ),
    defaults: mapping.defaults,
  });
  templateMapping(sheets, template, 'consumption');
  return template;
}
export function mapNamedWorkbook(sheets: ImportSheet[], kind: 'drivers' | 'patterns', name?: string, input?: unknown) {
  if (input === undefined) {
    const sheet = selectWorkbookSheet(sheets, name);
    return {
      sheets: [sheet],
      selection: {
        version: 1,
        kind,
        sheetName: sheet.name,
        columns: Object.fromEntries(
          workbookFields[kind].flatMap((field) => {
            const header = sheet.headers.find((h) => h.toLowerCase() === field.toLowerCase());
            return header ? [[field, header]] : [];
          }),
        ),
        defaults: {},
        excludedSheets: sheets.filter((s) => s !== sheet).map((s) => s.name),
      },
    };
  }
  const { template, sheet, columns } = templateMapping(sheets, input, kind);
  if (name && name !== template.sheetName)
    throw new DomainError('SHEET_NAME', 'The worksheet name and template selection disagree.');
  const headers = [...workbookFields[kind]];
  const mapped = {
    name: sheet.name,
    headers,
    rows: sheet.rows.map((row) => ({
      row: row.row,
      cells: headers.map((field) =>
        columns[field] === undefined ? (template.defaults[field] ?? '') : (row.cells[columns[field]] ?? ''),
      ),
    })),
  };
  return {
    sheets: [mapped],
    selection: { ...template, excludedSheets: sheets.filter((s) => s !== sheet).map((s) => s.name) },
  };
}
export function parseTemplateText(text: string): WorkbookTemplate {
  if (text.length > 16_384) throw new DomainError('TEMPLATE_SIZE', 'Use a mapping template smaller than 16 KB.');
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    throw new DomainError('TEMPLATE_JSON', 'Use a valid JSON mapping template.');
  }
  return workbookTemplate.parse(input);
}
