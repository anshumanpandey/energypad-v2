import { DateInput } from './ui/date-input';
import { writesFrozen } from '@/server/write-freeze';
import Link from 'next/link';
import { ZodError } from 'zod';
import { DomainError } from '@/domain/policy';
import { inventoryCutoff, inventoryReviewInput } from '@/domain/import-inventory';
import type { Actor } from '@/server/foundation';
import { accessible } from '@/server/page-auth';
import { importInventoryService } from '@/server/services';
import { Button } from './ui/button';

const labels: Record<string, string> = {
  sites: 'Site imports',
  energy: 'Energy imports',
  drivers: 'Driver imports',
  occupancy: 'Occupancy imports',
  patterns: 'Operating patterns',
  events: 'Operational events',
  carbon: 'Carbon workbooks',
};
const timestamp = (value: Date | null) =>
  value ? `${value.toISOString().slice(0, 19).replace('T', ' ')} UTC` : 'No batches';

export async function ImportRetention({
  actor,
  orgId,
  query,
}: {
  actor: Actor;
  orgId: string;
  query: Record<string, string | string[] | undefined>;
}) {
  const path = `/org/${orgId}/import-retention`;
  let report: Awaited<ReturnType<typeof importInventoryService.overview>> | undefined;
  let review: Awaited<ReturnType<typeof importInventoryService.inconsistentBatches>> | undefined;
  let error: string | undefined;
  const date = typeof query.beforeDate === 'string' ? query.beforeDate : '';
  if (Object.keys(query).length) {
    try {
      if (
        Object.keys(query).some((key) => !['beforeDate', 'category', 'cursor'].includes(key)) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
      )
        throw new DomainError('VALIDATION_ERROR', 'Choose one valid cutoff date.');
      const reviewInput =
        query.category !== undefined || query.cursor !== undefined
          ? inventoryReviewInput.parse({ category: query.category, cursor: query.cursor })
          : undefined;
      const cutoff = inventoryCutoff.parse(`${date}T00:00:00Z`);
      report = await accessible(() => importInventoryService.overview(actor, orgId, cutoff.toISOString()));
      if (reviewInput)
        review = await accessible(() => importInventoryService.inconsistentBatches(actor, orgId, reviewInput));
    } catch (issue) {
      if (issue instanceof ZodError) error = 'Choose a valid cutoff date and review category.';
      else if (issue instanceof DomainError && issue.status === 400) error = issue.message;
      else throw issue;
    }
  }
  const reviewUrl = (category: string, cursor?: string) =>
    `${path}?${new URLSearchParams({ beforeDate: date, category, ...(cursor ? { cursor } : {}) })}#inconsistent-batches`;
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <h2>Review stored imports</h2>
          <span className="tag">Read only</span>
        </div>
        <p>
          Choose a date to count staged batches created before midnight UTC on that date. No retention period is
          assumed.
        </p>
        <form key={date} method="GET" action={path} className="retention-filter">
          <label htmlFor="retention-before">
            Created before (UTC)
            <DateInput
              id="retention-before"
              type="date"
              name="beforeDate"
              required
              defaultValue={date}
              max={new Date().toISOString().slice(0, 10)}
              aria-describedby="retention-help"
            />
          </label>
          <Button type="submit">Review imports</Button>
          <Link href={path} prefetch={false}>
            Clear
          </Link>
        </form>
        <p id="retention-help">
          Age alone does not make a batch safe to delete. Active previews, provenance and retry records may still be
          needed.
        </p>
        {error && <p role="alert">{error}</p>}
        {!report && !error && <p>Select a cutoff date to load the inventory.</p>}
      </section>
      {report && (
        <>
          <p>
            Snapshot: {timestamp(new Date(report.observedAt))}. Cutoff: {timestamp(new Date(report.before))}{' '}
            (exclusive).
          </p>
          {writesFrozen() ? (
            <p className="notice">
              Inventory downloads are paused during maintenance because they require an audit record.
            </p>
          ) : (
            <p>
              <a
                href={`/api/v1/organisations/${orgId}/import-inventory/export?${new URLSearchParams({ before: report.before, fingerprint: report.fingerprint })}`}
              >
                Download inventory JSON
              </a>{' '}
              — contains these aggregate counts and dates; each download is audited.
            </p>
          )}
          <div className="retention-grid">
            {report.summaries.map((row) => (
              <section className="panel retention-card" key={row.kind} aria-label={labels[row.kind]}>
                <h2>{labels[row.kind]}</h2>
                <dl>
                  <div className="retention-highlight">
                    <dt>Staged before cutoff</dt>
                    <dd>{row.stagedBeforeCutoff}</dd>
                  </div>
                  <div>
                    <dt>Total batches</dt>
                    <dd>{row.total}</dd>
                  </div>
                  <div>
                    <dt>Staged (all dates)</dt>
                    <dd>{row.staged}</dd>
                  </div>
                  <div>
                    <dt>Committed</dt>
                    <dd>{row.committed}</dd>
                  </div>
                  <div>
                    <dt>Inconsistent records</dt>
                    <dd>{row.inconsistent}</dd>
                  </div>
                </dl>
                {row.inconsistent !== '0' && (
                  <p className="notice">
                    Review inconsistent records before making retention decisions.{' '}
                    <Link href={reviewUrl(row.kind)} prefetch={false}>
                      Inspect records
                    </Link>
                  </p>
                )}
                <p>
                  <strong>Oldest:</strong> {timestamp(row.oldestCreatedAt)}
                  <br />
                  <strong>Newest:</strong> {timestamp(row.newestCreatedAt)}
                </p>
              </section>
            ))}
          </div>
        </>
      )}
      {review && (
        <section className="panel" id="inconsistent-batches" aria-label="Inconsistent batch records">
          <h2>{labels[review.category]}: inconsistent records</h2>
          <p>
            All creation dates are included. This list is refreshed independently from the aggregate snapshot. These
            metadata records are not deletion candidates.
          </p>
          {review.items.length === 0 && <p>No inconsistent records remain in this category.</p>}
          {review.items.map((batch) => (
            <div className="retention-batch" key={batch.id}>
              <dl>
                <div>
                  <dt>Batch ID</dt>
                  <dd>
                    <code>{batch.id}</code>
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{batch.status}</dd>
                </div>
                <div>
                  <dt>Created (UTC)</dt>
                  <dd>{timestamp(batch.createdAt)}</dd>
                </div>
                <div>
                  <dt>Committed (UTC)</dt>
                  <dd>{batch.committedAt ? timestamp(batch.committedAt) : 'Not recorded'}</dd>
                </div>
              </dl>
            </div>
          ))}
          <nav aria-label="Inconsistent record pages" className="retention-filter">
            {query.cursor && (
              <Link href={reviewUrl(review.category)} prefetch={false}>
                Latest records
              </Link>
            )}
            {review.nextCursor && (
              <Link href={reviewUrl(review.category, review.nextCursor)} prefetch={false}>
                Older records
              </Link>
            )}
            <Link href={`${path}?${new URLSearchParams({ beforeDate: date })}`} prefetch={false}>
              Close record review
            </Link>
          </nav>
        </section>
      )}
      <section className="panel">
        <h2>What these counts include</h2>
        <p>
          All seven workbook-import categories, including archived sites. Carbon workbooks include emissions, carbon
          targets, monthly targets and monitoring.
        </p>
        <p>
          Staged means an uploaded, ready or invalid batch without a commit timestamp. Committed batches have both
          committed status and a timestamp. Other combinations are shown as inconsistent.
        </p>
        <p>
          Counts describe batches, not spreadsheet rows or storage size. Imported content is not displayed. Legacy
          migration receipts, saved reports, audit history and backups are outside this inventory.
        </p>
        <div className="notice">
          Deletion is not enabled. Retention periods and cleanup rules still require a decision.
        </div>
      </section>
    </>
  );
}
