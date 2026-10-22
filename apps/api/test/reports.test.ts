import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import { CoreService } from '../src/core/core.service.js';

const admin = { id: 'u1', username: 'admin', employeeId: null, roles: ['ADMIN'] } as const;

describe('exports synthetic', () => {
  it('xuất Excel và chặn formula injection', async () => {
    const prisma = {
      attendanceCalculation: {
        findMany: vi.fn().mockResolvedValue([
          {
            raw: { employeeCode: '=1+1', employeeName: '+Mẫu', departmentName: 'Sản xuất' },
            normalization: { shiftDate: new Date('2026-10-01'), checkInAt: new Date(), checkOutAt: new Date() },
            period: { month: 10, year: 2026 },
            workedSeconds: 28_800, lateSeconds: 0, earlySeconds: 0,
            tier100Seconds: 28_800, tier130Seconds: 0, tier150Seconds: 0, tier210Seconds: 0,
            status: 'VALID',
          },
        ]),
      },
    };
    const service = new CoreService(prisma as never, {} as never);
    const buffer = await service.exportAttendanceExcel(admin as never);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    expect(workbook.getWorksheet('BangCong')?.getCell('A2').value).toBe("'=1+1");
    expect(workbook.getWorksheet('BangCong')?.getCell('B2').value).toBe("'+Mẫu");
  });

  it('xuất PDF snapshot bằng font tiếng Việt', async () => {
    const prisma = {
      timesheet: {
        findFirst: vi.fn().mockResolvedValue({
          id: 't1', revision: 1, totalSeconds: 28_800,
          snapshot: { workedSeconds: 28_800, note: 'Dữ liệu tổng hợp mẫu' },
          employee: { code: 'SYN-001', name: 'Nhân viên mẫu', department: { name: 'Sản xuất' } },
          period: { month: 10, year: 2026 },
        }),
      },
    };
    const service = new CoreService(prisma as never, {} as never);
    const buffer = await service.timesheetPdf(admin as never, 't1');
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(2_000);
  });
});
