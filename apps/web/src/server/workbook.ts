import ExcelJS from 'exceljs';
import { unzipSync, zipSync } from 'fflate';
import { DomainError } from '../domain/policy';
import { siteInput, type ImportMapping, type ImportSheet, type RowIssue, type SiteInput } from '../domain/sites';
const reject = (message: string) => new DomainError('INVALID_WORKBOOK', message);
export const credentialHeader = (value: string) =>
  /password|passwd|pwd|secret|token|credential|apikey/.test(value.toLowerCase().replace(/[^a-z]/g, ''));
export async function readWorkbook(bytes: Uint8Array): Promise<ImportSheet[]> {
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
  for (const sheet of book.worksheets) {
    if (sheet.columnCount > 50 || sheet.rowCount > 2001)
      throw reject('Use at most 50 columns and 2,000 rows per sheet.');
    const headers = Array.from({ length: sheet.columnCount }, (_, i) =>
      sheet
        .getRow(1)
        .getCell(i + 1)
        .text.trim(),
    );
    if (headers.some((h) => h.length > 100)) throw reject('Column headings must be at most 100 characters.');
    const allowed = headers.map((h, i) => (credentialHeader(h) ? -1 : i)).filter((i) => i >= 0);
    const rows: ImportSheet['rows'] = [];
    sheet.eachRow((row, number) => {
      if (number === 1) return;
      const cells = allowed.map((i) => {
        const cell = row.getCell(i + 1);
        if (cell.formula || cell.type === ExcelJS.ValueType.Error)
          throw reject('Replace formulas and error cells with plain values before importing.');
        const value = cell.text.trim();
        if (value.length > 500) throw reject('Each cell must contain at most 500 characters.');
        return value;
      });
      if (cells.some(Boolean)) rows.push({ row: number, cells });
    });
    sheets.push({ name: sheet.name, headers: allowed.map((i) => headers[i]), rows });
  }
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
