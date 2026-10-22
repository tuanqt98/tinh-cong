import type { EngineConfig, ShiftCode } from './types.js';
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
}

export function isShiftCode(value: string | null): value is ShiftCode {
  return value === 'CA1' || value === 'CA3';
}

export function buildShiftTimeline(shiftCode: ShiftCode, shiftDate: string): ShiftTimeline {
  const midnight = shiftDateMidnightEpoch(shiftDate);

  if (shiftCode === 'CA1') {
    return {
      scheduledStart: midnight + 8 * 60 * 60,
      scheduledCompletion: midnight + 17 * 60 * 60,
      breakStart: midnight + 12 * 60 * 60,
      breakEnd: midnight + 13 * 60 * 60,
      targetWorkedSeconds: 8 * 60 * 60,
    };
  }

  return {
    scheduledStart: midnight + 22 * 60 * 60,
    scheduledCompletion: midnight + (24 + 7) * 60 * 60,
    breakStart: midnight + 24 * 60 * 60,
    breakEnd: midnight + 25 * 60 * 60,
    targetWorkedSeconds: 8 * 60 * 60,
  };
}
