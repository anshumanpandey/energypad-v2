import { describe, it, expect } from 'vitest';
import {
  can,
  canManageRole,
  hasFeature,
  invitationInput,
  organisationInput,
  tokenInput,
  roles,
} from '../src/domain/policy';
describe('access decisions', () => {
  it('keeps ownership and billing separate from admin access', () => {
    expect(can('OWNER', 'billing:manage')).toBe(true);
    expect(can('ADMIN', 'billing:manage')).toBe(false);
    for (const role of roles) expect(canManageRole(role, 'OWNER')).toBe(role === 'OWNER');
    for (const role of ['ANALYST', 'SITE_MANAGER', 'VIEWER'] as const) {
      expect(can(role, 'members:manage')).toBe(false);
      expect(can(role, 'audit:read')).toBe(false);
    }
  });
  it('denies unknown plans and gates entitlements', () => {
    expect(hasFeature('UNKNOWN', 'core')).toBe(false);
    expect(hasFeature('STARTER', 'portfolio')).toBe(false);
    expect(hasFeature('GROWTH', 'portfolio')).toBe(true);
    expect(hasFeature('GROWTH', 'nra')).toBe(false);
    expect(hasFeature('PROFESSIONAL', 'nra')).toBe(true);
    expect(hasFeature('PROFESSIONAL', 'sso')).toBe(false);
  });
});
describe('boundary validation', () => {
  it('normalizes emails and disallows privilege fields', () => {
    expect(invitationInput.parse({ email: '  TeAm@Example.com ', role: 'VIEWER' }).email).toBe('team@example.com');
    expect(
      organisationInput.safeParse({ name: 'Valid', currency: 'GBP', timezone: 'Europe/London', planKey: 'ENTERPRISE' })
        .success,
    ).toBe(false);
    expect(invitationInput.safeParse({ email: 'a@b.com', role: 'PLATFORM_ADMIN' }).success).toBe(false);
  });
  it('rejects invalid timezone, token and non-manager site grants', () => {
    expect(organisationInput.safeParse({ name: 'Valid', currency: 'GBP', timezone: 'Invalid/Zone' }).success).toBe(
      false,
    );
    expect(tokenInput.safeParse({ token: 'guess' }).success).toBe(false);
    expect(
      invitationInput.safeParse({ email: 'a@b.com', role: 'VIEWER', siteIds: ['5cd6b2a4-3c23-4c3c-9bf2-64d368e5effc'] })
        .success,
    ).toBe(false);
  });
});
