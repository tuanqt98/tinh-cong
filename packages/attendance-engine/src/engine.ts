import { buildShiftTimeline, DEFAULT_ENGINE_CONFIG, isShiftCode } from './rules.js';
import { isValidIsoDate, overlapSeconds, parseExplicitTimestamp } from './time.js';
import type {
  AttendanceCalculation,
  AttendanceException,
  AttendanceInput,
  AttendanceResult,
  EngineConfig,
  ExceptionCode,
  ShiftCode,
} from './types.js';

function exception(code: ExceptionCode, message: string): AttendanceException {
  return { code, blocking: true, message };
}

function allocateTiers(
  shiftCode: ShiftCode,
  shiftDate: string,
  workedSeconds: number,
  sundayTierPercentage: 200 | 230 | null,
) {
  const isSunday = new Date(`${shiftDate}T00:00:00.000Z`).getUTCDay() === 0;
  if (isSunday && sundayTierPercentage) {
    return {
      tier100Seconds: 0,
      tier130Seconds: 0,
      tier150Seconds: 0,
      tier200Seconds: sundayTierPercentage === 200 ? workedSeconds : 0,
      tier210Seconds: 0,
      tier230Seconds: sundayTierPercentage === 230 ? workedSeconds : 0,
    };
  }

  if (shiftCode === 'CA1') {
    const tier100Seconds = Math.min(workedSeconds, 8 * 60 * 60);
    return {
      tier100Seconds,
      tier130Seconds: 0,
      tier150Seconds: Math.max(workedSeconds - 8 * 60 * 60, 0),
      tier200Seconds: 0,
      tier210Seconds: 0,
      tier230Seconds: 0,
    };
  }

  const tier100Seconds = Math.min(workedSeconds, 4 * 60 * 60);
  const tier130Seconds = Math.min(Math.max(workedSeconds - 4 * 60 * 60, 0), 4 * 60 * 60);
  return {
    tier100Seconds,
    tier130Seconds,
    tier150Seconds: 0,
    tier200Seconds: 0,
    tier210Seconds: Math.max(workedSeconds - 8 * 60 * 60, 0),
    tier230Seconds: 0,
  };
}

export function calculateAttendance(
  input: AttendanceInput,
  config: Readonly<EngineConfig> = DEFAULT_ENGINE_CONFIG,
): AttendanceResult {
  const exceptions: AttendanceException[] = [];
  const shiftCode = isShiftCode(input.shiftCode) ? input.shiftCode : null;
  const shiftDate = input.shiftDate && isValidIsoDate(input.shiftDate) ? input.shiftDate : null;
  const checkIn = parseExplicitTimestamp(input.checkInAt);
  const checkOut = parseExplicitTimestamp(input.checkOutAt);

  if (!shiftCode) exceptions.push(exception('INVALID_SHIFT', 'Ca làm việc không hợp lệ.'));
  if (input.shiftDate && !shiftDate) {
    exceptions.push(exception('INVALID_SHIFT_DATE', 'Ngày ca không hợp lệ.'));
  }
  if (!input.shiftDate || !input.shiftDateEvidence) {
    exceptions.push(exception('UNRESOLVED_SHIFT_DATE', 'Chưa có căn cứ xác định ngày bắt đầu ca.'));
  }

  if (input.checkInAt === null && input.checkOutAt === null) {
    exceptions.push(exception('NO_ATTENDANCE', 'Không có giờ vào và giờ ra.'));
  } else {
    if (input.checkInAt === null) {
      exceptions.push(exception('MISSING_CHECKIN', 'Thiếu giờ vào.'));
    }
    if (input.checkOutAt === null) {
      exceptions.push(exception('MISSING_CHECKOUT', 'Thiếu giờ ra.'));
    }
  }

  if (checkIn.invalid) {
    exceptions.push(
      exception('INVALID_CHECKIN_TIMESTAMP', 'Giờ vào phải là timestamp đầy đủ có offset.'),
    );
  }
  if (checkOut.invalid) {
    exceptions.push(
      exception('INVALID_CHECKOUT_TIMESTAMP', 'Giờ ra phải là timestamp đầy đủ có offset.'),
    );
  }
  if (checkIn.subsecond || checkOut.subsecond) {
    exceptions.push(
      exception('SUBSECOND_PRECISION_UNSUPPORTED', 'Timestamp phải có độ chính xác đến giây.'),
    );
  }
  if (input.checkOutAt !== null && !input.checkOutDateEvidence) {
    exceptions.push(
      exception('UNRESOLVED_CHECKOUT_DATE', 'Chưa có căn cứ xác định ngày của giờ ra.'),
    );
  }

  const checkInEpochSeconds = checkIn.epochSeconds;
  const checkOutEpochSeconds = checkOut.epochSeconds;

  if (checkInEpochSeconds !== null && checkOutEpochSeconds !== null) {
    const presenceSeconds = checkOutEpochSeconds - checkInEpochSeconds;
    if (presenceSeconds === 0) {
      exceptions.push(exception('EQUAL_CHECK_TIMES', 'Giờ vào bằng giờ ra.'));
    } else if (presenceSeconds < 0) {
      exceptions.push(exception('NEGATIVE_DURATION', 'Thời lượng hiện diện âm.'));
    } else if (presenceSeconds > config.abnormalDurationThresholdSeconds) {
      exceptions.push(
        exception(
          'EXCESSIVE_DURATION',
          `Thời lượng hiện diện vượt ngưỡng ${config.abnormalDurationThresholdSeconds} giây.`,
        ),
      );
    }
  }

  if (
    shiftCode &&
    shiftDate &&
    input.shiftDateEvidence &&
    input.checkOutDateEvidence &&
    checkInEpochSeconds !== null &&
    checkOutEpochSeconds !== null
  ) {
    const timeline = buildShiftTimeline(shiftCode, shiftDate, config.shiftRule);
    if (checkOutEpochSeconds < timeline.scheduledStart) {
      exceptions.push(exception('CHECKOUT_BEFORE_SHIFT_START', 'Giờ ra nằm trước mốc bắt đầu ca.'));
    }
  }

  if (exceptions.length > 0) {
    return {
      status: 'NEEDS_REVIEW',
      shiftCode,
      shiftDate,
      checkInEpochSeconds,
      checkOutEpochSeconds,
      exceptions,
      calculation: null,
      ruleVersion: '2026-10-23-dec010',
    };
  }

  // Các guard trên đảm bảo các giá trị này không null.
  const safeShiftCode = shiftCode as ShiftCode;
  const safeShiftDate = shiftDate as string;
  const safeCheckIn = checkInEpochSeconds as number;
  const safeCheckOut = checkOutEpochSeconds as number;
  const timeline = buildShiftTimeline(safeShiftCode, safeShiftDate, config.shiftRule);
  const creditedCheckIn = timeline.countEarlyArrivalSeconds
    ? safeCheckIn
    : Math.max(safeCheckIn, timeline.scheduledStart);
  const creditedCheckOut =
    timeline.postCompletionBlockSeconds && safeCheckOut > timeline.scheduledCompletion
      ? timeline.scheduledCompletion +
        Math.floor(
          (safeCheckOut - timeline.scheduledCompletion) / timeline.postCompletionBlockSeconds,
        ) *
          timeline.postCompletionBlockSeconds
      : safeCheckOut;
  const presenceSeconds = Math.max(creditedCheckOut - creditedCheckIn, 0);
  const breakSeconds = overlapSeconds(
    creditedCheckIn,
    creditedCheckOut,
    timeline.breakStart,
    timeline.breakEnd,
  );
  const workedSeconds = presenceSeconds - breakSeconds;
  const lateSeconds = Math.max(safeCheckIn - timeline.scheduledStart, 0);
  const scheduledWindowSeconds =
    safeCheckOut -
    timeline.scheduledStart -
    overlapSeconds(timeline.scheduledStart, safeCheckOut, timeline.breakStart, timeline.breakEnd);
  const earlySeconds = Math.max(timeline.targetWorkedSeconds - scheduledWindowSeconds, 0);
  const tiers = allocateTiers(
    safeShiftCode,
    safeShiftDate,
    workedSeconds,
    timeline.sundayTierPercentage,
  );
  const calculation: AttendanceCalculation = {
    presenceSeconds,
    breakSeconds,
    workedSeconds,
    lateSeconds,
    earlySeconds,
    ...tiers,
  };

  return {
    status: 'VALID',
    shiftCode: safeShiftCode,
    shiftDate: safeShiftDate,
    checkInEpochSeconds: safeCheckIn,
    checkOutEpochSeconds: safeCheckOut,
    exceptions: [],
    calculation,
    ruleVersion: '2026-10-23-dec010',
  };
}
