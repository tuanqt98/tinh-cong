export const ATTENDANCE_PERIOD_STATES = [
  'DRAFT',
  'REVIEWED',
  'APPROVED',
  'LOCKED',
  'PUBLISHED',
] as const;

export type AttendancePeriodState = (typeof ATTENDANCE_PERIOD_STATES)[number];

export const SYSTEM_ROLES = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export interface PageResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}
