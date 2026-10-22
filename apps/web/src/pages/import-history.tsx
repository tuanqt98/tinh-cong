import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@tinh-cong/ui';
import { api } from '../api.js';
import { useApiQuery } from '../use-api-query.js';

interface ImportHistoryRow {
  id: string;
  originalName: string;
  status: 'PREVIEW' | 'ACCEPTED' | 'REJECTED';
  attemptedAt: string;
  confirmedAt: string | null;
  rejectionReason: string | null;
  _count: { issues: number; rawRows: number };
}

interface HistoryResponse {
  items: ImportHistoryRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface RawRow {
  id: string;
  sheet: string;
  rowNo: number;
  employeeId: string | null;
  employeeCode: string;
  employeeName: string;
  departmentName: string;
  attendanceDateRaw: string | null;
  checkInRaw: string | null;
  checkOutRaw: string | null;
  shiftNameRaw: string | null;
  _count: { exceptions: number; calculations: number };
}

interface RawRowsResponse {
  items: RawRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface ProcessingSummary {
  rawRows: number;
  linkedEmployees: number;
  missingEmployees: number;
  promotedImportIssues: number;
  missingSchedules: number;
  missingTimestampEvidence: number;
  calculatedRows: number;
}

function statusTone(status: ImportHistoryRow['status']) {
  if (status === 'ACCEPTED') return 'success' as const;
  if (status === 'REJECTED') return 'danger' as const;
  return 'warning' as const;
}

function RawRows({ importId }: { importId: string }) {
  const query = useApiQuery<RawRowsResponse>(
    ['import-rows', importId],
    `/imports/${importId}/rows?pageSize=50`,
  );
  if (query.isLoading) return <Skeleton className="h-72" />;
  if (query.isError) return <ErrorState message={query.error.message} />;
  if (!query.data?.items?.length)
    return <EmptyState description="Import này chưa có dữ liệu raw." />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Hiển thị {query.data.items.length.toLocaleString()} / {query.data.total.toLocaleString()}{' '}
        dòng đầu tiên.
      </p>
      <DataTable
        headers={['Nguồn', 'Mã NV', 'Họ tên', 'Phòng ban', 'Ngày', 'Vào', 'Ra', 'Ca', 'Xử lý']}
      >
        {query.data.items.map((row) => (
          <tr key={row.id}>
            <td className="px-4 py-3 text-xs">
              {row.sheet}:{row.rowNo}
            </td>
            <td className="px-4 py-3 text-xs font-medium">{row.employeeCode}</td>
            <td className="px-4 py-3 text-xs">{row.employeeName}</td>
            <td className="px-4 py-3 text-xs">{row.departmentName}</td>
            <td className="px-4 py-3 text-xs">{row.attendanceDateRaw ?? '—'}</td>
            <td className="px-4 py-3 text-xs">{row.checkInRaw ?? '—'}</td>
            <td className="px-4 py-3 text-xs">{row.checkOutRaw ?? '—'}</td>
            <td className="px-4 py-3 text-xs">{row.shiftNameRaw ?? '—'}</td>
            <td className="px-4 py-3 text-xs">
              {row._count.calculations > 0
                ? 'Đã tính'
                : row._count.exceptions > 0
                  ? `${row._count.exceptions} ngoại lệ`
                  : row.employeeId
                    ? 'Đã liên kết'
                    : 'Chưa xử lý'}
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

export function ImportHistory() {
  const queryClient = useQueryClient();
  const history = useApiQuery<HistoryResponse>(['imports'], '/imports?pageSize=20');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ProcessingSummary | null>(null);
  const [error, setError] = useState('');

  async function processImport(id: string) {
    setProcessingId(id);
    setError('');
    setSummary(null);
    try {
      const result = await api<ProcessingSummary>(`/imports/${id}/process`, { method: 'POST' });
      setSummary(result);
      setSelectedId(id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['imports'] }),
        queryClient.invalidateQueries({ queryKey: ['import-rows', id] }),
        queryClient.invalidateQueries({ queryKey: ['exceptions'] }),
        queryClient.invalidateQueries({ queryKey: ['/attendance'] }),
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể xử lý dữ liệu import');
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <Card className="mt-6">
      <CardContent>
        <div className="mb-4">
          <h2 className="text-base font-semibold sm:text-lg">Lịch sử và dữ liệu đã import</h2>
          <p className="text-sm text-slate-500">
            Dữ liệu raw được giữ nguyên; chỉ tính công khi đủ hồ sơ, lịch và evidence.
          </p>
        </div>
        {error && (
          <div className="mb-4">
            <ErrorState message={error} />
          </div>
        )}
        {summary && (
          <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
            Đã xử lý {summary.rawRows.toLocaleString()} dòng:{' '}
            {summary.linkedEmployees.toLocaleString()} liên kết nhân viên,{' '}
            {summary.calculatedRows.toLocaleString()} đã tính,{' '}
            {summary.missingEmployees.toLocaleString()} thiếu hồ sơ nhân viên,{' '}
            {summary.promotedImportIssues.toLocaleString()} cảnh báo nguồn được chuyển sang Ngoại
            lệ.
          </div>
        )}
        {history.isLoading ? (
          <Skeleton className="h-48" />
        ) : history.isError ? (
          <ErrorState message={history.error.message} />
        ) : history.data?.items?.length ? (
          <div className="space-y-4">
            <DataTable headers={['File', 'Trạng thái', 'Raw', 'Cảnh báo', 'Thời gian', 'Thao tác']}>
              {history.data.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-xs font-medium">{item.originalName}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">{item._count.rawRows.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">{item._count.issues.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">
                    {new Date(item.attemptedAt).toLocaleString('vi-VN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setSelectedId(item.id)}>
                        Xem dữ liệu
                      </Button>
                      <Button
                        size="sm"
                        disabled={item.status !== 'ACCEPTED' || processingId === item.id}
                        onClick={() => void processImport(item.id)}
                      >
                        {processingId === item.id ? 'Đang xử lý…' : 'Xử lý dữ liệu'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled
                        title="Chờ HR/chủ dự án duyệt master, lịch phân ca và tiêu chí timestamp"
                      >
                        Chờ duyệt master/lịch
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
            {selectedId && <RawRows importId={selectedId} />}
          </div>
        ) : (
          <EmptyState description="Chưa có lịch sử import." />
        )}
      </CardContent>
    </Card>
  );
}
