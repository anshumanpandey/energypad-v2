import { WorkbookCellError, type WorkbookCellIssue } from '../domain/workbook-errors';
import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { unzipSync, zipSync } from 'fflate';
import { DomainError } from '../domain/policy';
import { siteInput, type ImportMapping, type ImportSheet, type RowIssue, type SiteInput } from '../domain/sites';
const reject = (message: string) => new DomainError('INVALID_WORKBOOK', message);
export const credentialHeader = (value: string) =>
  /password|passwd|pwd|secret|token|credential|apikey/.test(value.toLowerCase().replace(/[^a-z]/g, ''));
// Read values rather than display text: number formats must not round imported quantities.
function importCell(cell: ExcelJS.Cell): string {
  let value = cell.value;
  const location = `${cell.worksheet.name}!${cell.address}`;
  if (cell.type === ExcelJS.ValueType.Formula) {
    // ExcelJS's value getter drops falsy results; its result getter preserves zero and false.
    const result = cell.result;
    if (result === undefined || result === null)
      throw reject(
        `${location}: formula has no saved result. Recalculate and save the workbook in Excel before importing.`,
      );
    value = result;
  }
  if (value && typeof value === 'object' && 'error' in value)
    throw reject('Excel error cell. Fix the error and save the workbook before importing.');
  let text: string;
  if (value === null || value === undefined) text = '';
  else if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw reject(`${location}: invalid date.`);
    // A month-only date format represents a monthly key; other dates retain their calendar day.
    const format = (cell.numFmt ?? '').replace(/"[^"]*"|\\.|\[[^\]]*\]/g, '').toLowerCase();
    text = value.toISOString().slice(0, /y/.test(format) && /m/.test(format) && !/[dhs]/.test(format) ? 7 : 10);
  } else if (typeof value === 'object' && 'richText' in value) text = value.richText.map((part) => part.text).join('');
  else if (typeof value === 'object' && 'text' in value) text = value.text;
  else if (typeof value === 'string' || typeof value === 'boolean') text = String(value);
  else if (typeof value === 'number' && Number.isFinite(value)) text = String(value);
  else throw reject(`${location}: unsupported cell value.`);
  return text.trim();
}
export async function readWorkbook(
  bytes: Uint8Array,
  options?: {
    sheetName: string;
    cellErrors: WorkbookCellIssue[];
    headerRow?: number;
    ignoredColumns?: readonly number[] | ((headers: readonly string[]) => readonly number[]);
  },
): Promise<ImportSheet[]> {
  if (bytes.length > 2_000_000) throw reject('Upload an XLSX file smaller than 2 MB.');
  let total = 0,
    entries = 0;
  let safeBytes: Uint8Array;
  try {
    const files = unzipSync(bytes, {
      filter(file) {
        total += file.originalSize;
        if (++entries > 500 || total > 10_000_000 || /vbaProject|externalLinks/.test(file.name))
          throw reject('Workbook is too large or contains unsupported content.');
        return true;
      },
    });
    if (Object.values(files).reduce((n, file) => n + file.length, 0) > 10_000_000)
      throw reject('Workbook is too large.');
    for (const [name, content] of Object.entries(files)) {
      if (!name.endsWith('.xml')) continue;
      const xml = new TextDecoder().decode(content);
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw reject('Unsupported XML declarations.');
      if (/^xl\/worksheets\/sheet[^/]*\.xml$/.test(name)) {
        // ExcelJS treats an empty string formula cache as missing. A space preserves its
        // presence during loading and is trimmed back to empty by importCell.
        files[name] = new TextEncoder().encode(
          xml.replace(/<c\b[^>]*(?<!\/)>[\s\S]*?<\/c>/g, (cell) =>
            /^<c\b[^>]*\bt=["']str["']/.test(cell) && /<f(?:\s|>)/.test(cell)
              ? cell.replace(/<v\s*\/>|<v>\s*<\/v>/, '<v> </v>')
              : cell,
          ),
        );
        for (const match of xml.matchAll(/<c\b[^>]*\br=["']([A-Z]+)([0-9]+)["']/g)) {
          const column = [...match[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
          if (column > 50 || Number(match[2]) > 2001) throw reject('Sheet dimensions exceed the import limit.');
        }
      }
    }
    safeBytes = zipSync(files);
  } catch {
    throw reject('Use a valid XLSX file with less than 10 MB of expanded content and no macros or external links.');
  }
  const book = new ExcelJS.Workbook();
  try {
    await book.xlsx.load(Uint8Array.from(safeBytes).buffer);
  } catch {
    throw reject('The XLSX file could not be read.');
  }
  if (!book.worksheets.length || book.worksheets.length > 10) throw reject('Use 1–10 sheets.');
  const sheets: ImportSheet[] = [];
  const cellErrors: WorkbookCellIssue[] = options?.cellErrors ?? [];
  let ignoredColumns: readonly number[] = [];
  function plainCell(cell: ExcelJS.Cell, limit: number) {
    if (ignoredColumns.includes(Number(cell.col))) return '';
    try {
      const value = importCell(cell);
      if (value.length > limit) throw reject(`Use at most ${limit} characters.`);
      return value;
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      const prefix = `${cell.worksheet.name}!${cell.address}: `;
      cellErrors.push({
        sheet: cell.worksheet.name,
        cell: cell.address,
        row: Number(cell.row),
        column: Number(cell.col),
        message: error.message.startsWith(prefix) ? error.message.slice(prefix.length) : error.message,
      });
      return '';
    }
  }
  for (const sheet of book.worksheets) {
    if (options && sheet.name !== options.sheetName) continue;
    if (sheet.columnCount > 50 || sheet.rowCount > 2001)
      throw reject('Use at most 50 columns and 2,000 rows per sheet.');
    const headerRow = options?.headerRow ?? 1;
    ignoredColumns =
      typeof options?.ignoredColumns === 'function'
        ? options.ignoredColumns(
            Array.from({ length: sheet.columnCount }, (_, i) => {
              try {
                return importCell(sheet.getRow(headerRow).getCell(i + 1));
              } catch {
                return '';
              }
            }),
          )
        : (options?.ignoredColumns ?? []);
    const headers = Array.from({ length: sheet.columnCount }, (_, i) =>
      plainCell(sheet.getRow(headerRow).getCell(i + 1), 100),
    );
    const allowed = headers.map((h, i) => (!options && credentialHeader(h) ? -1 : i)).filter((i) => i >= 0);
    const rows: ImportSheet['rows'] = [];
    sheet.eachRow((row, number) => {
      if (number <= headerRow) return;
      const cells = allowed.map((i) => {
        const cell = row.getCell(i + 1);
        const value = plainCell(cell, 500);
        return value;
      });
      if (cells.some(Boolean)) rows.push({ row: number, cells });
    });
    sheets.push({ name: sheet.name, headers: allowed.map((i) => headers[i]), rows });
  }
  if (cellErrors.length && !options) throw new WorkbookCellError(cellErrors);
  return sheets;
}
export function previewRows(sheets: ImportSheet[], mapping: ImportMapping) {
  const sheet = sheets[mapping.sheet];
  if (!sheet) throw reject('Choose a sheet from this workbook.');
  const issues: RowIssue[] = [],
    records: { row: number; data: SiteInput }[] = [];
  const emailIndex = sheet.headers.findIndex((h) => h.toLowerCase() === 'businessemail');
  const emails = new Set(sheet.rows.map((r) => r.cells[emailIndex]?.toLowerCase()).filter(Boolean));
  if (emails.size && !mapping.businessEmail)
    throw reject('Choose the source business email to import into this organisation.');
  const codes = new Set<string>();
  const sourceKey = createHash('sha256').update(JSON.stringify(sheets)).digest('hex').slice(0, 32);
  for (const row of sheet.rows) {
    if (emailIndex >= 0 && mapping.businessEmail && row.cells[emailIndex]?.toLowerCase() !== mapping.businessEmail)
      continue;
    const values: Record<string, string> = {};
    for (const [field, value] of Object.entries(mapping.defaults)) if (value) values[field] = value;
    for (const [field, column] of Object.entries(mapping.columns)) {
      if (column === undefined || column >= sheet.headers.length || !sheet.headers[column])
        throw reject('Choose a valid source column.');
      if (row.cells[column]) values[field] = row.cells[column];
    }
    if (!values.code && mapping.codePrefix) values.code = `${mapping.codePrefix}-${row.row}`;
    if (!values.code) values.code = `SITE-${sourceKey}-${mapping.sheet}-${row.row}`;
    const { population, floorArea, weeklyHours, vatPercent, ...site } = values;
    const attributes = [population, floorArea, weeklyHours, vatPercent].some((v) => v !== undefined)
      ? { effectiveFrom: mapping.effectiveFrom, population, floorArea, weeklyHours, vatPercent }
      : undefined;
    const parsed = siteInput.safeParse({ ...site, attributes });
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        issues.push({
          row: row.row,
          field: issue.path.join('.'),
          message: 'Missing or invalid value. Check the field format, range and effective date.',
        });
      continue;
    }
    if (codes.has(parsed.data.code))
      issues.push({ row: row.row, field: 'code', message: 'Duplicate site code in this sheet.' });
    codes.add(parsed.data.code);
    records.push({ row: row.row, data: parsed.data });
  }
  if (!records.length && !issues.length)
    issues.push({
      row: 0,
      field: 'sheet',
      message: 'No matching site rows. Check the selected sheet and business email.',
    });
  return { records, issues };
}
