import { z } from 'zod';
import { AIEvidenceService } from './ai-evidence';
import { type Actor, type Mailer } from './foundation';
import type { PrismaClient } from '@prisma/client';
import { DomainError, hasFeature } from '../domain/policy';
import { type EvidencePreview, resolveEvidenceSelection } from '../domain/ai-evidence';
import { snapshotHash } from './analysis/contract';
import { type AnswerProvider, ProviderFailure, selectionSchema, promptVersion } from './ai-provider';
const inputSchema = z
  .object({ previewId: z.uuid(), question: z.string().trim().min(5).max(2000), requestKey: z.uuid() })
  .strict();
export class AIGenerationService extends AIEvidenceService {
  constructor(
    db: PrismaClient,
    mail: Mailer,
    url: string,
    private provider: AnswerProvider | null,
    private dailyLimit = 20,
  ) {
    super(db, mail, url);
    if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 1000) throw Error('Invalid AI daily limit');
  }
  async availability(actor: Actor, org: string, siteId: string) {
    return this.db.$transaction(async (tx) => {
      await this.evidenceAccess(tx, actor, org, siteId);
      const tenant = await tx.organisation.findUniqueOrThrow({ where: { id: org } });
      return { configured: !!this.provider, entitled: hasFeature(tenant.planKey, 'ai'), dailyLimit: this.dailyLimit };
    });
  }
  async generationHistory(actor: Actor, org: string, siteId: string) {
    return this.db.$transaction(async (tx) => {
      await this.evidenceAccess(tx, actor, org, siteId);
      return tx.aIGeneration.findMany({
        where: { organisationId: org, siteId, authorId: actor.userId },
        include: { outcome: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 20,
      });
    });
  }
  async generate(actor: Actor, org: string, siteId: string, input: unknown) {
    const data = inputSchema.parse(input),
      requestHash = snapshotHash({ actorId: actor.userId, org, siteId, ...data });
    const reserved = await this.db.$transaction(async (tx) => {
      await this.lock(tx, org);
      await this.evidenceAccess(tx, actor, org, siteId);
      const retry = await tx.aIGeneration.findUnique({
        where: { organisationId_requestKey: { organisationId: org, requestKey: data.requestKey } },
        include: { outcome: true, preview: true },
      });
      if (retry) {
        if (retry.authorId !== actor.userId || retry.requestHash !== requestHash)
          throw new DomainError('REQUEST_CONFLICT', 'This request key was used for a different answer.', 409);
        return { row: retry, fresh: false };
      }
      const tenant = await tx.organisation.findUniqueOrThrow({ where: { id: org } });
      if (!hasFeature(tenant.planKey, 'ai'))
        throw new DomainError('AI_ENTITLEMENT', 'AI answers are not included in this workspace plan.', 403);
      if (!this.provider)
        throw new DomainError('AI_NOT_CONFIGURED', 'An AI provider and model must be configured.', 503);
      const preview = await tx.aIInteraction.findFirst({
        where: { id: data.previewId, organisationId: org, siteId, authorId: actor.userId },
      });
      if (!preview) throw new DomainError('NOT_FOUND', 'This evidence preview is not available.', 404);
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      if (
        (await tx.aIGeneration.count({ where: { organisationId: org, createdAt: { gte: today } } })) >= this.dailyLimit
      )
        throw new DomainError('AI_LIMIT', 'The workspace daily AI attempt limit has been reached.', 429);
      const row = await tx.aIGeneration.create({
        data: {
          organisationId: org,
          siteId,
          authorId: actor.userId,
          previewId: preview.id,
          promptHash: snapshotHash(data.question),
          promptVersion,
          model: this.provider.model,
          requestKey: data.requestKey,
          requestHash,
        },
        include: { outcome: true, preview: true },
      });
      await this.audit(tx, actor, org, 'ai.generation_reserved', row.id, {
        siteId,
        previewId: preview.id,
        promptHash: row.promptHash,
        promptVersion,
        model: row.model,
      });
      return { row, fresh: true };
    });
    const publicRow = ({ preview: _preview, ...row }: typeof reserved.row) => {
      void _preview;
      return row;
    };
    if (!reserved.fresh) return publicRow(reserved.row);
    const evidence = reserved.row.preview.result as unknown as EvidencePreview;
    let status = 'FAILED',
      result: Record<string, unknown> = { code: 'PROVIDER_ERROR', usage: null };
    try {
      const reply = await this.provider!.answer(data.question, evidence);
      result = {
        usage: reply.usage,
        responseId: reply.responseId,
        model: reply.model,
        provider: 'openai',
        providerCalls: 1,
      };
      try {
        const selection = selectionSchema.parse(reply.selection);
        if (selection.status === 'INSUFFICIENT' && selection.factIds.length) throw Error('Invalid insufficient result');
        const facts =
          selection.status === 'ANSWER' ? resolveEvidenceSelection({ factIds: selection.factIds }, evidence) : [];
        status = selection.status;
        result = {
          ...result,
          version: 'grounded-answer-v1',
          facts,
          citations: evidence.citations,
          limitations: evidence.limitations.slice(1),
        };
      } catch {
        result = { ...result, code: 'INVALID_CITATIONS' };
      }
    } catch (e) {
      const failure = e instanceof ProviderFailure ? e : new ProviderFailure('PROVIDER_ERROR');
      result = {
        code: failure.code,
        usage: failure.metadata?.usage ?? null,
        responseId: failure.metadata?.responseId ?? null,
        model: failure.metadata?.model ?? reserved.row.model,
        provider: 'openai',
        providerCalls: 1,
      };
    }
    // Finalize usage even if the caller loses access during the external call. Never expose the result without reauthorization.
    const outcome = await this.db.$transaction(async (tx) => {
      const row = await tx.aIGenerationOutcome.create({
        data: { generationId: reserved.row.id, status, result: JSON.parse(JSON.stringify(result)) },
      });
      await this.audit(tx, actor, org, 'ai.generation_completed', reserved.row.id, {
        siteId,
        status,
        resultHash: snapshotHash(result),
      });
      return row;
    });
    await this.db.$transaction((tx) => this.evidenceAccess(tx, actor, org, siteId));
    return { ...publicRow(reserved.row), outcome };
  }
}
