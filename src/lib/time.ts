import { isJapanPublicHoliday, isWeekendJapan } from "@/lib/calendar-jp";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function toMinutesHm(value: string): number {
  return toMinutes(value.slice(0, 5));
}

/** 退勤が出勤より早い時刻なら翌日扱い（+1440 分） */
function absoluteShiftEnd(inAbs: number, outRaw: number): number {
  return outRaw < inAbs ? outRaw + 1440 : outRaw;
}

/** 休憩を同日帯として正規化（終了が開始以下なら翌日にまたがるとみなす） */
function normalizeBreakBand(breakStart: string, breakEnd: string): { bs0: number; be0: number } {
  let bs0 = toMinutesHm(breakStart);
  let be0 = toMinutesHm(breakEnd);
  if (be0 <= bs0) be0 += 1440;
  return { bs0, be0 };
}

function overlapMinutes(a0: number, a1: number, b0: number, b1: number): number {
  const s = Math.max(a0, b0);
  const e = Math.min(a1, b1);
  return Math.max(0, e - s);
}

/** 勤務区間 [inAbs, outAbs] と重なる休憩分数（オフセット k=0..2 でシフトに載せる） */
function breakOverlapWithShift(
  inAbs: number,
  outAbs: number,
  breakStart: string,
  breakEnd: string,
): number {
  const { bs0, be0 } = normalizeBreakBand(breakStart, breakEnd);
  let best = 0;
  for (let k = 0; k <= 2; k += 1) {
    const a = bs0 + k * 1440;
    const b = be0 + k * 1440;
    if (a >= b) continue;
    best = Math.max(best, overlapMinutes(inAbs, outAbs, a, b));
  }
  return best;
}

/**
 * 勤務分数。退勤が出勤より早い時刻のときは日をまたいだ勤務（最大 1 回）として計算。
 * `workDate` は将来拡張用・呼び出し統一用（現状ロジックでは未使用）。
 */
export function calculateWorkMinutes(params: {
  clockIn: string | null;
  clockOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  break2Start?: string | null;
  break2End?: string | null;
  workDate?: string | null;
}): number {
  const { clockIn, clockOut, breakStart, breakEnd, break2Start, break2End } = params;

  if (!clockIn || !clockOut) {
    return 0;
  }

  const inAbs = toMinutesHm(clockIn);
  const outAbs = absoluteShiftEnd(inAbs, toMinutesHm(clockOut));
  let total = outAbs - inAbs;

  if (breakStart && breakEnd) {
    total -= breakOverlapWithShift(inAbs, outAbs, breakStart, breakEnd);
  }
  if (break2Start && break2End) {
    total -= breakOverlapWithShift(inAbs, outAbs, break2Start, break2End);
  }

  return Math.max(0, total);
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** 複数休憩の表示用合計（各ペアの長さの単純合算） */
export function totalBreakDurationMinutes(
  ...pairs: Array<{ start: string | null; end: string | null }>
): number {
  return pairs.reduce(
    (sum, { start, end }) => sum + breakDurationMinutes(start, end),
    0,
  );
}
/** 休憩開始・終了から休憩分数（日をまたぐ休憩は +1440 して長さを算出） */
export function breakDurationMinutes(
  breakStart: string | null,
  breakEnd: string | null,
): number {
  if (!breakStart || !breakEnd) return 0;
  const { bs0, be0 } = normalizeBreakBand(breakStart, breakEnd);
  return Math.max(0, be0 - bs0);
}

const STANDARD_WORK_MINUTES = 8 * 60;
const HALF_DAY_PM_STANDARD_MINUTES = 3 * 60;
const EIGHTEEN_OCLOCK_MINUTES = 18 * 60;

/** 休憩が [seg0, seg1) と重なる分（勤務区間に載った休憩のみ） */
function breakOverlapWithEveningSegment(
  inAbs: number,
  outAbs: number,
  breakStart: string,
  breakEnd: string,
  seg0: number,
  seg1: number,
): number {
  const { bs0, be0 } = normalizeBreakBand(breakStart, breakEnd);
  let best = 0;
  for (let k = 0; k <= 2; k += 1) {
    const a = bs0 + k * 1440;
    const b = be0 + k * 1440;
    if (a >= b) continue;
    const a1 = Math.max(a, inAbs);
    const b1 = Math.min(b, outAbs);
    if (a1 >= b1) continue;
    best = Math.max(best, overlapMinutes(a1, b1, seg0, seg1));
  }
  return best;
}

/**
 * 午前半休: 各暦日の 18:00〜24:00 における勤務（休憩と重なる分は除く）。
 * 日跨ぎ勤務では勤務日 0:00 基準の絶対分で 18 時窓を 2 日分まで評価する。
 */
function overtimeMinutesAfter18(
  clockIn: string,
  clockOut: string,
  breakStart: string | null,
  breakEnd: string | null,
  break2Start: string | null = null,
  break2End: string | null = null,
): number {
  const inAbs = toMinutesHm(clockIn);
  const outAbs = absoluteShiftEnd(inAbs, toMinutesHm(clockOut));

  let total = 0;
  for (let day = 0; day < 2; day += 1) {
    const w0 = EIGHTEEN_OCLOCK_MINUTES + day * 1440;
    const w1 = 1440 + day * 1440;
    const seg0 = Math.max(inAbs, w0);
    const seg1 = Math.min(outAbs, w1);
    if (seg0 >= seg1) continue;

    let len = seg1 - seg0;
    if (breakStart && breakEnd) {
      len -= breakOverlapWithEveningSegment(
        inAbs,
        outAbs,
        breakStart,
        breakEnd,
        seg0,
        seg1,
      );
    }
    if (break2Start && break2End) {
      len -= breakOverlapWithEveningSegment(
        inAbs,
        outAbs,
        break2Start,
        break2End,
        seg0,
        seg1,
      );
    }
    total += Math.max(0, len);
  }

  return total;
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
  break2Start?: string | null;
  break2End?: string | null;
}): number {
  const { workDate, dayCode, clockIn, clockOut, breakStart, breakEnd, break2Start, break2End } =
    params;
  const net = calculateWorkMinutes({
    clockIn,
    clockOut,
    breakStart,
    breakEnd,
    break2Start,
    break2End,
    workDate,
  });
  if (net <= 0) return 0;

  if (isWeekendJapan(workDate) || isJapanPublicHoliday(workDate) || dayCode === "残") {
    return net;
  }

  if (dayCode === "前") {
    if (!clockIn || !clockOut) return 0;
    return overtimeMinutesAfter18(
      clockIn,
      clockOut,
      breakStart,
      breakEnd,
      break2Start ?? null,
      break2End ?? null,
    );
  }

  if (dayCode === "後") {
    return Math.max(0, net - HALF_DAY_PM_STANDARD_MINUTES);
  }

  return Math.max(0, net - STANDARD_WORK_MINUTES);
}
