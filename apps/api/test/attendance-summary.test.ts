import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import { CoreService } from '../src/core/core.service.js';

const admin = { id: 'admin-1', username: 'admin', employeeId: null, roles: ['ADMIN'] } as const;
const period = {
  id: '00000000-0000-0000-0000-000000000901',
  year: 2026,
  month: 10,
  status: 'DRAFT',
  version: 1,
  lockedAt: null,
  publishedAt: null,
};

function createPrisma() {
  const calculations = [
    {
      rawId: 'raw-1',
      revision: 2,
      status: 'VALID',
      engineVersion: 'synthetic-v1',
      workedSeconds: 30_000,
      tier100Seconds: 28_800,
      tier130Seconds: 0,
      tier150Seconds: 1_200,
      tier200Seconds: 0,
      tier210Seconds: 0,
      tier230Seconds: 0,
      lateSeconds: 300,
      earlySeconds: 0,
      raw: { employeeId: 'employee-1', departmentName: 'Sản xuất trong kỳ' },
      normalization: { shiftDate: new Date('2026-10-01T00:00:00.000Z'), shiftCode: 'CA1' },
    },
    {
      rawId: 'raw-1',
      revision: 1,
      status: 'VALID',
      engineVersion: 'synthetic-v1',
      workedSeconds: 28_800,
      tier100Seconds: 28_800,
      tier130Seconds: 0,
      tier150Seconds: 0,
      tier200Seconds: 0,
      tier210Seconds: 0,
      tier230Seconds: 0,
      lateSeconds: 0,
      earlySeconds: 0,
      raw: { employeeId: 'employee-1', departmentName: 'Phòng cũ' },
      normalization: { shiftDate: new Date('2026-10-01T00:00:00.000Z'), shiftCode: 'CA1' },
    },
    {
      rawId: 'raw-2',
      revision: 1,
      status: 'NEEDS_REVIEW',
      engineVersion: 'synthetic-v1',
      workedSeconds: null,
      tier100Seconds: null,
      tier130Seconds: null,
      tier150Seconds: null,
      tier200Seconds: null,
      tier210Seconds: null,
      tier230Seconds: null,
      lateSeconds: null,
      earlySeconds: null,
      raw: { employeeId: 'employee-2', departmentName: 'Kỹ thuật' },
      normalization: { shiftDate: new Date('2026-10-02T00:00:00.000Z'), shiftCode: 'CA1' },
    },
  ];
  const rawRows = [
    {
      id: 'raw-1',
      employeeId: 'employee-1',
      departmentName: 'Sản xuất trong kỳ',
      exceptions: [],
    },
    {
      id: 'raw-2',
      employeeId: 'employee-2',
      departmentName: 'Kỹ thuật',
      exceptions: [{ id: 'exception-1', blocking: true }],
    },
  ];
  return {
    attendancePeriod: {
      findUnique: vi.fn().mockResolvedValue(period),
      findFirst: vi.fn().mockResolvedValue(period),
    },
    employee: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'employee-1',
          code: '=NV001',
          name: '+Nhân viên A',
          department: { name: 'Phòng hiện tại' },
        },
        {
          id: 'employee-2',
          code: 'NV002',
          name: 'Nhân viên B',
          department: { name: 'Kỹ thuật' },
        },
      ]),
    },
    attendanceCalculation: { findMany: vi.fn().mockResolvedValue(calculations) },
    attendanceRaw: { findMany: vi.fn().mockResolvedValue(rawRows) },
    $transaction: vi
      .fn()
      .mockImplementation((operations: Array<Promise<unknown>>) => Promise.all(operations)),
  };
}

describe('attendance summary', () => {
  it('chỉ cộng revision mới nhất, giữ phòng ban trong kỳ và tách trạng thái xử lý', async () => {
    const service = new CoreService(createPrisma() as never, {} as never);
    const result = await service.attendanceSummary(admin as never, {
      page: 1,
      pageSize: 10,
      periodId: period.id,
      sortBy: 'code',
      sortOrder: 'asc',
    });

    expect(result.total).toBe(2);
    expect(result.totals).toMatchObject({
      employees: 2,
      calculatedEmployees: 1,
      workedSeconds: 30_000,
      tier100Seconds: 28_800,
      tier150Seconds: 1_200,
      tier200Seconds: 0,
      tier230Seconds: 0,
      exceptionCount: 1,
    });
    expect(result.items[0]).toMatchObject({
      departmentName: 'Sản xuất trong kỳ',
      processingStatus: 'VALID',
      workingDays: null,
      attendanceDays: 1,
    });
    expect(result.items[1]).toMatchObject({
      processingStatus: 'NEEDS_REVIEW',
      workedSeconds: 0,
      exceptionCount: 1,
    });
    expect(result.calculationVersion).toEqual({
      engineVersions: ['synthetic-v1'],
      maxRevision: 2,
    });
  });

  it('xuất toàn bộ tập lọc, có dòng tổng và chặn formula injection', async () => {
    const service = new CoreService(createPrisma() as never, {} as never);
    const buffer = await service.exportAttendanceSummaryExcel(admin as never, {
      page: 1,
      pageSize: 10,
      periodId: period.id,
      sortBy: 'code',
      sortOrder: 'asc',
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    const sheet = workbook.getWorksheet('TongHopKyCong');

    expect(sheet?.getCell('A3').value).toContain('DỮ LIỆU TẠM');
    expect(sheet?.getCell('B9').value).toBe("'=NV001");
    expect(sheet?.getCell('C9').value).toBe("'+Nhân viên A");
    expect(sheet?.getCell('C11').value).toBe('TỔNG CỘNG');
    expect(sheet?.getCell('E11').numFmt).toBe('[h]:mm:ss');
    expect(sheet?.getCell('I8').value).toBe('Giờ 200%');
    expect(sheet?.getCell('K8').value).toBe('Giờ 230%');
  });

  it('tìm tên không phân biệt dấu tiếng Việt', async () => {
    const service = new CoreService(createPrisma() as never, {} as never);
    const result = await service.attendanceSummary(admin as never, {
      page: 1,
      pageSize: 10,
      periodId: period.id,
      search: 'nhan vien a',
      sortBy: 'code',
      sortOrder: 'asc',
    });

    expect(result.total).toBe(1);
    expect(result.items[0]?.employeeName).toBe('+Nhân viên A');
  });
});
