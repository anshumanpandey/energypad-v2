import { Prisma } from '@prisma/client';
import { FoundationService, type Actor } from './foundation';
import { DomainError, uuid } from '../domain/policy';
import { emissionFactorInput, emissionFactorCorrectionInput } from '../domain/emission-factors';
export class EmissionFactorService extends FoundationService {
  async list(actor: Actor, org: string) {
    await this.membership(actor, org);
    return this.db.emissionFactorVersion.findMany({
      where: { organisationId: org },
      orderBy: [{ validFrom: 'desc' }, { revision: 'desc' }],
    });
  }
  async add(actor: Actor, org: string, input: unknown, supersedesId?: string, reason?: string) {
    return this.db.$transaction((tx) => this.addWithin(tx, actor, org, input, supersedesId, reason));
  }
  async addWithin(
    tx: Prisma.TransactionClient,
    actor: Actor,
    org: string,
    input: unknown,
    supersedesId?: string,
    reason?: string,
  ) {
    const data = emissionFactorInput.parse(input);
    const { firstDay, lastDay, ...fields } = data;
    const validFrom = new Date(firstDay),
      validUntil = new Date(+new Date(lastDay) + 86400000);
    await this.lock(tx, org);
    await this.membership(actor, org, 'organisation:update', tx);
    const previous = supersedesId
      ? await tx.emissionFactorVersion.findFirst({
          where: { id: uuid.parse(supersedesId), organisationId: org, replacement: { is: null } },
        })
      : null;
    if (supersedesId && !previous)
      throw new DomainError(
        'STALE_REVISION',
        'This factor changed or is unavailable. Reload before correcting it.',
        409,
      );
    if (
      previous &&
      (previous.fuel !== data.fuel ||
        previous.geography !== data.geography ||
        previous.basis !== data.basis ||
        previous.unit !== data.unit)
    )
      throw new DomainError('IDENTITY', 'A correction must keep the fuel, geography, basis and unit.');
    if (
      await tx.emissionFactorVersion.findFirst({
        where: {
          organisationId: org,
          fuel: data.fuel,
          geography: data.geography,
          basis: data.basis,
          unit: data.unit,
          replacement: { is: null },
          validFrom: { lt: validUntil },
          validUntil: { gt: validFrom },
          ...(previous ? { id: { not: previous.id } } : {}),
        },
      })
    )
      throw new DomainError(
        'FACTOR_OVERLAP',
        'Another current factor covers these dates for this fuel, geography and basis.',
        409,
      );
    const record = await tx.emissionFactorVersion.create({
      data: {
        ...fields,
        validFrom,
        validUntil,
        organisationId: org,
        authorId: actor.userId,
        ...(previous ? { supersedesId: previous.id, revision: previous.revision + 1, correctionReason: reason } : {}),
      },
    });
    await this.audit(tx, actor, org, previous ? 'carbon.factor_corrected' : 'carbon.factor_added', record.id, {
      fuel: record.fuel,
      geography: record.geography,
      basis: record.basis,
      ...(previous ? { supersedesId: previous.id, reason } : {}),
    });
    return record;
  }
  async correct(actor: Actor, org: string, id: string, input: unknown) {
    const { factor, reason } = emissionFactorCorrectionInput.parse(input);
    return this.add(actor, org, factor, id, reason);
  }
}
