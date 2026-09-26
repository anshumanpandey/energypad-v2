import { DomainError, plans } from './policy';

// This version describes existing local assignment rules, not payment status.
export const planAccessVersion = 'assigned-plan-v1' as const;
export function resolvePlanAccess(organisation: { planKey: string; plan: { key: string; siteLimit: number | null } }) {
  const definition = plans.find((plan) => plan.key === organisation.planKey);
  const limit = organisation.plan.siteLimit;
  if (
    !definition ||
    organisation.plan.key !== organisation.planKey ||
    (limit !== null && (!Number.isSafeInteger(limit) || limit < 0))
  ) {
    throw new DomainError('PLAN_CONFIGURATION', 'Workspace plan configuration is unavailable.', 503);
  }
  return {
    version: planAccessVersion,
    source: 'LOCAL_ASSIGNMENT' as const,
    planKey: definition.key,
    // Preserve persisted capacity overrides and the existing feature catalogue.
    // Database entitlements are not an independent feature-grant mechanism.
    siteLimit: limit,
    features: { ...definition.entitlements },
  };
}
export function siteCapacity(access: ReturnType<typeof resolvePlanAccess>, active: number) {
  if (!Number.isSafeInteger(active) || active < 0) throw new Error('Invalid active-site count');
  const limit = access.siteLimit;
  return {
    active,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - active),
    overLimit: limit !== null && active > limit,
  };
}
export function requireSiteCapacity(access: ReturnType<typeof resolvePlanAccess>, active: number, amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error('Invalid site capacity increment');
  const capacity = siteCapacity(access, active);
  if (capacity.remaining !== null && amount > capacity.remaining)
    throw new DomainError('SITE_LIMIT', 'This import or site would exceed your plan’s active site limit.', 409);
}
