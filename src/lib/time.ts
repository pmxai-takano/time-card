import { isJapanPublicHoliday, isWeekendJapan } from "@/lib/calendar-jp";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function calculateWorkMinutes(params: {
  clockIn: string | null;
  clockOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
}): number {
  const { clockIn, clockOut, breakStart, breakEnd } = params;

  if (!clockIn || !clockOut) {
    return 0;
  }

  const total = toMinutes(clockOut) - toMinutes(clockIn);
  const breakMinutes =
    breakStart && breakEnd ? toMinutes(breakEnd) - toMinutes(breakStart) : 0;
  return Math.max(0, total - Math.max(0, breakMinutes));
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** 休憩開始・終了から休憩分数（不正なら 0） */
export function breakDurationMinutes(
  breakStart: string | null,
  breakEnd: string | null,
): number {
  if (!breakStart || !breakEnd) return 0;
  const start = toMinutes(breakStart.slice(0, 5));
  const end = toMinutes(breakEnd.slice(0, 5));
  return Math.max(0, end - start);
}

const STANDARD_WORK_MINUTES = 8 * 60;
const HALF_DAY_PM_STANDARD_MINUTES = 3 * 60;
const EIGHTEEN_OCLOCK_MINUTES = 18 * 60;

function overlapMinutes(a0: number, a1: number, b0: number, b1: number): number {
  const s = Math.max(a0, b0);
  const e = Math.min(a1, b1);
  return Math.max(0, e - s);
}

/** 午前半休: 18時以降の勤務時間（休憩と重なる分は除く） */
function overtimeMinutesAfter18(
  clockIn: string,
  clockOut: string,
  breakStart: string | null,
  breakEnd: string | null,
): number {
  const t0 = toMinutes(clockIn.slice(0, 5));
  const t1 = toMinutes(clockOut.slice(0, 5));
  const start = Math.max(t0, EIGHTEEN_OCLOCK_MINUTES);
  if (start >= t1) return 0;
  let raw = t1 - start;
  if (breakStart && breakEnd) {
    const b0 = toMinutes(breakStart.slice(0, 5));
    const b1 = toMinutes(breakEnd.slice(0, 5));
    raw -= overlapMinutes(start, t1, b0, b1);
  }
  return Math.max(0, raw);
}

/**
 * 残業分数（自動計算）
 * - 定時8時間超（平日・祝日でない・土日でない・残でない・前後でない）
 * - 土日祝: 全勤務が残業
 * - 勤怠区分「残」（休日出勤扱い）: 全日残業
 * - 「前」: 18時以降のみ
 * - 「後」: 3時間超過分
 */
export function calculateOvertimeMinutes(params: {
  workDate: string;
  dayCode: string | null;
  clockIn: string | null;
  clockOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
}): number {
  const { workDate, dayCode, clockIn, clockOut, breakStart, breakEnd } = params;
  const net = calculateWorkMinutes({ clockIn, clockOut, breakStart, breakEnd });
  if (net <= 0) return 0;

  if (isWeekendJapan(workDate) || isJapanPublicHoliday(workDate) || dayCode === "残") {
    return net;
  }

  if (dayCode === "前") {
    if (!clockIn || !clockOut) return 0;
    return overtimeMinutesAfter18(clockIn, clockOut, breakStart, breakEnd);
  }

  if (dayCode === "後") {
    return Math.max(0, net - HALF_DAY_PM_STANDARD_MINUTES);
  }

  return Math.max(0, net - STANDARD_WORK_MINUTES);
}
