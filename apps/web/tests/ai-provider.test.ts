import { describe, it, expect, vi } from 'vitest';
import { OpenAIAnswerProvider } from '../src/server/ai-provider';
import type { EvidencePreview } from '../src/domain/ai-evidence';
const evidence = {
  facts: [{ id: 'postKwh', label: 'Variance', value: '-0.99', unit: 'kWh', citationId: 'source-1' }],
  citations: [{ status: 'UNVALIDATED', period: { firstMonth: '2020-01', lastMonth: '2020-12' } }],
} as EvidencePreview;
const body = {
  id: 'resp_test',
  model: 'test-model',
  status: 'completed',
  usage: { input_tokens: 30, output_tokens: 8 },
  output: [
    {
      type: 'message',
      content: [{ type: 'output_text', text: JSON.stringify({ status: 'ANSWER', factIds: ['postKwh'] }) }],
    },
  ],
};
describe('OpenAI structured evidence adapter', () => {
  it('sends only question and summary facts with no tools or server scope', async () => {
    const transport = vi.fn(async () => Response.json(body));
    const provider = new OpenAIAnswerProvider('secret-test-key', 'test-model', transport);
    expect(await provider.answer('Explain variance', evidence)).toMatchObject({
      selection: { status: 'ANSWER', factIds: ['postKwh'] },
      usage: { inputTokens: 30, outputTokens: 8 },
    });
    const [url, request] = transport.mock.calls[0] as unknown as [string, RequestInit];
    const payload = JSON.parse(String(request.body));
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(payload.store).toBe(false);
    expect(payload.tools).toBeUndefined();
    expect(payload.text.format.strict).toBe(true);
    expect(JSON.parse(payload.input)).toEqual({
      question: 'Explain variance',
      facts: [{ id: 'postKwh', label: 'Variance', value: '-0.99', unit: 'kWh' }],
      status: 'UNVALIDATED',
      period: { firstMonth: '2020-01', lastMonth: '2020-12' },
    });
  });
  it('retains known usage for refusals, truncation and invalid JSON', async () => {
    for (const [changed, code] of [
      [{ output: [{ type: 'message', content: [{ type: 'refusal' }] }] }, 'PROVIDER_REFUSED'],
      [{ status: 'incomplete' }, 'PROVIDER_INCOMPLETE'],
      [{ output: [{ type: 'message', content: [{ type: 'output_text', text: 'not JSON' }] }] }, 'INVALID_RESPONSE'],
    ] as const) {
      const provider = new OpenAIAnswerProvider('secret', 'model', async () => Response.json({ ...body, ...changed }));
      await expect(provider.answer('Question', evidence)).rejects.toMatchObject({
        code,
        metadata: { usage: { inputTokens: 30, outputTokens: 8 } },
      });
    }
  });
  it('does not expose provider error bodies or retry rate limits', async () => {
    const transport = vi.fn(async () => new Response('secret error body', { status: 429 }));
    const provider = new OpenAIAnswerProvider('secret', 'model', transport);
    await expect(provider.answer('Question', evidence)).rejects.toMatchObject({
      code: 'PROVIDER_RATE_LIMIT',
      message: 'PROVIDER_RATE_LIMIT',
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('bounds provider responses and preserves unknown usage', async () => {
    await expect(
      new OpenAIAnswerProvider('secret', 'model', async () => new Response('x'.repeat(65537))).answer(
        'Question',
        evidence,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    const result = await new OpenAIAnswerProvider('secret', 'model', async () =>
      Response.json({ ...body, usage: undefined }),
    ).answer('Question', evidence);
    expect(result.usage).toEqual({ inputTokens: null, outputTokens: null });
  });
  it('aborts stalled provider calls without retries', async () => {
    vi.useFakeTimers();
    try {
      const transport: typeof fetch = async (_url, init) =>
        new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
      const pending = new OpenAIAnswerProvider('secret', 'model', transport).answer('Question', evidence);
      const assertion = expect(pending).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' });
      await vi.advanceTimersByTimeAsync(45000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
