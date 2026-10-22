import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Info,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { Badge, Button, EmptyState, cn } from '@tinh-cong/ui';

export interface ImportIssue {
  sheet?: string;
  rowNo?: number;
  code?: string;
  issueCode?: string;
  blocking?: boolean;
  field?: string;
  details?: { expectedHeader?: string };
}

export interface PreviewRow {
  sheet?: string;
  rowNo?: number;
  employeeCode?: unknown;
  employeeName?: unknown;
  departmentName?: unknown;
  attendanceDate?: unknown;
  checkIn?: unknown;
  checkOut?: unknown;
  shiftName?: unknown;
}

export interface ColumnMapping {
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  attendanceDate: string;
  checkIn: string;
  checkOut: string;
  shiftName: string;
}

const mappingFields: Array<{ key: keyof ColumnMapping; label: string }> = [
  { key: 'employeeCode', label: 'Mã nhân viên' },
  { key: 'employeeName', label: 'Tên nhân viên' },
  { key: 'departmentName', label: 'Phòng ban' },
  { key: 'attendanceDate', label: 'Ngày chấm công' },
  { key: 'checkIn', label: 'Giờ vào' },
  { key: 'checkOut', label: 'Giờ ra' },
  { key: 'shiftName', label: 'Tên ca' },
];

const headerOptions = [
  'Mã N.Viên',
  'Tên N.Viên',
  'Phòng ban',
  'Ngày',
  'Vào',
  'Ra',
  'Tên ca',
  'Mã NV',
  'Tên NV',
  'Ngày chấm công',
  'Giờ vào',
  'Giờ ra',
];

const issueLabels: Record<string, string> = {
  EQUAL_TIMESTAMPS: 'Giờ vào bằng giờ ra',
  MISSING_CHECKIN: 'Thiếu giờ vào',
  MISSING_CHECKOUT: 'Thiếu giờ ra',
  NO_ATTENDANCE: 'Không có dữ liệu vào/ra',
  INVALID_SHIFT: 'Tên ca không hợp lệ',
  ABNORMAL_DURATION: 'Thời gian hiện diện vượt ngưỡng',
  FORMULA_NOT_ALLOWED_IN_SOURCE_FIELD: 'Không cho phép công thức ở trường nguồn',
  MISSING_MAPPED_COLUMN: 'Thiếu cột bắt buộc',
  DUPLICATE: 'Dữ liệu trùng theo khóa đã duyệt',
};

const errorCodes = new Set([
  'EQUAL_TIMESTAMPS',
  'FORMULA_NOT_ALLOWED_IN_SOURCE_FIELD',
  'MISSING_MAPPED_COLUMN',
  'DUPLICATE',
]);

function issueCode(issue: ImportIssue) {
  return issue.code ?? issue.issueCode ?? 'UNKNOWN';
}

function rowKey(row: PreviewRow, index: number) {
  return `${row.sheet ?? 'sheet'}:${row.rowNo ?? index}`;
}

function issueRowKey(issue: ImportIssue) {
  return `${issue.sheet ?? 'sheet'}:${issue.rowNo ?? 0}`;
}

export function ImportStepper({ step, hasError }: { step: 1 | 2 | 3 | 4; hasError: boolean }) {
  const steps = [
    ['Tải file', 'Chọn file Excel'],
    ['Kiểm tra & ánh xạ cột', 'Xác định cấu trúc dữ liệu'],
    ['Xem trước dữ liệu', 'Kiểm tra lỗi và xác nhận'],
    ['Import', 'Lưu dữ liệu vào hệ thống'],
  ];

  return (
    <ol className="grid grid-cols-4 px-2 py-1" aria-label="Tiến trình import">
      {steps.map(([title, description], index) => {
        const number = (index + 1) as 1 | 2 | 3 | 4;
        const complete = number < step;
        const active = number === step;
        const failed = hasError && active;
        return (
          <li key={title} className="relative min-w-0 text-center">
            {index > 0 && (
              <span
                className={`absolute right-1/2 top-[17px] h-0.5 w-full ${complete || active ? 'bg-primary' : 'bg-slate-200'}`}
                aria-hidden="true"
              />
            )}
            <div
              className={`relative z-10 mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold shadow-sm ${
                failed
                  ? 'bg-red-600 text-white'
                  : complete || active
                    ? 'bg-primary text-white'
                    : 'bg-slate-200 text-slate-600'
              }`}
            >
              {complete ? <Check className="h-4 w-4" /> : number}
            </div>
            <p
              className={`mt-1.5 truncate text-[13px] font-semibold ${active ? 'text-navy' : 'text-slate-700'}`}
            >
              {title}
            </p>
            <p className="hidden truncate text-[11px] text-slate-500 sm:block">{description}</p>
          </li>
        );
      })}
    </ol>
  );
}

export function ExcelUploadZone({
  file,
  disabled,
  onFile,
  onRemove,
}: {
  file: File | null;
  disabled: boolean;
  onFile(file: File): void;
  onRemove(): void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function acceptFile(candidate: File | undefined) {
    if (candidate?.name.toLowerCase().endsWith('.xlsx')) onFile(candidate);
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:p-4">
      <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-navy">1. Tải file Excel</h2>
        {file && (
          <div className="flex max-w-[62%] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="truncate font-medium text-slate-700">{file.name}</span>
            <span className="hidden whitespace-nowrap text-slate-400 xl:inline">
              ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </span>
            <button
              type="button"
              onClick={onRemove}
              className="ml-1 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-red-600"
              aria-label="Xóa file đã chọn"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        name="file"
        type="file"
        accept=".xlsx"
        disabled={disabled}
        className="sr-only"
        onChange={(event) => acceptFile(event.target.files?.[0])}
      />
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={`flex min-h-[166px] flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center transition ${
          dragging ? 'border-primary bg-blue-50' : 'border-blue-300 bg-[#fbfdff]'
        }`}
      >
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <p className="text-sm font-bold text-navy">Kéo thả file Excel vào đây</p>
        <p className="my-1 text-xs text-slate-400">hoặc</p>
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Chọn file Excel
        </Button>
        <p className="mt-2 text-[11px] text-slate-400">Chỉ hỗ trợ định dạng .xlsx (tối đa 10 MB)</p>
      </div>

      <div className="mt-2.5 rounded-lg bg-blue-50 px-3 py-2.5 text-[11px] leading-[1.45] text-slate-600">
        <p className="mb-1 flex items-center gap-1.5 font-bold text-primary">
          <Info className="h-3.5 w-3.5" /> Yêu cầu file Excel
        </p>
        <ul className="grid gap-x-4 pl-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <li className="list-disc">File xuất từ máy chấm công</li>
          <li className="list-disc">Có đúng 7 trường nguồn</li>
          <li className="list-disc">Ngày, giờ và tên ca đúng định dạng</li>
          <li className="list-disc">Không dùng cột tính công có sẵn</li>
        </ul>
      </div>
    </section>
  );
}

export function ColumnMappingPanel({
  mapping,
  checked,
  structuralIssues,
  disabled,
  onChange,
}: {
  mapping: ColumnMapping;
  checked: boolean;
  structuralIssues: ImportIssue[];
  disabled: boolean;
  onChange(field: keyof ColumnMapping, value: string): void;
}) {
  const valid = checked && structuralIssues.length === 0;
  const checks = [
    'Tìm thấy đủ 7 cột bắt buộc',
    'Định dạng ngày hợp lệ',
    'Định dạng giờ hợp lệ',
    'Tên ca có thể kiểm tra',
    'Sẵn sàng kiểm tra dữ liệu',
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:p-4">
      <h2 className="text-[15px] font-bold text-navy">2. Ánh xạ cột dữ liệu</h2>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Chọn cột trong file Excel tương ứng với các trường dữ liệu
      </p>
      <div className="mt-3 grid gap-4 min-[1400px]:grid-cols-[minmax(0,1fr)_235px]">
        <div className="space-y-1.5">
          {mappingFields.map(({ key, label }) => (
            <label
              key={key}
              className="grid grid-cols-[116px_minmax(0,1fr)] items-center gap-2 text-xs"
            >
              <span className="font-medium text-slate-700">
                {label} <span className="text-red-500">*</span>
              </span>
              <select
                value={mapping[key]}
                disabled={disabled}
                onChange={(event) => onChange(key, event.target.value)}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-slate-50"
              >
                {[mapping[key], ...headerOptions.filter((header) => header !== mapping[key])].map(
                  (header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ),
                )}
              </select>
            </label>
          ))}
        </div>
        <div
          className={`rounded-lg px-4 py-3 ${
            valid
              ? 'bg-gradient-to-br from-emerald-50 to-white'
              : checked
                ? 'bg-gradient-to-br from-red-50 to-white'
                : 'bg-gradient-to-br from-slate-50 to-white'
          }`}
        >
          <p
            className={`flex items-center gap-2 text-xs font-bold ${valid ? 'text-emerald-700' : checked ? 'text-red-700' : 'text-slate-500'}`}
          >
            {valid ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : checked ? (
              <XCircle className="h-4 w-4" />
            ) : (
              <Info className="h-4 w-4" />
            )}
            {valid
              ? 'Cấu trúc file hợp lệ'
              : checked
                ? 'Cấu trúc cần xử lý'
                : 'Chờ kiểm tra cấu trúc'}
          </p>
          <div className="mt-4 space-y-3">
            {checks.map((label, index) => {
              const failed = checked && structuralIssues.length > 0 && index === 0;
              return (
                <p key={label} className="flex items-center gap-2 text-[11px] text-slate-600">
                  {valid ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : failed ? (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />
                  ) : (
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300" />
                  )}
                  {label}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Kpi({
  tone,
  value,
  label,
}: {
  tone: 'success' | 'danger' | 'warning';
  value: number;
  label: string;
}) {
  const styles = {
    success: 'bg-blue-50 text-primary',
    danger: 'bg-red-50 text-red-600',
    warning: 'bg-amber-50 text-amber-600',
  };
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'danger' ? AlertTriangle : Info;
  return (
    <div className={`flex min-w-[88px] items-center gap-2 rounded-lg px-2.5 py-2 ${styles[tone]}`}>
      <Icon className="h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm font-bold leading-none">{value.toLocaleString('vi-VN')}</p>
        <p className="mt-1 text-[10px] font-medium">{label}</p>
      </div>
    </div>
  );
}

export function ImportPreviewTable({
  rows,
  issues,
  totalRows,
  loading,
  onDownloadIssues,
}: {
  rows: PreviewRow[];
  issues: ImportIssue[];
  totalRows: number;
  loading: boolean;
  onDownloadIssues(): void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'valid' | 'error' | 'warning'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const issuesByRow = useMemo(() => {
    const map = new Map<string, ImportIssue[]>();
    for (const issue of issues) {
      const key = issueRowKey(issue);
      map.set(key, [...(map.get(key) ?? []), issue]);
    }
    return map;
  }, [issues]);

  function statusFor(row: PreviewRow, index: number) {
    const rowIssues = issuesByRow.get(rowKey(row, index)) ?? [];
    if (rowIssues.some((issue) => issue.blocking || errorCodes.has(issueCode(issue))))
      return 'error' as const;
    if (rowIssues.length) return 'warning' as const;
    return 'valid' as const;
  }

  const issueRows = new Set(issues.filter((issue) => issue.rowNo).map(issueRowKey));
  const errorRows = new Set(
    issues
      .filter((issue) => issue.rowNo && (issue.blocking || errorCodes.has(issueCode(issue))))
      .map(issueRowKey),
  );
  const warningRows = new Set([...issueRows].filter((key) => !errorRows.has(key)));
  const validCount = Math.max(totalRows - errorRows.size - warningRows.size, 0);

  const filtered = rows.filter((row, index) => {
    const query = search.trim().toLocaleLowerCase('vi-VN');
    const matchesSearch =
      !query ||
      [row.employeeCode, row.employeeName, row.departmentName]
        .map((value) => String(value ?? '').toLocaleLowerCase('vi-VN'))
        .some((value) => value.includes(query));
    return matchesSearch && (filter === 'all' || statusFor(row, index) === filter);
  });
  const pages = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const visibleKeys = visible.map((row, index) => rowKey(row, index));
  const allVisibleSelected =
    visibleKeys.length > 0 && visibleKeys.every((key) => selected.has(key));

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      for (const key of visibleKeys) allVisibleSelected ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-[15px] font-bold text-navy">
            3. Xem trước dữ liệu{' '}
            <span className="font-medium text-slate-500">
              ({totalRows.toLocaleString('vi-VN')} dòng)
            </span>
          </h2>
          <Kpi tone="success" value={validCount} label="Hợp lệ" />
          <Kpi tone="danger" value={errorRows.size} label="Có lỗi" />
          <Kpi tone="warning" value={warningRows.size} label="Cảnh báo" />
        </div>
        <div className="flex flex-wrap items-end gap-2 lg:justify-end">
          <label className="relative min-w-[210px] flex-1 xl:w-[250px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Tìm kiếm mã NV, tên NV, phòng ban..."
              className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
          <label className="text-[10px] font-medium text-slate-600">
            Lọc theo trạng thái
            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as typeof filter);
                setPage(1);
              }}
              className="mt-0.5 block h-9 w-40 rounded-lg border border-slate-200 bg-white px-2 text-xs"
            >
              <option value="all">Tất cả</option>
              <option value="valid">Hợp lệ</option>
              <option value="error">Có lỗi</option>
              <option value="warning">Cảnh báo</option>
            </select>
          </label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!issues.length}
            onClick={onDownloadIssues}
          >
            <Download className="h-3.5 w-3.5" /> Tải file lỗi
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 p-4" aria-label="Đang tải dữ liệu xem trước">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-9 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Chưa có dữ liệu xem trước"
          description="Chọn file, kiểm tra cấu trúc và ánh xạ cột để xem dữ liệu."
        />
      ) : (
        <div className="max-h-[230px] overflow-auto">
          <table className="w-full min-w-[1120px] text-left text-[11px]">
            <thead className="sticky top-0 z-[1] bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 px-3 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    aria-label="Chọn tất cả dòng đang hiển thị"
                  />
                </th>
                {[
                  '#',
                  'Mã NV',
                  'Tên nhân viên',
                  'Phòng ban',
                  'Ngày',
                  'Giờ vào',
                  'Giờ ra',
                  'Tên ca',
                  'Trạng thái',
                  'Thông báo lỗi/cảnh báo',
                ].map((header) => (
                  <th key={header} className="whitespace-nowrap px-3 py-1.5">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((row, index) => {
                const absoluteIndex = (safePage - 1) * pageSize + index;
                const key = rowKey(row, absoluteIndex);
                const status = statusFor(row, absoluteIndex);
                const rowIssues = issuesByRow.get(key) ?? [];
                return (
                  <tr
                    key={key}
                    className={
                      selected.has(key)
                        ? 'bg-blue-50'
                        : status === 'error'
                          ? 'bg-red-50/80'
                          : status === 'warning'
                            ? 'bg-amber-50/80'
                            : 'bg-white hover:bg-slate-50/70'
                    }
                  >
                    <td className="px-3 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(key)}
                        onChange={() =>
                          setSelected((current) => {
                            const next = new Set(current);
                            next.has(key) ? next.delete(key) : next.add(key);
                            return next;
                          })
                        }
                        aria-label={`Chọn dòng ${absoluteIndex + 1}`}
                      />
                    </td>
                    <td className="px-3 py-1 text-slate-500">{absoluteIndex + 1}</td>
                    <td className="px-3 py-1 font-medium text-navy">
                      {String(row.employeeCode ?? '—')}
                    </td>
                    <td className="px-3 py-1">{String(row.employeeName ?? '—')}</td>
                    <td className="px-3 py-1">{String(row.departmentName ?? '—')}</td>
                    <td className="whitespace-nowrap px-3 py-1">
                      {String(row.attendanceDate ?? '—')}
                    </td>
                    <td className="px-3 py-1">{String(row.checkIn ?? '—')}</td>
                    <td className="px-3 py-1">{String(row.checkOut ?? '—')}</td>
                    <td className="px-3 py-1">{String(row.shiftName ?? '—')}</td>
                    <td className="px-3 py-1">
                      <Badge
                        tone={
                          status === 'valid' ? 'success' : status === 'error' ? 'danger' : 'warning'
                        }
                      >
                        {status === 'valid' ? 'Hợp lệ' : status === 'error' ? 'Lỗi' : 'Cảnh báo'}
                      </Badge>
                    </td>
                    <td
                      className={`max-w-[260px] truncate px-3 py-1 ${status === 'error' ? 'text-red-700' : status === 'warning' ? 'text-amber-700' : 'text-slate-400'}`}
                    >
                      {rowIssues.length
                        ? rowIssues
                            .map((issue) => issueLabels[issueCode(issue)] ?? issueCode(issue))
                            .join('; ')
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-slate-100 px-3 py-2.5 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
            aria-label="Số dòng mỗi trang"
          >
            {[25, 50, 100].map((size) => (
              <option key={size} value={size}>
                Hiển thị {size} dòng
              </option>
            ))}
          </select>
          <span>
            Đang hiển thị {filtered.length ? (safePage - 1) * pageSize + 1 : 0}–
            {Math.min(safePage * pageSize, filtered.length)} / {totalRows.toLocaleString('vi-VN')}{' '}
            dòng
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(Math.max(safePage - 1, 1))}
            disabled={safePage === 1}
            className="rounded border border-slate-200 p-1.5 disabled:opacity-40"
            aria-label="Trang trước"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {Array.from({ length: Math.min(pages, 5) }, (_, index) => index + 1).map((number) => (
            <button
              key={number}
              type="button"
              onClick={() => setPage(number)}
              className={`h-7 min-w-7 rounded border px-2 ${safePage === number ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white'}`}
            >
              {number}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage(Math.min(safePage + 1, pages))}
            disabled={safePage === pages}
            className="rounded border border-slate-200 p-1.5 disabled:opacity-40"
            aria-label="Trang sau"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}

export function ImportActionBar({
  canCheck,
  canConfirm,
  checking,
  confirming,
  imported,
  onCheck,
  onBack,
  onConfirm,
}: {
  canCheck: boolean;
  canConfirm: boolean;
  checking: boolean;
  confirming: boolean;
  imported: boolean;
  onCheck(): void;
  onBack(): void;
  onConfirm(): void;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-3 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.04)] backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-5 lg:px-5">
      <Button
        type="button"
        variant="secondary"
        disabled={!canCheck || checking || confirming}
        onClick={onCheck}
      >
        <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
        {checking ? 'Đang kiểm tra…' : 'Kiểm tra lại'}
      </Button>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={checking || confirming}
          onClick={onBack}
        >
          Quay lại
        </Button>
        <Button
          type="button"
          disabled={!canConfirm || checking || confirming || imported}
          onClick={onConfirm}
        >
          {confirming ? 'Đang xác nhận…' : imported ? 'Đã import' : 'Xác nhận import'}
          {!confirming && !imported && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
