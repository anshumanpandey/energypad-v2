import { FoundationService, type Actor } from './foundation';
import { hasFeature, type Feature } from '../domain/policy';

const features: { key: Feature; name: string }[] = [
  { key: 'core', name: 'Core energy management' },
  { key: 'portfolio', name: 'Portfolio analysis' },
  { key: 'ai', name: 'AI answers' },
  { key: 'nra', name: 'Non-routine adjustments' },
  { key: 'api', name: 'API access' },
  { key: 'scheduledReports', name: 'Scheduled reports' },
  { key: 'sso', name: 'Single sign-on' },
];

export class BillingService extends FoundationService {
  async overview(actor: Actor, organisationId: string) {
    return this.db.$transaction(
      async (tx) => {
        await this.membership(actor, organisationId, 'billing:manage', tx);
        const organisation = await tx.organisation.findUniqueOrThrow({
          where: { id: organisationId },
          include: { plan: true },
        });
        const activeSites = await tx.site.count({ where: { organisationId, archivedAt: null } });
        const limit = organisation.plan.siteLimit;
        return {
          organisationId,
          plan: { key: organisation.planKey, name: organisation.plan.name },
          subscription: { status: 'NOT_CONNECTED' as const },
          sites: {
            active: activeSites,
            limit,
            remaining: limit === null ? null : Math.max(0, limit - activeSites),
            overLimit: limit !== null && activeSites > limit,
          },
          // Use the same feature policy as application access checks. The database
          // plan's siteLimit is authoritative for site creation/import capacity.
          features: features.map((feature) => ({
            ...feature,
            included: hasFeature(organisation.planKey, feature.key),
          })),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
export type BillingOverview = Awaited<ReturnType<BillingService['overview']>>;
