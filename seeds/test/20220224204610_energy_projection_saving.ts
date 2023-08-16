import { Knex } from 'knex';
import {
  buildFakeBusiness,
  buildFakeConsumption,
  buildFakeEmission,
  buildFakeSite,
  buildFakeTarget,
} from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    buildFakeBusiness({ id: 322, email: 'mail322@mail.com' }),
    buildFakeBusiness({ id: 700, email: 'mail700@mail.com' }),
  ]);

  const site = {
    id: 484,
    businessId: 322,
  };
  const site2 = {
    id: 486,
    businessId: 322,
  };
  const site3 = {
    id: 487,
    businessId: 322,
  };
  const site4 = {
    id: 700,
    businessId: 700,
  };
  const site5 = {
    id: 700,
    businessId: 700,
  };

  await knex('Sites').insert([
    buildFakeSite({ id: site.id, businessId: site.businessId, name: 'Site 484' }),
    buildFakeSite({ id: site2.id, businessId: site2.businessId }),
    buildFakeSite({ id: site3.id, businessId: site3.businessId }),
    buildFakeSite({ id: site5.id, businessId: site5.businessId }),
  ]);

  await knex('UtilityConsumptions').insert([
    buildFakeConsumption({
      id: 3100,
      date: '2019-01-01',
      consumption: 99,
      fuelSourceId: 1,
      siteId: site.id,
    }),
    buildFakeConsumption({
      id: 3102,
      date: '2019-02-01',
      consumption: 65,
      fuelSourceId: 1,
      siteId: site.id,
    }),
    buildFakeConsumption({
      id: 3104,
      date: '2019-03-01',
      consumption: 79,
      fuelSourceId: 1,
      siteId: site.id,
    }),
    buildFakeConsumption({
      id: 3106,
      date: '2019-04-01',
      consumption: 75,
      fuelSourceId: 1,
      siteId: site.id,
    }),
    buildFakeConsumption({
      id: 3108,
      date: '2019-05-01',
      consumption: 87,
      fuelSourceId: 1,
      siteId: site.id,
    }),
    buildFakeConsumption({
      id: 3110,
      date: '2019-06-01',
      consumption: 81,
      fuelSourceId: 1,
      siteId: site.id,
    }),
    buildFakeConsumption({
      id: 3112,
      date: '2019-07-01',
      consumption: 0,
      fuelSourceId: 1,
      siteId: site.id,
    }),
    buildFakeConsumption({
      id: 3114,
      date: '2019-08-01',
      consumption: 0,
      fuelSourceId: 1,
      siteId: site.id,
    }),
    buildFakeConsumption({
      id: 3116,
      date: '2019-09-01',
      consumption: 0,
      fuelSourceId: 1,
      siteId: site.id,
    }),
    buildFakeConsumption({
      id: 3118,
      date: '2019-10-01',
      consumption: 0,
      fuelSourceId: 1,
      siteId: site.id,
    }),
    buildFakeConsumption({
      id: 3120,
      date: '2019-11-01',
      consumption: 0,
      fuelSourceId: 1,
      siteId: site.id,
    }),
    buildFakeConsumption({
      id: 3122,
      date: '2019-12-01',
      consumption: 0,
      fuelSourceId: 1,
      siteId: site.id,
    }),
    buildFakeConsumption({
      id: 3330,
      date: '2019-12-01',
      consumption: 0,
      fuelSourceId: 2,
      siteId: site.id,
    }),
  ]);
  const targetData = buildFakeTarget([
    {
      id: 1000,
      date: '2020-01-01',
      siteId: site.id,
      fuelSourceId: 1,
      targets: [{ targetValue: 348, fuelUnit: 'm3' }],
    },
    {
      id: 1002,
      date: '2020-01-01',
      siteId: site.id,
      fuelSourceId: 2,
      targets: [{ targetValue: 104, fuelUnit: 'm3' }],
    },
  ]);
  await knex('UtilityConsumptions').insert([
    //2020
    buildFakeConsumption({
      id: 3124,
      date: '2020-01-01',
      consumption: 200,
      totalCost: 12,
      fuelSourceId: 1,
      siteId: site.id,
    }),
    buildFakeConsumption({
      id: 3126,
      date: '2020-02-01',
      consumption: 89,
      totalCost: 25,
      fuelSourceId: 1,
      siteId: site.id,
    }),
    buildFakeConsumption({
      id: 3128,
      date: '2020-03-01',
      consumption: 27,
      totalCost: 37,
      fuelSourceId: 1,
      siteId: site.id,
    }),

    buildFakeConsumption({
      id: 3123,
      date: '2020-01-01',
      consumption: 18,
      totalCost: 48,
      fuelSourceId: 2,
      siteId: site.id,
    }),

    buildFakeConsumption({
      id: 3130,
      date: '2020-03-01',
      consumption: 37,
      totalCost: 52,
      fuelSourceId: 1,
      siteId: site2.id,
    }),

    buildFakeConsumption({
      id: 3132,
      date: '2020-03-01',
      consumption: 46,
      totalCost: 69,
      fuelSourceId: 2,
      siteId: site2.id,
    }),
    //2021
    buildFakeConsumption({
      id: 3148,
      date: '2021-01-01',
      consumption: 37,
      fuelSourceId: 1,
      siteId: site3.id,
    }),
    buildFakeConsumption({
      id: 3149,
      date: '2021-01-01',
      consumption: 37,
      fuelSourceId: 2,
      siteId: site3.id,
    }),
    buildFakeConsumption({
      id: 3150,
      date: '2021-02-01',
      consumption: 64,
      fuelSourceId: 1,
      siteId: site3.id,
    }),
    buildFakeConsumption({
      id: 3152,
      date: '2021-03-01',
      consumption: 44,
      fuelSourceId: 1,
      siteId: site3.id,
    }),
    buildFakeConsumption({
      id: 3154,
      date: '2021-04-01',
      consumption: 78,
      fuelSourceId: 1,
      siteId: site3.id,
    }),
    buildFakeConsumption({
      id: 3156,
      date: '2021-05-01',
      consumption: 55,
      fuelSourceId: 1,
      siteId: site3.id,
    }),
    buildFakeConsumption({
      id: 3158,
      date: '2021-06-01',
      consumption: 19,
      fuelSourceId: 1,
      siteId: site3.id,
    }),
    buildFakeConsumption({
      id: 3160,
      date: '2021-07-01',
      consumption: 0,
      fuelSourceId: 1,
      siteId: site3.id,
    }),
    buildFakeConsumption({
      id: 3162,
      date: '2021-08-01',
      consumption: 0,
      fuelSourceId: 1,
      siteId: site3.id,
    }),
    buildFakeConsumption({
      id: 3164,
      date: '2021-09-01',
      consumption: 0,
      fuelSourceId: 1,
      siteId: site3.id,
    }),
    buildFakeConsumption({
      id: 3166,
      date: '2021-10-01',
      consumption: 0,
      fuelSourceId: 1,
      siteId: site3.id,
    }),
    buildFakeConsumption({
      id: 3168,
      date: '2021-11-01',
      consumption: 0,
      fuelSourceId: 1,
      siteId: site3.id,
    }),
    buildFakeConsumption({
      id: 3170,
      date: '2021-12-01',
      consumption: 0,
      fuelSourceId: 1,
      siteId: site3.id,
    }),
    //2022
    buildFakeConsumption({
      id: 3172,
      date: '2022-01-01',
      consumption: 39,
      fuelSourceId: 1,
      siteId: site3.id,
    }),
    buildFakeConsumption({
      id: 3174,
      date: '2022-02-01',
      consumption: 11,
      fuelSourceId: 1,
      siteId: site3.id,
    }),
    buildFakeConsumption({
      id: 3176,
      date: '2022-02-01',
      consumption: 16,
      fuelSourceId: 2,
      siteId: site3.id,
    }),
    buildFakeConsumption({
      id: 3178,
      date: '2022-02-01',
      consumption: 16,
      fuelSourceId: 2,
      siteId: site.id,
    }),

    //site4
    buildFakeConsumption({
      id: 3400,
      date: '2023-01-01',
      consumption: 100,
      fuelSourceId: 4,
      siteId: site4.id,
    }),
    buildFakeConsumption({
      id: 3402,
      date: '2023-02-01',
      consumption: 120,
      fuelSourceId: 1,
      siteId: site4.id,
    }),
    buildFakeConsumption({
      id: 3404,
      date: '2023-03-01',
      consumption: 200,
      fuelSourceId: 2,
      siteId: site4.id,
    }),
    buildFakeConsumption({
      id: 3406,
      date: '2023-04-01',
      consumption: 120,
      fuelSourceId: 1,
      siteId: site4.id,
    }),
    buildFakeConsumption({
      id: 3408,
      date: '2023-05-01',
      consumption: 300,
      fuelSourceId: 2,
      siteId: site4.id,
    }),
    buildFakeConsumption({
      id: 3410,
      date: '2023-06-01',
      consumption: 120,
      fuelSourceId: 1,
      siteId: site4.id,
    }),
    buildFakeConsumption({
      id: 3412,
      date: '2023-01-01',
      consumption: 200,
      fuelSourceId: 2,
      siteId: site4.id,
    }),
  ]);

  const targetData2 = buildFakeTarget([
    {
      id: 1008,
      date: '2023-01-01',
      siteId: site5.id,
      fuelSourceId: 4,
      targets: [{ targetValue: 150, fuelUnit: 'm3' }],
    },
    {
      id: 1010,
      date: '2023-01-01',
      siteId: site5.id,
      fuelSourceId: 2,
      targets: [{ targetValue: 80, fuelUnit: 'm3' }],
    },
  ]);
  await knex('UtilityConsumptions').insert([
    buildFakeConsumption({
      id: 3414,
      date: '2023-02-01',
      consumption: 84.69,
      fuelSourceId: 2,
      siteId: site5.id,
    }),
    buildFakeConsumption({
      id: 3416,
      date: '2023-03-01',
      consumption: 395.01,
      fuelSourceId: 4,
      siteId: site5.id,
    }),
    buildFakeConsumption({
      id: 3418,
      date: '2023-04-01',
      consumption: 120,
      fuelSourceId: 4,
      siteId: site5.id,
    }),
    buildFakeConsumption({
      id: 3420,
      date: '2023-05-01',
      consumption: 200,
      fuelSourceId: 4,
      siteId: site5.id,
    }),
    buildFakeConsumption({
      id: 3422,
      date: '2023-06-01',
      consumption: 120,
      fuelSourceId: 4,
      siteId: site5.id,
    }),
    buildFakeConsumption({
      id: 3424,
      date: '2022-12-01',
      consumption: 200,
      fuelSourceId: 2,
      siteId: site5.id,
    }),
    buildFakeConsumption({
      id: 3426,
      date: '2022-12-01',
      consumption: 120,
      fuelSourceId: 1,
      siteId: site5.id,
    }),
  ]);
  await knex('TargetConsumption').insert(targetData.TargetConsumption);
  await knex('TargetConsumptionFuelConversion').insert(targetData.TargetConsumptionFuelConversion);
  await knex('TargetConsumption').insert(targetData2.TargetConsumption);
  await knex('TargetConsumptionFuelConversion').insert(targetData2.TargetConsumptionFuelConversion);

  await knex('UtilityEmissions').insert([
    buildFakeEmission({
      id: 200,
      date: `2020-01-01`,
      fuelSourceId: 2,
      usedInId: 2,
      siteId: site2.id,
    }),
    buildFakeEmission({
      id: 202,
      date: `2020-01-01`,
      fuelSourceId: 3,
      usedInId: 2,
      siteId: site2.id,
    }),
  ]);
}
