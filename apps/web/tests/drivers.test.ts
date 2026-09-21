import { describe, it, expect } from 'vitest';
import { observationInput, scheduleInput, mapDriverWorkbook } from '../src/domain/drivers';
describe('observed drivers and planned schedules', () => {
  it('preserves zero and validates hours against the actual month length', () => {
    const input = { month: '2024-02', driver: 'OPERATING_HOURS', value: '696', source: 'Operations log' };
    expect(observationInput.parse(input).value).toBe('696');
    expect(observationInput.parse({ ...input, value: '0' }).value).toBe('0');
    for (const patch of [
      { month: '2023-02' },
      { value: '696.001' },
      { value: '-1' },
      { value: '' },
      { month: '2024-13' },
      { source: '' },
    ])
      expect(observationInput.safeParse({ ...input, ...patch }).success).toBe(false);
  });
  it('rejects invalid dates, reversed ranges and impossible weekly schedules', () => {
    const input = {
      name: 'Standard',
      firstDay: '2024-02-29',
      lastDay: '2024-03-01',
      weeklyHours: '168',
      source: 'Operations plan',
    };
    expect(scheduleInput.safeParse(input).success).toBe(true);
    for (const patch of [
      { firstDay: '2023-02-29' },
      { lastDay: '2024-02-28' },
      { weeklyHours: '168.001' },
      { firstDay: '2024-13-01' },
    ])
      expect(scheduleInput.safeParse({ ...input, ...patch }).success).toBe(false);
  });
  it('maps every row with explicit basis and reports duplicates and invalid rows', () => {
    const sheet = {
      name: 'Drivers',
      headers: ['source', 'value', 'driver', 'month'],
      rows: [
        { row: 2, cells: ['Attendance', '0', 'population', '2020-01'] },
        { row: 3, cells: ['Attendance', '2', 'POPULATION', '2020-01'] },
        { row: 4, cells: ['Log', '700', 'OPERATING_HOURS', '2021-02'] },
      ],
    };
    const result = mapDriverWorkbook([sheet]);
    expect(result.records).toHaveLength(2);
    expect(result.records[0].data.value).toBe('0');
    expect(result.issues.map((i) => i.row)).toEqual([3, 4]);
    expect(() => mapDriverWorkbook([sheet, sheet])).toThrow();
    expect(() => mapDriverWorkbook([{ ...sheet, headers: ['month', 'driver', 'value', 'workingHours'] }])).toThrow();
    expect(() => mapDriverWorkbook([{ ...sheet, rows: Array.from({ length: 241 }, () => sheet.rows[0]) }])).toThrow();
  });
});
