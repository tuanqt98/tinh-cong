import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import {
  SOURCE_FIELDS,
  SOURCE_FIELD_ALIASES,
  type ColumnMapping,
  type ImportValidationIssue,
  type ParsedSourceRow,
  type SourceField,
  type WorkbookParseResult,
} from './imports.types.js';

@Injectable()
export class ExcelParserService {
  parseMapping(value: string): ColumnMapping {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new BadRequestException('Mapping phải là JSON hợp lệ.');
    }
    if (!parsed || typeof parsed !== 'object') throw new BadRequestException('Mapping không hợp lệ.');
    const mapping = parsed as Record<string, unknown>;
    for (const field of SOURCE_FIELDS) {
      if (typeof mapping[field] !== 'string' || !String(mapping[field]).trim()) {
        throw new BadRequestException(`Thiếu mapping cho ${field}.`);
      }
    }
    return Object.fromEntries(
      SOURCE_FIELDS.map((field) => [field, String(mapping[field]).trim()]),
    ) as ColumnMapping;
  }

  async parse(buffer: Buffer, mapping: ColumnMapping): Promise<WorkbookParseResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const rows: ParsedSourceRow[] = [];
    const issues: ImportValidationIssue[] = [];

    workbook.eachSheet((worksheet) => {
      let bestHeaderRowNo = 1;
      let maxMatchedFields = 0;
      const searchLimit = Math.min(worksheet.rowCount, 20);

      for (let r = 1; r <= searchLimit; r++) {
        const candidateRow = worksheet.getRow(r);
        const cellTexts = new Set<string>();
        candidateRow.eachCell((cell) => {
          const val = this.cellToScalar(cell.value).value;
          if (val !== null && val !== undefined) {
            cellTexts.add(String(val).trim());
          }
        });
        let matchedCount = 0;
        for (const field of SOURCE_FIELDS) {
          const target = mapping[field];
          if (cellTexts.has(target) || (SOURCE_FIELD_ALIASES[field] ?? []).some((alias) => cellTexts.has(alias))) {
            matchedCount++;
          }
        }
        if (matchedCount > maxMatchedFields) {
          maxMatchedFields = matchedCount;
          bestHeaderRowNo = r;
        }
      }

      const headerRow = worksheet.getRow(bestHeaderRowNo);
      const headers = new Map<string, number>();
      headerRow.eachCell((cell, columnNumber) => {
        const header = this.cellToScalar(cell.value).value;
        if (header !== null) headers.set(String(header).trim(), columnNumber);
      });

      const resolvedColumns = new Map<SourceField, number>();
      const missingHeaders: SourceField[] = [];

      for (const field of SOURCE_FIELDS) {
        const target = mapping[field];
        if (headers.has(target)) {
          resolvedColumns.set(field, headers.get(target)!);
        } else {
          const alias = (SOURCE_FIELD_ALIASES[field] ?? []).find((a) => headers.has(a));
          if (alias) {
            resolvedColumns.set(field, headers.get(alias)!);
          } else {
            missingHeaders.push(field);
          }
        }
      }

      for (const field of missingHeaders) {
        issues.push({
          sheet: worksheet.name,
          rowNo: bestHeaderRowNo,
          code: 'MISSING_MAPPED_COLUMN',
          blocking: true,
          field,
          details: { expectedHeader: mapping[field] },
        });
      }
      if (missingHeaders.length) return;

      worksheet.eachRow((row, rowNo) => {
        if (rowNo <= bestHeaderRowNo) return;
        const values = {} as Record<SourceField, string | number | boolean | null>;
        const rawCells: Record<string, string | number | boolean | null> = {};
        let hasValue = false;

        for (const field of SOURCE_FIELDS) {
          const column = resolvedColumns.get(field)!;
          const converted = this.cellToScalar(row.getCell(column).value);
          values[field] = converted.value;
          const headerName = mapping[field];
          rawCells[headerName] = converted.value;
          if (converted.value !== null && converted.value !== '') hasValue = true;
          if (converted.formula) {
            issues.push({
              sheet: worksheet.name,
              rowNo,
              code: 'FORMULA_NOT_ALLOWED_IN_SOURCE_FIELD',
              blocking: true,
              field,
            });
          }
        }
        if (!hasValue) return;

        const parsedRow: ParsedSourceRow = {
          sheet: worksheet.name,
          rowNo,
          employeeCode: this.asText(values.employeeCode),
          employeeName: this.asText(values.employeeName),
          departmentName: this.asText(values.departmentName),
          attendanceDate: this.asText(values.attendanceDate),
          checkIn: this.asText(values.checkIn),
          checkOut: this.asText(values.checkOut),
          shiftName: this.asText(values.shiftName),
          rawCells,
        };
        rows.push(parsedRow);
        this.validateRequired(parsedRow, issues);
      });
    });

    if (workbook.worksheets.length === 0) {
      issues.push({ sheet: '', rowNo: 0, code: 'WORKBOOK_HAS_NO_SHEETS', blocking: true });
    }
    return { sheets: workbook.worksheets.map((sheet) => sheet.name), rows, issues };
  }

  private validateRequired(row: ParsedSourceRow, issues: ImportValidationIssue[]) {
    for (const field of ['employeeCode', 'employeeName', 'departmentName'] as const) {
      if (!row[field]) {
        issues.push({ sheet: row.sheet, rowNo: row.rowNo, code: 'MISSING_REQUIRED_VALUE', blocking: true, field });
      }
    }
    if (!row.shiftName || row.shiftName === '--') {
      issues.push({ sheet: row.sheet, rowNo: row.rowNo, code: 'INVALID_SHIFT', blocking: false, field: 'shiftName' });
    }
    if (!row.checkIn && !row.checkOut) {
      issues.push({ sheet: row.sheet, rowNo: row.rowNo, code: 'NO_ATTENDANCE', blocking: false });
    } else {
      if (!row.checkIn) issues.push({ sheet: row.sheet, rowNo: row.rowNo, code: 'MISSING_CHECKIN', blocking: false });
      if (!row.checkOut) issues.push({ sheet: row.sheet, rowNo: row.rowNo, code: 'MISSING_CHECKOUT', blocking: false });
    }
  }

  private cellToScalar(value: ExcelJS.CellValue): {
    value: string | number | boolean | null;
    formula: boolean;
  } {
    if (value === null || value === undefined) return { value: null, formula: false };
    if (value instanceof Date) {
      if (
        value.getUTCHours() === 0 &&
        value.getUTCMinutes() === 0 &&
        value.getUTCSeconds() === 0 &&
        value.getUTCMilliseconds() === 0
      ) {
        return { value: value.toISOString().slice(0, 10), formula: false };
      }
      return { value: value.toISOString(), formula: false };
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return { value, formula: false };
    }
    if ('formula' in value || 'sharedFormula' in value) return { value: null, formula: true };
    if ('richText' in value) {
      return { value: value.richText.map((item) => item.text).join(''), formula: false };
    }
    if ('text' in value) return { value: value.text, formula: false };
    if ('error' in value) return { value: null, formula: false };
    return { value: String(value), formula: false };
  }

  private asText(value: string | number | boolean | null): string | null {
    if (value === null) return null;
    const text = String(value).trim();
    return text.length ? text : null;
  }
}
