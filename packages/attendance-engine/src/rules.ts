import type { EngineConfig, EngineShiftRule, ShiftCode } from './types.js';
import { shiftDateMidnightEpoch } from './time.js';

export const DEFAULT_ENGINE_CONFIG: Readonly<EngineConfig> = {
  abnormalDurationThresholdSeconds: 16 * 60 * 60,
  timezone: 'Asia/Ho_Chi_Minh',
};

export interface ShiftTimeline {
  scheduledStart: number;
  scheduledCompletion: number;
  breakStart: number;
  breakEnd: number;
  targetWorkedSeconds: number;
  countEarlyArrivalSeconds: boolean;
  postCompletionBlockSeconds: number | null;
  sundayTierPercentage: 200 | 230 | null;
}

export function isShiftCode(value: string | null): value is ShiftCode {
  return value === 'CA1' || value === 'CA3';
}

function defaultShiftRule(shiftCode: ShiftCode): EngineShiftRule {
  if (shiftCode === 'CA1') {
    return {
      scheduledStartSeconds: 7 * 60 * 60,
      scheduledCompletionSeconds: 19 * 60 * 60,
      breakStartSeconds: 12 * 60 * 60,
      breakEndSeconds: 13 * 60 * 60,
      targetWorkedSeconds: 11 * 60 * 60,
      countEarlyArrivalSeconds: false,
      postCompletionBlockSeconds: 30 * 60,
      sundayTierPercentage: 200,
    };
  }

  return {
    scheduledStartSeconds: 19 * 60 * 60,
    scheduledCompletionSeconds: (24 + 7) * 60 * 60,
    breakStartSeconds: 24 * 60 * 60,
    breakEndSeconds: 25 * 60 * 60,
    targetWorkedSeconds: 11 * 60 * 60,
    countEarlyArrivalSeconds: false,
    postCompletionBlockSeconds: 30 * 60,
    sundayTierPercentage: 230,
  };
}

export function buildShiftTimeline(
  shiftCode: ShiftCode,
  shiftDate: string,
  override?: EngineShiftRule,
): ShiftTimeline {
  const midnight = shiftDateMidnightEpoch(shiftDate);
  const rule = override ?? defaultShiftRule(shiftCode);
  return {
    scheduledStart: midnight + rule.scheduledStartSeconds,
    scheduledCompletion: midnight + rule.scheduledCompletionSeconds,
    breakStart: midnight + rule.breakStartSeconds,
    breakEnd: midnight + rule.breakEndSeconds,
    targetWorkedSeconds: rule.targetWorkedSeconds,
    countEarlyArrivalSeconds: rule.countEarlyArrivalSeconds,
    postCompletionBlockSeconds: rule.postCompletionBlockSeconds,
    sundayTierPercentage: rule.sundayTierPercentage,
  };
}
