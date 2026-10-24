export const SHIFT_CODES = ['CA1', 'CA3'] as const;
export type ShiftCode = (typeof SHIFT_CODES)[number];

export type AttendanceStatus = 'VALID' | 'NEEDS_REVIEW';

export type EvidenceType =
  | 'SOURCE_TIMESTAMP'
  | 'WORK_SCHEDULE'
  | 'APPROVED_MAPPING'
  | 'HR_ADJUSTMENT';

export interface NormalizationEvidence {
  type: EvidenceType;
  reference: string;
}

export type ExceptionCode =
  | 'NO_ATTENDANCE'
  | 'MISSING_CHECKIN'
  | 'MISSING_CHECKOUT'
  | 'INVALID_CHECKIN_TIMESTAMP'
  | 'INVALID_CHECKOUT_TIMESTAMP'
  | 'INVALID_SHIFT'
  | 'INVALID_SHIFT_DATE'
  | 'UNRESOLVED_SHIFT_DATE'
  | 'UNRESOLVED_CHECKOUT_DATE'
  | 'EQUAL_CHECK_TIMES'
  | 'NEGATIVE_DURATION'
  | 'EXCESSIVE_DURATION'
  | 'CHECKOUT_BEFORE_SHIFT_START'
  | 'SUBSECOND_PRECISION_UNSUPPORTED'
  | 'DUPLICATE'
  | 'DUPLICATE_RULE_UNCONFIGURED'
  | 'MULTIPLE_ROWS_SAME_EMPLOYEE_SHIFT_DATE';

export interface AttendanceException {
  code: ExceptionCode;
  blocking: boolean;
  message: string;
}

export interface AttendanceInput {
  employeeCode: string;
  shiftCode: ShiftCode | string | null;
  shiftDate: string | null;
  checkInAt: string | Date | null;
  checkOutAt: string | Date | null;
  shiftDateEvidence: NormalizationEvidence | null;
  checkOutDateEvidence: NormalizationEvidence | null;
}

export interface EngineConfig {
  abnormalDurationThresholdSeconds: number;
  timezone: 'Asia/Ho_Chi_Minh';
  shiftRule?: EngineShiftRule;
}

export interface EngineShiftRule {
  scheduledStartSeconds: number;
  scheduledCompletionSeconds: number;
  breakStartSeconds: number;
  breakEndSeconds: number;
  targetWorkedSeconds: number;
  countEarlyArrivalSeconds: boolean;
  postCompletionBlockSeconds: number | null;
  sundayTierPercentage: 200 | 230 | null;
}

export interface AttendanceCalculation {
  presenceSeconds: number;
  breakSeconds: number;
  workedSeconds: number;
  lateSeconds: number;
  earlySeconds: number;
  tier100Seconds: number;
  tier130Seconds: number;
  tier150Seconds: number;
  tier200Seconds: number;
  tier210Seconds: number;
  tier230Seconds: number;
}

export interface AttendanceResult {
  status: AttendanceStatus;
  shiftCode: ShiftCode | null;
  shiftDate: string | null;
  checkInEpochSeconds: number | null;
  checkOutEpochSeconds: number | null;
  exceptions: AttendanceException[];
  calculation: AttendanceCalculation | null;
  ruleVersion: '2026-10-23-dec010';
}

export interface DuplicateCandidate {
  rowId: string;
  employeeCode: string;
  shiftDate: string | null;
  values: Readonly<Record<string, string | number | boolean | null>>;
}

export type DuplicateScope = 'WITHIN_FILE' | 'STORED_DATA';

export interface DuplicateIssue {
  code: 'DUPLICATE';
  scope: DuplicateScope;
  rowIds: string[];
  key: string;
}

export interface DuplicateDetectionResult {
  configured: boolean;
  accepted: boolean;
  issues: DuplicateIssue[];
  exceptions: AttendanceException[];
}

export type DuplicateKeyResolver = (candidate: DuplicateCandidate) => string | null;
