import type {
  AttendanceException,
  DuplicateCandidate,
  DuplicateDetectionResult,
  DuplicateIssue,
  DuplicateKeyResolver,
} from './types.js';

export function detectDuplicates(
  candidates: readonly DuplicateCandidate[],
  storedKeys: ReadonlySet<string>,
  keyResolver?: DuplicateKeyResolver,
): DuplicateDetectionResult {
  if (!keyResolver) {
    const unconfigured: AttendanceException = {
      code: 'DUPLICATE_RULE_UNCONFIGURED',
      blocking: true,
      message: 'Chưa có khóa nhận diện trùng được HR phê duyệt.',
    };
    return { configured: false, accepted: false, issues: [], exceptions: [unconfigured] };
  }

  const rowsByKey = new Map<string, string[]>();
  for (const candidate of candidates) {
    const key = keyResolver(candidate);
    if (!key) continue;
    const rows = rowsByKey.get(key) ?? [];
    rows.push(candidate.rowId);
    rowsByKey.set(key, rows);
  }

  const issues: DuplicateIssue[] = [];
  for (const [key, rowIds] of rowsByKey) {
    if (rowIds.length > 1) {
      issues.push({ code: 'DUPLICATE', scope: 'WITHIN_FILE', rowIds, key });
    }
    if (storedKeys.has(key)) {
      issues.push({ code: 'DUPLICATE', scope: 'STORED_DATA', rowIds, key });
    }
  }

  return { configured: true, accepted: issues.length === 0, issues, exceptions: [] };
}

export interface MultipleRowGroup {
  employeeCode: string;
  shiftDate: string;
  rowIds: string[];
}

export function findMultipleRowsSameEmployeeShiftDate(
  candidates: readonly DuplicateCandidate[],
): MultipleRowGroup[] {
  const groups = new Map<string, MultipleRowGroup>();
  for (const candidate of candidates) {
    if (!candidate.shiftDate) continue;
    const key = `${candidate.employeeCode}\u0000${candidate.shiftDate}`;
    const group = groups.get(key) ?? {
      employeeCode: candidate.employeeCode,
      shiftDate: candidate.shiftDate,
      rowIds: [],
    };
    group.rowIds.push(candidate.rowId);
    groups.set(key, group);
  }

  return [...groups.values()].filter((group) => group.rowIds.length > 1);
}
