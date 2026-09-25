import { snapshotHash } from './analysis/contract';
// Check timestamps describe when a read occurred, not the evidence it contains.
export function carbonContentFingerprint(value: unknown): string {
  function stable(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(stable);
    if (v !== null && typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v)
          .filter(([key]) => key !== 'checkedAt')
          .map(([key, item]) => [key, stable(item)]),
      );
    return v;
  }
  return snapshotHash(stable(value));
}
