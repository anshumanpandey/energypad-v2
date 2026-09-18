import { z } from 'zod';

export const roles = ['OWNER', 'ADMIN', 'ANALYST', 'SITE_MANAGER', 'VIEWER'] as const;
export type Role = (typeof roles)[number];
export const roleLabels: Record<Role, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  ANALYST: 'Analyst',
  SITE_MANAGER: 'Site manager',
  VIEWER: 'Viewer',
};
export const permissionRoles = {
  'organisation:update': ['OWNER', 'ADMIN'],
  'members:manage': ['OWNER', 'ADMIN'],
  'audit:read': ['OWNER', 'ADMIN'],
  'billing:manage': ['OWNER'],
} satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof permissionRoles;
export function can(role: Role, permission: Permission): boolean {
  return (permissionRoles[permission] as readonly Role[]).includes(role);
}
export function canManageRole(actor: Role, target: Role): boolean {
  return actor === 'OWNER' || (actor === 'ADMIN' && target !== 'OWNER');
}

export const plans = [
  {
    key: 'STARTER',
    name: 'Starter',
    siteLimit: 5,
    entitlements: {
      core: true,
      portfolio: false,
      ai: false,
      nra: false,
      api: false,
      scheduledReports: false,
      sso: false,
    },
  },
  {
    key: 'GROWTH',
    name: 'Growth',
    siteLimit: 25,
    entitlements: { core: true, portfolio: true, ai: true, nra: false, api: false, scheduledReports: true, sso: false },
  },
  {
    key: 'PROFESSIONAL',
    name: 'Professional',
    siteLimit: 100,
    entitlements: { core: true, portfolio: true, ai: true, nra: true, api: true, scheduledReports: true, sso: false },
  },
  {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    siteLimit: null,
    entitlements: { core: true, portfolio: true, ai: true, nra: true, api: true, scheduledReports: true, sso: true },
  },
] as const;
export type Feature = keyof (typeof plans)[number]['entitlements'];
export function hasFeature(plan: string, feature: Feature): boolean {
  return plans.find((p) => p.key === plan)?.entitlements[feature] ?? false;
}

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
export const uuid = z.string().uuid();
export const email = z.string().trim().toLowerCase().email().max(254);
const timezone = z
  .string()
  .max(100)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, 'Choose a valid time zone.');
export const organisationInput = z
  .object({
    name: z.string().trim().min(2).max(100),
    currency: z.enum(['GBP', 'EUR', 'USD', 'CAD', 'AUD', 'INR']),
    timezone,
  })
  .strict();
export const invitationInput = z
  .object({
    email,
    role: z.enum(roles),
    siteIds: z.array(uuid).max(100).default([]),
  })
  .strict()
  .refine((v) => v.role === 'SITE_MANAGER' || v.siteIds.length === 0, 'Only site managers need site assignments.');
export const memberInput = z.object({ role: z.enum(roles) }).strict();
export const assignmentInput = z.object({ siteIds: z.array(uuid).max(100) }).strict();
export const tokenInput = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
