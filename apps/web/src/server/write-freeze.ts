import { DomainError } from '../domain/policy';

export const freezeMessage =
  'Maintenance is in progress. Changes, sign-in and audited downloads are temporarily paused.';
// Invalid nonempty values fail closed. This setting is operator-owned, never a request parameter.
export function writesFrozen(value = process.env.APP_WRITE_FREEZE) {
  return value !== undefined && value !== '' && value !== 'false';
}
export function assertWritable() {
  if (writesFrozen()) throw new DomainError('WRITE_FREEZE', freezeMessage, 503);
}
export function freezeResponse() {
  return Response.json(
    { code: 'WRITE_FREEZE', title: freezeMessage, status: 503 },
    {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
    },
  );
}
export function databaseConnection(url: string, frozen: boolean) {
  if (!frozen) return url;
  const parsed = new URL(url);
  parsed.searchParams.set(
    'options',
    `${parsed.searchParams.get('options') ?? ''} -c default_transaction_read_only=on`.trim(),
  );
  return parsed.toString();
}
