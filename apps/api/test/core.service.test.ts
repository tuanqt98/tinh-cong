import { ConflictException } from '@nestjs/common';
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
    const prisma = {
      managerScope: { findMany: vi.fn().mockResolvedValue([]) },
      attendanceException: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const scopedService = new CoreService(prisma as never, disabledConfig as never);

    await scopedService.listExceptions(
      { id: 'hr-1', username: 'hr', employeeId: 'employee-self', roles: ['HR'] },
      { page: 1, pageSize: 20 },
    );

    expect(prisma.attendanceException.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { raw: { employee: { id: { in: [] } } } },
      }),
    );
  });
});
