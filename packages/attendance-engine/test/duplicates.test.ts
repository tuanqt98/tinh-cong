import { describe, expect, it } from 'vitest';
import {
  detectDuplicates,
  findMultipleRowsSameEmployeeShiftDate,
  type DuplicateCandidate,
} from '../src/index.js';

const rows: DuplicateCandidate[] = [
  {
    rowId: 'row-1',
    employeeCode: 'SYN-001',
    shiftDate: '2026-10-01',
    values: { fingerprint: 'same', checkIn: '08:00' },
  },
  {
    rowId: 'row-2',
    employeeCode: 'SYN-001',
    shiftDate: '2026-10-01',
    values: { fingerprint: 'same', checkIn: '08:00' },
  },
];

describe('duplicate policy', () => {
  it('fail-closed khi chưa cấu hình khóa trùng', () => {
    const result = detectDuplicates(rows, new Set());
    expect(result).toMatchObject({ configured: false, accepted: false });
    expect(result.exceptions[0]?.code).toBe('DUPLICATE_RULE_UNCONFIGURED');
  });

  it('T28 từ chối toàn file khi trùng trong file', () => {
    const result = detectDuplicates(rows, new Set(), (row) => String(row.values.fingerprint));
    expect(result.accepted).toBe(false);
    expect(result.issues).toEqual([
      { code: 'DUPLICATE', scope: 'WITHIN_FILE', rowIds: ['row-1', 'row-2'], key: 'same' },
    ]);
  });

  it('T29 từ chối khi trùng dữ liệu đã lưu', () => {
    const result = detectDuplicates(
      [rows[0]!],
      new Set(['same']),
      (row) => String(row.values.fingerprint),
    );
    expect(result.accepted).toBe(false);
    expect(result.issues[0]).toMatchObject({ scope: 'STORED_DATA', rowIds: ['row-1'] });
  });

  it('chấp nhận khi detector đã cấu hình và không có trùng', () => {
    const result = detectDuplicates([rows[0]!], new Set(), (row) => String(row.values.fingerprint));
    expect(result).toMatchObject({ configured: true, accepted: true, issues: [] });
  });

  it('T31 phân biệt nhiều dòng cùng NV/ngày với duplicate', () => {
    const multiple = findMultipleRowsSameEmployeeShiftDate([
      rows[0]!,
      { ...rows[1]!, values: { fingerprint: 'different', checkIn: '13:00' } },
    ]);
    expect(multiple).toEqual([
      {
        employeeCode: 'SYN-001',
        shiftDate: '2026-10-01',
        rowIds: ['row-1', 'row-2'],
      },
    ]);
  });
});
