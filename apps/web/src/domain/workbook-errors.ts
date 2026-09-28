import { DomainError } from './policy';
export type WorkbookCellIssue = { sheet: string; cell: string; row: number; column: number; message: string };
export class WorkbookCellError extends DomainError {
  constructor(public cellErrors: WorkbookCellIssue[]) {
    super(
      'INVALID_WORKBOOK',
      `${cellErrors.length} cells could not be imported. Fix the listed cells and upload again. ${cellErrors[0]?.sheet}!${cellErrors[0]?.cell}: ${cellErrors[0]?.message}`,
    );
  }
}
