import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, Clock3, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
  cn,
} from '@tinh-cong/ui';
import { api } from '../api.js';
import { useAuth } from '../auth.js';
import { useApiQuery } from '../use-api-query.js';

interface ShiftRule {
  id: string;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  scheduledStartSeconds: number;
  scheduledCompletionSeconds: number;
  breakStartSeconds: number;
  breakEndSeconds: number;
}

interface Shift {
  id: string;
  code: string;
  name: string;
  active: boolean;
  rules: ShiftRule[];
}

interface CompanyHoliday {
  id: string;
  holidayDate: string;
  name: string;
  createdAt: string;
  createdBy: { id: string; username: string };
  resolvedExceptions?: number;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function secondsToTime(value: number) {
  const normalized = value % 86_400;
  return `${String(Math.floor(normalized / 3600)).padStart(2, '0')}:${String(
    Math.floor((normalized % 3600) / 60),
  ).padStart(2, '0')}`;
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(`${dateOnly(value)}T00:00:00+07:00`));
}

export function ShiftsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = Boolean(user?.roles.some((role) => role === 'ADMIN' || role === 'HR'));
  const [month, setMonth] = useState(currentMonth);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompanyHoliday | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'error' } | null>(null);

  const shifts = useApiQuery<Shift[]>(['shifts'], '/shifts');
  const holidays = useApiQuery<CompanyHoliday[]>(
    ['company-holidays', month],
    `/company-holidays?month=${month}`,
  );
  const activeRules = useMemo(
    () =>
      (shifts.data ?? []).map((shift) => ({
        shift,
        rule: [...shift.rules].sort((a, b) => b.version - a.version)[0] ?? null,
      })),
    [shifts.data],
  );

  function notify(text: string, tone: 'success' | 'error' = 'success') {
    setMessage({ text, tone });
    window.setTimeout(() => setMessage(null), 4000);
  }

  async function createHoliday(event: FormEvent) {
    event.preventDefault();
    if (!holidayDate || !holidayName.trim()) {
      notify('Vui lòng nhập ngày và tên ngày nghỉ lễ.', 'error');
      return;
    }
    setSaving(true);
    try {
      const created = await api<CompanyHoliday>('/company-holidays', {
        method: 'POST',
        body: JSON.stringify({ holidayDate, name: holidayName.trim() }),
      });
      setMonth(dateOnly(created.holidayDate).slice(0, 7));
      setHolidayDate('');
      setHolidayName('');
      await queryClient.invalidateQueries({ queryKey: ['company-holidays'] });
      notify(
        created.resolvedExceptions
          ? `Đã lưu ngày nghỉ và đóng ${created.resolvedExceptions} ngoại lệ không còn áp dụng.`
          : 'Đã lưu ngày nghỉ lễ công ty.',
      );
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Không thể lưu ngày nghỉ lễ.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removeHoliday() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/company-holidays/${deleteTarget.id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['company-holidays'] });
      notify('Đã xóa cấu hình ngày nghỉ lễ.');
      setDeleteTarget(null);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Không thể xóa ngày nghỉ lễ.', 'error');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      {message && (
        <div
          role="status"
          className={cn(
            'fixed right-5 top-20 z-[70] max-w-md rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl',
            message.tone === 'success' ? 'bg-emerald-600' : 'bg-red-600',
          )}
        >
          {message.text}
        </div>
      )}

      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-navy">Cấu hình ca làm việc</h1>
        <p className="mt-1 text-sm text-slate-500">
          Theo dõi rule ca và cấu hình ngày nghỉ lễ công ty theo từng tháng.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
                <Clock3 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-bold text-navy">Quy tắc ca hiện hành</h2>
                <p className="text-xs text-slate-500">Rule có phiên bản và ngày hiệu lực rõ ràng</p>
              </div>
            </div>
          </CardHeader>
          {shifts.isLoading ? (
            <Skeleton className="m-5 h-56" />
          ) : shifts.isError ? (
            <CardContent><ErrorState message={shifts.error.message} /></CardContent>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeRules.map(({ shift, rule }) => (
                <div key={shift.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-navy">{shift.name}</span>
                      <Badge tone={shift.active ? 'success' : 'neutral'}>
                        {shift.active ? 'Đang áp dụng' : 'Ngừng áp dụng'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Mã {shift.code} · {rule ? `Phiên bản ${rule.version}` : 'Chưa có rule'}
                    </p>
                  </div>
                  {rule && (
                    <div className="text-sm text-slate-600 sm:text-right">
                      <p className="font-semibold text-navy">
                        {secondsToTime(rule.scheduledStartSeconds)} – {secondsToTime(rule.scheduledCompletionSeconds)}
                      </p>
                      <p className="mt-1 text-xs">
                        Nghỉ {secondsToTime(rule.breakStartSeconds)} – {secondsToTime(rule.breakEndSeconds)}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-violet-50 p-2.5 text-violet-600">
                  <CalendarDays className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-bold text-navy">Ngày nghỉ lễ công ty</h2>
                  <p className="text-xs text-slate-500">HR và ADMIN quản lý</p>
                </div>
              </div>
              <Input
                aria-label="Tháng ngày nghỉ lễ"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="w-full sm:w-40"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                Ngày đã cấu hình chỉ được bỏ qua ngoại lệ khi <strong>cả giờ vào và giờ ra đều trống</strong>.
                Có dữ liệu chấm công vẫn được kiểm tra và tính bình thường.
              </p>
            </div>

            {canManage && (
              <form onSubmit={(event) => void createHoliday(event)} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-600">
                  Ngày nghỉ
                  <Input aria-label="Ngày nghỉ" type="date" value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} className="mt-1.5" />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Tên ngày nghỉ
                  <Input aria-label="Tên ngày nghỉ" value={holidayName} maxLength={255} placeholder="Ví dụ: Quốc khánh" onChange={(event) => setHolidayName(event.target.value)} className="mt-1.5" />
                </label>
                <div className="sm:col-span-2 sm:text-right">
                  <Button type="submit" disabled={saving}>
                    <Plus className="h-4 w-4" /> {saving ? 'Đang lưu…' : 'Thêm ngày nghỉ'}
                  </Button>
                </div>
              </form>
            )}

            {holidays.isLoading ? (
              <Skeleton className="h-44" />
            ) : holidays.isError ? (
              <ErrorState message={holidays.error.message} />
            ) : holidays.data?.length ? (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Ngày</th>
                      <th className="px-4 py-3 font-semibold">Tên ngày nghỉ</th>
                      {canManage && <th className="w-16 px-4 py-3 text-right font-semibold">Xóa</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {holidays.data.map((holiday) => (
                      <tr key={holiday.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold capitalize text-navy">{formatDate(holiday.holidayDate)}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{dateOnly(holiday.holidayDate)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-700">{holiday.name}</p>
                          <p className="mt-0.5 text-xs text-slate-400">Tạo bởi {holiday.createdBy.username}</p>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            <Button type="button" variant="ghost" size="sm" aria-label={`Xóa ${holiday.name}`} onClick={() => setDeleteTarget(holiday)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState description={`Chưa cấu hình ngày nghỉ lễ trong tháng ${month}.`} />
            )}
          </CardContent>
        </Card>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label="Xác nhận xóa ngày nghỉ">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-amber-50 p-2 text-amber-600"><AlertTriangle className="h-5 w-5" /></span>
              <div>
                <h3 className="font-bold text-navy">Xóa ngày nghỉ lễ?</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {deleteTarget.name} · {dateOnly(deleteTarget.holidayDate)}. Hệ thống sẽ từ chối nếu ngày này đã có dữ liệu import hoặc kỳ đã khóa.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Hủy</Button>
              <Button variant="danger" onClick={() => void removeHoliday()} disabled={deleting}>
                {deleting ? 'Đang xóa…' : 'Xóa ngày nghỉ'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
