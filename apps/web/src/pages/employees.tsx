import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, EmptyState, ErrorState, Input, Skeleton, cn } from '@tinh-cong/ui';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  CirclePause,
  Download,
  FileSpreadsheet,
  History,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserRoundX,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { FormEvent, ReactNode, useMemo, useRef, useState } from 'react';
import { api, apiBlob } from '../api.js';
import { useAuth } from '../auth.js';
import { useApiQuery } from '../use-api-query.js';

type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED';

interface Department {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

interface Employee {
  id: string;
  code: string;
  name: string;
  status: EmployeeStatus;
  departmentId: string | null;
  department: Department | null;
}

interface EmployeePage {
  items: Employee[];
  total: number;
  page: number;
  pageSize: number;
}

interface EmployeeStatistics {
  total: number;
  ACTIVE: number;
  ON_LEAVE: number;
  RESIGNED: number;
}

interface EmployeeHistoryRow {
  id: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  effectiveFrom: string | null;
  createdAt: string;
  actor: { id: string; username: string } | null;
}

interface ImportPreview {
  fileName: string;
  rowCount: number;
  rows: Array<{
    code: string;
    name: string;
    departmentId: string;
    status: EmployeeStatus;
  }>;
  errors: Array<{ row: number; field: string; message: string }>;
  canConfirm: boolean;
}

interface EmployeeFormState {
  code: string;
  name: string;
  departmentId: string;
  status: EmployeeStatus;
}

const statusMeta: Record<EmployeeStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'Đang làm việc', className: 'bg-emerald-100 text-emerald-700' },
  ON_LEAVE: { label: 'Tạm nghỉ', className: 'bg-violet-100 text-violet-700' },
  RESIGNED: { label: 'Nghỉ việc', className: 'bg-rose-100 text-rose-700' },
};

const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat('vi-VN').format(new Date(value)) : '—';

function emptyForm(): EmployeeFormState {
  return {
    code: '',
    name: '',
    departmentId: '',
    status: 'ACTIVE',
  };
}

function employeeForm(employee: Employee): EmployeeFormState {
  return {
    code: employee.code,
    name: employee.name,
    departmentId: employee.departmentId ?? '',
    status: employee.status,
  };
}

function StatusBadge({ status }: { status: EmployeeStatus }) {
  const meta = statusMeta[status];
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-slate-700">
      <span className="mb-1.5 block">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

const controlClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-navy outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-slate-100 disabled:text-slate-500';

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | undefined;
  icon: typeof Users;
  tone: 'blue' | 'green' | 'orange' | 'violet';
}) {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-emerald-100 text-emerald-600',
    orange: 'bg-amber-100 text-amber-500',
    violet: 'bg-violet-100 text-violet-600',
  };
  return (
    <div className="flex min-h-[92px] items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span
        className={cn(
          'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl',
          colors[tone],
        )}
      >
        <Icon className="h-7 w-7" />
      </span>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        {value === undefined ? (
          <Skeleton className="mt-2 h-7 w-16" />
        ) : (
          <p className="mt-1 text-2xl font-bold text-navy">{value}</p>
        )}
      </div>
    </div>
  );
}

function EmployeePanel({
  employee,
  mode,
  departments,
  onClose,
  onSaved,
  onRequestDelete,
  notify,
}: {
  employee: Employee | null;
  mode: 'view' | 'edit' | 'create';
  departments: Department[];
  onClose: () => void;
  onSaved: (employee: Employee) => void;
  onRequestDelete: (employee: Employee) => void;
  notify: (message: string, tone?: 'success' | 'error') => void;
}) {
  const [tab, setTab] = useState<'info' | 'history'>('info');
  const [editing, setEditing] = useState(mode !== 'view');
  const [form, setForm] = useState<EmployeeFormState>(
    employee ? employeeForm(employee) : emptyForm(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const history = useQuery({
    queryKey: ['employee-history', employee?.id],
    queryFn: () => api<EmployeeHistoryRow[]>(`/employees/${employee!.id}/history`),
    enabled: Boolean(employee && tab === 'history'),
  });

  const set = (key: keyof EmployeeFormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!form.code.trim() || !form.name.trim() || !form.departmentId) {
      setError('Vui lòng nhập đủ mã nhân viên, họ tên và phòng ban.');
      return;
    }
    setSaving(true);
    try {
      const base = {
        name: form.name.trim(),
        departmentId: form.departmentId,
        status: form.status,
      };
      const saved = employee
        ? await api<Employee>(`/employees/${employee.id}`, {
            method: 'PATCH',
            body: JSON.stringify(base),
          })
        : await api<Employee>('/employees', {
            method: 'POST',
            body: JSON.stringify({
              ...base,
              code: form.code.trim(),
            }),
          });
      notify(employee ? 'Đã lưu thay đổi nhân viên.' : 'Đã thêm nhân viên mới.');
      onSaved(saved);
      setEditing(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Không thể lưu nhân viên.';
      setError(message);
      notify(message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const displayEmployee =
    employee ??
    ({
      name: form.name || 'Nhân viên mới',
      code: form.code || 'Chưa có mã',
      status: form.status,
    } as Employee);
  const disabled = !editing;

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[400px] flex-col border-l border-slate-200 bg-white shadow-2xl xl:sticky xl:top-[74px] xl:z-0 xl:h-[calc(100vh-174px)] xl:w-[380px] xl:shrink-0 xl:rounded-xl xl:border xl:shadow-sm">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-5">
        <h2 className="font-bold text-navy">Thông tin nhân viên</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Đóng thông tin nhân viên"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex items-center gap-4 px-5 py-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-primary ring-4 ring-blue-50">
          <CircleUserRound className="h-10 w-10" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-navy">{displayEmployee.name}</p>
          <p className="mb-2 text-xs text-slate-500">Mã NV: {displayEmployee.code}</p>
          <StatusBadge status={displayEmployee.status} />
        </div>
      </div>
      <div className="flex shrink-0 border-b border-slate-200 px-4">
        {(
          [
            ['info', 'Thông tin'],
            ['history', 'Lịch sử'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'flex-1 border-b-2 px-1 py-3 text-xs font-medium',
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-navy',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
          {tab === 'info' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Mã nhân viên" required>
                  <Input
                    value={form.code}
                    onChange={(event) => set('code', event.target.value)}
                    disabled={Boolean(employee) || disabled}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Tên nhân viên" required>
                  <Input
                    value={form.name}
                    onChange={(event) => set('name', event.target.value)}
                    disabled={disabled}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Phòng ban" required>
                  <select
                    className={controlClass}
                    value={form.departmentId}
                    onChange={(event) => set('departmentId', event.target.value)}
                    disabled={disabled}
                  >
                    <option value="">Chọn phòng ban</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Trạng thái" required>
                  <select
                    className={controlClass}
                    value={form.status}
                    onChange={(event) => set('status', event.target.value as EmployeeStatus)}
                    disabled={disabled}
                  >
                    {Object.entries(statusMeta).map(([value, meta]) => (
                      <option key={value} value={value}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          )}
          {tab === 'history' && (
            <div className="space-y-3">
              {!employee ? (
                <EmptyState description="Lịch sử sẽ có sau khi tạo nhân viên." />
              ) : history.isLoading ? (
                <Skeleton className="h-48" />
              ) : history.isError ? (
                <ErrorState message={history.error.message} />
              ) : history.data?.length ? (
                history.data.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex gap-3">
                      <span className="mt-0.5 rounded-lg bg-blue-50 p-2 text-primary">
                        <History className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-navy">
                          {item.action === 'EMPLOYEE_CREATED'
                            ? 'Tạo hồ sơ'
                            : item.action === 'EMPLOYEE_IMPORTED'
                              ? 'Import hồ sơ'
                              : 'Cập nhật hồ sơ'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.actor?.username ?? 'Hệ thống'} ·{' '}
                          {new Intl.DateTimeFormat('vi-VN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          }).format(new Date(item.createdAt))}
                        </p>
                        {item.effectiveFrom && (
                          <p className="mt-1 text-xs text-slate-500">
                            Hiệu lực: {formatDate(item.effectiveFrom)}
                          </p>
                        )}
                        {item.reason && (
                          <p className="mt-2 text-xs text-slate-700">{item.reason}</p>
                        )}
                        <div className="mt-2 text-[11px] text-slate-500">
                          Trạng thái: {String(item.before?.status ?? '—')} →{' '}
                          {String(item.after?.status ?? '—')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState description="Chưa có lịch sử thay đổi." />
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white p-4">
          {employee ? (
            <Button
              type="button"
              variant="secondary"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => onRequestDelete(employee)}
            >
              <Trash2 className="h-4 w-4" /> Ngừng hoạt động
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                editing && employee
                  ? (setForm(employeeForm(employee)), setEditing(false))
                  : onClose()
              }
            >
              {editing ? 'Hủy' : 'Đóng'}
            </Button>
            {editing ? (
              <Button type="submit" disabled={saving}>
                {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
              </Button>
            ) : (
              <Button type="button" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" /> Chỉnh sửa
              </Button>
            )}
          </div>
        </div>
      </form>
    </aside>
  );
}

function ImportDialog({
  onClose,
  onImported,
  notify,
}: {
  onClose: () => void;
  onImported: () => Promise<void>;
  notify: (message: string, tone?: 'success' | 'error') => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function previewFile() {
    if (!file) {
      setError('Vui lòng chọn file Excel .xlsx.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      setPreview(
        await api<ImportPreview>('/employees/import/preview', {
          method: 'POST',
          body: formData,
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể đọc file nhân viên.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!preview?.canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ imported: number }>('/employees/import/confirm', {
        method: 'POST',
        body: JSON.stringify({ rows: preview.rows }),
      });
      await onImported();
      notify(`Đã import ${result.imported} nhân viên.`);
      onClose();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Không thể import nhân viên.';
      setError(message);
      notify(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-import-title"
        className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="employee-import-title" className="text-lg font-bold text-navy">
              Import danh sách nhân viên
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              File gồm đúng bốn cột: Mã nhân viên, Tên nhân viên, Phòng ban, Trạng thái.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Đóng import nhân viên"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="File Excel nhân viên"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setPreview(null);
            setError(null);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-left hover:border-primary hover:bg-blue-50"
        >
          <span className="rounded-lg bg-blue-100 p-2 text-primary">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-navy">
              {file?.name ?? 'Chọn file Excel .xlsx'}
            </span>
            <span className="block text-xs text-slate-500">Tối đa 10 MB</span>
          </span>
        </button>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {preview && (
          <div className="mt-4 rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-navy">
              Đã đọc {preview.rowCount} dòng nhân viên
            </p>
            {preview.errors.length ? (
              <div className="mt-3 max-h-44 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {preview.errors.map((item, index) => (
                  <p key={`${item.row}:${item.field}:${index}`}>
                    {item.row ? `Dòng ${item.row}: ` : ''}
                    {item.message}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-emerald-700">Dữ liệu hợp lệ và sẵn sàng import.</p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          {!preview ? (
            <Button type="button" onClick={() => void previewFile()} disabled={!file || busy}>
              <Upload className="h-4 w-4" /> {busy ? 'Đang đọc…' : 'Kiểm tra file'}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPreview(null);
                  inputRef.current?.click();
                }}
                disabled={busy}
              >
                Chọn file khác
              </Button>
              <Button
                type="button"
                onClick={() => void confirmImport()}
                disabled={!preview.canConfirm || busy}
              >
                <Upload className="h-4 w-4" /> {busy ? 'Đang import…' : 'Xác nhận import'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DepartmentDialog({
  departments,
  onClose,
  onCreated,
  notify,
}: {
  departments: Department[];
  onClose: () => void;
  onCreated: () => Promise<void>;
  notify: (message: string, tone?: 'success' | 'error') => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedCode = code.trim();
    const normalizedName = name.trim();
    if (!normalizedCode || !normalizedName) {
      setError('Vui lòng nhập đủ mã và tên phòng ban.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api<Department>('/departments', {
        method: 'POST',
        body: JSON.stringify({ code: normalizedCode, name: normalizedName }),
      });
      await onCreated();
      setCode('');
      setName('');
      notify(`Đã tạo phòng ban ${normalizedName}.`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Không thể tạo phòng ban.';
      setError(message);
      notify(message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="department-management-title"
        className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="department-management-title" className="text-lg font-bold text-navy">
              Quản lý phòng ban
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Tạo master phòng ban trước khi import nhân viên. File có thể dùng mã hoặc tên duy
              nhất.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Đóng quản lý phòng ban"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={submit}
          className="mt-5 grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
        >
          <Field label="Mã phòng ban" required>
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Ví dụ: AKO"
              maxLength={50}
              autoFocus
            />
          </Field>
          <Field label="Tên phòng ban" required>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ví dụ: AKO"
              maxLength={255}
            />
          </Field>
          <Button type="submit" disabled={saving}>
            <Plus className="h-4 w-4" /> {saving ? 'Đang tạo…' : 'Thêm'}
          </Button>
        </form>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-navy">
            Danh mục hiện có ({departments.length})
          </div>
          <div className="max-h-72 overflow-y-auto">
            {departments.length ? (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Mã phòng ban</th>
                    <th className="px-4 py-2 font-medium">Tên phòng ban</th>
                    <th className="px-4 py-2 text-right font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departments.map((department) => (
                    <tr key={department.id}>
                      <td className="px-4 py-2 font-semibold text-navy">{department.code}</td>
                      <td className="px-4 py-2 text-slate-700">{department.name}</td>
                      <td className="px-4 py-2 text-right">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-1 text-xs font-medium',
                            department.active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {department.active ? 'Hoạt động' : 'Ngừng hoạt động'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState description="Chưa có phòng ban." />
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EmployeesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canManage = Boolean(user?.roles.some((role) => role === 'ADMIN' || role === 'HR'));
  const canManageDepartments = Boolean(user?.roles.includes('ADMIN'));
  const [draftSearch, setDraftSearch] = useState('');
  const [filters, setFilters] = useState({ search: '', departmentId: '', status: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ by: string; order: 'asc' | 'desc' }>({
    by: 'code',
    order: 'asc',
  });
  const [selected, setSelected] = useState<Employee | null>(null);
  const [panelMode, setPanelMode] = useState<'view' | 'edit' | 'create'>('view');
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDepartments, setShowDepartments] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const params = useMemo(() => {
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortBy: sort.by,
      sortOrder: sort.order,
    });
    if (filters.search) query.set('search', filters.search);
    if (filters.departmentId) query.set('departmentId', filters.departmentId);
    if (filters.status) query.set('status', filters.status);
    return query.toString();
  }, [filters, page, pageSize, sort]);

  const employees = useApiQuery<EmployeePage>(['employees', params], `/employees?${params}`);
  const statistics = useApiQuery<EmployeeStatistics>(
    ['employee-statistics'],
    '/employees/statistics',
  );
  const departments = useApiQuery<Department[]>(['departments'], '/departments');
  const totalPages = Math.max(1, Math.ceil((employees.data?.total ?? 0) / pageSize));

  function notify(message: string, tone: 'success' | 'error' = 'success') {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 3500);
  }

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['employees'] }),
      queryClient.invalidateQueries({ queryKey: ['employee-statistics'] }),
    ]);
  }

  async function refreshDepartments() {
    await queryClient.invalidateQueries({ queryKey: ['departments'] });
  }

  async function downloadTemplate() {
    try {
      const blob = await apiBlob('/employees/template');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mau-danh-sach-nhan-vien.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Không thể tải file mẫu.', 'error');
    }
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setFilters((current) => ({ ...current, search: draftSearch.trim() }));
  }

  function clearFilters() {
    setDraftSearch('');
    setFilters({ search: '', departmentId: '', status: '' });
    setPage(1);
  }

  function toggleSort(by: string) {
    setSort((current) => ({
      by,
      order: current.by === by && current.order === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  }

  async function deactivate() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await api<{ preservedAttendance: boolean; attendanceRecords: number }>(
        `/employees/${deleteTarget.id}`,
        {
          method: 'DELETE',
          body: JSON.stringify({
            reason: 'Ngừng hoạt động theo xác nhận trên màn quản lý nhân viên.',
          }),
        },
      );
      notify(
        `Đã chuyển sang Nghỉ việc. ${result.attendanceRecords} bản ghi chấm công được giữ nguyên.`,
      );
      setDeleteTarget(null);
      setSelected(null);
      await refresh();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Không thể ngừng hoạt động.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const kpis = [
    ['Tổng nhân viên', statistics.data?.total, Users, 'blue'],
    ['Đang làm việc', statistics.data?.ACTIVE, UsersRound, 'green'],
    ['Nghỉ việc', statistics.data?.RESIGNED, UserRoundX, 'orange'],
    ['Tạm nghỉ', statistics.data?.ON_LEAVE, CirclePause, 'violet'],
  ] as const;

  return (
    <div className="mx-auto max-w-[1600px]">
      {toast && (
        <div
          role="status"
          className={cn(
            'fixed right-5 top-20 z-[70] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl',
            toast.tone === 'success' ? 'bg-emerald-600' : 'bg-red-600',
          )}
        >
          {toast.message}
        </div>
      )}
      <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Quản lý nhân viên</h1>
          <p className="mt-1 text-sm text-slate-500">
            Danh sách và thông tin nhân viên trong công ty
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {canManageDepartments && (
              <Button variant="secondary" onClick={() => setShowDepartments(true)}>
                <Building2 className="h-4 w-4" /> Quản lý phòng ban
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowImport(true)}>
              <Upload className="h-4 w-4" /> Import danh sách
            </Button>
            <Button variant="secondary" onClick={() => void downloadTemplate()}>
              <Download className="h-4 w-4" /> Tải file mẫu
            </Button>
            <Button
              onClick={() => {
                setSelected(null);
                setPanelMode('create');
              }}
            >
              <Plus className="h-4 w-4" /> Thêm nhân viên
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {kpis.map(([label, value, Icon, tone]) => (
              <KpiCard
                key={label}
                label={label}
                value={statistics.isLoading ? undefined : value}
                icon={Icon}
                tone={tone}
              />
            ))}
          </div>

          <section>
            <form
              onSubmit={applyFilters}
              className="mb-3 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-2 2xl:grid-cols-[minmax(230px,1.5fr)_1fr_1fr_auto_auto] 2xl:items-end"
            >
              <Field label="Tìm kiếm">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-9"
                    placeholder="Tìm mã NV, tên nhân viên…"
                    value={draftSearch}
                    onChange={(event) => setDraftSearch(event.target.value)}
                  />
                </div>
              </Field>
              <Field label="Phòng ban">
                <select
                  className={controlClass}
                  value={filters.departmentId}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, departmentId: event.target.value }));
                    setPage(1);
                  }}
                >
                  <option value="">Tất cả phòng ban</option>
                  {departments.data?.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Trạng thái">
                <select
                  className={controlClass}
                  value={filters.status}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, status: event.target.value }));
                    setPage(1);
                  }}
                >
                  <option value="">Tất cả</option>
                  {Object.entries(statusMeta).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Button type="submit">
                <Search className="h-4 w-4" /> Tìm kiếm
              </Button>
              <Button type="button" variant="secondary" onClick={clearFilters}>
                Xóa lọc
              </Button>
            </form>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {employees.isError && (
                <div className="p-4">
                  <ErrorState message={employees.error.message} />
                </div>
              )}
              {employees.isLoading ? (
                <div className="p-5">
                  <Skeleton className="h-[420px]" />
                </div>
              ) : employees.data?.items.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-600">
                      <tr>
                        {(
                          [
                            ['code', 'Mã nhân viên'],
                            ['name', 'Tên nhân viên'],
                            ['department', 'Phòng ban'],
                            ['status', 'Trạng thái'],
                          ] as const
                        ).map(([key, label]) => (
                          <th key={key} className="px-3 py-3 font-semibold">
                            <button
                              type="button"
                              onClick={() => toggleSort(key)}
                              className="hover:text-primary"
                            >
                              {label}
                              {sort.by === key ? (sort.order === 'asc' ? ' ↑' : ' ↓') : ''}
                            </button>
                          </th>
                        ))}
                        <th className="px-3 py-3 text-center font-semibold">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {employees.data.items.map((employee) => (
                        <tr
                          key={employee.id}
                          onClick={() => {
                            setSelected(employee);
                            setPanelMode('view');
                          }}
                          className={cn(
                            'h-[52px] cursor-pointer transition hover:bg-blue-50/60',
                            selected?.id === employee.id && 'bg-blue-100/70',
                          )}
                        >
                          <td className="px-3 font-semibold text-navy">{employee.code}</td>
                          <td className="px-3 font-medium text-navy">{employee.name}</td>
                          <td className="px-3 text-slate-600">
                            {employee.department?.name ?? '—'}
                          </td>
                          <td className="px-3">
                            <StatusBadge status={employee.status} />
                          </td>
                          <td className="px-3">
                            <div className="flex justify-center gap-1">
                              {canManage && (
                                <button
                                  type="button"
                                  title="Chỉnh sửa"
                                  aria-label={`Chỉnh sửa ${employee.name}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelected(employee);
                                    setPanelMode('edit');
                                  }}
                                  className="rounded-lg p-2 text-primary hover:bg-blue-100"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              )}
                              {canManage && (
                                <button
                                  type="button"
                                  title="Ngừng hoạt động"
                                  aria-label={`Ngừng hoạt động ${employee.name}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setDeleteTarget(employee);
                                  }}
                                  className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                !employees.isError && (
                  <EmptyState
                    title="Chưa có nhân viên"
                    description="Không tìm thấy nhân viên phù hợp trong phạm vi truy cập."
                  />
                )
              )}
              <div className="flex flex-col gap-3 border-t border-slate-200 px-3 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <select
                    aria-label="Số dòng mỗi trang"
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2"
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                  >
                    <option value={10}>Hiển thị 10 dòng</option>
                    <option value={20}>Hiển thị 20 dòng</option>
                    <option value={50}>Hiển thị 50 dòng</option>
                  </select>
                  <span>
                    Đang hiển thị {employees.data?.total ? (page - 1) * pageSize + 1 : 0}–
                    {Math.min(page * pageSize, employees.data?.total ?? 0)} /{' '}
                    {employees.data?.total ?? 0} nhân viên
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"
                    disabled={page === 1}
                    onClick={() => setPage((current) => current - 1)}
                    aria-label="Trang trước"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-20 text-center">
                    Trang {page} / {totalPages}
                  </span>
                  <button
                    className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => current + 1)}
                    aria-label="Trang sau"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {(selected || panelMode === 'create') && (
          <EmployeePanel
            key={`${panelMode}:${selected?.id ?? 'new'}`}
            employee={selected}
            mode={panelMode}
            departments={departments.data ?? []}
            onClose={() => {
              setSelected(null);
              setPanelMode('view');
            }}
            onSaved={(saved) => {
              setSelected(saved);
              setPanelMode('view');
              void refresh();
            }}
            onRequestDelete={setDeleteTarget}
            notify={notify}
          />
        )}
      </div>

      {showImport && (
        <ImportDialog onClose={() => setShowImport(false)} onImported={refresh} notify={notify} />
      )}

      {showDepartments && (
        <DepartmentDialog
          departments={departments.data ?? []}
          onClose={() => setShowDepartments(false)}
          onCreated={refreshDepartments}
          notify={notify}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
              <Trash2 className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-bold text-navy">Ngừng hoạt động nhân viên?</h2>
            <p className="mt-2 text-sm text-slate-600">
              <strong>
                {deleteTarget.code} · {deleteTarget.name}
              </strong>{' '}
              sẽ chuyển sang trạng thái Nghỉ việc. Hồ sơ và toàn bộ dữ liệu chấm công cũ vẫn được
              giữ nguyên.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Hủy
              </Button>
              <Button variant="danger" onClick={() => void deactivate()} disabled={deleting}>
                {deleting ? 'Đang xử lý…' : 'Xác nhận ngừng'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
