import { expect, it, vi } from 'vitest';
import { EnergyService } from '../src/server/energy';
import { actorFor } from '../src/server/foundation';
import type { PrismaClient } from '@prisma/client';

it('lists current consumption across every year, scoped to accessible sites', async () => {
  const findMany = vi.fn().mockResolvedValue([]);
  const service = new EnergyService(
    { consumptionRecord: { findMany } } as unknown as PrismaClient,
    { send: vi.fn() },
    'http://localhost:3100',
  );
  vi.spyOn(service, 'listSites').mockResolvedValue([{ id: 'assigned-site', name: 'London', code: 'London' }]);
  await service.allRecords(actorFor('user'), 'organisation');
  expect(findMany).toHaveBeenCalledWith({
    where: { organisationId: 'organisation', siteId: { in: ['assigned-site'] }, replacement: { is: null } },
    orderBy: [{ periodStart: 'desc' }, { siteId: 'asc' }, { meterId: 'asc' }],
    include: { site: { select: { name: true } }, meter: { select: { name: true } } },
  });
  vi.spyOn(service, 'listSites').mockResolvedValue([]);
  await service.allRecords(actorFor('user'), 'organisation');
  expect(findMany.mock.calls[1][0].where.siteId.in).toEqual([]);
});
