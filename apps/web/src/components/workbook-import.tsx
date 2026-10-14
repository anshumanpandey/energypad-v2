import { ApiImportSource } from './api-import-source';
import { ImportReview } from './import-review';

export function WorkbookImport({ orgId }: { orgId: string }) {
  return (
    <div className="import-sources">
      <ApiImportSource orgId={orgId} disabled={false} />
      <ImportReview orgId={orgId} />
    </div>
  );
}
