import { WasteCalculationV2 } from '../waste.service';
import { buildFakeConsumption } from './waste.test';

test.only('main', async () => {
  const params = {
    consumptions: [
      buildFakeConsumption({
        id: 1,
        date: '2022-01-01',
        consumption: 1200,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2022-02-01',
        consumption: 1244,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2022-03-01',
        consumption: 1250,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2022-04-01',
        consumption: 1243,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2022-05-01',
        consumption: 1245,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2022-06-01',
        consumption: 1244,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2022-07-01',
        consumption: 1240,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2022-08-01',
        consumption: 1243,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2022-09-01',
        consumption: 1239,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2022-10-01',
        consumption: 1240,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2022-11-01',
        consumption: 1245,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2022-12-01',
        consumption: 1240,
        siteId: 1,
        fuelSourceId: 1,
      }),
    ],
    hdd: [
      { value: 140, date: new Date(2022, 0, 1), siteId: 1, kind: 'HDD' as const },
      { value: 130, date: new Date(2022, 1, 1), siteId: 1, kind: 'HDD' as const },
      { value: 100, date: new Date(2022, 2, 1), siteId: 1, kind: 'HDD' as const },
      { value: 90, date: new Date(2022, 3, 1), siteId: 1, kind: 'HDD' as const },
      { value: 80, date: new Date(2022, 4, 1), siteId: 1, kind: 'HDD' as const },
      { value: 70, date: new Date(2022, 5, 1), siteId: 1, kind: 'HDD' as const },
      { value: 60, date: new Date(2022, 6, 1), siteId: 1, kind: 'HDD' as const },
      { value: 50, date: new Date(2022, 7, 1), siteId: 1, kind: 'HDD' as const },
      { value: 90, date: new Date(2022, 8, 1), siteId: 1, kind: 'HDD' as const },
      { value: 100, date: new Date(2022, 9, 1), siteId: 1, kind: 'HDD' as const },
      { value: 120, date: new Date(2022, 10, 1), siteId: 1, kind: 'HDD' as const },
      { value: 140, date: new Date(2022, 11, 1), siteId: 1, kind: 'HDD' as const },

      { value: 20, date: new Date(2022, 0, 1), siteId: 1, kind: 'CDD' as const },
      { value: 20, date: new Date(2022, 1, 1), siteId: 1, kind: 'CDD' as const },
      { value: 100, date: new Date(2022, 2, 1), siteId: 1, kind: 'CDD' as const },
      { value: 120, date: new Date(2022, 3, 1), siteId: 1, kind: 'CDD' as const },
      { value: 130, date: new Date(2022, 4, 1), siteId: 1, kind: 'CDD' as const },
      { value: 140, date: new Date(2022, 5, 1), siteId: 1, kind: 'CDD' as const },
      { value: 150, date: new Date(2022, 6, 1), siteId: 1, kind: 'CDD' as const },
      { value: 130, date: new Date(2022, 7, 1), siteId: 1, kind: 'CDD' as const },
      { value: 120, date: new Date(2022, 8, 1), siteId: 1, kind: 'CDD' as const },
      { value: 50, date: new Date(2022, 9, 1), siteId: 1, kind: 'CDD' as const },
      { value: 50, date: new Date(2022, 10, 1), siteId: 1, kind: 'CDD' as const },
      { value: 20, date: new Date(2022, 11, 1), siteId: 1, kind: 'CDD' as const },
    ],
    population: [
    ],

    time: [
    ],

    cdd: [
    ],

    nextConsumptions: [
      buildFakeConsumption({
        id: 1,
        date: '2023-01-01',
        consumption: 1248,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2023-02-01',
        consumption: 1242,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2023-03-01',
        consumption: 1254,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2023-04-01',
        consumption: 1270,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2023-05-01',
        consumption: 1268,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2023-06-01',
        consumption: 1289,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2023-07-01',
        consumption: 1265,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2023-08-01',
        consumption: 1278,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2023-09-01',
        consumption: 1257,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2023-10-01',
        consumption: 1276,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2023-11-01',
        consumption: 1268,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2023-12-01',
        consumption: 1265,
        siteId: 1,
        fuelSourceId: 1,
      }),
    ],
    nextHdd: [
      { value: 10, date: new Date(2023, 0, 1), siteId: 1, kind: 'HDD' as const },
      { value: 6, date: new Date(2023, 1, 1), siteId: 1, kind: 'HDD' as const },
      { value: 20, date: new Date(2023, 2, 1), siteId: 1, kind: 'HDD' as const },
      { value: 30, date: new Date(2023, 3, 1), siteId: 1, kind: 'HDD' as const },
      { value: 15, date: new Date(2023, 4, 1), siteId: 1, kind: 'HDD' as const },
      { value: 26, date: new Date(2023, 5, 1), siteId: 1, kind: 'HDD' as const },
      { value: 28, date: new Date(2023, 6, 1), siteId: 1, kind: 'HDD' as const },
      { value: 29, date: new Date(2023, 7, 1), siteId: 1, kind: 'HDD' as const },
      { value: 26, date: new Date(2023, 8, 1), siteId: 1, kind: 'HDD' as const },
      { value: 32, date: new Date(2023, 9, 1), siteId: 1, kind: 'HDD' as const },
      { value: 21, date: new Date(2023, 10, 1), siteId: 1, kind: 'HDD' as const },
      { value: 20, date: new Date(2023, 11, 1), siteId: 1, kind: 'HDD' as const },

      { value: 5, date: new Date(2023, 0, 1), siteId: 1, kind: 'CDD' as const },
      { value: 7, date: new Date(2023, 1, 1), siteId: 1, kind: 'CDD' as const },
      { value: 8, date: new Date(2023, 2, 1), siteId: 1, kind: 'CDD' as const },
      { value: 5, date: new Date(2023, 3, 1), siteId: 1, kind: 'CDD' as const },
      { value: 6, date: new Date(2023, 4, 1), siteId: 1, kind: 'CDD' as const },
      { value: 7, date: new Date(2023, 5, 1), siteId: 1, kind: 'CDD' as const },
      { value: 8, date: new Date(2023, 6, 1), siteId: 1, kind: 'CDD' as const },
      { value: 11, date: new Date(2023, 7, 1), siteId: 1, kind: 'CDD' as const },
      { value: 12, date: new Date(2023, 8, 1), siteId: 1, kind: 'CDD' as const },
      { value: 13, date: new Date(2023, 9, 1), siteId: 1, kind: 'CDD' as const },
      { value: 8, date: new Date(2023, 10, 1), siteId: 1, kind: 'CDD' as const },
      { value: 10, date: new Date(2023, 11, 1), siteId: 1, kind: 'CDD' as const },
    ],
    nextPopulation: [
    ],
    nextTime: [
    ],

    nextCdd: [
    ],
    year: 2023,
  };

  const result = WasteCalculationV2.wasteForHeatingAndCooling(params);
  expect(result.length).toBe(12);
  expect(result[0].waste).toBe(-1.62);
  expect(result[1].waste).toBe(4.92);
  expect(result[2].waste).toBe(-8.67);
  expect(result[3].waste).toBe(-25.95);
  expect(result[4].waste).toBe(-22.17);
  expect(result[5].waste).toBe(-44.41);
  expect(result[6].waste).toBe(-20.60);
  expect(result[7].waste).toBe(-33.60);
  expect(result[8].waste).toBe(-12.21);
  expect(result[9].waste).toBe(-31.87);
  expect(result[10].waste).toBe(-22.79);
  expect(result[11].waste).toBe(-19.59);
});
