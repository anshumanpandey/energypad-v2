import { it, expect } from 'vitest';
import { readingCorrectionInput, conversionCorrectionInput } from '../src/domain/energy';
it('requires a correction reason and an explicit conversion choice', () => {
  const reading = { meterId: '123e4567-e89b-42d3-a456-426614174000', month: '2020-01', quantity: '0' };
  const input = { reading, reason: 'Correct invoice', useLatestConversion: false };
  expect(readingCorrectionInput.parse(input).reading.quantity).toBe('0');
  expect(readingCorrectionInput.safeParse({ ...input, reason: ' ' }).success).toBe(false);
  expect(readingCorrectionInput.safeParse({ reading, reason: 'Correct invoice' }).success).toBe(false);
  expect(readingCorrectionInput.safeParse({ ...input, reading: { ...reading, periodEnd: '2020-02-15' } }).success).toBe(
    false,
  );
  expect(
    conversionCorrectionInput.safeParse({
      conversion: {
        meterId: reading.meterId,
        firstMonth: '2020-01',
        lastMonth: '2020-12',
        factor: '12',
        source: 'Supplier',
      },
      reason: '',
    }).success,
  ).toBe(false);
});
