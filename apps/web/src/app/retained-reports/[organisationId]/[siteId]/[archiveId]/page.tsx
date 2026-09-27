import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageActor, accessible } from '@/server/page-auth';
import { reportArchiveService } from '@/server/services';
import { uuid } from '@/domain/policy';
import { reportFields } from '@/domain/analytics-report';
import { writesFrozen, freezeMessage } from '@/server/write-freeze';
export const dynamic = 'force-dynamic';
export default async function RetainedReportPage({
  params,
}: {
  params: Promise<{ organisationId: string; siteId: string; archiveId: string }>;
}) {
  const { organisationId, siteId, archiveId } = await params;
  if (![organisationId, siteId, archiveId].every((id) => uuid.safeParse(id).success)) notFound();
  const returnTo = `/retained-reports/${organisationId}/${siteId}/${archiveId}`;
  const { actor } = await pageActor(returnTo);
  if (writesFrozen())
    return (
      <main className="panel">
        <h1>Report access paused</h1>
        <p>{freezeMessage}</p>
      </main>
    );
  const report = await accessible(() => reportArchiveService.view(actor, organisationId, siteId, archiveId));
  const download = `/api/v1/organisations/${organisationId}/sites/${siteId}/report-archives/${archiveId}`;
  return (
    <main className="stack-form" style={{ maxWidth: 1100, margin: '32px auto', padding: 20 }}>
      <Link href={`/org/${organisationId}/reports`}>Back to Reports</Link>
      <section className="panel stack-form" aria-label="Retained report snapshot">
        <span className="eyebrow">RETAINED SNAPSHOT</span>
        <h1>{report.family[0].toUpperCase() + report.family.slice(1)} report</h1>
        <p>
          {report.period.firstMonth} – {report.period.lastMonth} · {report.status}
        </p>
        <p>{report.note}</p>
        <p>
          This is the saved snapshot, not a new calculation. This page address can be shared manually; opening it
          requires sign-in and current access to this site.
        </p>
        <div className="button-row">
          <a href={`${download}?format=json`}>Download retained JSON</a>
          <a href={`${download}?format=csv`}>Download retained CSV</a>
        </div>
        <dl>
          {Object.entries(report.summary).map(([key, value]) => (
            <div key={key}>
              <dt>{key.replace(/([a-z])([A-Z])/g, '$1 $2')}</dt>
              <dd style={{ overflowWrap: 'anywhere' }}>
                {value === null ? 'Unavailable' : String(value)} {value !== null ? (report.units[key] ?? '') : ''}
              </dd>
            </div>
          ))}
        </dl>
        <details>
          <summary>Snapshot values and evidence</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {reportFields(report).map((field) => (
                  <tr key={field.path}>
                    <td>{field.path}</td>
                    <td>{field.value === null ? 'Unavailable' : String(field.value)}</td>
                    <td>{field.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </main>
  );
}
