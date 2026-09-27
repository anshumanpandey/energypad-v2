import { csvCell } from './carbon-report';

export type AuditPageExport = {
  exportVersion: 'audit-page-v1';
  organisationId: string;
  exportedAt: string;
  filters: { action?: string; requestId?: string };
  cursor: string | null;
  nextCursor: string | null;
  pageSize: 100;
  items: {
    id: string;
    createdAt: Date | string;
    actorUserId: string;
    action: string;
    targetId: string;
    correlationId: string;
    metadata: unknown;
  }[];
};

export function auditExportCsv(report: AuditPageExport) {
  const columns = [
    'recordType',
    'exportVersion',
    'organisationId',
    'exportedAt',
    'actionFilter',
    'requestIdFilter',
    'cursor',
    'nextCursor',
    'pageSize',
    'eventCount',
    'eventId',
    'createdAt',
    'actorUserId',
    'action',
    'targetId',
    'requestId',
    'metadata',
  ];
  const common = [
    report.exportVersion,
    report.organisationId,
    report.exportedAt,
    report.filters.action ?? '',
    report.filters.requestId ?? '',
    report.cursor ?? '',
    report.nextCursor ?? '',
    report.pageSize,
    report.items.length,
  ];
  // The PAGE row preserves scope and pagination even when the result is empty.
  const rows = [
    columns,
    ['PAGE', ...common, '', '', '', '', '', '', ''],
    ...report.items.map((event) => [
      'EVENT',
      ...common,
      event.id,
      event.createdAt instanceof Date ? event.createdAt.toISOString() : event.createdAt,
      event.actorUserId,
      event.action,
      event.targetId,
      event.correlationId,
      JSON.stringify(event.metadata),
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
