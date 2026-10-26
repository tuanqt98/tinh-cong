import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CoreService } from '../src/core/core.service.js';

describe('CoreService guards', () => {
  const disabledConfig = {
    get: (key: string) => (key === 'WORKFLOW_ENABLED' ? 'false' : undefined),
  };
  const service = new CoreService({} as never, disabledConfig as never);

  it('gọi engine preview với timestamp đầy đủ', () => {
    const result = service.calculatePreview({
      employeeCode: 'SYN-001',
      shiftCode: 'CA1',
      shiftDate: '2026-10-01',
      checkInAt: '2026-10-01T08:00:00+07:00',
      checkOutAt: '2026-10-01T17:00:00+07:00',
      shiftDateEvidence: { type: 'WORK_SCHEDULE', reference: 'synthetic:schedule' },
      checkOutDateEvidence: { type: 'SOURCE_TIMESTAMP', reference: 'synthetic:row' },
    });
    expect(result.status).toBe('VALID');
    expect(result.calculation?.workedSeconds).toBe(28_800);
  });

  it('fail-closed workflow khi Q10/Q11 chưa cấu hình', async () => {
    await expect(
      service.transitionPeriod(
        '00000000-0000-0000-0000-000000000001',
        { targetStatus: 'REVIEWED', expectedVersion: 1 },
        { id: 'u1', username: 'admin', employeeId: null, roles: ['ADMIN'] },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('HR không có scope không đọc được ngoại lệ, kể cả khi tài khoản gắn nhân viên', async () => {
    const rawCount = vi.fn().mockResolvedValue(0);
    const rawFindMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      managerScope: { findMany: vi.fn().mockResolvedValue([]) },
      attendanceRaw: { count: rawCount, findMany: rawFindMany },
      $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
    };
    const scopedService = new CoreService(prisma as never, disabledConfig as never);

    await scopedService.listExceptions(
      { id: 'hr-1', username: 'hr', employeeId: 'employee-self', roles: ['HR'] },
      { page: 1, pageSize: 20 },
    );

    expect(rawFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([{ employee: { id: { in: [] } } }]),
        },
      }),
    );
  });

  it('gom nhiều mã lỗi thành một bản ghi ngoại lệ và giữ đầy đủ mã', async () => {
    const raw = {
      id: 'raw-1',
      employeeCode: 'SYN-001',
      employeeName: 'Nhân viên synthetic',
      departmentName: 'Phòng synthetic',
      attendanceDateRaw: '2026-10-01',
      checkInRaw: null,
      checkOutRaw: null,
      shiftNameRaw: 'CA1',
      employee: null,
      normalizations: [],
      calculations: [],
      exceptions: [
        {
          id: 'exception-1',
          code: 'MISSING_CHECKIN',
          blocking: true,
          status: 'OPEN',
          details: { message: 'Thiếu giờ vào' },
          createdAt: new Date('2026-10-01T00:00:00Z'),
          updatedAt: new Date('2026-10-01T00:00:00Z'),
          resolutions: [],
        },
        {
          id: 'exception-2',
          code: 'MISSING_CHECKOUT',
          blocking: true,
          status: 'OPEN',
          details: { message: 'Thiếu giờ ra' },
          createdAt: new Date('2026-10-01T00:00:00Z'),
          updatedAt: new Date('2026-10-01T00:00:00Z'),
          resolutions: [],
        },
      ],
    };
    const findMany = vi.fn().mockResolvedValue([raw]);
    const prisma = {
      attendanceRaw: {
        count: vi.fn().mockResolvedValue(1),
        findMany,
      },
      $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
    };
    const result = await new CoreService(prisma as never, disabledConfig as never).listExceptions(
      { id: 'admin-1', username: 'admin', employeeId: null, roles: ['ADMIN'] },
      { page: '1', pageSize: '20' } as unknown as Parameters<CoreService['listExceptions']>[1],
    );

    expect(result.total).toBe(1);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20 }));
    expect(result).toMatchObject({ page: 1, pageSize: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.exceptions.map((item) => item.code)).toEqual([
      'MISSING_CHECKIN',
      'MISSING_CHECKOUT',
    ]);
  });

  it('khóa ghi nhận xử lý ngoại lệ khi Q10/Q11 chưa được duyệt', async () => {
    await expect(
      service.resolveException(
        '00000000-0000-0000-0000-000000000001',
        { action: 'REVIEWED_NO_CHANGE', reason: 'Lý do synthetic đủ dài' },
        { id: 'admin-1', username: 'admin', employeeId: null, roles: ['ADMIN'] },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('từ chối PATCH nhân viên không có trường hồ sơ hợp lệ', async () => {
    await expect(
      service.updateEmployee(
        { id: 'admin-1', username: 'admin', employeeId: null, roles: ['ADMIN'] },
        '00000000-0000-0000-0000-000000000001',
        { reason: 'Không có thay đổi hồ sơ' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
