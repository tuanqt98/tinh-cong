import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CircleHelp, FileClock, UploadCloud } from 'lucide-react';
import { Button, ErrorState } from '@tinh-cong/ui';
import { api } from '../api.js';
import {
  ColumnMappingPanel,
  ExcelUploadZone,
  ImportActionBar,
  ImportPreviewTable,
  ImportStepper,
  type ColumnMapping,
  type ImportIssue,
  type PreviewRow,
} from './import-excel-components.js';
import { ImportHistory } from './import-history.js';

const defaultMapping: ColumnMapping = {
  employeeCode: 'Mã N.Viên',
  employeeName: 'Tên N.Viên',
  departmentName: 'Phòng ban',
  attendanceDate: 'Ngày',
  checkIn: 'Vào',
  checkOut: 'Ra',
  shiftName: 'Tên ca',
};

interface Preview {
  id: string;
  status: 'PREVIEW' | 'ACCEPTED' | 'REJECTED';
  rowCount: number;
  sheets: string[];
  previewRows: PreviewRow[];
  issues: ImportIssue[];
  duplicateRuleConfigured: boolean;
  canConfirm: boolean;
}

interface ConfirmResult {
  id: string;
  status: 'ACCEPTED' | 'REJECTED';
  rowCount?: number;
  duplicateCount?: number;
  processing?: {
    status?: 'FAILED';
    rawRows?: number;
    linkedEmployees?: number;
    missingEmployees?: number;
    missingEmployeeCodes?: string[];
    promotedImportIssues?: number;
    calculatedRows?: number;
  };
}

const structuralCodes = new Set(['MISSING_MAPPED_COLUMN', 'FORMULA_NOT_ALLOWED_IN_SOURCE_FIELD']);

export function ImportsPage() {
  const queryClient = useQueryClient();
  const confirmInFlight = useRef(false);
  const [view, setView] = useState<'import' | 'history'>('import');
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(defaultMapping);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const mappingValid = Object.values(mapping).every((value) => value.trim().length > 0);
  const structuralIssues =
    preview?.issues.filter((issue) => structuralCodes.has(issue.code ?? issue.issueCode ?? '')) ??
    [];
  const blockingIssues = preview?.issues.filter((issue) => issue.blocking) ?? [];
  const imported = preview?.status === 'ACCEPTED';
  const step: 1 | 2 | 3 | 4 = imported ? 4 : preview ? 3 : file ? 2 : 1;

  function chooseFile(selected: File) {
    setFile(selected);
    setPreview(null);
    setError('');
    setStatusMessage('');
  }

  function removeFile() {
    setFile(null);
    setPreview(null);
    setError('');
    setStatusMessage('');
  }

  function changeMapping(field: keyof ColumnMapping, value: string) {
    setMapping((current) => ({ ...current, [field]: value }));
    setPreview(null);
    setError('');
    setStatusMessage('Ánh xạ đã thay đổi. Hãy kiểm tra lại file trước khi xác nhận.');
  }

  async function runPreview() {
    if (!file || !mappingValid || loading) return;
    setLoading(true);
    setError('');
    setStatusMessage('');
    const data = new FormData();
    data.set('file', file);
    data.set('mapping', JSON.stringify(mapping));
    try {
      setPreview(await api<Preview>('/imports/preview', { method: 'POST', body: data }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể đọc file');
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!preview || preview.status !== 'PREVIEW' || !preview.canConfirm || confirmInFlight.current)
      return;
    confirmInFlight.current = true;
    setConfirming(true);
    setError('');
    setStatusMessage('');
    try {
      const result = await api<ConfirmResult>(`/imports/${preview.id}/confirm`, { method: 'POST' });
      setPreview({ ...preview, ...result, canConfirm: false });
      setStatusMessage(
        result.status === 'ACCEPTED'
          ? result.processing?.status === 'FAILED'
            ? `Import thành công ${result.rowCount?.toLocaleString() ?? preview.rowCount.toLocaleString()} dòng raw; bước xử lý cần chạy lại trong Lịch sử import.`
            : result.processing?.missingEmployees
              ? `Import thành công ${result.rowCount?.toLocaleString() ?? preview.rowCount.toLocaleString()} dòng; còn ${result.processing.missingEmployeeCodes?.length ?? 0} mã nhân viên thiếu hồ sơ. Mở Lịch sử import để xem và bổ sung.`
              : `Import thành công ${result.rowCount?.toLocaleString() ?? preview.rowCount.toLocaleString()} dòng; cảnh báo đã được chuyển sang Ngoại lệ.`
          : `Import bị từ chối do phát hiện ${result.duplicateCount ?? 0} dòng trùng. Không có dữ liệu nào được ghi.`,
      );
      await queryClient.invalidateQueries({ queryKey: ['imports'] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể xác nhận import');
    } finally {
      confirmInFlight.current = false;
      setConfirming(false);
    }
  }

  function downloadIssues() {
    if (!preview?.issues.length) return;
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [
      ['Sheet', 'Dòng', 'Mã lỗi', 'Trường', 'Blocking'],
      ...preview.issues.map((issue) => [
        issue.sheet ?? '',
        issue.rowNo ?? '',
        issue.code ?? issue.issueCode ?? 'UNKNOWN',
        issue.field ?? '',
        issue.blocking ? 'YES' : 'NO',
      ]),
    ];
    const blob = new Blob([`\uFEFF${rows.map((row) => row.map(escape).join(',')).join('\n')}`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `loi-import-${preview.id}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Import Excel</h1>
          <p className="mt-0.5 text-[13px] text-slate-500">
            Nhập dữ liệu chấm công từ máy chấm công
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={view === 'history' ? 'primary' : 'secondary'}
            onClick={() => setView(view === 'history' ? 'import' : 'history')}
          >
            <FileClock className="h-4 w-4" />
            {view === 'history' ? 'Quay lại import' : 'Lịch sử import'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setShowGuide((current) => !current)}
          >
            <CircleHelp className="h-4 w-4 text-primary" /> Hướng dẫn import
          </Button>
        </div>
      </div>

      {showGuide && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <UploadCloud className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Chọn file .xlsx, kiểm tra đủ bảy trường nguồn, xem toàn bộ lỗi/cảnh báo rồi mới xác
            nhận. Import có dữ liệu trùng hoặc lỗi chặn sẽ bị từ chối toàn bộ.
          </p>
        </div>
      )}

      {view === 'history' ? (
        <ImportHistory />
      ) : (
        <>
          <ImportStepper step={step} hasError={Boolean(error)} />

          <div className="mt-2 grid gap-3 lg:grid-cols-[0.98fr_1.02fr]">
            <ExcelUploadZone
              file={file}
              disabled={loading || confirming || imported}
              onFile={chooseFile}
              onRemove={removeFile}
            />
            <ColumnMappingPanel
              mapping={mapping}
              checked={Boolean(preview)}
              structuralIssues={structuralIssues}
              disabled={loading || confirming || imported}
              onChange={changeMapping}
            />
          </div>

          {error && (
            <div className="mt-3">
              <ErrorState message={error} />
            </div>
          )}
          {statusMessage && (
            <div
              className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
                preview?.status === 'ACCEPTED'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              {statusMessage}
            </div>
          )}
          {preview && !preview.duplicateRuleConfigured && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Khóa nhận diện trùng chưa được cấu hình. Xác nhận import bị chặn để không ghi dữ liệu
              không an toàn.
            </div>
          )}
          {blockingIssues.length > 0 && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              Có {blockingIssues.length.toLocaleString('vi-VN')} lỗi chặn. Hãy sửa file hoặc ánh xạ
              rồi kiểm tra lại; hệ thống không import một phần.
            </div>
          )}

          <div className="mt-3">
            <ImportPreviewTable
              rows={preview?.previewRows ?? []}
              issues={preview?.issues ?? []}
              totalRows={preview?.rowCount ?? 0}
              loading={loading}
              onDownloadIssues={downloadIssues}
            />
          </div>

          <ImportActionBar
            canCheck={Boolean(file && mappingValid && !imported)}
            canConfirm={Boolean(
              preview?.canConfirm && preview.status === 'PREVIEW' && blockingIssues.length === 0,
            )}
            checking={loading}
            confirming={confirming}
            imported={Boolean(imported)}
            onCheck={() => void runPreview()}
            onBack={() => {
              if (preview) {
                setPreview(null);
                setStatusMessage('');
              } else {
                removeFile();
              }
            }}
            onConfirm={() => void confirm()}
          />
        </>
      )}
    </div>
  );
}
