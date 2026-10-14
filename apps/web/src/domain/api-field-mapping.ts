import { z } from 'zod';
import { apiImportExample, datasetPayload, type ApiDataset } from './api-import';

const path = z
  .string()
  .trim()
  .max(200)
  .refine(
    (value) =>
      !value ||
      value.split('.').every((part) => part.length > 0 && !['__proto__', 'prototype', 'constructor'].includes(part)),
    'Use dot-separated field names without reserved keys.',
  );
export const apiFieldMapping = z
  .object({
    enabled: z.boolean(),
    recordsPath: path,
    fields: z.record(z.string().max(60), path),
  })
  .strict();
export type ApiFieldMapping = z.infer<typeof apiFieldMapping>;
export function defaultFieldMapping(dataset: ApiDataset): ApiFieldMapping {
  return { enabled: false, recordsPath: dataset, fields: {} };
}
export const mappingFields = (dataset: ApiDataset) => Object.keys(apiImportExample[dataset][0]);
const nullableFields = ['totalCost', 'vatCost', 'population', 'operatingHours'];
export const mappingFieldNullable = (dataset: ApiDataset, field: string) =>
  dataset === 'consumption' && nullableFields.includes(field);
export function validateFieldMapping(dataset: ApiDataset, input: unknown) {
  return apiFieldMapping
    .superRefine((mapping, ctx) => {
      for (const field of Object.keys(mapping.fields)) {
        if (!mappingFields(dataset).includes(field))
          ctx.addIssue({ code: 'custom', path: ['fields', field], message: 'Unknown destination field.' });
        else if (mapping.enabled && !mapping.fields[field] && !mappingFieldNullable(dataset, field))
          ctx.addIssue({
            code: 'custom',
            path: ['fields', field],
            message: 'Choose a source field for this required value.',
          });
      }
    })
    .parse(input);
}
function readPath(value: unknown, path: string): unknown {
  if (!path) return value;
  for (const key of path.split('.')) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}
export function mapApiResponse(dataset: ApiDataset, input: unknown, config: ApiFieldMapping) {
  const mapping = validateFieldMapping(dataset, config);
  if (!mapping.enabled) return datasetPayload(dataset).parse(input);
  const rows = readPath(input, mapping.recordsPath);
  if (!Array.isArray(rows))
    throw new Error(`Records path "${mapping.recordsPath || '(response root)'}" must contain an array.`);
  if (rows.length > 10000) throw new Error('Import at most 10,000 records at a time.');
  const example = apiImportExample[dataset][0] as Record<string, unknown>;
  const mapped = rows.map((row) =>
    Object.fromEntries(
      mappingFields(dataset).map((field) => {
        const source = mapping.fields[field] ?? field;
        let value = source ? readPath(row, source) : undefined;
        if ((value === undefined || value === null || value === '') && mappingFieldNullable(dataset, field))
          value = null;
        // Only unambiguous decimal strings are converted. Formatted numbers remain validation errors.
        if (typeof example[field] === 'number' && typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value.trim()))
          value = Number(value);
        return [field, value];
      }),
    ),
  );
  const parsed = datasetPayload(dataset).safeParse({ version: 1, [dataset]: mapped });
  if (!parsed.success)
    throw new Error(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'));
  return parsed.data;
}
