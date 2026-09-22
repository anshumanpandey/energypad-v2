'use client';
import { workbookFields, parseTemplateText, type WorkbookKind } from '@/domain/workbook-template';
import { Button } from './ui/button';
export function downloadMapping(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
export async function workbookSelection(form: HTMLFormElement) {
  const data = new FormData(form);
  const params = new URLSearchParams();
  const name = String(data.get('sheetName') ?? '').trim();
  if (name) params.set('sheet', name);
  const file = data.get('mappingTemplate');
  if (file instanceof File && file.size) {
    if (file.size > 16_384) throw new Error('Use a mapping template smaller than 16 KB.');
    params.set('template', JSON.stringify(parseTemplateText(await file.text())));
  }
  return params.toString();
}
export function WorkbookTemplateFields({ kind }: { kind: Exclude<WorkbookKind, 'consumption'> }) {
  return (
    <>
      <p>
        Select one sheet per batch. Other worksheets remain outside this import. A saved version 1 JSON template can map
        source headers and explicit defaults.
      </p>
      <label>
        Worksheet name (required for multiple sheets unless supplied by a template)
        <input name="sheetName" maxLength={31} />
      </label>
      <label>
        Saved mapping template (optional)
        <input name="mappingTemplate" type="file" accept=".json,application/json" />
      </label>
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          downloadMapping(
            {
              version: 1,
              kind,
              sheetName: kind === 'drivers' ? 'Drivers' : 'Patterns',
              columns: Object.fromEntries(workbookFields[kind].map((field) => [field, field])),
              defaults: {},
            },
            `${kind}-mapping-v1.json`,
          )
        }
      >
        Download {kind} mapping template v1
      </Button>
    </>
  );
}

export type WorkbookSelection = {
  version: number;
  kind: WorkbookKind;
  sheetName: string;
  excludedSheets: string[];
  columns: Record<string, string>;
  defaults: Record<string, string>;
};
export function WorkbookSelectionSummary({ selection }: { selection?: WorkbookSelection }) {
  if (!selection) return null;
  const { excludedSheets, ...template } = selection;
  return (
    <div className="stack-form">
      <p>
        Selected sheet: {selection.sheetName}. Excluded sheets: {excludedSheets.join(', ') || 'None'}. Mapping version:{' '}
        {selection.version}.
      </p>
      <Button
        type="button"
        variant="secondary"
        onClick={() => downloadMapping(template, `${selection.kind}-mapping-v1.json`)}
      >
        Save this mapping template
      </Button>
    </div>
  );
}
