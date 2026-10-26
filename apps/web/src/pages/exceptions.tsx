import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileClock,
  Info,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, EmptyState, ErrorState, Skeleton, cn } from '@tinh-cong/ui';
import { api, apiBlob } from '../api.js';
import { useApiQuery } from '../use-api-query.js';

type ExceptionStatus = 'OPEN' | 'RESOLVED';
type ExceptionSeverity = 'BLOCKING' | 'WARNING' | 'INFO';

interface Period {
  id: string;
  year: number;
  month: number;
  status: string;
  version: number;
}

interface Department {
  id: string;
  code: string;
  name: string;
}

interface ExceptionCodeItem {
  id: string;
  code: string;
  description: string;
  blocking: boolean;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  details: unknown;
  createdAt: string;
  updatedAt: string;
  resolutions: Array<{
    action: string;
    reason: string;
    createdAt: string;
    actor: { id: string; username: string };
  }>;
}

interface ExceptionRow {
  id: string;
  employeeId: string | null;
  employeeCode: string;
  employeeName: string;
  departmentId: string | null;
  departmentName: string | null;
  attendanceDate: string | null;
  shiftDate: string | null;
  shiftCode: string | null;
  checkIn: string | null;
  checkOut: string | null;
  normalizedCheckInAt: string | null;
  normalizedCheckOutAt: string | null;
  normalizationRevision: number | null;
  calculationRevision: number | null;
  calculationStatus: string | null;
  workedSeconds: number | null;
  lateCount: number | null;
  earlyCount: number | null;
  period: Period | null;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  exceptions: ExceptionCodeItem[];
}

interface ExceptionListResponse {
  items: ExceptionRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface ExceptionSummary {
  totalRecords: number;
  totalCodes: number;
  blockingRecords: number;
  warningRecords: number;
  infoRecords: number;
  resolvedRecords: number;
  openRecords: number;
  workflowEnabled: boolean;
}

interface Calculation {
  id?: string;
  revision?: number;
  status?: string;
  presenceSeconds: number | null;
  breakSeconds: number | null;
  workedSeconds: number | null;
  tier100Seconds: number | null;
  tier130Seconds: number | null;
  tier150Seconds: number | null;
  tier200Seconds: number | null;
  tier210Seconds: number | null;
  tier230Seconds: number | null;
  lateCount: number | null;
  earlyCount: number | null;
}

interface ExceptionDetail {
  id: string;
  status: ExceptionStatus;
  severity: ExceptionSeverity;
  workflowEnabled: boolean;
  employee: {
    id: string | null;
    code: string;
    name: string;
    position: string | null;
    department: { id: string | null; code: string | null; name: string } | null;
  };
  period: (Period & { lockedAt?: string | null; publishedAt?: string | null }) | null;
  raw: {
    importId: string;
    fileName: string;
    mappingVersion: string;
    importedAt: string;
    sheet: string;
    rowNo: number;
    attendanceDate: string | null;
    checkIn: string | null;
    checkOut: string | null;
    shiftName: string | null;
    cells: unknown;
  };
  normalization: {
    revision: number;
    shiftDate: string | null;
    checkInAt: string | null;
    checkOutAt: string | null;
    shiftCode: string | null;
    shiftDateEvidence: unknown;
    checkOutDateEvidence: unknown;
    ruleVersion: string;
  } | null;
  calculation: Calculation | null;
  exceptions: ExceptionCodeItem[];
  adjustments: Array<{
    id: string;
    revision: number;
    before: unknown;
    after: unknown;
    reason: string;
    createdAt: string;
    actor: { id: string; username: string };
  }>;
  history: Array<{
    id: string;
    type: 'ADJUSTMENT' | 'RESOLUTION' | 'AUDIT';
    action: string;
    reason: string | null;
    before: unknown;
    after: unknown;
    createdAt: string;
    actor: { id: string; username: string } | null;
  }>;
  version: number;
}

interface PreviewResponse {
  persisted: false;
  inputVersion: number;
  before: Calculation | null;
  preview: {
    status: string;
    calculation: Calculation | null;
    exceptions: Array<{ code: string; message: string; blocking: boolean }>;
  };
  remainingBlockingCodes: string[];
}

interface Filters {
  search: string;
  month: string;
  departmentId: string;
  shiftCode: string;
  code: string;
  severity: string;
  status: string;
}

const EMPTY_FILTERS: Filters = {
  search: '',
  month: '',
  departmentId: '',
  shiftCode: '',
  code: '',
  severity: '',
  status: 'OPEN',
};

const ERROR_LABELS: Record<string, string> = {
  MISSING_CHECKIN: 'Thiếu giờ vào',
  MISSING_CHECKOUT: 'Thiếu giờ ra',
  INVALID_SHIFT: 'Ca không hợp lệ',
  INVALID_SHIFT_DATE: 'Ngày ca không hợp lệ',
  INVALID_CHECKIN_TIMESTAMP: 'Giờ vào không hợp lệ',
  INVALID_CHECKOUT_TIMESTAMP: 'Giờ ra không hợp lệ',
  UNRESOLVED_SHIFT_DATE: 'Ngày ca chưa có căn cứ',
  UNRESOLVED_CHECKOUT_DATE: 'Ngày ra chưa có căn cứ',
  DUPLICATE: 'Dữ liệu trùng',
  MULTIPLE_ROWS_SAME_EMPLOYEE_DATE: 'Nhiều dòng cùng ngày',
  MULTIPLE_ROWS_SAME_EMPLOYEE_SHIFT_DATE: 'Nhiều dòng cùng ngày/ca',
  EQUAL_CHECK_TIMES: 'Giờ vào bằng giờ ra',
  NEGATIVE_DURATION: 'Thời lượng âm',
  EXCESSIVE_DURATION: 'Hiện diện trên 16 giờ',
  NO_ATTENDANCE: 'Không có chấm công',
  EMPLOYEE_NOT_FOUND: 'Thiếu hồ sơ nhân viên',
  SHIFT_RULE_NOT_FOUND: 'Thiếu quy tắc ca',
};

function queryFromFilters(filters: Filters, page: number, pageSize: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

function filtersFromSearchParams(params: URLSearchParams): Filters {
  return {
    search: params.get('search') ?? '',
    month: params.get('month') ?? '',
    departmentId: params.get('departmentId') ?? '',
    shiftCode: params.get('shiftCode') ?? '',
    code: params.get('code') ?? '',
    severity: params.get('severity') ?? '',
    status: params.get('status') ?? 'OPEN',
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : value;
}

function formatTime(value: string | null | undefined) {
  if (!value) return '—';
  const iso = value.match(/T(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}:${iso[2]}`;
  const short = value.match(/^(\d{1,2}):(\d{2})/);
  return short?.[1] && short[2] ? `${short[1].padStart(2, '0')}:${short[2]}` : value;
}

function formatHours(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return '—';
  return `${(seconds / 3600).toFixed(2)} giờ`;
}

function severityLabel(value: ExceptionSeverity) {
  if (value === 'BLOCKING') return 'Lỗi chặn';
  if (value === 'WARNING') return 'Cần kiểm tra';
  return 'Thông tin';
}

function exceptionLabel(code: string) {
  return ERROR_LABELS[code] ?? code.replaceAll('_', ' ').toLocaleLowerCase('vi-VN');
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] font-medium text-slate-500">{label}</span>
      <select
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-navy outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  icon: typeof AlertTriangle;
  tone: 'red' | 'amber' | 'blue' | 'green' | 'slate';
}) {
  const styles = {
    red: 'border-red-100 bg-red-50/60 text-red-600',
    amber: 'border-amber-100 bg-amber-50/60 text-amber-600',
    blue: 'border-blue-100 bg-blue-50/60 text-blue-600',
    green: 'border-emerald-100 bg-emerald-50/60 text-emerald-600',
    slate: 'border-slate-200 bg-white text-slate-600',
  }[tone];
  return (
    <Card className="min-w-0 rounded-xl shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
      <div className="flex h-[78px] items-center gap-3 px-4">
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
            styles,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[11px] text-slate-500">{label}</span>
          <span className="mt-0.5 block text-xl font-extrabold leading-none text-navy">
            {value}
          </span>
          {hint && <span className="mt-1 block truncate text-[9px] text-slate-400">{hint}</span>}
        </span>
      </div>
    </Card>
  );
}

function SeverityBadge({ severity }: { severity: ExceptionSeverity }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold',
        severity === 'BLOCKING' && 'bg-red-50 text-red-600',
        severity === 'WARNING' && 'bg-amber-50 text-amber-700',
        severity === 'INFO' && 'bg-blue-50 text-blue-700',
      )}
    >
      {severityLabel(severity)}
    </span>
  );
}

function StatusBadge({ status }: { status: ExceptionStatus }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold',
        status === 'OPEN' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700',
      )}
    >
      {status === 'OPEN' ? 'Chưa xử lý' : 'Đã xử lý'}
    </span>
  );
}

function DetailDrawer({ id, onClose }: { id: string; onClose(): void }) {
  const [tab, setTab] = useState<'INFO' | 'DATA' | 'HISTORY'>('INFO');
  const [reason, setReason] = useState('');
  const [shiftCode, setShiftCode] = useState('');
  const [shiftDate, setShiftDate] = useState('');
  const [checkInAt, setCheckInAt] = useState('');
  const [checkOutAt, setCheckOutAt] = useState('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadedDetailId, setLoadedDetailId] = useState<string | null>(null);
  const detailQuery = useQuery({
    queryKey: ['exception-detail', id],
    queryFn: () => api<ExceptionDetail>(`/exceptions/${id}`),
  });
  const detail = detailQuery.data;

  if (detail && loadedDetailId !== detail.id) {
    setLoadedDetailId(detail.id);
    setShiftCode(detail.normalization?.shiftCode ?? detail.raw.shiftName ?? '');
    setShiftDate(detail.normalization?.shiftDate?.slice(0, 10) ?? detail.raw.attendanceDate ?? '');
    setCheckInAt(detail.normalization?.checkInAt ?? '');
    setCheckOutAt(detail.normalization?.checkOutAt ?? '');
    setPreview(null);
    setPreviewError(null);
    setReason('');
  }

  async function calculatePreview() {
    setPreviewing(true);
    setPreviewError(null);
    try {
      const result = await api<PreviewResponse>(`/exceptions/${id}/preview`, {
        method: 'POST',
        body: JSON.stringify({
          shiftCode: shiftCode || null,
          shiftDate: shiftDate || null,
          checkInAt: checkInAt || null,
          checkOutAt: checkOutAt || null,
        }),
      });
      setPreview(result);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Không thể tính thử.');
    } finally {
      setPreviewing(false);
    }
  }

  const calculation = preview?.preview.calculation ?? detail?.calculation ?? null;
  const scheduled = shiftCode.toUpperCase() === 'CA3' ? ['19:00', '07:00'] : ['07:00', '19:00'];
  const mutationLocked =
    !detail?.workflowEnabled || ['LOCKED', 'PUBLISHED'].includes(detail.period?.status ?? '');

  return (
    <>
      <button
        aria-label="Đóng chi tiết ngoại lệ"
        className="fixed inset-0 top-[58px] z-30 bg-slate-950/25 xl:hidden"
        onClick={onClose}
      />
      <aside
        aria-label="Chi tiết ngoại lệ"
        className="fixed bottom-0 right-0 top-[58px] z-40 flex w-full flex-col border-l border-slate-200 bg-white shadow-[-12px_0_30px_rgba(15,23,42,0.12)] sm:w-[390px]"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
          <div>
            <h2 className="text-base font-bold text-navy">Chi tiết ngoại lệ</h2>
            <p className="text-[10px] text-slate-400">Dữ liệu nguồn luôn được giữ nguyên</p>
          </div>
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            aria-label="Đóng drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {detailQuery.isLoading && (
          <div className="space-y-3 p-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-10" />
            <Skeleton className="h-64" />
          </div>
        )}
        {detailQuery.isError && (
          <div className="p-4">
            <ErrorState message={detailQuery.error.message} />
          </div>
        )}
        {detail && (
          <>
            <div className="shrink-0 p-3 pb-0">
              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-primary">
                    <UserRound className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-navy">
                      {detail.employee.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      Mã NV: {detail.employee.code}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
                        {detail.employee.department?.name ?? 'Chưa có phòng ban'}
                      </span>
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700">
                        {detail.normalization?.shiftCode ?? detail.raw.shiftName ?? 'Chưa rõ ca'}
                      </span>
                    </div>
                  </div>
                  <SeverityBadge severity={detail.severity} />
                </div>
                <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-2.5">
                  <div>
                    <div className="text-[10px] text-slate-500">Ngày chấm công</div>
                    <div className="mt-0.5 text-sm font-bold text-navy">
                      {formatDate(detail.normalization?.shiftDate ?? detail.raw.attendanceDate)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500">Kỳ công</div>
                    <div className="mt-0.5 text-xs font-semibold text-navy">
                      {detail.period
                        ? `${String(detail.period.month).padStart(2, '0')}/${detail.period.year} · ${detail.period.status}`
                        : 'Chưa xác định'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 flex shrink-0 border-b border-slate-200 px-3">
              {[
                ['INFO', 'Thông tin'],
                ['DATA', 'Dữ liệu chi tiết'],
                ['HISTORY', `Lịch sử (${detail.history.length})`],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={cn(
                    'flex-1 border-b-2 px-2 py-2.5 text-[11px] font-semibold',
                    tab === value
                      ? 'border-primary text-primary'
                      : 'border-transparent text-slate-500 hover:text-navy',
                  )}
                  onClick={() => setTab(value as typeof tab)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {tab === 'INFO' && (
                <div className="space-y-4">
                  {!detail.workflowEnabled && (
                    <div
                      role="alert"
                      className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-4 text-amber-800"
                    >
                      Workflow điều chỉnh đang khóa do Q10/Q11 chưa được phê duyệt. Bạn vẫn có thể
                      xem dữ liệu và tính thử, nhưng không thể lưu thay đổi.
                    </div>
                  )}

                  <section>
                    <h3 className="mb-2 text-xs font-bold text-navy">Dữ liệu chấm công</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-red-100 bg-red-50/50 p-2.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <Clock3 className="h-3.5 w-3.5 text-red-500" />
                          Giờ vào thực tế
                        </div>
                        <div className="mt-1 text-lg font-bold text-red-600">
                          {formatTime(detail.raw.checkIn)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2.5">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <Clock3 className="h-3.5 w-3.5 text-emerald-600" />
                          Giờ ra thực tế
                        </div>
                        <div className="mt-1 text-lg font-bold text-emerald-700">
                          {formatTime(detail.raw.checkOut)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                      <div>
                        <span className="block text-slate-400">Ca làm việc</span>
                        <span className="mt-1 block rounded-md border bg-white px-2 py-1.5 font-semibold">
                          {shiftCode || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-slate-400">Bắt đầu chuẩn</span>
                        <span className="mt-1 block rounded-md border bg-white px-2 py-1.5 font-semibold">
                          {scheduled[0]}
                        </span>
                      </div>
                      <div>
                        <span className="block text-slate-400">Kết thúc chuẩn</span>
                        <span className="mt-1 block rounded-md border bg-white px-2 py-1.5 font-semibold">
                          {scheduled[1]}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 text-xs font-bold text-navy">Phân tích hiện tại</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-red-100 bg-red-50/40 p-2">
                        <span className="block text-[9px] text-red-500">Lượt đi muộn</span>
                        <strong className="mt-1 block text-xs text-red-600">
                          {calculation?.lateCount ?? 0} lượt
                        </strong>
                      </div>
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-2">
                        <span className="block text-[9px] text-emerald-600">Lượt về sớm</span>
                        <strong className="mt-1 block text-xs text-emerald-700">
                          {calculation?.earlyCount ?? 0} lượt
                        </strong>
                      </div>
                      <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-2">
                        <span className="block text-[9px] text-blue-600">Giờ tính công</span>
                        <strong className="mt-1 block text-xs text-blue-700">
                          {formatHours(calculation?.workedSeconds)}
                        </strong>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 text-xs font-bold text-navy">
                      Các lỗi phát hiện ({detail.exceptions.length})
                    </h3>
                    <div className="space-y-1.5">
                      {detail.exceptions.map((item) => (
                        <div key={item.id} className="rounded-lg border border-slate-200 p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <code className="text-[10px] font-bold text-red-600">{item.code}</code>
                            <div className="flex gap-1">
                              <SeverityBadge severity={item.severity} />
                              <StatusBadge status={item.status} />
                            </div>
                          </div>
                          <p className="mt-1 text-[10px] leading-4 text-slate-600">
                            {item.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 text-xs font-bold text-navy">Đề xuất điều chỉnh</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] text-slate-500">
                        Ca đề xuất
                        <select
                          aria-label="Ca đề xuất"
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"
                          value={shiftCode}
                          onChange={(event) => setShiftCode(event.target.value)}
                        >
                          <option value="">Chưa xác định</option>
                          <option value="CA1">Ca 1</option>
                          <option value="CA3">Ca 3</option>
                        </select>
                      </label>
                      <label className="text-[10px] text-slate-500">
                        Ngày ca
                        <input
                          aria-label="Ngày ca đề xuất"
                          type="date"
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                          value={shiftDate}
                          onChange={(event) => setShiftDate(event.target.value)}
                        />
                      </label>
                      <label className="text-[10px] text-slate-500">
                        Timestamp vào
                        <input
                          aria-label="Giờ vào đề xuất"
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                          value={checkInAt}
                          onChange={(event) => setCheckInAt(event.target.value)}
                          placeholder="YYYY-MM-DDTHH:mm:ss+07:00"
                        />
                      </label>
                      <label className="text-[10px] text-slate-500">
                        Timestamp ra
                        <input
                          aria-label="Giờ ra đề xuất"
                          className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs"
                          value={checkOutAt}
                          onChange={(event) => setCheckOutAt(event.target.value)}
                          placeholder="YYYY-MM-DDTHH:mm:ss+07:00"
                        />
                      </label>
                    </div>
                    <label className="mt-2 block text-[10px] text-slate-500">
                      Lý do xử lý <span className="text-red-500">*</span>
                      <textarea
                        aria-label="Lý do xử lý"
                        className="mt-1 min-h-16 w-full resize-y rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-primary"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Nhập lý do xử lý..."
                      />
                    </label>
                  </section>

                  {previewError && <ErrorState message={previewError} />}
                  {preview && (
                    <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-navy">Kết quả tính thử</h3>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[9px] font-semibold',
                            preview.preview.status === 'VALID'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700',
                          )}
                        >
                          {preview.preview.status}
                        </span>
                      </div>
                      {preview.preview.calculation ? (
                        <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2 text-[10px]">
                          <span>
                            Hiện diện
                            <strong className="block text-navy">
                              {formatHours(preview.preview.calculation.presenceSeconds)}
                            </strong>
                          </span>
                          <span>
                            Nghỉ
                            <strong className="block text-navy">
                              {formatHours(preview.preview.calculation.breakSeconds)}
                            </strong>
                          </span>
                          <span>
                            Tính công
                            <strong className="block text-navy">
                              {formatHours(preview.preview.calculation.workedSeconds)}
                            </strong>
                          </span>
                          <span>
                            100%
                            <strong className="block text-emerald-700">
                              {formatHours(preview.preview.calculation.tier100Seconds)}
                            </strong>
                          </span>
                          <span>
                            130%
                            <strong className="block text-violet-700">
                              {formatHours(preview.preview.calculation.tier130Seconds)}
                            </strong>
                          </span>
                          <span>
                            150%
                            <strong className="block text-orange-700">
                              {formatHours(preview.preview.calculation.tier150Seconds)}
                            </strong>
                          </span>
                          <span>
                            200%
                            <strong className="block text-rose-700">
                              {formatHours(preview.preview.calculation.tier200Seconds)}
                            </strong>
                          </span>
                          <span>
                            210%
                            <strong className="block text-pink-700">
                              {formatHours(preview.preview.calculation.tier210Seconds)}
                            </strong>
                          </span>
                          <span>
                            230%
                            <strong className="block text-fuchsia-700">
                              {formatHours(preview.preview.calculation.tier230Seconds)}
                            </strong>
                          </span>
                        </div>
                      ) : (
                        <p className="mt-2 text-[10px] text-red-700">
                          Còn lỗi chặn:{' '}
                          {preview.remainingBlockingCodes.join(', ') || 'Không xác định'}
                        </p>
                      )}
                      <p className="mt-2 text-[9px] text-slate-500">
                        Tính thử không ghi dữ liệu và không đổi trạng thái kỳ công.
                      </p>
                    </section>
                  )}
                </div>
              )}

              {tab === 'DATA' && (
                <div className="space-y-4 text-xs">
                  <section>
                    <h3 className="mb-2 font-bold text-navy">Dữ liệu nguồn bất biến</h3>
                    <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 rounded-xl border border-slate-200 p-3">
                      <dt className="text-slate-500">File Excel</dt>
                      <dd className="break-all font-medium">{detail.raw.fileName}</dd>
                      <dt className="text-slate-500">Sheet / dòng</dt>
                      <dd>
                        {detail.raw.sheet} / {detail.raw.rowNo}
                      </dd>
                      <dt className="text-slate-500">Ngày nguồn</dt>
                      <dd>{detail.raw.attendanceDate ?? '—'}</dd>
                      <dt className="text-slate-500">Giờ vào / ra</dt>
                      <dd>
                        {detail.raw.checkIn ?? '—'} / {detail.raw.checkOut ?? '—'}
                      </dd>
                      <dt className="text-slate-500">Tên ca nguồn</dt>
                      <dd>{detail.raw.shiftName ?? '—'}</dd>
                      <dt className="text-slate-500">Mapping</dt>
                      <dd>{detail.raw.mappingVersion}</dd>
                    </dl>
                  </section>
                  <section>
                    <h3 className="mb-2 font-bold text-navy">Dữ liệu chuẩn hóa</h3>
                    {detail.normalization ? (
                      <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 rounded-xl border border-slate-200 p-3">
                        <dt className="text-slate-500">Ngày ca</dt>
                        <dd>{formatDate(detail.normalization.shiftDate)}</dd>
                        <dt className="text-slate-500">Timestamp vào</dt>
                        <dd className="break-all">{detail.normalization.checkInAt ?? '—'}</dd>
                        <dt className="text-slate-500">Timestamp ra</dt>
                        <dd className="break-all">{detail.normalization.checkOutAt ?? '—'}</dd>
                        <dt className="text-slate-500">Ca</dt>
                        <dd>{detail.normalization.shiftCode ?? '—'}</dd>
                        <dt className="text-slate-500">Rule</dt>
                        <dd>{detail.normalization.ruleVersion}</dd>
                        <dt className="text-slate-500">Revision</dt>
                        <dd>{detail.normalization.revision}</dd>
                      </dl>
                    ) : (
                      <EmptyState description="Bản ghi chưa có dữ liệu chuẩn hóa hợp lệ." />
                    )}
                  </section>
                  <section>
                    <h3 className="mb-2 font-bold text-navy">Raw cells</h3>
                    <pre className="max-h-52 overflow-auto rounded-xl bg-slate-950 p-3 text-[10px] leading-4 text-slate-200">
                      {JSON.stringify(detail.raw.cells, null, 2)}
                    </pre>
                  </section>
                </div>
              )}

              {tab === 'HISTORY' && (
                <div>
                  {detail.history.length ? (
                    <ol className="space-y-3 border-l border-slate-200 pl-4">
                      {detail.history.map((item) => (
                        <li
                          key={`${item.type}-${item.id}`}
                          className="relative rounded-lg border border-slate-200 p-3 text-xs before:absolute before:-left-[21px] before:top-4 before:h-2.5 before:w-2.5 before:rounded-full before:bg-primary before:ring-4 before:ring-white"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <strong className="text-navy">{item.action}</strong>
                            <span className="text-[9px] text-slate-400">
                              {new Date(item.createdAt).toLocaleString('vi-VN')}
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {item.actor?.username ?? 'Hệ thống'} · {item.type}
                          </p>
                          {item.reason && (
                            <p className="mt-2 rounded-md bg-slate-50 p-2 text-[10px] leading-4 text-slate-600">
                              {item.reason}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <EmptyState description="Chưa có lịch sử xử lý cho bản ghi này." />
                  )}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white p-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void calculatePreview()}
                disabled={previewing}
              >
                {previewing ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}{' '}
                Tính thử
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={onClose}>
                  Đóng
                </Button>
                <Button
                  size="sm"
                  disabled={mutationLocked || !reason.trim()}
                  title={
                    mutationLocked
                      ? 'Workflow đang khóa theo Q10/Q11 hoặc kỳ đã bất biến.'
                      : undefined
                  }
                >
                  Lưu xử lý
                </Button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

export function ExceptionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilters = filtersFromSearchParams(searchParams);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get('pageSize')) || 15);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const queryString = queryFromFilters(appliedFilters, page, pageSize);
  const summaryParams = new URLSearchParams(queryString);
  summaryParams.delete('page');
  summaryParams.delete('pageSize');

  const listQuery = useApiQuery<ExceptionListResponse | ExceptionRow[]>(
    ['exceptions', queryString],
    `/exceptions?${queryString}`,
  );
  const summaryQuery = useApiQuery<ExceptionSummary | unknown[]>(
    ['exception-summary', summaryParams.toString()],
    `/exceptions/summary?${summaryParams.toString()}`,
  );
  const periodsQuery = useApiQuery<Period[]>(['periods'], '/periods');
  const departmentsQuery = useApiQuery<Department[]>(['departments'], '/departments');
  const response: ExceptionListResponse = Array.isArray(listQuery.data)
    ? { items: listQuery.data, total: listQuery.data.length, page: 1, pageSize }
    : (listQuery.data ?? { items: [], total: 0, page, pageSize });
  const summary = (!Array.isArray(summaryQuery.data) ? summaryQuery.data : null) ?? {
    totalRecords: response.total,
    totalCodes: response.items.reduce((sum, item) => sum + item.exceptions.length, 0),
    blockingRecords: response.items.filter((item) => item.severity === 'BLOCKING').length,
    warningRecords: response.items.filter((item) => item.severity === 'WARNING').length,
    infoRecords: response.items.filter((item) => item.severity === 'INFO').length,
    resolvedRecords: response.items.filter((item) => item.status === 'RESOLVED').length,
    openRecords: response.items.filter((item) => item.status === 'OPEN').length,
    workflowEnabled: false,
  };
  const totalPages = Math.max(1, Math.ceil(response.total / pageSize));
  const errorCodes = useMemo(
    () =>
      [
        ...new Set(
          response.items.flatMap((item) => item.exceptions.map((exception) => exception.code)),
        ),
      ].sort(),
    [response.items],
  );

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function applyFilters() {
    setAppliedFilters(filters);
    setPage(1);
    const params = new URLSearchParams(queryFromFilters(filters, 1, pageSize));
    setSearchParams(params, { replace: true });
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
    setSearchParams(new URLSearchParams(queryFromFilters(EMPTY_FILTERS, 1, pageSize)), {
      replace: true,
    });
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    setSearchParams(new URLSearchParams(queryFromFilters(appliedFilters, nextPage, pageSize)), {
      replace: true,
    });
  }

  async function downloadExport() {
    setDownloading(true);
    try {
      const blob = await apiBlob(`/exceptions/export?${summaryParams.toString()}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ngoai-le-${new Date().toISOString().slice(0, 10)}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={cn('min-w-0 transition-[padding] duration-200', selectedId && 'xl:pr-[405px]')}>
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy">Xử lý ngoại lệ</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kiểm tra, điều chỉnh và xác nhận các dữ liệu chấm công bất thường
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void downloadExport()}
            disabled={downloading}
          >
            {downloading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}{' '}
            Xuất danh sách lỗi
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void listQuery.refetch();
              void summaryQuery.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4" /> Làm mới
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Tổng ngoại lệ"
          value={summary.totalRecords}
          hint={`${summary.totalCodes} mã lỗi`}
          icon={AlertTriangle}
          tone="slate"
        />
        <KpiCard
          label="Lỗi chặn"
          value={summary.blockingRecords}
          hint="Chặn tính/chốt công"
          icon={ShieldAlert}
          tone="red"
        />
        <KpiCard
          label="Cần kiểm tra"
          value={summary.warningRecords}
          hint="Không tự động sửa"
          icon={AlertCircle}
          tone="amber"
        />
        <KpiCard
          label="Thông tin"
          value={summary.infoRecords}
          hint="Không chặn"
          icon={Info}
          tone="blue"
        />
        <KpiCard
          label="Đã xử lý"
          value={summary.resolvedRecords}
          hint="Đã revalidate hợp lệ"
          icon={CheckCircle2}
          tone="green"
        />
      </div>

      <Card className="mt-3 rounded-xl p-3 shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-7">
          <FilterSelect
            label="Tháng/Năm"
            value={filters.month}
            onChange={(value) => updateFilter('month', value)}
          >
            <option value="">Tất cả kỳ</option>
            {periodsQuery.data?.map((period) => (
              <option
                key={period.id}
                value={`${period.year}-${String(period.month).padStart(2, '0')}`}
              >
                {String(period.month).padStart(2, '0')}/{period.year}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Phòng ban"
            value={filters.departmentId}
            onChange={(value) => updateFilter('departmentId', value)}
          >
            <option value="">Tất cả phòng ban</option>
            {departmentsQuery.data?.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Ca làm việc"
            value={filters.shiftCode}
            onChange={(value) => updateFilter('shiftCode', value)}
          >
            <option value="">Tất cả ca</option>
            <option value="CA1">Ca 1</option>
            <option value="CA3">Ca 3</option>
          </FilterSelect>
          <FilterSelect
            label="Mức độ"
            value={filters.severity}
            onChange={(value) => updateFilter('severity', value)}
          >
            <option value="">Tất cả mức độ</option>
            <option value="BLOCKING">Lỗi chặn</option>
            <option value="WARNING">Cần kiểm tra</option>
            <option value="INFO">Thông tin</option>
          </FilterSelect>
          <FilterSelect
            label="Mã lỗi"
            value={filters.code}
            onChange={(value) => updateFilter('code', value)}
          >
            <option value="">Tất cả mã lỗi</option>
            {errorCodes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Trạng thái"
            value={filters.status}
            onChange={(value) => updateFilter('status', value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="OPEN">Chưa xử lý</option>
            <option value="RESOLVED">Đã xử lý</option>
          </FilterSelect>
          <div className="flex items-end gap-1.5">
            <Button className="h-9 flex-1 px-3 text-xs" onClick={applyFilters}>
              <SlidersHorizontal className="h-3.5 w-3.5" /> Lọc
            </Button>
            <Button
              aria-label="Xóa bộ lọc"
              className="h-9 px-2.5"
              variant="secondary"
              onClick={clearFilters}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="mt-2.5 flex gap-2">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              aria-label="Tìm nhân viên"
              className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
              placeholder="Tìm theo mã NV, tên nhân viên..."
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyFilters();
              }}
            />
          </label>
          <Button className="h-9 min-w-28 text-xs" onClick={applyFilters}>
            <Search className="h-4 w-4" /> Tìm kiếm
          </Button>
        </div>
      </Card>

      <Card className="mt-3 min-w-0 overflow-hidden rounded-xl shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-navy">
              Danh sách ngoại lệ{' '}
              <span className="font-normal text-slate-400">({response.total} bản ghi)</span>
            </h2>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Một bản ghi có thể chứa nhiều mã lỗi; nhấp vào dòng để xem đầy đủ.
            </p>
          </div>
          {!summary.workflowEnabled && (
            <span className="hidden rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-semibold text-amber-700 sm:inline-flex">
              Workflow ghi đang khóa
            </span>
          )}
        </div>

        {listQuery.isError && (
          <div className="p-4">
            <ErrorState message={listQuery.error.message} />
          </div>
        )}
        {listQuery.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-9" />
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-11" />
            ))}
          </div>
        ) : response.items.length ? (
          <div className="max-w-full overflow-auto">
            <table className="w-full min-w-[1180px] table-fixed text-left text-[11px]">
              <thead className="sticky top-0 z-10 bg-blue-50/80 text-[10px] font-semibold text-slate-600 backdrop-blur">
                <tr>
                  <th className="w-10 px-3 py-3">#</th>
                  <th className="w-24 px-2 py-3">Ngày công</th>
                  <th className="w-24 px-2 py-3">Mã NV</th>
                  <th className="w-36 px-2 py-3">Họ tên</th>
                  <th className="w-32 px-2 py-3">Phòng ban</th>
                  <th className="w-14 px-2 py-3">Ca</th>
                  <th className="w-16 px-2 py-3">Giờ vào</th>
                  <th className="w-16 px-2 py-3">Giờ ra</th>
                  <th className="w-48 px-2 py-3">Loại ngoại lệ</th>
                  <th className="w-24 px-2 py-3">Mức độ</th>
                  <th className="w-24 px-2 py-3">Trạng thái</th>
                  <th className="w-16 px-2 py-3 text-center">Xem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {response.items.map((item, index) => (
                  <tr
                    key={item.id}
                    className={cn(
                      'h-[52px] cursor-pointer transition hover:bg-blue-50/60',
                      selectedId === item.id && 'bg-blue-50',
                    )}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <td className="px-3 py-2 text-slate-400">
                      {(page - 1) * pageSize + index + 1}
                    </td>
                    <td className="px-2 py-2 font-medium text-navy">
                      {formatDate(item.shiftDate ?? item.attendanceDate)}
                    </td>
                    <td className="px-2 py-2 font-semibold text-primary">{item.employeeCode}</td>
                    <td
                      className="truncate px-2 py-2 font-medium text-navy"
                      title={item.employeeName}
                    >
                      {item.employeeName}
                    </td>
                    <td
                      className="truncate px-2 py-2 text-slate-600"
                      title={item.departmentName ?? ''}
                    >
                      {item.departmentName ?? '—'}
                    </td>
                    <td className="px-2 py-2">
                      <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700">
                        {item.shiftCode ?? '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2 font-medium">{formatTime(item.checkIn)}</td>
                    <td className="px-2 py-2 font-medium">{formatTime(item.checkOut)}</td>
                    <td className="px-2 py-2">
                      <div
                        className="flex items-center gap-1 overflow-hidden"
                        title={item.exceptions
                          .map((exception) => `${exception.code}: ${exception.description}`)
                          .join('\n')}
                      >
                        {item.exceptions.slice(0, 2).map((exception) => (
                          <span
                            key={exception.id}
                            className={cn(
                              'max-w-24 truncate rounded-md px-1.5 py-1 text-[9px] font-semibold',
                              exception.blocking
                                ? 'bg-red-50 text-red-600'
                                : 'bg-amber-50 text-amber-700',
                            )}
                          >
                            {exceptionLabel(exception.code)}
                          </span>
                        ))}
                        {item.exceptions.length > 2 && (
                          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-1 text-[9px] font-semibold text-slate-600">
                            +{item.exceptions.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <SeverityBadge severity={item.severity} />
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        className="rounded-md p-1.5 text-primary hover:bg-blue-100"
                        aria-label={`Xem ngoại lệ ${item.employeeCode}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedId(item.id);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Không có ngoại lệ phù hợp"
            description="Thử thay đổi bộ lọc hoặc chọn kỳ công khác."
          />
        )}

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <span>Hiển thị</span>
            <select
              aria-label="Số dòng mỗi trang"
              className="h-8 rounded-lg border border-slate-200 px-2 text-xs"
              value={pageSize}
              onChange={(event) => {
                const size = Number(event.target.value);
                setPageSize(size);
                setPage(1);
                setSearchParams(new URLSearchParams(queryFromFilters(appliedFilters, 1, size)), {
                  replace: true,
                });
              }}
            >
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
            <span>
              dòng ·{' '}
              {response.total
                ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, response.total)} / ${response.total}`
                : '0 bản ghi'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              aria-label="Trang trước"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => changePage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from(
              { length: Math.min(totalPages, 5) },
              (_, index) => index + Math.max(1, Math.min(page - 2, totalPages - 4)),
            ).map((value) => (
              <button
                key={value}
                className={cn(
                  'h-8 min-w-8 rounded-lg border px-2 text-xs font-semibold',
                  value === page
                    ? 'border-primary bg-primary text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
                onClick={() => changePage(value)}
              >
                {value}
              </button>
            ))}
            <button
              aria-label="Trang sau"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 disabled:opacity-40"
              disabled={page >= totalPages}
              onClick={() => changePage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5 text-[10px] leading-4 text-blue-800">
        <FileClock className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>Nguyên tắc an toàn:</strong> dữ liệu nguồn bất biến; tính thử không ghi dữ liệu;
          kỳ LOCKED/PUBLISHED không được sửa trực tiếp. “Đã xử lý” chỉ được ghi nhận sau
          revalidation hợp lệ.
        </span>
      </div>

      {selectedId && <DetailDrawer id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
