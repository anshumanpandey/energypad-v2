import { describe, expect, it } from 'vitest';
import { auditExportCsv, type AuditPageExport } from '../src/domain/audit-export';

const report: AuditPageExport = {
  exportVersion: 'audit-page-v1',
  organisationId: 'org',
  exportedAt: '2026-09-26T00:00:00.000Z',
  filters: { action: 'test.activity' },
  cursor: 'previous',
  nextCursor: 'next',
  pageSize: 100,
  items: [
    {
      id: 'id',
      createdAt: new Date('2020-01-01T00:00:00Z'),
      actorUserId: 'actor',
      action: 'test.activity',
      targetId: '=HYPERLINK("bad")',
      correlationId: 'request',
      metadata: { note: 'quoted,"value"\nnext line' },
    },
  ],
};

describe('audit page CSV', () => {
  it('retains page scope, next cursor and UTC evidence timestamps', () => {
    const csv = auditExportCsv(report);
    expect(csv).toContain('"PAGE","audit-page-v1","org"');
    expect(csv).toContain('"previous","next","100","1"');
    expect(csv).toContain('"2020-01-01T00:00:00.000Z"');
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"{""note"":');
    expect(report.items[0].targetId).toBe('=HYPERLINK("bad")');
  });
  it('retains a page record for empty results and protects all text cells', () => {
    const csv = auditExportCsv({
      ...report,
      filters: {},
      items: [],
      cursor: null,
      nextCursor: null,
      organisationId: '\t=private',
    });
    expect(csv).toContain('"\'\t=private"');
    expect(csv.trimEnd().split('\r\n')).toHaveLength(2);
    expect(csv).toContain('"100","0"');
  });
});
