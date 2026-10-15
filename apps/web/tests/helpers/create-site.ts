import type { APIRequestContext } from '@playwright/test';

type SiteInput = { code: string; name: string };
type Site = SiteInput & { id: string };

// Never blindly replay a creation whose response may have been lost after commit.
export async function createSite(request: APIRequestContext, sitesPath: string, input: SiteInput): Promise<Site> {
  let reset: Error | undefined;
  for (let attempt = 0; attempt <= 3; attempt++) {
    if (reset) {
      const response = await request.get(sitesPath, { maxRetries: 2 });
      if (!response.ok()) throw new Error(`Site recovery read failed: HTTP ${response.status()}`);
      const sites = (await response.json()) as Site[];
      const existing = sites.find((site) => site.code === input.code);
      if (existing) {
        if (existing.name !== input.name) throw new Error(`Conflicting site fixture: ${input.code}`);
        return existing;
      }
    }
    if (attempt === 3) break;
    try {
      const response = await request.post(sitesPath, {
        headers: { origin: 'http://localhost:3101' },
        data: input,
      });
      if (reset && response.status() === 409) continue;
      if (!response.ok()) throw new Error(`Site creation failed: HTTP ${response.status()}`);
      return (await response.json()) as Site;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('ECONNRESET')) throw error;
      reset = error;
    }
  }
  throw reset ?? new Error('Site fixture could not be reconciled');
}
