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
        attendanceDateRaw: '2026-09-01',
        checkInRaw: '22:05',
        checkOutRaw: '07:00',
        shiftNameRaw: 'Ca3',
        sheet: 'Synthetic',
        rowNo: 4,
      },
      {
        sourceType: 'APPROVED_XLSX_IMPORT',
        sourceRef: 'import:synthetic:raw:1',
        shift: { code: 'CA3' },
      },
    );

    expect(normalized).toMatchObject({
      checkInAt: '2026-09-01T22:05:00+07:00',
      checkOutAt: '2026-09-02T07:00:00+07:00',
      checkOutDateEvidence: { type: 'APPROVED_MAPPING' },
    });
  });

  it('không suy ngày cho nguồn giờ-only chưa được duyệt', () => {
    const service = createService('employeeCode,attendanceDate,shiftName');
    const normalized = service.approvedSourceTimestamps(
      {
        attendanceDateRaw: '2026-09-01',
        checkInRaw: '08:00',
        checkOutRaw: '17:00',
        shiftNameRaw: 'Ca1',
        sheet: 'Synthetic',
        rowNo: 4,
      },
      {
        sourceType: 'MANUAL_UNAPPROVED',
        sourceRef: 'synthetic',
        shift: { code: 'CA1' },
      },
    );

    expect(normalized).toBeNull();
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
