import { describe, expect, it, vi } from 'vitest';
import { opportunityInput, opportunityReviewInput, opportunityWorkInput } from '../src/domain/opportunities';
import { supportingEvidenceInput } from '../src/domain/opportunity-supporting';
import { verificationInput } from '../src/domain/opportunity-verification';
import { opportunityBodyLimits } from '../src/server/opportunity-body-limits';
import { readBody } from '../src/server/http';

// Body reading uses the real HTTP implementation; no authentication or database
// is needed to validate its byte boundary.
vi.mock('../src/server/auth', () => ({ auth: vi.fn() }));
const id = '10000000-0000-4000-8000-000000000001';
const requestKey = id;
function fixtures(text: (length: number) => string) {
  const common = { previousId: id, eventId: id, workVersionId: id, actionId: id, note: text(2000), requestKey };
  const provenance = { energyUseId: id, source: text(500), legacySource: text(200), legacyId: text(200) };
  return [
    {
      name: 'create',
      schema: opportunityInput,
      limit: opportunityBodyLimits.create,
      input: { runId: id, carbonRunId: id, title: text(160), rationale: text(4000), requestKey },
    },
    {
      name: 'review',
      schema: opportunityReviewInput,
      limit: opportunityBodyLimits.review,
      input: {
        previousId: id,
        workVersionId: id,
        verificationId: id,
        status: 'IN_PROGRESS',
        note: text(4000),
        requestKey,
      },
    },
    {
      name: 'work',
      schema: opportunityWorkInput,
      limit: opportunityBodyLimits.work,
      input: {
        previousId: id,
        eventId: id,
        ownerMembershipId: id,
        note: text(4000),
        requestKey,
        actions: Array.from({ length: 20 }, (_, index) => ({
          id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          title: text(200),
          ownerMembershipId: id,
          dueDate: '2026-12-31',
          status: 'DONE',
          completionEvidence: text(2000),
        })),
      },
    },
    {
      name: 'verification',
      schema: verificationInput,
      limit: opportunityBodyLimits.verification,
      input: {
        previousId: id,
        eventId: id,
        workVersionId: id,
        runId: id,
        carbonRunId: id,
        implementationDate: '2020-12-31',
        note: text(4000),
        references: Array(10).fill(text(500)),
        requestKey,
      },
    },
    {
      name: 'programme',
      schema: supportingEvidenceInput,
      limit: opportunityBodyLimits.supporting,
      input: {
        ...common,
        ...provenance,
        kind: 'PROGRAMME',
        title: text(200),
        question: text(2000),
        answers: Array(20).fill(text(1000)),
      },
    },
    {
      name: 'tip',
      schema: supportingEvidenceInput,
      limit: opportunityBodyLimits.supporting,
      input: { ...common, ...provenance, kind: 'TIP', category: text(200), text: text(2500), month: '2026-09' },
    },
    {
      name: 'log',
      schema: supportingEvidenceInput,
      limit: opportunityBodyLimits.supporting,
      input: { ...common, kind: 'LOG', operationalEventId: id },
    },
  ];
}
function jsonRequest(body: string) {
  return new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}
function escapeStrings(json: string) {
  // Escape keys, UUIDs and every UTF-16 code unit, not just non-ASCII values.
  return json.replace(
    /"(?:\\.|[^"\\])*"/g,
    (token) =>
      '"' +
      (JSON.parse(token) as string)
        .split('')
        .map((char) => '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'))
        .join('') +
      '"',
  );
}
describe('opportunity request byte budgets', () => {
  for (const [encoding, sample] of [
    ['UTF-8', '界'],
    ['astral Unicode', '🌍'],
    ['JSON controls', '\u0000'],
    ['quotes and backslashes', '"\\'],
    ['lone surrogate', '\ud800'],
    ['fully escaped JSON', '界'],
  ]) {
    for (const fixture of fixtures((length) => sample.repeat(Math.ceil(length / sample.length)).slice(0, length))) {
      it(`accepts maximum ${fixture.name} fields with ${encoding}`, async () => {
        const json = JSON.stringify(fixture.input);
        const body = encoding === 'fully escaped JSON' ? escapeStrings(json) : json;
        expect(fixture.schema.safeParse(fixture.input).success).toBe(true);
        expect(Buffer.byteLength(body)).toBeLessThanOrEqual(fixture.limit);
        expect(await readBody(jsonRequest(body), fixture.limit)).toEqual(fixture.input);
      });
    }
  }
  for (const [name, limit] of Object.entries(opportunityBodyLimits)) {
    it(`accepts exactly the ${name} cap and rejects one byte over it`, async () => {
      const exact = '{}' + ' '.repeat(limit - 2);
      expect(await readBody(jsonRequest(exact), limit)).toEqual({});
      await expect(readBody(jsonRequest(exact + ' '), limit)).rejects.toMatchObject({
        code: 'BODY_TOO_LARGE',
        status: 413,
      });
    });
  }
  it('counts streamed bytes across chunks and cancels an oversized body without trusting Content-Length', async () => {
    let cancelled = false;
    let chunk = 0;
    const request = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '2' },
      body: new ReadableStream({
        pull(controller) {
          controller.enqueue(new Uint8Array(chunk++ === 0 ? 16_384 : 1));
        },
        cancel() {
          cancelled = true;
        },
      }),
      duplex: 'half',
    } as RequestInit & { duplex: string });
    await expect(readBody(request)).rejects.toMatchObject({ code: 'BODY_TOO_LARGE', status: 413 });
    expect(cancelled).toBe(true);
  });
  it('retains content-type, JSON syntax and schema field limits', async () => {
    await expect(readBody(new Request('http://localhost/test', { method: 'POST', body: '{}' }))).rejects.toMatchObject({
      status: 415,
    });
    await expect(readBody(jsonRequest('{'))).rejects.toMatchObject({ code: 'INVALID_JSON' });
    const input = fixtures((length) => '界'.repeat(length))[0].input;
    const decoded = await readBody(
      jsonRequest(JSON.stringify({ ...input, rationale: '界'.repeat(4001) })),
      opportunityBodyLimits.create,
    );
    expect(opportunityInput.safeParse(decoded).success).toBe(false);
  });
});
