import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([buildFakeBusiness({ id: 602, email: 'mail602@mail.com' })]);

  await knex('Sites').insert([buildFakeSite({ id: 600, businessId: 602, name: 'Site 600' })]);

  await knex('TargetConsumption').insert([
    { id: 100, date: '2020-01-01', siteId: 484, fuelSourceId: 1 },
    { id: 102, date: '2020-02-01', siteId: 484, fuelSourceId: 1 },
    { id: 104, date: '2020-03-01', siteId: 484, fuelSourceId: 1 },
  ]);

  await knex('TargetConsumptionFuelConversion').insert([
    { id: 102, targetValue: 100, fuelUnit: 'm3', targetConsumptionId: 100 },
    { id: 104, targetValue: 200, fuelUnit: 'm3', targetConsumptionId: 100 },
    { id: 106, targetValue: 300, fuelUnit: 'm3', targetConsumptionId: 100 },

    { id: 108, targetValue: 100, fuelUnit: 'm3', targetConsumptionId: 102 },
    { id: 110, targetValue: 200, fuelUnit: 'm3', targetConsumptionId: 102 },
    { id: 112, targetValue: 300, fuelUnit: 'm3', targetConsumptionId: 102 },

    { id: 114, targetValue: 100, fuelUnit: 'm3', targetConsumptionId: 104 },
    { id: 116, targetValue: 200, fuelUnit: 'm3', targetConsumptionId: 104 },
    { id: 118, targetValue: 300, fuelUnit: 'm3', targetConsumptionId: 104 },
  ]);
}
