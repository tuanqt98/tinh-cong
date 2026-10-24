import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ImportsService } from '../src/imports/imports.service.js';

type DuplicatePolicyAccess = {
  duplicateKeyFields(): string[];
  duplicateKey(row: Record<string, string | number | boolean | null>, fields: string[]): string;
  isIsoDate(value: string | null): value is string;
  isFullOffsetTimestamp(value: string | null): value is string;
  sourceShiftCode(value: string | null): 'CA1' | 'CA3' | null;
  sourceDepartmentCode(value: string): string;
  approvedSourceTimestamps(
    raw: unknown,
    schedule: unknown,
  ): {
    checkInAt: string;
    checkOutAt: string;
    checkOutDateEvidence: { type: string; reference: string };
  } | null;
};

function createService(value: string | undefined) {
  const config = {
    get: (key: string) => (key === 'DUPLICATE_KEY_FIELDS' ? value : undefined),
  };
  return new ImportsService(
    {} as never,
    config as never,
    {} as never,
  ) as unknown as DuplicatePolicyAccess;
}

describe('ImportsService duplicate key policy', () => {
  it('dùng đúng khóa đã được duyệt: mã nhân viên + ngày + tên ca', () => {
    const service = createService('employeeCode,attendanceDate,shiftName');

    expect(service.duplicateKeyFields()).toEqual(['employeeCode', 'attendanceDate', 'shiftName']);
  });

  it('không đưa giờ vào/ra vào khóa nhận diện trùng', () => {
    const service = createService('employeeCode,attendanceDate,shiftName');
    const fields = service.duplicateKeyFields();
    const base = {
      employeeCode: 'SYN-001',
      attendanceDate: '2026-10-01',
      shiftName: 'Ca1',
      checkIn: '08:00',
      checkOut: '17:00',
    };

    expect(service.duplicateKey(base, fields)).toBe(
      service.duplicateKey({ ...base, checkIn: '08:05', checkOut: '17:10' }, fields),
    );
  });

  it('từ chối trường khóa không thuộc bảy trường nguồn', () => {
    const service = createService('employeeCode,attendanceDate,deviceId');

    expect(() => service.duplicateKeyFields()).toThrow(
      'DUPLICATE_KEY_FIELDS chứa trường không hợp lệ.',
    );
  });

  it('trả conflict rõ ràng khi confirm lại import đã xử lý', async () => {
    const prisma = {
      attendanceImport: {
        findUnique: vi.fn().mockResolvedValue({
          id: '00000000-0000-0000-0000-000000000001',
          status: 'ACCEPTED',
          storageKey: 'synthetic.xlsx',
          attemptedById: 'user-1',
          issues: [],
        }),
      },
    };
    const config = { get: () => 'employeeCode,attendanceDate,shiftName' };
    const service = new ImportsService(prisma as never, config as never, {} as never);

    const confirmation = service.confirm('00000000-0000-0000-0000-000000000001', {
      id: 'user-1',
      username: 'hr',
      employeeId: null,
      roles: ['HR'],
    });

    await expect(confirmation).rejects.toBeInstanceOf(ConflictException);
    await expect(confirmation).rejects.toMatchObject({
      response: {
        code: 'IMPORT_ALREADY_PROCESSED',
        message: 'Import đã được xử lý với trạng thái ACCEPTED.',
      },
    });
  });

  it('ghi import lớn bằng batch transaction nguyên tử thay vì interactive transaction timeout 5 giây', async () => {
    const rows = Array.from({ length: 2_765 }, (_, index) => ({
      sheet: 'Synthetic',
      rowNo: index + 4,
      employeeCode: `SYN-${index.toString().padStart(4, '0')}`,
      employeeName: `Nhân viên ${index}`,
      departmentName: 'Synthetic',
      attendanceDate: '2026-10-01',
      checkIn: '08:00',
      checkOut: '17:00',
      shiftName: 'Ca1',
      rawCells: {},
    }));
    const createMany = vi.fn().mockReturnValue({ operation: 'createMany' });
    const update = vi.fn().mockReturnValue({ operation: 'update' });
    const createAudit = vi.fn().mockReturnValue({ operation: 'audit' });
    const transaction = vi.fn().mockResolvedValue([{ count: rows.length }, {}, {}]);
    const prisma = {
      attendanceImport: {
        findUnique: vi.fn().mockResolvedValue({
          id: '00000000-0000-0000-0000-000000000001',
          status: 'PREVIEW',
          storageKey: 'package.json',
          attemptedById: 'user-1',
          issues: [],
          metadata: {
            mapping: {
              employeeCode: 'Mã N.Viên',
              employeeName: 'Tên N.Viên',
              departmentName: 'Phòng ban',
              attendanceDate: 'Ngày',
              checkIn: 'Vào',
              checkOut: 'Ra',
              shiftName: 'Tên ca',
            },
          },
        }),
        update,
      },
      attendanceRaw: { findMany: vi.fn().mockResolvedValue([]), createMany },
      auditLog: { create: createAudit },
      $transaction: transaction,
    };
    const parser = {
      parse: vi.fn().mockResolvedValue({ rows, sheets: ['Synthetic'], issues: [] }),
    };
    const service = new ImportsService(
      prisma as never,
      { get: () => 'employeeCode,attendanceDate,shiftName' } as never,
      parser as never,
    );
    vi.spyOn(service, 'process').mockResolvedValue({} as never);

    const result = await service.confirm('00000000-0000-0000-0000-000000000001', {
      id: 'user-1',
      username: 'hr',
      employeeId: null,
      roles: ['HR'],
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(transaction.mock.calls[0]?.[0]).toBeInstanceOf(Array);
    expect(transaction.mock.calls[0]?.[0]).toHaveLength(3);
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.arrayContaining([expect.any(Object)]) }),
    );
    expect(createMany.mock.calls[0]?.[0].data).toHaveLength(2_765);
    expect(result).toMatchObject({ status: 'ACCEPTED', rowCount: 2_765 });
  });

  it('chỉ chấp nhận timestamp đầy đủ ngày và offset cho pipeline', () => {
    const service = createService('employeeCode,attendanceDate,shiftName');

    expect(service.isIsoDate('2026-09-01')).toBe(true);
    expect(service.isIsoDate('01/09/2026')).toBe(false);
    expect(service.isFullOffsetTimestamp('2026-09-01T08:00:00+07:00')).toBe(true);
    expect(service.isFullOffsetTimestamp('08:00')).toBe(false);
  });

  it('không xử lý dữ liệu khi import chưa ACCEPTED', async () => {
    const prisma = {
      attendanceImport: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: 'import-1', status: 'PREVIEW', rawRows: [], issues: [] }),
      },
    };
    const service = new ImportsService(
      prisma as never,
      { get: () => undefined } as never,
      {} as never,
    );

    await expect(
      service.process('00000000-0000-0000-0000-000000000001', {
        id: 'user-1',
        username: 'hr',
        employeeId: null,
        roles: ['HR'],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('ánh xạ đúng alias Ca1 và Ca3 đã được duyệt', () => {
    const service = createService('employeeCode,attendanceDate,shiftName');

    expect(service.sourceShiftCode('Ca1')).toBe('CA1');
    expect(service.sourceShiftCode(' ca3 ')).toBe('CA3');
    expect(service.sourceShiftCode('--')).toBeNull();
  });

  it('gắn checkout Ca3 sang D+1 khi giờ ra nhỏ hơn giờ vào', () => {
    const service = createService('employeeCode,attendanceDate,shiftName');
    const normalized = service.approvedSourceTimestamps(
      {
        id: 'raw-1',
        importId: 'import-1',
        attendanceDateRaw: '2026-09-01',
        checkInRaw: '22:05',
        checkOutRaw: '07:00',
        shiftNameRaw: 'Ca3',
        sheet: 'Synthetic',
        rowNo: 4,
      },
      'CA3',
    );

    expect(normalized).toMatchObject({
      checkInAt: '2026-09-01T22:05:00+07:00',
      checkOutAt: '2026-09-02T07:00:00+07:00',
      checkOutDateEvidence: { type: 'APPROVED_MAPPING' },
    });
  });

  it('tính trực tiếp từ Tên ca trong file mà không đọc lịch phân ca', async () => {
    const normalizationCreate = vi.fn().mockResolvedValue({ id: 'normalization-1' });
    const calculationCreate = vi.fn().mockResolvedValue({ id: 'calculation-1' });
    const prisma = {
      shift: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'shift-ca1',
            code: 'CA1',
            active: true,
            rules: [
              {
                id: 'rule-ca1-v3',
                version: 3,
                effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
                effectiveTo: null,
                scheduledStartSeconds: 25_200,
                scheduledCompletionSeconds: 68_400,
                breakStartSeconds: 43_200,
                breakEndSeconds: 46_800,
                abnormalDurationThresholdSeconds: 57_600,
                tiers: {
                  tier100: 28_800,
                  tier150After: 28_800,
                  targetWorkedSeconds: 39_600,
                  countEarlyArrivalSeconds: false,
                  postCompletionBlockSeconds: 1_800,
                  sundayTierPercentage: 200,
                },
              },
            ],
          },
        ]),
      },
      attendancePeriod: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'period-2026-09', year: 2026, month: 9, status: 'DRAFT' }]),
      },
      attendanceNormalization: { create: normalizationCreate },
      attendanceCalculation: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: calculationCreate,
      },
      attendanceException: {
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      exceptionResolution: { createMany: vi.fn() },
      $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const service = new ImportsService(
      prisma as never,
      { get: () => 'employeeCode,attendanceDate,shiftName' } as never,
      {} as never,
    );

    const processLinkedRows = (
      service as unknown as {
        processLinkedRows: (
          rows: never[],
          existingKeys: Set<string>,
          actorId: string,
        ) => Promise<{
          missingSchedules: number;
          missingTimestampEvidence: number;
          calculatedRows: number;
        }>;
      }
    ).processLinkedRows.bind(service);
    const result = await processLinkedRows(
      [
        {
          id: 'raw-1',
          importId: 'import-1',
          employeeId: 'employee-1',
          employeeCode: 'NV0001',
          employeeName: 'Nhân viên kiểm thử',
          departmentName: 'Phòng kiểm thử',
          attendanceDateRaw: '2026-09-01',
          checkInRaw: '08:00',
          checkOutRaw: '17:00',
          shiftNameRaw: 'Ca1',
          sheet: 'Synthetic',
          rowNo: 4,
        } as never,
      ],
      new Set(),
      'actor-1',
    );

    expect(result).toEqual({
      missingSchedules: 0,
      missingTimestampEvidence: 0,
      calculatedRows: 1,
    });
    expect(normalizationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shiftCode: 'CA1',
          shiftDateEvidence: expect.objectContaining({
            type: 'APPROVED_MAPPING',
            reference: expect.stringContaining('SOURCE_SHIFT_ASSIGNMENT'),
          }),
        }),
      }),
    );
    expect(calculationCreate).toHaveBeenCalledOnce();
  });

  it('không suy timestamp khi Tên ca nguồn không khớp ca đang xử lý', () => {
    const service = createService('employeeCode,attendanceDate,shiftName');
    const normalized = service.approvedSourceTimestamps(
      {
        id: 'raw-1',
        importId: 'import-1',
        attendanceDateRaw: '2026-09-01',
        checkInRaw: '08:00',
        checkOutRaw: '17:00',
        shiftNameRaw: 'Ca1',
        sheet: 'Synthetic',
        rowNo: 4,
      },
      'CA3',
    );

    expect(normalized).toBeNull();
  });

  it('chặn tính lại trực tiếp khi kỳ đã LOCKED', async () => {
    const prisma = {
      shift: { findMany: vi.fn().mockResolvedValue([]) },
      attendancePeriod: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'period-2026-09', year: 2026, month: 9, status: 'LOCKED' }]),
      },
    };
    const service = new ImportsService(prisma as never, {} as never, {} as never);
    const processLinkedRows = (
      service as unknown as {
        processLinkedRows: (
          rows: never[],
          existingKeys: Set<string>,
          actorId: string,
        ) => Promise<unknown>;
      }
    ).processLinkedRows.bind(service);

    await expect(
      processLinkedRows(
        [
          {
            id: 'raw-locked',
            employeeId: 'employee-1',
            attendanceDateRaw: '2026-09-18',
          } as never,
        ],
        new Set(),
        'actor-1',
      ),
    ).rejects.toMatchObject({
      response: { code: 'ATTENDANCE_PERIOD_IMMUTABLE' },
    });
  });

  it('khóa provision master/lịch khi chưa có phê duyệt nghiệp vụ', async () => {
    const service = new ImportsService({} as never, { get: () => undefined } as never, {} as never);

    await expect(
      service.approveSourceAndProcess('00000000-0000-0000-0000-000000000001', {
        id: 'admin-1',
        username: 'admin',
        employeeId: null,
        roles: ['ADMIN'],
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'SOURCE_MASTER_APPROVAL_REQUIRED',
      },
    });
  });
});
