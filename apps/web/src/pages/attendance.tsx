import { useQuery } from '@tanstack/react-query';
import { Button, EmptyState, ErrorState, Skeleton, cn } from '@tinh-cong/ui';
import {
  AlertTriangle,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, apiBlob } from '../api.js';

type PeriodStatus = 'DRAFT' | 'REVIEWED' | 'APPROVED' | 'LOCKED' | 'PUBLISHED';
type ProcessingStatus = 'VALID' | 'NEEDS_REVIEW' | 'NO_DATA';
type SortField =
  | 'code'
  | 'name'
  | 'department'
  | 'workedSeconds'
  | 'attendanceDays'
  | 'exceptionCount'
  | 'processingStatus';

interface Period {
  id: string;
  year: number;
  month: number;
  status: PeriodStatus;
  version: number;
  lockedAt: string | null;
  publishedAt: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  code: string;
  name: string;
}

interface SummaryRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  workedSeconds: number;
  tier100Seconds: number;
  tier130Seconds: number;
  tier150Seconds: number;
  tier210Seconds: number;
  lateSeconds: number;
  earlySeconds: number;
  workingDays: number | null;
  attendanceDays: number;
  exceptionCount: number;
  processingStatus: ProcessingStatus;
  approvalStatus: PeriodStatus;
  calculated: boolean;
}

interface SummaryTotals {
  employees: number;
  calculatedEmployees: number;
  workedSeconds: number;
  tier100Seconds: number;
  tier130Seconds: number;
  tier150Seconds: number;
  tier210Seconds: number;
  lateSeconds: number;
  earlySeconds: number;
  attendanceDays: number;
  exceptionCount: number;
}

interface SummaryResponse {
  items: SummaryRow[];
  total: number;
  page: number;
  pageSize: number;
  period: Period | null;
  totals: SummaryTotals;
  workingDaysAvailable: boolean;
  calculationVersion: { engineVersions: string[]; maxRevision: number | null };
}

const controlClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-navy outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-slate-100';

const processingMeta: Record<ProcessingStatus, { label: string; className: string }> = {
  VALID: { label: 'Hợp lệ', className: 'bg-emerald-100 text-emerald-700' },
  NEEDS_REVIEW: { label: 'Có ngoại lệ', className: 'bg-amber-100 text-amber-700' },
  NO_DATA: { label: 'Chưa có dữ liệu', className: 'bg-slate-100 text-slate-600' },
};

const approvalMeta: Record<PeriodStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Chưa chốt', className: 'bg-violet-100 text-violet-700' },
  REVIEWED: { label: 'Đã rà soát', className: 'bg-blue-100 text-blue-700' },
  APPROVED: { label: 'Đã duyệt', className: 'bg-cyan-100 text-cyan-700' },
  LOCKED: { label: 'Đã chốt', className: 'bg-emerald-100 text-emerald-700' },
  PUBLISHED: { label: 'Đã phát hành', className: 'bg-green-100 text-green-700' },
};

function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return '—';
  const sign = seconds < 0 ? '-' : '';
  const absolute = Math.abs(seconds);
  const hours = Math.floor(absolute / 3600);
  const minutes = Math.floor((absolute % 3600) / 60);
  const remainingSeconds = absolute % 60;
  return `${sign}${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function percentage(value: number, total: number) {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '0.0%';
}

function KpiCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
  loading,
}: {
  label: string;
  value: string;
  note?: string;
  icon: typeof Users;
  tone: 'blue' | 'green' | 'amber' | 'violet' | 'teal' | 'orange' | 'rose';
  loading: boolean;
}) {
  const tones = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-500',
    violet: 'bg-violet-100 text-violet-600',
    teal: 'bg-teal-100 text-teal-600',
    orange: 'bg-orange-100 text-orange-500',
    rose: 'bg-rose-100 text-rose-500',
  };
  return (
    <div className="flex min-h-[106px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <span
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
          tones[tone],
        )}
      >
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-slate-500">{label}</p>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-20" />
        ) : (
          <p className="mt-1 truncate text-xl font-bold tabular-nums text-navy" title={value}>
            {value}
          </p>
        )}
        {note && !loading && <p className="mt-1 text-xs font-medium text-emerald-600">{note}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ProcessingStatus }) {
  const meta = processingMeta[status];
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}

function ApprovalBadge({ status }: { status: PeriodStatus }) {
  const meta = approvalMeta[status];
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}

function SortButton({
  field,
  label,
  current,
  direction,
  onSort,
}: {
  field: SortField;
  label: string;
  current: string;
  direction: string;
  onSort: (field: SortField) => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 whitespace-nowrap font-semibold hover:text-primary"
      onClick={() => onSort(field)}
      aria-label={`Sắp xếp theo ${label}`}
    >
      {label}
      <ArrowUp
        className={cn(
          'h-3 w-3',
          current !== field && 'opacity-25',
          direction === 'desc' && 'rotate-180',
        )}
      />
    </button>
  );
}

export function AttendanceSummaryPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [shiftCode, setShiftCode] = useState(params.get('shiftCode') ?? '');
  const [processingStatus, setProcessingStatus] = useState(params.get('processingStatus') ?? '');
  const [selection, setSelection] = useState<{ key: string; ids: Set<string> }>({
    key: '',
    ids: new Set(),
  });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const periods = useQuery({ queryKey: ['periods'], queryFn: () => api<Period[]>('/periods') });
  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: () => api<Department[]>('/departments'),
  });
  const shifts = useQuery({ queryKey: ['shifts'], queryFn: () => api<Shift[]>('/shifts') });

  useEffect(() => {
    if (!params.get('periodId') && periods.data?.[0]) {
      const next = new URLSearchParams(params);
      next.set('periodId', periods.data[0].id);
      next.set('page', '1');
      setParams(next, { replace: true });
    }
  }, [params, periods.data, setParams]);

  const periodId = params.get('periodId') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const pageSize = [10, 20, 50, 100].includes(Number(params.get('pageSize')))
    ? Number(params.get('pageSize'))
    : 10;
  const summaryPath = useMemo(() => {
    const query = new URLSearchParams(params);
    query.set('page', String(page));
    query.set('pageSize', String(pageSize));
    return `/attendance/summary?${query.toString()}`;
  }, [page, pageSize, params]);
  const selected = selection.key === summaryPath ? selection.ids : new Set<string>();
  const summary = useQuery({
    queryKey: ['attendance-summary', summaryPath],
    queryFn: () => api<SummaryResponse>(summaryPath),
    enabled: Boolean(periodId),
    retry: 1,
  });

  const totals = summary.data?.totals;
  const totalPages = Math.max(1, Math.ceil((summary.data?.total ?? 0) / pageSize));
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set('page', '1');
    setParams(next);
  };
  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    const next = new URLSearchParams(params);
    for (const [key, value] of [
      ['search', search.trim()],
      ['shiftCode', shiftCode],
      ['processingStatus', processingStatus],
    ] as const) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.set('page', '1');
    setParams(next);
  };
  const resetFilters = () => {
    const next = new URLSearchParams();
    if (periods.data?.[0]) next.set('periodId', periods.data[0].id);
    next.set('page', '1');
    next.set('pageSize', String(pageSize));
    setSearch('');
    setShiftCode('');
    setProcessingStatus('');
    setParams(next);
  };
  const sort = (field: SortField) => {
    const next = new URLSearchParams(params);
    const current = params.get('sortBy') ?? 'code';
    next.set('sortBy', field);
    next.set('sortOrder', current === field && params.get('sortOrder') !== 'desc' ? 'desc' : 'asc');
    next.set('page', '1');
    setParams(next);
  };
  const togglePage = (checked: boolean) => {
    setSelection({
      key: summaryPath,
      ids: checked ? new Set(summary.data?.items.map((item) => item.employeeId) ?? []) : new Set(),
    });
  };
  const exportExcel = async () => {
    setExporting(true);
    setExportError('');
    try {
      const exportParams = new URLSearchParams(params);
      exportParams.delete('page');
      exportParams.delete('pageSize');
      const blob = await apiBlob(`/attendance/export?${exportParams.toString()}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const activePeriod = periods.data?.find((item) => item.id === periodId);
      anchor.href = url;
      anchor.download = `bang-cong-tong-hop-${activePeriod?.year ?? 'ky'}-${String(activePeriod?.month ?? '').padStart(2, '0')}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Không thể xuất Excel.');
    } finally {
      setExporting(false);
    }
  };
  const goToPage = (nextPage: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(Math.min(Math.max(1, nextPage), totalPages)));
    setParams(next);
  };
  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
    const start = Math.min(Math.max(1, page - 2), Math.max(1, totalPages - 4));
    return start + index;
  });

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Bảng công tổng hợp</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tổng hợp kết quả chấm công theo nhân viên trong kỳ
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[180px_180px_180px_auto]">
          <label className="text-xs font-medium text-slate-600">
            <span className="mb-1.5 block">Tháng/Năm</span>
            <select
              className={controlClass}
              value={periodId}
              onChange={(event) => setParam('periodId', event.target.value)}
              disabled={periods.isLoading}
            >
              {!periods.data?.length && <option value="">Chưa có kỳ công</option>}
              {periods.data?.map((period) => (
                <option
                  key={period.id}
                  value={period.id}
                >{`Tháng ${String(period.month).padStart(2, '0')}/${period.year}`}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            <span className="mb-1.5 block">Phòng ban</span>
            <select
              className={controlClass}
              value={params.get('department') ?? ''}
              onChange={(event) => setParam('department', event.target.value)}
            >
              <option value="">Tất cả phòng ban</option>
              {departments.data?.map((department) => (
                <option key={department.id} value={department.name}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            <span className="mb-1.5 block">Trạng thái kỳ</span>
            <select
              className={controlClass}
              value={params.get('approvalStatus') ?? ''}
              onChange={(event) => setParam('approvalStatus', event.target.value)}
            >
              <option value="">Tất cả</option>
              {Object.entries(approvalMeta).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            className="self-end whitespace-nowrap"
            onClick={() => void exportExcel()}
            disabled={!summary.data?.period || exporting}
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {exportError && <ErrorState message={exportError} />}
      {summary.data?.period && !['LOCKED', 'PUBLISHED'].includes(summary.data.period.status) && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          Dữ liệu kỳ này chưa chốt. File Excel xuất ra sẽ được gắn nhãn dữ liệu tạm.
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard
          label="Tổng nhân viên"
          value={String(totals?.employees ?? 0)}
          icon={Users}
          tone="blue"
          loading={summary.isLoading}
        />
        <KpiCard
          label="Đã tính công"
          value={String(totals?.calculatedEmployees ?? 0)}
          note={percentage(totals?.calculatedEmployees ?? 0, totals?.employees ?? 0)}
          icon={CheckCircle2}
          tone="green"
          loading={summary.isLoading}
        />
        <KpiCard
          label="Tổng giờ công"
          value={formatDuration(totals?.workedSeconds ?? 0)}
          icon={Clock3}
          tone="amber"
          loading={summary.isLoading}
        />
        <KpiCard
          label="Giờ 100%"
          value={formatDuration(totals?.tier100Seconds ?? 0)}
          note={percentage(totals?.tier100Seconds ?? 0, totals?.workedSeconds ?? 0)}
          icon={ArrowUp}
          tone="violet"
          loading={summary.isLoading}
        />
        <KpiCard
          label="Giờ 130%"
          value={formatDuration(totals?.tier130Seconds ?? 0)}
          note={percentage(totals?.tier130Seconds ?? 0, totals?.workedSeconds ?? 0)}
          icon={ArrowUp}
          tone="teal"
          loading={summary.isLoading}
        />
        <KpiCard
          label="Giờ 150%"
          value={formatDuration(totals?.tier150Seconds ?? 0)}
          note={percentage(totals?.tier150Seconds ?? 0, totals?.workedSeconds ?? 0)}
          icon={ArrowUp}
          tone="orange"
          loading={summary.isLoading}
        />
        <KpiCard
          label="Giờ 210%"
          value={formatDuration(totals?.tier210Seconds ?? 0)}
          note={percentage(totals?.tier210Seconds ?? 0, totals?.workedSeconds ?? 0)}
          icon={ArrowUp}
          tone="rose"
          loading={summary.isLoading}
        />
      </section>

      <form
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[minmax(240px,2fr)_minmax(150px,1fr)_minmax(170px,1fr)_auto_auto] md:items-end"
        onSubmit={applyFilters}
      >
        <label className="text-xs font-medium text-slate-600">
          <span className="mb-1.5 block">Tìm kiếm</span>
          <span className="relative block">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className={cn(controlClass, 'pl-9')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo mã NV, tên nhân viên..."
            />
          </span>
        </label>
        <label className="text-xs font-medium text-slate-600">
          <span className="mb-1.5 block">Ca làm việc</span>
          <select
            className={controlClass}
            value={shiftCode}
            onChange={(event) => setShiftCode(event.target.value)}
          >
            <option value="">Tất cả</option>
            {shifts.data?.map((shift) => (
              <option key={shift.id} value={shift.code}>
                {shift.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          <span className="mb-1.5 block">Trạng thái xử lý</span>
          <select
            className={controlClass}
            value={processingStatus}
            onChange={(event) => setProcessingStatus(event.target.value)}
          >
            <option value="">Tất cả</option>
            {Object.entries(processingMeta).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">
          <Search className="h-4 w-4" />
          Tìm kiếm
        </Button>
        <Button type="button" variant="secondary" onClick={resetFilters}>
          <RotateCcw className="h-4 w-4" />
          Xóa lọc
        </Button>
      </form>

      {summary.isError && (
        <div className="space-y-3">
          <ErrorState message={summary.error.message} />
          <Button variant="secondary" onClick={() => void summary.refetch()}>
            Thử lại
          </Button>
        </div>
      )}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {summary.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : !periodId || !summary.data?.period ? (
          <EmptyState
            title="Chưa có kỳ công"
            description="Tạo kỳ công trước khi xem bảng tổng hợp."
          />
        ) : !summary.data.items.length ? (
          <EmptyState
            title="Không có dữ liệu phù hợp"
            description="Hãy thay đổi bộ lọc hoặc bổ sung dữ liệu chấm công cho kỳ đã chọn."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1840px] w-full border-collapse text-left text-xs text-navy">
              <thead className="bg-slate-50 text-slate-600">
                <tr className="border-b border-slate-200">
                  <th className="sticky left-0 z-20 w-12 bg-slate-50 px-3 py-3 text-center">#</th>
                  <th className="sticky left-12 z-20 w-10 bg-slate-50 px-2 py-3 text-center">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả nhân viên trên trang"
                      checked={
                        summary.data.items.length > 0 && selected.size === summary.data.items.length
                      }
                      onChange={(event) => togglePage(event.target.checked)}
                    />
                  </th>
                  <th className="sticky left-[88px] z-20 w-28 bg-slate-50 px-3 py-3">
                    <SortButton
                      field="code"
                      label="Mã NV"
                      current={params.get('sortBy') ?? 'code'}
                      direction={params.get('sortOrder') ?? 'asc'}
                      onSort={sort}
                    />
                  </th>
                  <th className="sticky left-[200px] z-20 w-48 bg-slate-50 px-3 py-3">
                    <SortButton
                      field="name"
                      label="Họ tên"
                      current={params.get('sortBy') ?? 'code'}
                      direction={params.get('sortOrder') ?? 'asc'}
                      onSort={sort}
                    />
                  </th>
                  <th className="w-44 px-3 py-3">
                    <SortButton
                      field="department"
                      label="Phòng ban"
                      current={params.get('sortBy') ?? 'code'}
                      direction={params.get('sortOrder') ?? 'asc'}
                      onSort={sort}
                    />
                  </th>
                  <th className="bg-blue-50 px-3 py-3 text-center text-blue-700">
                    <SortButton
                      field="workedSeconds"
                      label="Tổng công"
                      current={params.get('sortBy') ?? 'code'}
                      direction={params.get('sortOrder') ?? 'asc'}
                      onSort={sort}
                    />
                  </th>
                  <th className="bg-emerald-50 px-3 py-3 text-center text-emerald-700">Giờ 100%</th>
                  <th className="bg-violet-50 px-3 py-3 text-center text-violet-700">Giờ 130%</th>
                  <th className="bg-orange-50 px-3 py-3 text-center text-orange-700">Giờ 150%</th>
                  <th className="bg-rose-50 px-3 py-3 text-center text-rose-700">Giờ 210%</th>
                  <th className="bg-red-50 px-3 py-3 text-center text-red-700">Đi muộn</th>
                  <th className="bg-amber-50 px-3 py-3 text-center text-amber-700">Về sớm</th>
                  <th className="px-3 py-3 text-center">Số ngày làm việc</th>
                  <th className="px-3 py-3 text-center">
                    <SortButton
                      field="attendanceDays"
                      label="Số ngày có mặt"
                      current={params.get('sortBy') ?? 'code'}
                      direction={params.get('sortOrder') ?? 'asc'}
                      onSort={sort}
                    />
                  </th>
                  <th className="px-3 py-3 text-center">
                    <SortButton
                      field="exceptionCount"
                      label="Số ngoại lệ"
                      current={params.get('sortBy') ?? 'code'}
                      direction={params.get('sortOrder') ?? 'asc'}
                      onSort={sort}
                    />
                  </th>
                  <th className="px-3 py-3 text-center">
                    <SortButton
                      field="processingStatus"
                      label="Trạng thái xử lý"
                      current={params.get('sortBy') ?? 'code'}
                      direction={params.get('sortOrder') ?? 'asc'}
                      onSort={sort}
                    />
                  </th>
                  <th className="px-3 py-3 text-center">Trạng thái kỳ</th>
                  <th className="px-3 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {summary.data.items.map((row, index) => {
                  const checked = selected.has(row.employeeId);
                  return (
                    <tr
                      key={row.employeeId}
                      className={cn(
                        'border-b border-slate-100 hover:bg-blue-50/40',
                        checked && 'bg-blue-50',
                      )}
                    >
                      <td
                        className={cn(
                          'sticky left-0 z-10 bg-white px-3 py-3 text-center',
                          checked && 'bg-blue-50',
                        )}
                      >
                        {(page - 1) * pageSize + index + 1}
                      </td>
                      <td
                        className={cn(
                          'sticky left-12 z-10 bg-white px-2 py-3 text-center',
                          checked && 'bg-blue-50',
                        )}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${row.employeeName}`}
                          checked={checked}
                          onChange={(event) =>
                            setSelection((current) => {
                              const next =
                                current.key === summaryPath
                                  ? new Set(current.ids)
                                  : new Set<string>();
                              if (event.target.checked) next.add(row.employeeId);
                              else next.delete(row.employeeId);
                              return { key: summaryPath, ids: next };
                            })
                          }
                        />
                      </td>
                      <td
                        className={cn(
                          'sticky left-[88px] z-10 bg-white px-3 py-3 font-semibold',
                          checked && 'bg-blue-50',
                        )}
                      >
                        {row.employeeCode}
                      </td>
                      <td
                        className={cn(
                          'sticky left-[200px] z-10 bg-white px-3 py-3 font-medium',
                          checked && 'bg-blue-50',
                        )}
                      >
                        {row.employeeName}
                      </td>
                      <td className="px-3 py-3">{row.departmentName ?? '—'}</td>
                      <td className="bg-blue-50/60 px-3 py-3 text-center font-bold tabular-nums text-blue-700">
                        {formatDuration(row.workedSeconds)}
                      </td>
                      <td className="bg-emerald-50/60 px-3 py-3 text-center font-semibold tabular-nums text-emerald-700">
                        {formatDuration(row.tier100Seconds)}
                      </td>
                      <td className="bg-violet-50/60 px-3 py-3 text-center font-semibold tabular-nums text-violet-700">
                        {formatDuration(row.tier130Seconds)}
                      </td>
                      <td className="bg-orange-50/60 px-3 py-3 text-center font-semibold tabular-nums text-orange-700">
                        {formatDuration(row.tier150Seconds)}
                      </td>
                      <td className="bg-rose-50/60 px-3 py-3 text-center font-semibold tabular-nums text-rose-700">
                        {formatDuration(row.tier210Seconds)}
                      </td>
                      <td className="bg-red-50/50 px-3 py-3 text-center tabular-nums text-red-700">
                        {formatDuration(row.lateSeconds)}
                      </td>
                      <td className="bg-amber-50/50 px-3 py-3 text-center tabular-nums text-amber-700">
                        {formatDuration(row.earlySeconds)}
                      </td>
                      <td
                        className="px-3 py-3 text-center"
                        title={
                          !summary.data.workingDaysAvailable
                            ? 'Chưa có lịch/policy ngày làm việc được phê duyệt'
                            : undefined
                        }
                      >
                        {row.workingDays ?? 'N/A'}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums">{row.attendanceDays}</td>
                      <td className="px-3 py-3 text-center tabular-nums">{row.exceptionCount}</td>
                      <td className="px-3 py-3 text-center">
                        <StatusBadge status={row.processingStatus} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <ApprovalBadge status={row.approvalStatus} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Link
                          className="inline-flex rounded-md p-2 text-primary hover:bg-blue-50"
                          aria-label={`Xem chi tiết ${row.employeeName}`}
                          to={`/attendance/detail?employeeId=${encodeURIComponent(row.employeeId)}&periodId=${encodeURIComponent(summary.data.period!.id)}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 font-bold">
                <tr className="border-t border-slate-200">
                  <td className="sticky left-0 z-10 bg-slate-50 px-3 py-3" colSpan={4}>
                    Tổng cộng toàn bộ tập lọc
                  </td>
                  <td className="px-3 py-3">{totals?.employees ?? 0} NV</td>
                  <td className="bg-blue-50 px-3 py-3 text-center text-blue-700">
                    {formatDuration(totals?.workedSeconds ?? 0)}
                  </td>
                  <td className="bg-emerald-50 px-3 py-3 text-center text-emerald-700">
                    {formatDuration(totals?.tier100Seconds ?? 0)}
                  </td>
                  <td className="bg-violet-50 px-3 py-3 text-center text-violet-700">
                    {formatDuration(totals?.tier130Seconds ?? 0)}
                  </td>
                  <td className="bg-orange-50 px-3 py-3 text-center text-orange-700">
                    {formatDuration(totals?.tier150Seconds ?? 0)}
                  </td>
                  <td className="bg-rose-50 px-3 py-3 text-center text-rose-700">
                    {formatDuration(totals?.tier210Seconds ?? 0)}
                  </td>
                  <td className="bg-red-50 px-3 py-3 text-center text-red-700">
                    {formatDuration(totals?.lateSeconds ?? 0)}
                  </td>
                  <td className="bg-amber-50 px-3 py-3 text-center text-amber-700">
                    {formatDuration(totals?.earlySeconds ?? 0)}
                  </td>
                  <td className="px-3 py-3 text-center">N/A</td>
                  <td className="px-3 py-3 text-center">{totals?.attendanceDays ?? 0}</td>
                  <td className="px-3 py-3 text-center">{totals?.exceptionCount ?? 0}</td>
                  <td className="px-3 py-3 text-center">—</td>
                  <td className="px-3 py-3 text-center">—</td>
                  <td className="px-3 py-3 text-center">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <label className="flex items-center gap-2">
              Hiển thị
              <select
                className="h-9 rounded-lg border border-slate-200 bg-white px-2"
                value={pageSize}
                onChange={(event) => {
                  const next = new URLSearchParams(params);
                  next.set('pageSize', event.target.value);
                  next.set('page', '1');
                  setParams(next);
                }}
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size} dòng
                  </option>
                ))}
              </select>
            </label>
            <span>
              Đang hiển thị {summary.data?.total ? (page - 1) * pageSize + 1 : 0} -{' '}
              {Math.min(page * pageSize, summary.data?.total ?? 0)} / {summary.data?.total ?? 0}{' '}
              nhân viên
            </span>
          </div>
          <nav className="flex items-center gap-1" aria-label="Phân trang">
            <button
              className="rounded-md border border-slate-200 p-2 disabled:opacity-40"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              aria-label="Trang trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                className={cn(
                  'h-8 min-w-8 rounded-md border px-2 text-xs',
                  pageNumber === page
                    ? 'border-primary bg-primary text-white'
                    : 'border-slate-200 bg-white',
                )}
                onClick={() => goToPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            <button
              className="rounded-md border border-slate-200 p-2 disabled:opacity-40"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              aria-label="Trang sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </section>
      <p className="flex items-center gap-2 text-xs text-slate-500">
        <CalendarDays className="h-4 w-4" />
        Số ngày làm việc đang để N/A vì chưa có lịch/policy ngày làm việc được phê duyệt; hệ thống
        không tự suy diễn.
      </p>
    </div>
  );
}

interface AttendanceDetailRow {
  id: string;
  revision: number;
  status: 'VALID' | 'NEEDS_REVIEW';
  workedSeconds: number | null;
  tier100Seconds: number | null;
  tier130Seconds: number | null;
  tier150Seconds: number | null;
  tier210Seconds: number | null;
  lateSeconds: number | null;
  earlySeconds: number | null;
  normalization: {
    shiftDate: string | null;
    shiftCode: string | null;
    checkInAt: string | null;
    checkOutAt: string | null;
  };
  raw: { employeeCode: string; employeeName: string; departmentName: string };
  exceptions: Array<{ id: string; code: string; status: string }>;
}

export function AttendanceDetailPage() {
  const [params] = useSearchParams();
  const employeeId = params.get('employeeId');
  const periodId = params.get('periodId');
  const path = employeeId
    ? `/attendance/employee/${encodeURIComponent(employeeId)}${periodId ? `?periodId=${encodeURIComponent(periodId)}` : ''}`
    : '';
  const detail = useQuery({
    queryKey: ['attendance-detail', employeeId, periodId],
    queryFn: () => api<AttendanceDetailRow[]>(path),
    enabled: Boolean(path),
    retry: 1,
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-navy">Chi tiết bảng công</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ngày ca, timestamp, mức công và ngoại lệ theo nhân viên trong kỳ.
        </p>
      </div>
      {!employeeId ? (
        <EmptyState description="Chọn một nhân viên từ Bảng công tổng hợp để xem chi tiết." />
      ) : detail.isError ? (
        <ErrorState message={detail.error.message} />
      ) : detail.isLoading ? (
        <Skeleton className="h-72" />
      ) : !detail.data?.length ? (
        <EmptyState description="Nhân viên chưa có dữ liệu tính công trong kỳ đã chọn." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-[1200px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                {[
                  'Ngày ca',
                  'Ca',
                  'Giờ vào',
                  'Giờ ra',
                  'Tổng công',
                  '100%',
                  '130%',
                  '150%',
                  '210%',
                  'Đi muộn',
                  'Về sớm',
                  'Revision',
                  'Ngoại lệ',
                ].map((header) => (
                  <th key={header} className="px-3 py-3">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.data.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-3">
                    {row.normalization.shiftDate
                      ? new Intl.DateTimeFormat('vi-VN').format(
                          new Date(row.normalization.shiftDate),
                        )
                      : '—'}
                  </td>
                  <td className="px-3 py-3">{row.normalization.shiftCode ?? '—'}</td>
                  <td className="px-3 py-3">
                    {row.normalization.checkInAt
                      ? new Date(row.normalization.checkInAt).toLocaleString('vi-VN')
                      : '—'}
                  </td>
                  <td className="px-3 py-3">
                    {row.normalization.checkOutAt
                      ? new Date(row.normalization.checkOutAt).toLocaleString('vi-VN')
                      : '—'}
                  </td>
                  {[
                    row.workedSeconds,
                    row.tier100Seconds,
                    row.tier130Seconds,
                    row.tier150Seconds,
                    row.tier210Seconds,
                    row.lateSeconds,
                    row.earlySeconds,
                  ].map((value, index) => (
                    <td key={index} className="px-3 py-3 tabular-nums">
                      {formatDuration(value)}
                    </td>
                  ))}
                  <td className="px-3 py-3">{row.revision}</td>
                  <td className="px-3 py-3">
                    {row.exceptions.length
                      ? row.exceptions.map((item) => item.code).join(', ')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
