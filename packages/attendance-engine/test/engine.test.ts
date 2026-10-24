import { describe, expect, it } from 'vitest';
import { calculateAttendance, type AttendanceInput } from '../src/index.js';

const scheduleEvidence = { type: 'WORK_SCHEDULE', reference: 'synthetic:schedule-1' } as const;
const sourceEvidence = { type: 'SOURCE_TIMESTAMP', reference: 'synthetic:row-1' } as const;

function input(overrides: Partial<AttendanceInput> = {}): AttendanceInput {
  return {
    employeeCode: 'SYN-001',
    shiftCode: 'CA1',
    shiftDate: '2026-10-01',
    checkInAt: '2026-10-01T07:00:00+07:00',
    checkOutAt: '2026-10-01T19:00:00+07:00',
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
  it('T01 tính đủ khung 07:00–19:00', () => {
    expect(calculation()).toMatchObject({
      presenceSeconds: 43_200,
      breakSeconds: 3_600,
      workedSeconds: 39_600,
      tier100Seconds: 28_800,
      tier150Seconds: 10_800,
      lateSeconds: 0,
      earlySeconds: 0,
    });
  });

  it('T02 tính đi muộn độc lập', () => {
    expect(calculation({ checkInAt: '2026-10-01T07:30:00+07:00' })).toMatchObject({
      workedSeconds: 37_800,
      lateSeconds: 1_800,
      earlySeconds: 0,
    });
  });

  it('T03 tính về sớm độc lập', () => {
    expect(calculation({ checkOutAt: '2026-10-01T18:30:00+07:00' })).toMatchObject({
      workedSeconds: 37_800,
      lateSeconds: 0,
      earlySeconds: 1_800,
    });
  });

  it('T04 phân bổ tăng ca 150%', () => {
    expect(
      calculation({
        checkInAt: '2026-10-01T07:30:00+07:00',
        checkOutAt: '2026-10-01T19:30:00+07:00',
      }),
    ).toMatchObject({
      workedSeconds: 39_600,
      tier100Seconds: 28_800,
      tier150Seconds: 10_800,
      lateSeconds: 1_800,
      earlySeconds: 0,
    });
  });

  it('T05 không trừ nghỉ khi làm trước giờ nghỉ', () => {
    expect(calculation({ checkOutAt: '2026-10-01T11:00:00+07:00' })).toMatchObject({
      breakSeconds: 0,
      workedSeconds: 14_400,
      earlySeconds: 25_200,
    });
  });

  it('T06 chỉ trừ phần giao giờ nghỉ', () => {
    expect(calculation({ checkOutAt: '2026-10-01T12:30:00+07:00' })).toMatchObject({
      breakSeconds: 1_800,
      workedSeconds: 18_000,
      earlySeconds: 21_600,
    });
  });

  it('bảo toàn giây, không làm tròn', () => {
    expect(calculation({ checkInAt: '2026-10-01T07:00:01+07:00' })).toMatchObject({
      workedSeconds: 39_599,
      tier150Seconds: 10_799,
      lateSeconds: 1,
    });
  });

  it('không tính trước 07:00 và chỉ ghi nhận phần sau 19:00 theo khối đủ 30 phút', () => {
    expect(
      calculation({
        checkInAt: '2026-10-01T06:30:00+07:00',
        checkOutAt: '2026-10-01T19:20:00+07:00',
      }),
    ).toMatchObject({
      presenceSeconds: 43_200,
      workedSeconds: 39_600,
      tier100Seconds: 28_800,
      tier150Seconds: 10_800,
      lateSeconds: 0,
      earlySeconds: 0,
    });

    expect(
      calculation({
        checkInAt: '2026-10-01T06:30:00+07:00',
        checkOutAt: '2026-10-01T19:30:00+07:00',
      }),
    ).toMatchObject({ workedSeconds: 41_400, tier150Seconds: 12_600 });

    expect(
      calculation({
        checkInAt: '2026-10-01T06:30:00+07:00',
        checkOutAt: '2026-10-01T19:59:59+07:00',
      }),
    ).toMatchObject({ workedSeconds: 41_400, tier150Seconds: 12_600 });
  });

  it('vẫn tính được rule Ca 1 lịch sử 08:00–17:00 qua cấu hình versioned', () => {
    const result = calculateAttendance(
      input({
        checkInAt: '2026-08-31T08:00:00+07:00',
        checkOutAt: '2026-08-31T17:00:00+07:00',
        shiftDate: '2026-08-31',
      }),
      {
        timezone: 'Asia/Ho_Chi_Minh',
        abnormalDurationThresholdSeconds: 57_600,
        shiftRule: {
          scheduledStartSeconds: 28_800,
          scheduledCompletionSeconds: 61_200,
          breakStartSeconds: 43_200,
          breakEndSeconds: 46_800,
          targetWorkedSeconds: 28_800,
          countEarlyArrivalSeconds: true,
          postCompletionBlockSeconds: null,
          sundayTierPercentage: null,
        },
      },
    );

    expect(result.status).toBe('VALID');
    expect(result.calculation).toMatchObject({
      workedSeconds: 28_800,
      tier100Seconds: 28_800,
      tier150Seconds: 0,
      lateSeconds: 0,
      earlySeconds: 0,
    });
  });

  it('phân bổ toàn bộ Ca 1 ngày Chủ nhật vào mức 200%', () => {
    expect(
      calculation({
        shiftDate: '2026-10-04',
        checkInAt: '2026-10-04T06:30:00+07:00',
        checkOutAt: '2026-10-04T19:30:00+07:00',
      }),
    ).toMatchObject({
      workedSeconds: 41_400,
      tier100Seconds: 0,
      tier130Seconds: 0,
      tier150Seconds: 0,
      tier200Seconds: 41_400,
      tier210Seconds: 0,
      tier230Seconds: 0,
    });
  });
});

describe('Ca 3', () => {
  it('T07 tính đủ 8 giờ qua ngày', () => {
    expect(
      calculation({
        shiftCode: 'CA3',
        checkInAt: '2026-10-01T19:00:00+07:00',
        checkOutAt: '2026-10-02T07:00:00+07:00',
      }),
    ).toMatchObject({
      presenceSeconds: 43_200,
      breakSeconds: 3_600,
      workedSeconds: 39_600,
      tier100Seconds: 14_400,
      tier130Seconds: 14_400,
      tier210Seconds: 10_800,
      lateSeconds: 0,
      earlySeconds: 0,
    });
  });

  it('T08 tính đi muộn', () => {
    expect(
      calculation({
        shiftCode: 'CA3',
        checkInAt: '2026-10-01T19:15:00+07:00',
        checkOutAt: '2026-10-02T07:00:00+07:00',
      }),
    ).toMatchObject({ workedSeconds: 38_700, lateSeconds: 900, earlySeconds: 0 });
  });

  it('T09 tính đi muộn và về sớm độc lập', () => {
    expect(
      calculation({
        shiftCode: 'CA3',
        checkInAt: '2026-10-01T19:15:00+07:00',
        checkOutAt: '2026-10-02T06:30:00+07:00',
      }),
    ).toMatchObject({ workedSeconds: 36_900, lateSeconds: 900, earlySeconds: 1_800 });
  });

  it('T10 phân bổ tăng ca 210%', () => {
    expect(
      calculation({
        shiftCode: 'CA3',
        checkInAt: '2026-10-01T19:00:00+07:00',
        checkOutAt: '2026-10-02T08:00:00+07:00',
      }),
    ).toMatchObject({
      workedSeconds: 43_200,
      tier100Seconds: 14_400,
      tier130Seconds: 14_400,
      tier210Seconds: 14_400,
    });
  });

  it('không tính đến sớm và chỉ ghi nhận tăng ca theo khối đủ 30 phút', () => {
    expect(
      calculation({
        shiftCode: 'CA3',
        checkInAt: '2026-10-01T18:45:00+07:00',
        checkOutAt: '2026-10-02T07:15:00+07:00',
      }),
    ).toMatchObject({
      presenceSeconds: 43_200,
      workedSeconds: 39_600,
      tier210Seconds: 10_800,
      lateSeconds: 0,
      earlySeconds: 0,
    });

    expect(
      calculation({
        shiftCode: 'CA3',
        checkInAt: '2026-10-01T18:45:00+07:00',
        checkOutAt: '2026-10-02T07:30:00+07:00',
      }),
    ).toMatchObject({ workedSeconds: 41_400, tier210Seconds: 12_600 });

    expect(
      calculation({
        shiftCode: 'CA3',
        checkInAt: '2026-10-01T19:00:00+07:00',
        checkOutAt: '2026-10-02T07:59:59+07:00',
      }),
    ).toMatchObject({ workedSeconds: 41_400, tier210Seconds: 12_600 });
  });

  it('T12 chỉ trừ phần giao nghỉ đầu ca đêm', () => {
    expect(
      calculation({
        shiftCode: 'CA3',
        checkInAt: '2026-10-01T19:00:00+07:00',
        checkOutAt: '2026-10-02T00:30:00+07:00',
      }),
    ).toMatchObject({ breakSeconds: 1_800, workedSeconds: 18_000, earlySeconds: 21_600 });
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
      lateSeconds: 19_800,
      earlySeconds: 0,
    });
  });

  it('phân bổ toàn bộ Ca 3 có ngày bắt đầu ca là Chủ nhật vào mức 230%', () => {
    expect(
      calculation({
        shiftCode: 'CA3',
        shiftDate: '2026-10-04',
        checkInAt: '2026-10-04T18:45:00+07:00',
        checkOutAt: '2026-10-05T07:30:00+07:00',
      }),
    ).toMatchObject({
      workedSeconds: 41_400,
      tier100Seconds: 0,
      tier130Seconds: 0,
      tier150Seconds: 0,
      tier200Seconds: 0,
      tier210Seconds: 0,
      tier230Seconds: 41_400,
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
    expect(result.exceptions.map((item) => item.code)).toContain('SUBSECOND_PRECISION_UNSUPPORTED');
  });
});

describe('bất biến', () => {
  it.each([
    ['CA1', '2026-10-01T07:30:00+07:00', '2026-10-01T18:45:13+07:00'],
    ['CA3', '2026-10-01T21:55:00+07:00', '2026-10-02T08:12:34+07:00'],
    ['CA1', '2026-10-04T07:00:00+07:00', '2026-10-04T19:00:00+07:00'],
    ['CA3', '2026-10-04T19:00:00+07:00', '2026-10-05T07:00:00+07:00'],
  ] as const)('tổng các mức bằng worked cho %s', (shiftCode, checkInAt, checkOutAt) => {
    const value = calculation({
      shiftCode,
      shiftDate: checkInAt.slice(0, 10),
      checkInAt,
      checkOutAt,
    });
    expect(
      value.tier100Seconds +
        value.tier130Seconds +
        value.tier150Seconds +
        value.tier200Seconds +
        value.tier210Seconds +
        value.tier230Seconds,
    ).toBe(value.workedSeconds);
  });
});
