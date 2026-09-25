import { describe, expect, it } from 'vitest';
import { carbonContentFingerprint } from '../src/server/carbon-fingerprint';
describe('carbon preview fingerprints', () => {
  it('ignores only volatile check times, including nested site checks', () => {
    expect(carbonContentFingerprint({ checkedAt: 'a', sites: [{ summary: { checkedAt: 'b', value: '0' } }] })).toBe(
      carbonContentFingerprint({ sites: [{ summary: { value: '0', checkedAt: 'c' } }], checkedAt: 'd' }),
    );
  });
  it('preserves source timestamps, identities, values and scope', () => {
    const source = { runId: 'old', calculatedAt: 'a', scope: 'assigned', total: '0', sites: ['a'] };
    for (const change of [
      { runId: 'new' },
      { calculatedAt: 'b' },
      { scope: 'all' },
      { total: null },
      { sites: ['a', 'b'] },
    ])
      expect(carbonContentFingerprint({ ...source, ...change })).not.toBe(carbonContentFingerprint(source));
  });
});
