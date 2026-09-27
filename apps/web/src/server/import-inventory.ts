import { createHash } from 'node:crypto';
import { z } from 'zod';
import { assertWritable } from './write-freeze';
import { Prisma } from '@prisma/client';
import { DomainError, uuid } from '../domain/policy';
import { inventoryCutoff, inventoryReviewInput } from '../domain/import-inventory';
import { FoundationService, type Actor } from './foundation';

// Identifiers are an internal allowlist, never derived from a request.
const tables = [
  ['sites', 'ImportBatch'],
  ['energy', 'EnergyImportBatch'],
  ['drivers', 'DriverImportBatch'],
  ['occupancy', 'OccupancyImportBatch'],
  ['patterns', 'PatternImportBatch'],
  ['events', 'EventImportBatch'],
  ['carbon', 'CarbonWorkbookBatch'],
] as const;

type Summary = {
  kind: string;
  total: string;
  staged: string;
  committed: string;
  inconsistent: string;
  stagedBeforeCutoff: string;
  oldestCreatedAt: Date | null;
  newestCreatedAt: Date | null;
};

export class ImportInventoryService extends FoundationService {
  private async snapshot(tx: Prisma.TransactionClient, actor: Actor, organisationId: string, before: string) {
    const org = uuid.parse(organisationId);
    const cutoff = inventoryCutoff.parse(before);
    const observedAt = new Date();
    if (cutoff > observedAt) throw new DomainError('VALIDATION_ERROR', 'The cutoff cannot be in the future.');
    await this.membership(actor, org, 'retention:read', tx);
    const queries = tables.map(
      ([kind, table]) => Prisma.sql`
        SELECT ${kind}::text AS kind, count(*)::text AS total,
          count(*) FILTER (WHERE lifecycle = 'staged')::text AS staged,
          count(*) FILTER (WHERE lifecycle = 'committed')::text AS committed,
          count(*) FILTER (WHERE lifecycle = 'inconsistent')::text AS inconsistent,
          count(*) FILTER (WHERE lifecycle = 'staged' AND "createdAt" < ${cutoff})::text AS "stagedBeforeCutoff",
          min("createdAt") AS "oldestCreatedAt", max("createdAt") AS "newestCreatedAt"
        FROM (
          SELECT "createdAt", CASE
            WHEN status = 'COMMITTED' AND "committedAt" IS NOT NULL THEN 'committed'
            WHEN status IN ('UPLOADED', 'READY', 'INVALID') AND "committedAt" IS NULL THEN 'staged'
            ELSE 'inconsistent'
          END AS lifecycle
          FROM ${Prisma.raw(`"${table}"`)} WHERE "organisationId" = ${org}::uuid
        ) batches
      `,
    );
    const summaries = await tx.$queryRaw<Summary[]>(Prisma.join(queries, ' UNION ALL '));
    const evidence = {
      version: 1,
      organisationId: org,
      before: cutoff.toISOString(),
      summaries: [...summaries].sort((a, b) => a.kind.localeCompare(b.kind)),
    };
    const fingerprint = createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
    return {
      fingerprint,
      version: 1,
      organisationId: org,
      observedAt: observedAt.toISOString(),
      before: cutoff.toISOString(),
      deletionEnabled: false,
      summaries,
    };
  }
  async inconsistentBatches(actor: Actor, organisationId: string, input: unknown) {
    const org = uuid.parse(organisationId);
    const { category, cursor } = inventoryReviewInput.parse(input);
    const table = tables.find(([kind]) => kind === category)![1];
    // Only this fixed identifier allowlist is interpolated; all user values are bound.
    const source = Prisma.raw(`"${table}"`);
    const scope = Prisma.sql`"organisationId" = ${org}::uuid AND NOT (
      (status = 'COMMITTED' AND "committedAt" IS NOT NULL) OR
      (status IN ('UPLOADED', 'READY', 'INVALID') AND "committedAt" IS NULL))`;
    type Row = { id: string; status: string; createdAt: Date; committedAt: Date | null };
    return this.db.$transaction(
      async (tx) => {
        await this.membership(actor, org, 'retention:read', tx);
        let boundary = Prisma.empty;
        if (cursor) {
          const [anchor] = await tx.$queryRaw<Row[]>(Prisma.sql`
          SELECT id, "createdAt" FROM ${source} WHERE ${scope} AND id = ${cursor}::uuid`);
          if (!anchor)
            throw new DomainError(
              'NOT_FOUND',
              'This review cursor is no longer available. Refresh the inventory.',
              404,
            );
          boundary = Prisma.sql`AND ("createdAt", id) < (${anchor.createdAt}, ${anchor.id}::uuid)`;
        }
        const rows = await tx.$queryRaw<Row[]>(Prisma.sql`
        SELECT id, status, "createdAt", "committedAt" FROM ${source}
        WHERE ${scope} ${boundary} ORDER BY "createdAt" DESC, id DESC LIMIT 51`);
        const items = rows.slice(0, 50);
        return { category, items, nextCursor: rows.length > 50 ? items.at(-1)!.id : null };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async overview(actor: Actor, organisationId: string, before: string) {
    return this.db.$transaction((tx) => this.snapshot(tx, actor, organisationId, before), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }
  async exportInventory(actor: Actor, organisationId: string, before: string, fingerprint: string) {
    const expected = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(fingerprint);
    assertWritable();
    return this.db.$transaction(
      async (tx) => {
        await this.lock(tx, organisationId);
        const report = await this.snapshot(tx, actor, organisationId, before);
        if (report.fingerprint !== expected)
          throw new DomainError('STALE_INVENTORY', 'The inventory changed. Refresh it before downloading.', 409);
        await this.audit(tx, actor, organisationId, 'retention.inventory_exported', organisationId, {
          before: report.before,
          fingerprint: report.fingerprint,
          categories: report.summaries.length,
        });
        return { exportVersion: 'import-inventory-v1', ...report };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
