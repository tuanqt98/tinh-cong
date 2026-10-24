import { describe, expect, it, vi } from 'vitest';
import { CoreService } from '../src/core/core.service.js';

const admin = { id: 'admin-1', username: 'admin', employeeId: null, roles: ['ADMIN'] } as const;
const periodId = '00000000-0000-0000-0000-000000000901';

function createPrisma() {
  return {
    employee: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'employee-1',
        code: 'SYN-001',
        name: 'Nhân viên synthetic 01',
        position: 'Công nhân',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        status: 'ACTIVE',
        department: { name: 'Sản xuất' },
      }),
    },
    attendancePeriod: {
      findUnique: vi.fn().mockResolvedValue({
        id: periodId,
        year: 2026,
        month: 10,
        status: 'DRAFT',
        version: 1,
        timezone: 'Asia/Ho_Chi_Minh',
        lockedAt: null,
        publishedAt: null,
      }),
    },
    attendanceRaw: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'raw-1',
          rowNo: 2,
          employeeCode: 'SYN-001',
          employeeName: 'Nhân viên synthetic 01',
          departmentName: 'Sản xuất trong kỳ',
          attendanceDateRaw: '2026-10-01',
          checkInRaw: '08:05',
          checkOutRaw: '17:15',
          shiftNameRaw: 'Ca1',
          normalizations: [],
          calculations: [
            {
              id: 'calculation-2',
              revision: 2,
              status: 'VALID',
              engineVersion: 'synthetic-v2',
              presenceSeconds: 33_000,
              breakSeconds: 3_600,
              workedSeconds: 29_400,
              lateSeconds: 300,
              earlySeconds: 0,
              tier100Seconds: 28_800,
              tier130Seconds: 0,
              tier150Seconds: 600,
              tier200Seconds: 0,
              tier210Seconds: 0,
              tier230Seconds: 0,
              normalization: {
                revision: 2,
                shiftDate: new Date('2026-10-01T00:00:00.000Z'),
                shiftCode: 'CA1',
                checkInAt: new Date('2026-10-01T01:05:00.000Z'),
                checkOutAt: new Date('2026-10-01T10:15:00.000Z'),
              },
              exceptions: [],
            },
            {
              id: 'calculation-1',
              revision: 1,
              status: 'VALID',
              engineVersion: 'synthetic-v1',
              presenceSeconds: 32_400,
              breakSeconds: 3_600,
              workedSeconds: 28_800,
              lateSeconds: 0,
              earlySeconds: 0,
              tier100Seconds: 28_800,
              tier130Seconds: 0,
              tier150Seconds: 0,
              tier200Seconds: 0,
              tier210Seconds: 0,
              tier230Seconds: 0,
              normalization: {
                revision: 1,
                shiftDate: new Date('2026-10-01T00:00:00.000Z'),
                shiftCode: 'CA1',
                checkInAt: new Date('2026-10-01T01:00:00.000Z'),
                checkOutAt: new Date('2026-10-01T10:00:00.000Z'),
              },
              exceptions: [],
            },
          ],
          exceptions: [
            { id: 'exception-1', code: 'SOURCE_WARNING', blocking: false, status: 'OPEN' },
          ],
          adjustments: [
            {
              id: 'adjustment-1',
              revision: 2,
              before: { checkOut: '17:00' },
              after: { checkOut: '17:15' },
              reason: 'Synthetic regression',
              createdAt: new Date('2026-10-02T00:00:00.000Z'),
              actor: { id: 'admin-1', username: 'admin' },
            },
          ],
        },
      ]),
    },
  };
}

describe('attendance detail', () => {
  it('chỉ dùng revision mới nhất, trả dữ liệu nguồn và không suy diễn ngày làm việc', async () => {
    const prisma = createPrisma();
    const service = new CoreService(prisma as never, {} as never);
    const result = await service.employeeAttendance(admin as never, 'employee-1', periodId);

    expect(prisma.attendanceRaw.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employeeId: 'employee-1' }),
      }),
    );
    expect(result.employee).toMatchObject({
      code: 'SYN-001',
      departmentName: 'Sản xuất',
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      id: 'calculation-2',
      revision: 2,
      workedSeconds: 29_400,
      source: { attendanceDate: '2026-10-01', shiftName: 'Ca1' },
    });
    expect(result.totals).toMatchObject({
      workedSeconds: 29_400,
      tier100Seconds: 28_800,
      tier150Seconds: 600,
      tier200Seconds: 0,
      tier230Seconds: 0,
      attendanceDays: 1,
      exceptionCount: 1,
    });
    expect(result.workingDaysAvailable).toBe(false);
    expect(result.workingDays).toBeNull();
    expect(result.adjustments[0]).toMatchObject({ revision: 2, rowNo: 2 });
    expect(result.calculationVersion).toEqual({
      engineVersions: ['synthetic-v2'],
      maxRevision: 2,
    });
  });

  it('xuất PDF chi tiết có đánh dấu bản nháp', async () => {
    const service = new CoreService(createPrisma() as never, {} as never);
    const buffer = await service.employeeAttendancePdf(admin as never, 'employee-1', periodId);

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(2_000);
  });
});
