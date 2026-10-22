const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EXPLICIT_OFFSET_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/;

export interface TimestampParseResult {
  epochSeconds: number | null;
  invalid: boolean;
  subsecond: boolean;
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseExplicitTimestamp(value: string | Date | null): TimestampParseResult {
  if (value === null) return { epochSeconds: null, invalid: false, subsecond: false };

  if (typeof value === 'string' && !EXPLICIT_OFFSET_PATTERN.test(value)) {
    return { epochSeconds: null, invalid: true, subsecond: false };
  }

  const milliseconds = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    return { epochSeconds: null, invalid: true, subsecond: false };
  }

  if (milliseconds % 1000 !== 0) {
    return { epochSeconds: null, invalid: false, subsecond: true };
  }

  return { epochSeconds: milliseconds / 1000, invalid: false, subsecond: false };
}

export function shiftDateMidnightEpoch(shiftDate: string): number {
  return Date.parse(`${shiftDate}T00:00:00+07:00`) / 1000;
}

export function overlapSeconds(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): number {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}
