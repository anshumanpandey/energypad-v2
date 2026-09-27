import { z } from 'zod';
import { DomainError } from './policy';

export const inventoryCutoff = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));
export function inventoryQuery(query: URLSearchParams) {
  if ([...query.keys()].some((key) => key !== 'before') || query.getAll('before').length !== 1)
    throw new DomainError('VALIDATION_ERROR', 'Supply one before timestamp with a time zone.');
  return inventoryCutoff.parse(query.get('before'));
}

export function inventoryExportQuery(query: URLSearchParams) {
  if (
    [...query.keys()].some((key) => !['before', 'fingerprint'].includes(key)) ||
    query.getAll('fingerprint').length !== 1
  )
    throw new DomainError('VALIDATION_ERROR', 'Supply one inventory fingerprint and cutoff.');
  const fingerprint = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(query.get('fingerprint'));
  const cutoffQuery = new URLSearchParams(query);
  cutoffQuery.delete('fingerprint');
  return { before: inventoryQuery(cutoffQuery).toISOString(), fingerprint };
}

export const inventoryReviewInput = z
  .object({
    category: z.enum(['sites', 'energy', 'drivers', 'occupancy', 'patterns', 'events', 'carbon']),
    cursor: z.string().uuid().optional(),
  })
  .strict();
export function inventoryReviewQuery(query: URLSearchParams) {
  if ([...query.keys()].some((key) => query.getAll(key).length !== 1))
    throw new DomainError('VALIDATION_ERROR', 'Supply each review parameter only once.');
  return inventoryReviewInput.parse(Object.fromEntries(query));
}
