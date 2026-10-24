import { useQuery } from '@tanstack/react-query';
import { Button, EmptyState, ErrorState, Skeleton, cn } from '@tinh-cong/ui';
import {
  AlertTriangle,
  ArrowUp,
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  Download,
  Eye,
  FileText,
  History,
  RotateCcw,
  Search,
  Timer,
  User,
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
  tier200Seconds: number;
  tier210Seconds: number;
  tier230Seconds: number;
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
  tier200Seconds: number;
  tier210Seconds: number;
  tier230Seconds: number;
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
  note?: string | undefined;
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

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-9">
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
          label="Giờ 200%"
          value={formatDuration(totals?.tier200Seconds ?? 0)}
          note={percentage(totals?.tier200Seconds ?? 0, totals?.workedSeconds ?? 0)}
          icon={ArrowUp}
          tone="blue"
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
        <KpiCard
          label="Giờ 230%"
          value={formatDuration(totals?.tier230Seconds ?? 0)}
          note={percentage(totals?.tier230Seconds ?? 0, totals?.workedSeconds ?? 0)}
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
            <table className="min-w-[2040px] w-full border-collapse text-left text-xs text-navy">
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
                  <th className="bg-sky-50 px-3 py-3 text-center text-sky-700">Giờ 200%</th>
                  <th className="bg-rose-50 px-3 py-3 text-center text-rose-700">Giờ 210%</th>
                  <th className="bg-pink-50 px-3 py-3 text-center text-pink-700">Giờ 230%</th>
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
                      <td className="bg-sky-50/60 px-3 py-3 text-center font-semibold tabular-nums text-sky-700">
                        {formatDuration(row.tier200Seconds)}
                      </td>
                      <td className="bg-rose-50/60 px-3 py-3 text-center font-semibold tabular-nums text-rose-700">
                        {formatDuration(row.tier210Seconds)}
                      </td>
                      <td className="bg-pink-50/60 px-3 py-3 text-center font-semibold tabular-nums text-pink-700">
                        {formatDuration(row.tier230Seconds)}
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
                  <td className="bg-sky-50 px-3 py-3 text-center text-sky-700">
                    {formatDuration(totals?.tier200Seconds ?? 0)}
                  </td>
                  <td className="bg-rose-50 px-3 py-3 text-center text-rose-700">
                    {formatDuration(totals?.tier210Seconds ?? 0)}
                  </td>
                  <td className="bg-pink-50 px-3 py-3 text-center text-pink-700">
                    {formatDuration(totals?.tier230Seconds ?? 0)}
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

type DetailTab = 'detail' | 'summary' | 'chart' | 'source' | 'history';

interface AttendanceDetailRow {
  id: string;
  rawId: string;
  rowNo: number;
  revision: number;
  status: 'VALID' | 'NEEDS_REVIEW';
  engineVersion: string | null;
  shiftDate: string | null;
  shiftCode: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  presenceSeconds: number | null;
  breakSeconds: number | null;
  workedSeconds: number | null;
  tier100Seconds: number | null;
  tier130Seconds: number | null;
  tier150Seconds: number | null;
  tier200Seconds: number | null;
  tier210Seconds: number | null;
  tier230Seconds: number | null;
  lateSeconds: number | null;
  earlySeconds: number | null;
  exceptions: Array<{ id: string; code: string; blocking: boolean; status: string }>;
  source: {
    employeeCode: string;
    employeeName: string;
    departmentName: string;
    attendanceDate: string | null;
    checkIn: string | null;
    checkOut: string | null;
    shiftName: string | null;
  };
}

interface AttendanceAdjustmentRow {
  id: string;
  rawId: string;
  rowNo: number;
  revision: number;
  before: unknown;
  after: unknown;
  reason: string;
  createdAt: string;
  actor: { id: string; username: string };
}

interface AttendanceDetailResponse {
  employee: {
    id: string;
    code: string;
    name: string;
    position: string | null;
    startDate: string | null;
    status: 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED';
    departmentName: string | null;
  };
  period: (Period & { timezone: string }) | null;
  rows: AttendanceDetailRow[];
  adjustments: AttendanceAdjustmentRow[];
  totals: Omit<SummaryTotals, 'employees' | 'calculatedEmployees'>;
  workingDays: number | null;
  workingDaysAvailable: boolean;
  calculationVersion: { engineVersions: string[]; maxRevision: number | null };
}

const detailTabs: Array<{
  id: DetailTab;
  label: string;
  icon: typeof Clock3;
}> = [
  { id: 'detail', label: 'Bảng công chi tiết', icon: CalendarDays },
  { id: 'summary', label: 'Tổng hợp', icon: FileText },
  { id: 'chart', label: 'Biểu đồ', icon: BarChart3 },
  { id: 'source', label: 'Dữ liệu nguồn', icon: Database },
  { id: 'history', label: 'Lịch sử điều chỉnh', icon: History },
];

const employeeStatusMeta = {
  ACTIVE: { label: 'Đang làm việc', className: 'bg-emerald-100 text-emerald-700' },
  ON_LEAVE: { label: 'Tạm nghỉ', className: 'bg-violet-100 text-violet-700' },
  RESIGNED: { label: 'Nghỉ việc', className: 'bg-rose-100 text-rose-700' },
} as const;

function detailDate(value: string | null, timezone = 'Asia/Ho_Chi_Minh') {
  return value
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: timezone,
      }).format(new Date(value))
    : '—';
}

function detailTime(value: string | null, timezone = 'Asia/Ho_Chi_Minh') {
  return value
    ? new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
      }).format(new Date(value))
    : '—';
}

function detailHours(seconds: number | null | undefined, digits = 2) {
  return seconds === null || seconds === undefined ? '—' : (seconds / 3600).toFixed(digits);
}

function detailWeekday(value: string | null, timezone = 'Asia/Ho_Chi_Minh') {
  if (!value) return '—';
  const label = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', timeZone: timezone }).format(
    new Date(value),
  );
  return label.charAt(0).toLocaleUpperCase('vi-VN') + label.slice(1);
}

function DetailMetric({
  label,
  value,
  icon: Icon,
  tone,
  note,
}: {
  label: string;
  value: string;
  icon: typeof Clock3;
  tone: 'blue' | 'green' | 'violet' | 'orange' | 'rose' | 'navy';
  note?: string | undefined;
}) {
  const tones = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-emerald-100 text-emerald-600',
    violet: 'bg-violet-100 text-violet-600',
    orange: 'bg-orange-100 text-orange-500',
    rose: 'bg-rose-100 text-rose-500',
    navy: 'bg-slate-100 text-navy',
  };
  return (
    <div className="flex min-h-[82px] items-center gap-2.5 rounded-xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-2.5 shadow-sm">
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          tones[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-base font-bold tabular-nums text-navy" title={value}>
          {value}
        </p>
        {note && <p className="text-[10px] text-slate-400">{note}</p>}
      </div>
    </div>
  );
}

export function AttendanceDetailPage() {
  const [params, setParams] = useSearchParams();
  const employeeId = params.get('employeeId');
  const periodId = params.get('periodId');
  const [activeTab, setActiveTab] = useState<DetailTab>('detail');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const periods = useQuery({ queryKey: ['periods'], queryFn: () => api<Period[]>('/periods') });
  const path = employeeId
    ? `/attendance/employee/${encodeURIComponent(employeeId)}${periodId ? `?periodId=${encodeURIComponent(periodId)}` : ''}`
    : '';
  const detail = useQuery({
    queryKey: ['attendance-detail', employeeId, periodId],
    queryFn: () => api<AttendanceDetailResponse>(path),
    enabled: Boolean(path),
    retry: 1,
  });

  useEffect(() => {
    if (employeeId && !periodId && periods.data?.[0]) {
      const next = new URLSearchParams(params);
      next.set('periodId', periods.data[0].id);
      setParams(next, { replace: true });
    }
  }, [employeeId, params, periodId, periods.data, setParams]);

  const orderedPeriods = useMemo(
    () =>
      [...(periods.data ?? [])].sort(
        (left, right) => left.year * 12 + left.month - (right.year * 12 + right.month),
      ),
    [periods.data],
  );
  const currentPeriodIndex = orderedPeriods.findIndex((item) => item.id === periodId);
  const timezone = detail.data?.period?.timezone ?? 'Asia/Ho_Chi_Minh';
  const totalPages = Math.max(1, Math.ceil((detail.data?.rows.length ?? 0) / pageSize));
  const visibleRows = detail.data?.rows.slice((page - 1) * pageSize, page * pageSize) ?? [];
  const status = detail.data ? employeeStatusMeta[detail.data.employee.status] : null;

  const changePeriod = (index: number) => {
    const period = orderedPeriods[index];
    if (!period) return;
    setPage(1);
    const next = new URLSearchParams(params);
    next.set('periodId', period.id);
    setParams(next);
  };

  const exportPdf = async () => {
    if (!employeeId || !detail.data?.period) return;
    setExportError('');
    setExporting(true);
    try {
      const query = new URLSearchParams({ periodId: detail.data.period.id });
      const blob = await apiBlob(
        `/attendance/employee/${encodeURIComponent(employeeId)}/pdf?${query.toString()}`,
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `chi-tiet-bang-cong-${detail.data.employee.code}-${detail.data.period.year}-${String(detail.data.period.month).padStart(2, '0')}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Không thể xuất PDF.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-2xl font-bold text-navy">Chi tiết bảng công</h1>
          <p className="mt-1 text-sm text-slate-500">
            <Link to="/attendance" className="hover:text-primary">
              Bảng công tổng hợp
            </Link>{' '}
            <span className="px-1">›</span> Chi tiết bảng công
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            className="h-10 border border-slate-200 bg-white text-navy hover:bg-slate-50"
            disabled={currentPeriodIndex <= 0}
            onClick={() => changePeriod(currentPeriodIndex - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Tháng trước
          </Button>
          <label className="relative min-w-[180px]">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy" />
            <select
              aria-label="Kỳ công"
              className={cn(controlClass, 'pl-9 font-semibold')}
              value={periodId ?? ''}
              onChange={(event) => {
                setPage(1);
                const next = new URLSearchParams(params);
                next.set('periodId', event.target.value);
                setParams(next);
              }}
            >
              {!periodId && <option value="">Chọn kỳ công</option>}
              {orderedPeriods.map((period) => (
                <option key={period.id} value={period.id}>
                  Tháng {String(period.month).padStart(2, '0')}/{period.year}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="secondary"
            className="h-10 border border-slate-200 bg-white text-navy hover:bg-slate-50"
            disabled={currentPeriodIndex < 0 || currentPeriodIndex >= orderedPeriods.length - 1}
            onClick={() => changePeriod(currentPeriodIndex + 1)}
          >
            Tháng sau <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            className="h-10 min-w-[130px]"
            onClick={() => void exportPdf()}
            disabled={exporting || !detail.data?.period}
          >
            <Download className="h-4 w-4" /> {exporting ? 'Đang xuất...' : 'Xuất PDF'}
          </Button>
        </div>
      </div>

      {exportError && <ErrorState message={exportError} />}
      {!employeeId ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <User className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            Chọn một nhân viên từ Bảng công tổng hợp để xem chi tiết.
          </p>
          <Link
            to="/attendance"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Mở Bảng công tổng hợp
          </Link>
        </div>
      ) : detail.isError ? (
        <ErrorState message={detail.error.message} />
      ) : detail.isLoading ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
          <Skeleton className="h-[760px]" />
          <Skeleton className="h-[560px]" />
        </div>
      ) : detail.data ? (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_200px]">
          <div className="min-w-0 space-y-4">
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="grid lg:grid-cols-[330px_minmax(0,1fr)]">
                <div className="flex items-center gap-4 border-b border-slate-100 p-5 lg:border-b-0 lg:border-r">
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-blue-100 to-blue-200 text-primary">
                    <User className="h-11 w-11" strokeWidth={1.7} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-500">
                      {detail.data.employee.code}
                    </p>
                    <h2
                      className="truncate text-xl font-bold text-navy"
                      title={detail.data.employee.name}
                    >
                      {detail.data.employee.name}
                    </h2>
                    <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <Users className="h-4 w-4" /> Phòng ban:{' '}
                      {detail.data.employee.departmentName ?? '—'}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <Briefcase className="h-4 w-4" /> Chức danh:{' '}
                      {detail.data.employee.position ?? 'Chưa cập nhật'}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 2xl:grid-cols-5">
                  <DetailMetric
                    label="Tổng giờ công"
                    value={detailHours(detail.data.totals.workedSeconds, 1)}
                    icon={Clock3}
                    tone="blue"
                    note="giờ"
                  />
                  <DetailMetric
                    label="Giờ 100%"
                    value={detailHours(detail.data.totals.tier100Seconds, 1)}
                    icon={ArrowUp}
                    tone="green"
                    note="giờ"
                  />
                  <DetailMetric
                    label="Giờ 130%"
                    value={detailHours(detail.data.totals.tier130Seconds, 1)}
                    icon={ArrowUp}
                    tone="violet"
                    note="giờ"
                  />
                  <DetailMetric
                    label="Giờ 150%"
                    value={detailHours(detail.data.totals.tier150Seconds, 1)}
                    icon={ArrowUp}
                    tone="orange"
                    note="giờ"
                  />
                  <DetailMetric
                    label="Giờ 200%"
                    value={detailHours(detail.data.totals.tier200Seconds, 1)}
                    icon={ArrowUp}
                    tone="blue"
                    note="giờ"
                  />
                  <DetailMetric
                    label="Giờ 210%"
                    value={detailHours(detail.data.totals.tier210Seconds, 1)}
                    icon={ArrowUp}
                    tone="rose"
                    note="giờ"
                  />
                  <DetailMetric
                    label="Giờ 230%"
                    value={detailHours(detail.data.totals.tier230Seconds, 1)}
                    icon={ArrowUp}
                    tone="rose"
                    note="giờ"
                  />
                  <DetailMetric
                    label="Đi muộn"
                    value={detailHours(detail.data.totals.lateSeconds, 1)}
                    icon={Timer}
                    tone="rose"
                    note="giờ"
                  />
                  <DetailMetric
                    label="Về sớm"
                    value={detailHours(detail.data.totals.earlySeconds, 1)}
                    icon={Timer}
                    tone="orange"
                    note="giờ"
                  />
                  <DetailMetric
                    label="Số ngày làm việc"
                    value={
                      detail.data.workingDaysAvailable
                        ? String(detail.data.workingDays ?? 0)
                        : 'N/A'
                    }
                    icon={CalendarDays}
                    tone="navy"
                    note={!detail.data.workingDaysAvailable ? 'Chưa có policy' : undefined}
                  />
                  <DetailMetric
                    label="Số ngày có mặt"
                    value={`${detail.data.totals.attendanceDays} ngày`}
                    icon={CalendarDays}
                    tone="violet"
                  />
                  <DetailMetric
                    label="Số ngoại lệ"
                    value={String(detail.data.totals.exceptionCount)}
                    icon={AlertTriangle}
                    tone="rose"
                  />
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto border-b border-slate-200">
                <nav className="flex min-w-max px-3" aria-label="Nội dung bảng công">
                  {detailTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        className={cn(
                          'flex h-12 items-center gap-2 border-b-2 px-4 text-sm font-medium transition',
                          activeTab === tab.id
                            ? 'border-primary text-primary'
                            : 'border-transparent text-slate-500 hover:text-navy',
                        )}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setPage(1);
                        }}
                      >
                        <Icon className="h-4 w-4" /> {tab.label}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {activeTab === 'detail' && (
                <>
                  {detail.data.rows.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1280px] text-left text-xs">
                        <thead className="bg-slate-50 text-[11px] text-slate-600">
                          <tr>
                            {[
                              '#',
                              'Ngày',
                              'Thứ',
                              'Ca',
                              'Giờ vào',
                              'Giờ ra',
                              'Giờ nghỉ',
                              'Giờ tính công',
                              '100%',
                              '130%',
                              '150%',
                              '200%',
                              '210%',
                              '230%',
                              'Đi muộn',
                              'Về sớm',
                              'Trạng thái',
                              'Ghi chú',
                            ].map((header) => (
                              <th
                                key={header}
                                className="whitespace-nowrap border-r border-slate-200 px-2.5 py-3 text-center font-semibold last:border-r-0"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map((row, index) => (
                            <tr
                              key={row.id}
                              className={cn(
                                'border-t border-slate-100',
                                row.status !== 'VALID' && 'bg-rose-50/60',
                              )}
                            >
                              <td className="px-2.5 py-2.5 text-center text-slate-500">
                                {(page - 1) * pageSize + index + 1}
                              </td>
                              <td className="whitespace-nowrap px-2.5 py-2.5 text-center font-medium text-navy">
                                {detailDate(row.shiftDate, timezone)}
                              </td>
                              <td className="whitespace-nowrap px-2.5 py-2.5 text-center">
                                {detailWeekday(row.shiftDate, timezone)}
                              </td>
                              <td className="px-2.5 py-2.5 text-center">
                                <span
                                  className={cn(
                                    'rounded-full px-2.5 py-1 font-semibold',
                                    row.shiftCode === 'CA3'
                                      ? 'bg-violet-100 text-violet-700'
                                      : 'bg-blue-100 text-blue-700',
                                  )}
                                >
                                  {row.shiftCode ?? '—'}
                                </span>
                              </td>
                              <td className="px-2.5 py-2.5 text-center tabular-nums">
                                {detailTime(row.checkInAt, timezone)}
                              </td>
                              <td className="px-2.5 py-2.5 text-center tabular-nums">
                                {detailTime(row.checkOutAt, timezone)}
                              </td>
                              {[
                                row.breakSeconds,
                                row.workedSeconds,
                                row.tier100Seconds,
                                row.tier130Seconds,
                                row.tier150Seconds,
                                row.tier200Seconds,
                                row.tier210Seconds,
                                row.tier230Seconds,
                                row.lateSeconds,
                                row.earlySeconds,
                              ].map((value, valueIndex) => (
                                <td
                                  key={valueIndex}
                                  className={cn(
                                    'px-2.5 py-2.5 text-center tabular-nums',
                                    valueIndex === 3 && 'text-violet-700',
                                    valueIndex === 4 && 'text-orange-600',
                                    valueIndex === 5 && 'text-sky-600',
                                    valueIndex === 6 && 'text-rose-600',
                                    valueIndex === 7 && 'text-pink-600',
                                  )}
                                >
                                  {detailHours(value)}
                                </td>
                              ))}
                              <td className="px-2.5 py-2.5 text-center">
                                <span
                                  className={cn(
                                    'whitespace-nowrap rounded-full px-2.5 py-1 font-semibold',
                                    row.status === 'VALID'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-amber-100 text-amber-700',
                                  )}
                                >
                                  {row.status === 'VALID' ? 'Hợp lệ' : 'Cần kiểm tra'}
                                </span>
                              </td>
                              <td
                                className="max-w-48 truncate px-2.5 py-2.5 text-slate-500"
                                title={row.exceptions.map((item) => item.code).join(', ')}
                              >
                                {row.exceptions.length
                                  ? row.exceptions.map((item) => item.code).join(', ')
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-slate-200 bg-slate-50 font-bold text-navy">
                          <tr>
                            <td colSpan={7} className="px-3 py-3 text-right">
                              Tổng cộng
                            </td>
                            {[
                              detail.data.totals.workedSeconds,
                              detail.data.totals.tier100Seconds,
                              detail.data.totals.tier130Seconds,
                              detail.data.totals.tier150Seconds,
                              detail.data.totals.tier200Seconds,
                              detail.data.totals.tier210Seconds,
                              detail.data.totals.tier230Seconds,
                              detail.data.totals.lateSeconds,
                              detail.data.totals.earlySeconds,
                            ].map((value, index) => (
                              <td key={index} className="px-2.5 py-3 text-center tabular-nums">
                                {detailHours(value)}
                              </td>
                            ))}
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <EmptyState description="Nhân viên chưa có dữ liệu nguồn hoặc kết quả tính công trong kỳ đã chọn." />
                  )}
                  <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <select
                        aria-label="Hiển thị chi tiết"
                        className="h-9 rounded-lg border border-slate-200 bg-white px-3"
                        value={pageSize}
                        onChange={(event) => {
                          setPageSize(Number(event.target.value));
                          setPage(1);
                        }}
                      >
                        {[10, 15, 30].map((size) => (
                          <option key={size} value={size}>
                            Hiển thị {size} dòng
                          </option>
                        ))}
                      </select>
                      <span>
                        Đang hiển thị {detail.data.rows.length ? (page - 1) * pageSize + 1 : 0} -{' '}
                        {Math.min(page * pageSize, detail.data.rows.length)} /{' '}
                        {detail.data.rows.length} dòng
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-md border border-slate-200 p-2 disabled:opacity-40"
                        disabled={page <= 1}
                        onClick={() => setPage((current) => current - 1)}
                        aria-label="Trang trước"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white">
                        {page}
                      </span>
                      <span className="text-xs text-slate-500">/ {totalPages}</span>
                      <button
                        className="rounded-md border border-slate-200 p-2 disabled:opacity-40"
                        disabled={page >= totalPages}
                        onClick={() => setPage((current) => current + 1)}
                        aria-label="Trang sau"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'summary' && (
                <div className="grid gap-4 p-5 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <h3 className="font-bold text-navy">Cơ cấu giờ công</h3>
                    <dl className="mt-4 space-y-3 text-sm">
                      {[
                        ['Tổng giờ công', detail.data.totals.workedSeconds],
                        ['Giờ 100%', detail.data.totals.tier100Seconds],
                        ['Giờ 130%', detail.data.totals.tier130Seconds],
                        ['Giờ 150%', detail.data.totals.tier150Seconds],
                        ['Giờ 200%', detail.data.totals.tier200Seconds],
                        ['Giờ 210%', detail.data.totals.tier210Seconds],
                        ['Giờ 230%', detail.data.totals.tier230Seconds],
                      ].map(([label, value]) => (
                        <div
                          key={String(label)}
                          className="flex justify-between border-b border-slate-100 pb-2"
                        >
                          <dt className="text-slate-500">{label}</dt>
                          <dd className="font-semibold tabular-nums text-navy">
                            {formatDuration(value as number)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <h3 className="font-bold text-navy">Chất lượng dữ liệu</h3>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Ngày có mặt</dt>
                        <dd className="font-semibold text-navy">
                          {detail.data.totals.attendanceDays}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Ngoại lệ mở</dt>
                        <dd className="font-semibold text-rose-600">
                          {detail.data.totals.exceptionCount}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-slate-500">Revision cao nhất</dt>
                        <dd className="font-semibold text-navy">
                          {detail.data.calculationVersion.maxRevision ?? '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-slate-500">Engine</dt>
                        <dd
                          className="truncate font-semibold text-navy"
                          title={detail.data.calculationVersion.engineVersions.join(', ')}
                        >
                          {detail.data.calculationVersion.engineVersions.join(', ') || '—'}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                      Số ngày làm việc chưa được suy diễn vì chưa có lịch/policy được phê duyệt.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'chart' && (
                <div className="p-5">
                  <h3 className="font-bold text-navy">Tỷ trọng theo mức công</h3>
                  <div className="mt-5 space-y-4">
                    {[
                      ['100%', detail.data.totals.tier100Seconds, 'bg-emerald-500'],
                      ['130%', detail.data.totals.tier130Seconds, 'bg-violet-500'],
                      ['150%', detail.data.totals.tier150Seconds, 'bg-orange-500'],
                      ['200%', detail.data.totals.tier200Seconds, 'bg-sky-500'],
                      ['210%', detail.data.totals.tier210Seconds, 'bg-rose-500'],
                      ['230%', detail.data.totals.tier230Seconds, 'bg-pink-500'],
                    ].map(([label, value, color]) => {
                      const seconds = value as number;
                      const ratio = detail.data.totals.workedSeconds
                        ? (seconds / detail.data.totals.workedSeconds) * 100
                        : 0;
                      return (
                        <div
                          key={String(label)}
                          className="grid grid-cols-[52px_minmax(0,1fr)_150px] items-center gap-3 text-sm"
                        >
                          <span className="font-semibold text-navy">{label}</span>
                          <div className="h-5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={cn('h-full rounded-full', color as string)}
                              style={{ width: `${Math.min(100, ratio)}%` }}
                            />
                          </div>
                          <span className="text-right tabular-nums text-slate-600">
                            {formatDuration(seconds)} ({ratio.toFixed(1)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'source' && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        {[
                          'Dòng',
                          'Mã nhân viên',
                          'Tên nhân viên',
                          'Phòng ban',
                          'Ngày chấm công',
                          'Giờ vào',
                          'Giờ ra',
                          'Tên ca',
                        ].map((header) => (
                          <th key={header} className="px-3 py-3 font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.data.rows.map((row) => (
                        <tr key={row.rawId} className="border-t border-slate-100">
                          <td className="px-3 py-3">{row.rowNo}</td>
                          <td className="px-3 py-3 font-semibold">{row.source.employeeCode}</td>
                          <td className="px-3 py-3">{row.source.employeeName}</td>
                          <td className="px-3 py-3">{row.source.departmentName}</td>
                          <td className="px-3 py-3">{row.source.attendanceDate ?? '—'}</td>
                          <td className="px-3 py-3">{row.source.checkIn ?? '—'}</td>
                          <td className="px-3 py-3">{row.source.checkOut ?? '—'}</td>
                          <td className="px-3 py-3">{row.source.shiftName ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'history' &&
                (detail.data.adjustments.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          {['Thời gian', 'Dòng nguồn', 'Revision', 'Người thực hiện', 'Lý do'].map(
                            (header) => (
                              <th key={header} className="px-3 py-3 font-semibold">
                                {header}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.data.adjustments.map((item) => (
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="px-3 py-3">
                              {new Date(item.createdAt).toLocaleString('vi-VN', {
                                timeZone: timezone,
                              })}
                            </td>
                            <td className="px-3 py-3">{item.rowNo}</td>
                            <td className="px-3 py-3">{item.revision}</td>
                            <td className="px-3 py-3">{item.actor.username}</td>
                            <td className="px-3 py-3">{item.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState description="Chưa có điều chỉnh nào trong kỳ này. Mọi điều chỉnh phải có revision, actor và lý do." />
                ))}
            </section>
            <p className="flex items-start gap-2 text-xs text-slate-500">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              Chỉ hiển thị revision mới nhất của từng dòng nguồn. Ngày không có dữ liệu không được
              tự gán là nghỉ; thao tác chỉnh sửa/chốt công vẫn khóa cho tới khi Q10/Q11 được duyệt.
            </p>
          </div>

          <aside className="space-y-3">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-navy">Thông tin nhân viên</h3>
              <dl className="mt-4 space-y-3 text-xs">
                {[
                  ['Mã nhân viên', detail.data.employee.code],
                  ['Họ tên', detail.data.employee.name],
                  ['Phòng ban', detail.data.employee.departmentName ?? '—'],
                  ['Chức danh', detail.data.employee.position ?? 'Chưa cập nhật'],
                  ['Ngày vào làm', detailDate(detail.data.employee.startDate, timezone)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="mt-1 font-medium text-navy">{value}</dd>
                  </div>
                ))}
                <div>
                  <dt className="text-slate-500">Trạng thái</dt>
                  <dd className="mt-1">
                    {status && (
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2.5 py-1 font-semibold',
                          status.className,
                        )}
                      >
                        {status.label}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-navy">
                Tổng hợp tháng{' '}
                {detail.data.period
                  ? `${String(detail.data.period.month).padStart(2, '0')}/${detail.data.period.year}`
                  : '—'}
              </h3>
              <dl className="mt-4 space-y-3 text-[11px]">
                {[
                  ['Tổng giờ công', detail.data.totals.workedSeconds, 'text-blue-600'],
                  ['Giờ 100%', detail.data.totals.tier100Seconds, 'text-emerald-600'],
                  ['Giờ 130%', detail.data.totals.tier130Seconds, 'text-violet-600'],
                  ['Giờ 150%', detail.data.totals.tier150Seconds, 'text-orange-600'],
                  ['Giờ 200%', detail.data.totals.tier200Seconds, 'text-sky-600'],
                  ['Giờ 210%', detail.data.totals.tier210Seconds, 'text-rose-600'],
                  ['Giờ 230%', detail.data.totals.tier230Seconds, 'text-pink-600'],
                  ['Đi muộn', detail.data.totals.lateSeconds, 'text-rose-600'],
                  ['Về sớm', detail.data.totals.earlySeconds, 'text-orange-600'],
                ].map(([label, value, color]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-2">
                    <dt className={cn('font-medium', color as string)}>{label}</dt>
                    <dd className="tabular-nums text-navy">
                      {detailHours(value as number, 1)} giờ
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between">
                  <dt className="text-slate-500">Số ngày làm việc</dt>
                  <dd className="font-semibold text-navy">N/A</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Số ngày có mặt</dt>
                  <dd className="font-semibold text-navy">{detail.data.totals.attendanceDays}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-rose-600">Số ngoại lệ</dt>
                  <dd className="font-semibold text-rose-600">
                    {detail.data.totals.exceptionCount}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-navy">Ghi chú</h3>
              <p className="mt-3 min-h-16 rounded-lg border border-slate-200 p-3 text-xs text-slate-500">
                {detail.data.totals.exceptionCount
                  ? 'Có ngoại lệ mở cần xử lý tại màn Xử lý ngoại lệ.'
                  : 'Không có ngoại lệ mở trong dữ liệu đang hiển thị.'}
              </p>
            </section>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
