import { z } from 'zod';
import { uuid } from './policy';

const optionalText = (schema: z.ZodType<string>) =>
  z.preprocess((value) => (typeof value === 'string' ? value.trim() || undefined : value), schema.optional());
export const auditFilters = z
  .object({
    action: optionalText(
      z
        .string()
        .max(100)
        .regex(/^[a-z][a-z0-9_.-]*$/),
    ),
    requestId: optionalText(uuid),
  })
  .strict();

export function auditHistoryUrl(organisationId: string, filters: z.infer<typeof auditFilters>, cursor?: string) {
  const query = new URLSearchParams();
  if (filters.action) query.set('action', filters.action);
  if (filters.requestId) query.set('requestId', filters.requestId);
  if (cursor) query.set('cursor', cursor);
  return `/org/${organisationId}/audit${query.size ? `?${query}` : ''}`;
}
