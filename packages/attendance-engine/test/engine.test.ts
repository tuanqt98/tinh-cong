import { describe, expect, it } from 'vitest';
import { calculateAttendance, type AttendanceInput } from '../src/index.js';

const scheduleEvidence = { type: 'WORK_SCHEDULE', reference: 'synthetic:schedule-1' } as const;
const sourceEvidence = { type: 'SOURCE_TIMESTAMP', reference: 'synthetic:row-1' } as const;

function input(overrides: Partial<AttendanceInput> = {}): AttendanceInput {
  return {
    employeeCode: 'SYN-001',
    shiftCode: 'CA1',
    shiftDate: '2026-10-01',
    checkInAt: '2026-10-01T08:00:00+07:00',
    checkOutAt: '2026-10-01T17:00:00+07:00',
    shiftDateEvidence: scheduleEvidence,
    checkOutDateEvidence: sourceEvidence,
    ...overrides,
  };
}

function calculation(overrides: Partial<AttendanceInput> = {}) {
  const result = calculateAttendance(input(overrides));
  expect(result.status).toBe('VALID');
  expect(result.calculation).not.toBeNull();
  return result.calculation!;
}

describe('Ca 1', () => {
  it('T01 tính đủ 8 giờ', () => {
    expect(calculation()).toMatchObject({
      presenceSeconds: 32_400,
      breakSeconds: 3_600,
      workedSeconds: 28_800,
      tier100Seconds: 28_800,
      tier150Seconds: 0,
      lateSeconds: 0,
      earlySeconds: 0,
    });
  });

  it('T02 tính đi muộn độc lập', () => {
    expect(calculation({ checkInAt: '2026-10-01T08:30:00+07:00' })).toMatchObject({
      workedSeconds: 27_000,
      lateSeconds: 1_800,
      earlySeconds: 0,
    });
  });

  it('T03 tính về sớm độc lập', () => {
    expect(calculation({ checkOutAt: '2026-10-01T16:30:00+07:00' })).toMatchObject({
      workedSeconds: 27_000,
      lateSeconds: 0,
      earlySeconds: 1_800,
    });
  });

  it('T04 phân bổ tăng ca 150%', () => {
    expect(
      calculation({
        checkInAt: '2026-10-01T08:30:00+07:00',
        checkOutAt: '2026-10-01T18:00:00+07:00',
      }),
    ).toMatchObject({
      workedSeconds: 30_600,
      tier100Seconds: 28_800,
      tier150Seconds: 1_800,
      lateSeconds: 1_800,
      earlySeconds: 0,
    });
  });

  it('T05 không trừ nghỉ khi làm trước giờ nghỉ', () => {
    expect(calculation({ checkOutAt: '2026-10-01T11:00:00+07:00' })).toMatchObject({
      breakSeconds: 0,
      workedSeconds: 10_800,
      earlySeconds: 18_000,
    });
  });

  it('T06 chỉ trừ phần giao giờ nghỉ', () => {
    expect(calculation({ checkOutAt: '2026-10-01T12:30:00+07:00' })).toMatchObject({
      breakSeconds: 1_800,
      workedSeconds: 14_400,
      earlySeconds: 14_400,
    });
  });

  it('bảo toàn giây, không làm tròn', () => {
    expect(calculation({ checkInAt: '2026-10-01T08:00:01+07:00' })).toMatchObject({
      workedSeconds: 28_799,
      lateSeconds: 1,
    });
  });
});

describe('Ca 3', () => {
  it('T07 tính đủ 8 giờ qua ngày', () => {
    expect(
      calculation({
        shiftCode: 'CA3',
        checkInAt: '2026-10-01T22:00:00+07:00',
        checkOutAt: '2026-10-02T07:00:00+07:00',
      }),
    ).toMatchObject({
      presenceSeconds: 32_400,
      breakSeconds: 3_600,
      workedSeconds: 28_800,
      tier100Seconds: 14_400,
      tier130Seconds: 14_400,
      tier210Seconds: 0,
      lateSeconds: 0,
      earlySeconds: 0,
    });
  });

  it('T08 tính đi muộn', () => {
    expect(
      calculation({
        shiftCode: 'CA3',
        checkInAt: '2026-10-01T22:15:00+07:00',
        checkOutAt: '2026-10-02T07:00:00+07:00',
      }),
    ).toMatchObject({ workedSeconds: 27_900, lateSeconds: 900, earlySeconds: 0 });
  });

  it('T09 tính đi muộn và về sớm độc lập', () => {
    expect(
      calculation({
        shiftCode: 'CA3',
        checkInAt: '2026-10-01T22:15:00+07:00',
        checkOutAt: '2026-10-02T06:30:00+07:00',
      }),
    ).toMatchObject({ workedSeconds: 26_100, lateSeconds: 900, earlySeconds: 1_800 });
  });

  it('T10 phân bổ tăng ca 210%', () => {
    expect(
      calculation({
        shiftCode: 'CA3',
        checkInAt: '2026-10-01T22:00:00+07:00',
        checkOutAt: '2026-10-02T09:00:00+07:00',
      }),
    ).toMatchObject({
      workedSeconds: 36_000,
      tier100Seconds: 14_400,
      tier130Seconds: 14_400,
      tier210Seconds: 7_200,
    });
  });

  it('T12 chỉ trừ phần giao nghỉ đầu ca đêm', () => {
    expect(
      calculation({
        shiftCode: 'CA3',
        checkInAt: '2026-10-01T22:00:00+07:00',
        checkOutAt: '2026-10-02T00:30:00+07:00',
      }),
    ).toMatchObject({ breakSeconds: 1_800, workedSeconds: 7_200, earlySeconds: 21_600 });
  });

  it('T26 gắn ca ngày trước cho check-in sau nửa đêm khi có lịch', () => {
    const result = calculateAttendance(
      input({
        shiftCode: 'CA3',
        checkInAt: '2026-10-02T00:30:00+07:00',
        checkOutAt: '2026-10-02T07:00:00+07:00',
      }),
    );
    expect(result.shiftDate).toBe('2026-10-01');
    expect(result.calculation).toMatchObject({
      workedSeconds: 21_600,
      tier100Seconds: 14_400,
      tier130Seconds: 7_200,
      lateSeconds: 9_000,
      earlySeconds: 0,
    });
  });
});

describe('fail-closed validation và nhiều lỗi', () => {
  it('T11/T27 không suy ngày ra khi thiếu evidence', () => {
    const result = calculateAttendance(
      input({
        shiftCode: 'CA3',
        checkInAt: '2026-10-01T22:00:00+07:00',
        checkOutAt: '2026-10-02T07:00:00+07:00',
        checkOutDateEvidence: null,
      }),
    );
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.calculation).toBeNull();
    expect(result.exceptions.map((item) => item.code)).toContain('UNRESOLVED_CHECKOUT_DATE');
  });

  it('từ chối chuỗi chỉ có giờ không offset', () => {
    const result = calculateAttendance(input({ checkInAt: '08:00', checkOutAt: '17:00' }));
    expect(result.exceptions.map((item) => item.code)).toEqual(
      expect.arrayContaining(['INVALID_CHECKIN_TIMESTAMP', 'INVALID_CHECKOUT_TIMESTAMP']),
    );
  });

  it('T13 thiếu check-in', () => {
    const result = calculateAttendance(input({ checkInAt: null }));
    expect(result.exceptions.map((item) => item.code)).toContain('MISSING_CHECKIN');
  });

  it('T14 thiếu check-out', () => {
    const result = calculateAttendance(input({ checkOutAt: null }));
    expect(result.exceptions.map((item) => item.code)).toContain('MISSING_CHECKOUT');
  });

  it('T15 không tự gán ca lạ', () => {
    const result = calculateAttendance(input({ shiftCode: 'CA2' }));
    expect(result.shiftCode).toBeNull();
    expect(result.exceptions.map((item) => item.code)).toContain('INVALID_SHIFT');
  });

  it('T18 hai mốc trống tạo NO_ATTENDANCE', () => {
    const result = calculateAttendance(input({ checkInAt: null, checkOutAt: null }));
    expect(result.exceptions.map((item) => item.code)).toContain('NO_ATTENDANCE');
  });

  it('T32 giờ vào bằng giờ ra', () => {
    const result = calculateAttendance(
      input({
        checkInAt: '2026-10-01T08:00:00+07:00',
        checkOutAt: '2026-10-01T08:00:00+07:00',
      }),
    );
    expect(result.exceptions.map((item) => item.code)).toContain('EQUAL_CHECK_TIMES');
  });

  it('thời lượng âm chỉ kết luận sau timestamp đầy đủ', () => {
    const result = calculateAttendance(
      input({
        checkInAt: '2026-10-01T09:00:00+07:00',
        checkOutAt: '2026-10-01T08:00:00+07:00',
      }),
    );
    expect(result.exceptions.map((item) => item.code)).toContain('NEGATIVE_DURATION');
  });

  it('T33 chỉ chặn khi lớn hơn 16 giờ', () => {
    const atBoundary = calculateAttendance(
      input({
        checkInAt: '2026-10-01T08:00:00+07:00',
        checkOutAt: '2026-10-02T00:00:00+07:00',
      }),
    );
    expect(atBoundary.exceptions.map((item) => item.code)).not.toContain('EXCESSIVE_DURATION');

    const overBoundary = calculateAttendance(
      input({
        checkInAt: '2026-10-01T08:00:00+07:00',
        checkOutAt: '2026-10-02T00:00:01+07:00',
      }),
    );
    expect(overBoundary.exceptions.map((item) => item.code)).toContain('EXCESSIVE_DURATION');
  });

  it('T34 giữ tất cả lỗi trên một dòng', () => {
    const result = calculateAttendance(
      input({
        shiftCode: 'UNKNOWN',
        shiftDate: null,
        shiftDateEvidence: null,
        checkOutAt: null,
      }),
    );
    expect(result.exceptions.map((item) => item.code)).toEqual(
      expect.arrayContaining(['INVALID_SHIFT', 'UNRESOLVED_SHIFT_DATE', 'MISSING_CHECKOUT']),
    );
  });

  it('từ chối phần lẻ giây thay vì làm tròn', () => {
    const result = calculateAttendance(input({ checkInAt: '2026-10-01T08:00:00.500+07:00' }));
    expect(result.exceptions.map((item) => item.code)).toContain(
      'SUBSECOND_PRECISION_UNSUPPORTED',
    );
  });
});

describe('bất biến', () => {
  it.each([
    ['CA1', '2026-10-01T07:30:00+07:00', '2026-10-01T18:45:13+07:00'],
    ['CA3', '2026-10-01T21:55:00+07:00', '2026-10-02T08:12:34+07:00'],
  ] as const)('tổng các mức bằng worked cho %s', (shiftCode, checkInAt, checkOutAt) => {
    const value = calculation({ shiftCode, checkInAt, checkOutAt });
    expect(
      value.tier100Seconds +
        value.tier130Seconds +
        value.tier150Seconds +
        value.tier210Seconds,
    ).toBe(value.workedSeconds);
  });
});
