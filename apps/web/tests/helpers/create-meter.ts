import type { APIRequestContext } from '@playwright/test';

type MeterInput = { code: string; name: string; fuel: string; unit: string };
type Meter = MeterInput & { id: string };

// A reset can arrive after the server commits. Reconcile by the site's unique
// meter code before retrying, and never accept a conflicting fixture.
export async function createMeter(request: APIRequestContext, sitePath: string, input: MeterInput): Promise<Meter> {
  let reset: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (reset) {
      const response = await request.get(sitePath, { maxRetries: 2 });
      if (!response.ok()) throw new Error(`Meter recovery read failed: HTTP ${response.status()}`);
      const site = (await response.json()) as { meters: Meter[] };
      const existing = site.meters.find((meter) => meter.code === input.code);
      if (existing) {
        if (Object.entries(input).some(([key, value]) => existing[key as keyof MeterInput] !== value))
          throw new Error(`Conflicting meter fixture: ${input.code}`);
        return existing;
      }
    }
    try {
      const response = await request.post(`${sitePath}/meters`, {
        headers: { origin: 'http://localhost:3101' },
        data: input,
      });
      // A previous request may have committed between reconciliation and retry.
      if (reset && response.status() === 409) continue;
      if (!response.ok()) throw new Error(`Meter creation failed: HTTP ${response.status()}`);
      return (await response.json()) as Meter;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('ECONNRESET')) throw error;
      reset = error;
    }
  }
  throw reset ?? new Error('Meter fixture could not be reconciled');
}
