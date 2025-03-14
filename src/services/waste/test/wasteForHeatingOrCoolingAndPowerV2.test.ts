import { WasteCalculationV2 } from '../waste.service';
import { buildFakeConsumption } from './waste.test';

test.only('main', async () => {
  const params = {
    consumptions: [
      buildFakeConsumption({
        id: 1,
        date: '2013-01-01',
        consumption: 22160.0,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2013-02-01',
        consumption: 22180,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2013-03-01',
        consumption: 22190,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2013-04-01',
        consumption: 22150,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2013-05-01',
        consumption: 22280,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2013-06-01',
        consumption: 22220,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2013-07-01',
        consumption: 22250,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2013-08-01',
        consumption: 22300,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2013-09-01',
        consumption: 22250,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2013-10-01',
        consumption: 22250,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2013-11-01',
        consumption: 22200,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2013-12-01',
        consumption: 22200,
        siteId: 1,
        fuelSourceId: 1,
      }),
    ],
    hdd: [
      { value: 2166.5, date: new Date(2013, 0, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1904.3, date: new Date(2013, 1, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1996.7, date: new Date(2013, 2, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1799.9, date: new Date(2013, 3, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1734.6, date: new Date(2013, 4, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1546.1, date: new Date(2013, 5, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1435.9, date: new Date(2013, 6, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1441, date: new Date(2013, 7, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1526.8, date: new Date(2013, 8, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1723, date: new Date(2013, 9, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1792.4, date: new Date(2013, 10, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1976.6, date: new Date(2013, 11, 1), siteId: 1, kind: 'HDD' as const },
    ],
    population: [
      { siteId: 1, value: 120.0, date: '2013-01-01' },
      { siteId: 1, value: 190, date: '2013-02-01' },
      { siteId: 1, value: 110, date: '2013-03-01' },
      { siteId: 1, value: 100, date: '2013-04-01' },
      { siteId: 1, value: 60, date: '2013-05-01' },
      { siteId: 1, value: 140, date: '2013-06-01' },
      { siteId: 1, value: 60, date: '2013-07-01' },
      { siteId: 1, value: 220, date: '2013-08-01' },
      { siteId: 1, value: 280, date: '2013-09-01' },
      { siteId: 1, value: 240, date: '2013-10-01' },
      { siteId: 1, value: 180, date: '2013-11-01' },
      { siteId: 1, value: 190, date: '2013-12-01' },
    ],

    time: [
      { siteId: 1, value: 130.0, date: '2013-01-01' },
      { siteId: 1, value: 155, date: '2013-02-01' },
      { siteId: 1, value: 90, date: '2013-03-01' },
      { siteId: 1, value: 80, date: '2013-04-01' },
      { siteId: 1, value: 100, date: '2013-05-01' },
      { siteId: 1, value: 120, date: '2013-06-01' },
      { siteId: 1, value: 70, date: '2013-07-01' },
      { siteId: 1, value: 100, date: '2013-08-01' },
      { siteId: 1, value: 100, date: '2013-09-01' },
      { siteId: 1, value: 160, date: '2013-10-01' },
      { siteId: 1, value: 180, date: '2013-11-01' },
      { siteId: 1, value: 150, date: '2013-12-01' },
    ],

    daylight: [
      { siteId: 1, value: 420, date: '2013-01-01' },
      { siteId: 1, value: 421, date: '2013-02-01' },
      { siteId: 1, value: 440, date: '2013-03-01' },
      { siteId: 1, value: 420, date: '2013-04-01' },
      { siteId: 1, value: 430, date: '2013-05-01' },
      { siteId: 1, value: 445, date: '2013-06-01' },
      { siteId: 1, value: 450, date: '2013-07-01' },
      { siteId: 1, value: 500, date: '2013-08-01' },
      { siteId: 1, value: 450, date: '2013-09-01' },
      { siteId: 1, value: 460, date: '2013-10-01' },
      { siteId: 1, value: 480, date: '2013-11-01' },
      { siteId: 1, value: 490, date: '2013-12-01' },
    ],

    nextConsumptions: [
      buildFakeConsumption({
        id: 1,
        date: '2014-01-01',
        consumption: 22190.0,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2014-02-01',
        consumption: 22210,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2014-03-01',
        consumption: 22220,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2014-04-01',
        consumption: 22190,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2014-05-01',
        consumption: 22370,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2014-06-01',
        consumption: 22290,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2014-07-01',
        consumption: 22280,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2014-08-01',
        consumption: 22350,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2014-09-01',
        consumption: 22290,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2014-10-01',
        consumption: 22210,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2014-11-01',
        consumption: 22280,
        siteId: 1,
        fuelSourceId: 1,
      }),

      buildFakeConsumption({
        id: 1,
        date: '2014-12-01',
        consumption: 22200,
        siteId: 1,
        fuelSourceId: 1,
      }),
    ],
    nextHdd: [
      { value: 2008.2, date: new Date(2014, 0, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1870.9, date: new Date(2014, 1, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1991.9, date: new Date(2014, 2, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1785, date: new Date(2014, 3, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1726, date: new Date(2014, 4, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1532.2, date: new Date(2014, 5, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1405, date: new Date(2014, 6, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1457.1, date: new Date(2014, 7, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1455.6, date: new Date(2014, 8, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1668.7, date: new Date(2014, 9, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1892, date: new Date(2014, 10, 1), siteId: 1, kind: 'HDD' as const },
      { value: 1989.8, date: new Date(2014, 11, 1), siteId: 1, kind: 'HDD' as const },
    ],
    nextPopulation: [
      { siteId: 1, value: 110.0, date: '2014-01-01' },
      { siteId: 1, value: 180, date: '2014-02-01' },
      { siteId: 1, value: 100, date: '2014-03-01' },
      { siteId: 1, value: 100, date: '2014-04-01' },
      { siteId: 1, value: 50, date: '2014-05-01' },
      { siteId: 1, value: 150, date: '2014-06-01' },
      { siteId: 1, value: 180, date: '2014-07-01' },
      { siteId: 1, value: 220, date: '2014-08-01' },
      { siteId: 1, value: 300, date: '2014-09-01' },
      { siteId: 1, value: 250, date: '2014-10-01' },
      { siteId: 1, value: 180, date: '2014-11-01' },
      { siteId: 1, value: 190, date: '2014-12-01' },
    ],
    nextTime: [
      { siteId: 1, value: 150, date: '2014-01-01' },
      { siteId: 1, value: 110, date: '2014-02-01' },
      { siteId: 1, value: 80, date: '2014-03-01' },
      { siteId: 1, value: 90, date: '2014-04-01' },
      { siteId: 1, value: 100, date: '2014-05-01' },
      { siteId: 1, value: 120, date: '2014-06-01' },
      { siteId: 1, value: 70, date: '2014-07-01' },
      { siteId: 1, value: 80, date: '2014-08-01' },
      { siteId: 1, value: 100, date: '2014-09-01' },
      { siteId: 1, value: 160, date: '2014-10-01' },
      { siteId: 1, value: 160, date: '2014-11-01' },
      { siteId: 1, value: 160, date: '2014-12-01' },
    ],

    nextDaylight: [
      { siteId: 1, value: 400, date: '2014-01-01' },
      { siteId: 1, value: 380, date: '2014-02-01' },
      { siteId: 1, value: 450, date: '2014-03-01' },
      { siteId: 1, value: 410, date: '2014-04-01' },
      { siteId: 1, value: 450, date: '2014-05-01' },
      { siteId: 1, value: 420, date: '2014-06-01' },
      { siteId: 1, value: 460, date: '2014-07-01' },
      { siteId: 1, value: 520, date: '2014-08-01' },
      { siteId: 1, value: 480, date: '2014-09-01' },
      { siteId: 1, value: 490, date: '2014-10-01' },
      { siteId: 1, value: 500, date: '2014-11-01' },
      { siteId: 1, value: 500, date: '2014-12-01' },
    ],
    year: 2014,
  };

  const result = WasteCalculationV2.wasteForHeatingOrCoolingAndPower(params);
  expect(result.length).toBe(12);
  expect(result[0].waste).toBe(622.173729);
  expect(result[1].waste).toBe(-5978.631421);
  expect(result[2].waste).toBe(-4729.308853);
  expect(result[3].waste).toBe(3125.209754);
  expect(result[4].waste).toBe(-4716.479282);
  expect(result[5].waste).toBe(2707.459671);
  expect(result[6].waste).toBe(41613.706265);
  expect(result[7].waste).toBe(-5004.497411);
  expect(result[8].waste).toBe(-982.896733);
  expect(result[9].waste).toBe(-1137.623247);
  expect(result[10].waste).toBe(-2283.320687);
  expect(result[11].waste).toBe(1161.375453);
});
