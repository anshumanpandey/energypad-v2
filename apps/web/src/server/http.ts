import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { auth } from './auth';
import { DomainError } from '../domain/policy';
import type { Actor } from './foundation';

export async function readBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new DomainError('CONTENT_TYPE', 'Send a JSON request.', 415);
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  if (reader) {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 16_384) {
          await reader.cancel();
          throw new DomainError('BODY_TOO_LARGE', 'This request is too large.', 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError('INVALID_JSON', 'The request is not valid JSON.');
  }
}
export async function api(request: Request, work: (actor: Actor) => Promise<unknown>, status = 200) {
  const correlationId = randomUUID();
  const headers = { 'X-Request-Id': correlationId, 'Cache-Control': 'no-store' };
  try {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const expected = new URL(process.env.AUTH_URL ?? 'http://localhost:3100').origin;
      if (request.headers.get('origin') !== expected)
        throw new DomainError('ORIGIN_REJECTED', 'The request origin is not allowed.', 403);
    }
    const session = await auth();
    if (!session?.user?.id) throw new DomainError('UNAUTHENTICATED', 'Sign in to continue.', 401);
    const result = await work({ userId: session.user.id, correlationId });
    return Response.json(result, { status, headers });
  } catch (error) {
    let issue =
      error instanceof DomainError
        ? error
        : new DomainError('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
    if (error instanceof ZodError)
      issue = new DomainError('VALIDATION_ERROR', error.issues[0]?.message ?? 'Check your input.');
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      issue = new DomainError('CONFLICT', 'This record already exists.', 409);
    if (issue.status === 500) console.error('Request failed', { correlationId });
    return Response.json(
      {
        type: `urn:energiepad:problem:${issue.code.toLowerCase()}`,
        title: issue.message,
        status: issue.status,
        code: issue.code,
        correlationId,
      },
      {
        status: issue.status,
        headers: { ...headers, 'Content-Type': 'application/problem+json' },
      },
    );
  }
}
