import { describe, expect, it } from 'vitest';
import { resolvePlanAccess, requireSiteCapacity, siteCapacity } from '../src/domain/plan-access';

const assigned = (planKey = 'STARTER', siteLimit: number | null = 5) =>
  resolvePlanAccess({ planKey, plan: { key: planKey, siteLimit } });

describe('assigned plan access', () => {
  it.each([
    ['STARTER', false, false, false],
    ['GROWTH', true, false, false],
    ['PROFESSIONAL', true, true, false],
    ['ENTERPRISE', true, true, true],
  ])('preserves %s feature inclusion', (key, ai, nra, sso) => {
    expect(assigned(key).features).toMatchObject({ core: true, ai, nra, sso });
    expect(assigned(key).source).toBe('LOCAL_ASSIGNMENT');
  });
  it('uses persisted capacity overrides and does not share mutable grants', () => {
    const access = assigned('GROWTH', 2);
    expect(siteCapacity(access, 3)).toEqual({ active: 3, limit: 2, remaining: 0, overLimit: true });
    expect(() => requireSiteCapacity(access, 3, 1)).toThrow(/active site limit/);
    access.features.ai = false;
    expect(assigned('GROWTH').features.ai).toBe(true);
  });
  it('enforces exact boundaries for individual and batch creation', () => {
    expect(() => requireSiteCapacity(assigned(), 3, 2)).not.toThrow();
    expect(() => requireSiteCapacity(assigned(), 3, 3)).toThrow(/active site limit/);
    expect(() => requireSiteCapacity(assigned(), 5, 1)).toThrow(/active site limit/);
    expect(() => requireSiteCapacity(assigned('STARTER', 0), 0, 1)).toThrow();
    expect(() => requireSiteCapacity(assigned('PROFESSIONAL', 100), 99, 1)).not.toThrow();
    expect(() => requireSiteCapacity(assigned('PROFESSIONAL', 100), 100, 1)).toThrow();
  });
  it('preserves unlimited capacity', () => {
    const access = assigned('ENTERPRISE', null);
    expect(siteCapacity(access, 500)).toEqual({ active: 500, limit: null, remaining: null, overLimit: false });
    expect(() => requireSiteCapacity(access, 500, 1000)).not.toThrow();
  });
  it('fails closed for unknown plans, mismatched relations and invalid limits', () => {
    expect(() => assigned('UNKNOWN', null)).toThrow(/configuration/);
    expect(() => resolvePlanAccess({ planKey: 'STARTER', plan: { key: 'ENTERPRISE', siteLimit: null } })).toThrow();
    for (const limit of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
      expect(() => assigned('STARTER', limit)).toThrow(/configuration/);
  });
  it('rejects invalid usage and increments even on unlimited plans', () => {
    for (const invalid of [-1, 0.5, NaN, Infinity]) {
      expect(() => siteCapacity(assigned(), invalid)).toThrow();
      expect(() => requireSiteCapacity(assigned('ENTERPRISE', null), 0, invalid)).toThrow();
    }
    expect(() => requireSiteCapacity(assigned(), 0, 0)).toThrow();
  });
});
