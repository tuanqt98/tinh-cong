export const SOURCE_FIELDS = [
  'employeeCode',
  'employeeName',
  'departmentName',
  'attendanceDate',
  'checkIn',
  'checkOut',
  'shiftName',
] as const;

export type SourceField = (typeof SOURCE_FIELDS)[number];
export type ColumnMapping = Record<SourceField, string>;

export const SOURCE_FIELD_ALIASES: Record<SourceField, readonly string[]> = {
  employeeCode: ['Mã N.Viên', 'Mã NV', 'Mã nhân viên', 'Mã NVien', 'Ma NV', 'Mã NV.'],
  employeeName: ['Tên N.Viên', 'Họ tên', 'Họ và tên', 'Tên nhân viên', 'Ten NV', 'Tên NV.'],
  departmentName: ['Phòng ban', 'Bộ phận', 'Phong ban', 'Bo phan'],
  attendanceDate: ['Ngày', 'Ngày chấm công', 'Ngay cham cong', 'Ngay'],
  checkIn: ['Vào', 'Giờ vào', 'Gio vao', 'Vao'],
  checkOut: ['Ra', 'Giờ ra', 'Gio ra', 'Ra'],
  shiftName: ['Tên ca', 'Ca', 'Ca làm việc', 'Ten ca'],
};

export interface ParsedSourceRow {
  sheet: string;
  rowNo: number;
  employeeCode: string | null;
  employeeName: string | null;
  departmentName: string | null;
  attendanceDate: string | null;
  checkIn: string | null;
  checkOut: string | null;
  shiftName: string | null;
  rawCells: Record<string, string | number | boolean | null>;
}

export interface ImportValidationIssue {
  sheet: string;
  rowNo: number;
  code: string;
  blocking: boolean;
  field?: SourceField;
  details?: Record<string, unknown>;
}

export interface WorkbookParseResult {
  sheets: string[];
  rows: ParsedSourceRow[];
  issues: ImportValidationIssue[];
}

export interface UploadedWorkbook {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
