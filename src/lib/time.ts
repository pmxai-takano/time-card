import {
  addDaysJapan,
  calendarDayKindJapan,
  isDeemedOvertimeWeekdayJapan,
  type CalendarDayKind,
} from "@/lib/calendar-jp";
import type { WorkSystem } from "@/lib/work-system";

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
/** 裁量労働制の平日のみなし残業（法定外）分数 */
export const DEEMED_WEEKDAY_OVERTIME_MINUTES = 90;

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
 * `dayCount` は勤務日 0:00 基準で評価する暦日数（日跨ぎ分割時は 1）。
 */
function overtimeMinutesAfter18(
  clockIn: string,
  clockOut: string,
  breakStart: string | null,
  breakEnd: string | null,
  break2Start: string | null = null,
  break2End: string | null = null,
  dayCount = 2,
): number {
  const inAbs = toMinutesHm(clockIn);
  const outAbs = absoluteShiftEnd(inAbs, toMinutesHm(clockOut));

  let total = 0;
  for (let day = 0; day < dayCount; day += 1) {
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
 * 残業分数（自動計算）— 通常勤務体系向け。
 * 裁量労働制は `calculateAttendanceBreakdown` を使う。
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
  return calculateAttendanceBreakdown({
    ...params,
    workSystem: "standard",
  }).overtimeMinutes;
}

export type AttendanceBreakdown = {
  workMinutes: number;
  /** 法定外残業（土曜・祝日の全日、平日の定時超過、「残」など） */
  overtimeMinutes: number;
  /** 法定休日（日曜）の勤務 */
  holidayWorkMinutes: number;
  /** みなし残業枠（裁量労働制・平日勤務日は 1.5 時間） */
  deemedOvertimeMinutes: number;
  /** みなし法定外（裁量労働制・平日の法定外残業のうちみなし枠でカバーされる分） */
  deemedNonStatutoryMinutes: number;
};

type BreakdownParams = {
  workSystem?: WorkSystem;
  workDate: string;
  dayCode: string | null;
  clockIn: string | null;
  clockOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  break2Start?: string | null;
  break2End?: string | null;
};

function emptyBreakdown(workMinutes = 0): AttendanceBreakdown {
  return {
    workMinutes,
    overtimeMinutes: 0,
    holidayWorkMinutes: 0,
    deemedOvertimeMinutes: 0,
    deemedNonStatutoryMinutes: 0,
  };
}

/**
 * 勤務区間のうち [seg0, seg1) に含まれる実働分数（休憩控除後）。
 */
function workMinutesInAbsoluteSegment(
  inAbs: number,
  outAbs: number,
  seg0: number,
  seg1: number,
  breakStart: string | null,
  breakEnd: string | null,
  break2Start: string | null,
  break2End: string | null,
): number {
  const a0 = Math.max(inAbs, seg0);
  const a1 = Math.min(outAbs, seg1);
  if (a0 >= a1) return 0;

  let len = a1 - a0;
  if (breakStart && breakEnd) {
    len -= breakOverlapWithEveningSegment(
      inAbs,
      outAbs,
      breakStart,
      breakEnd,
      a0,
      a1,
    );
  }
  if (break2Start && break2End) {
    len -= breakOverlapWithEveningSegment(
      inAbs,
      outAbs,
      break2Start,
      break2End,
      a0,
      a1,
    );
  }
  return Math.max(0, len);
}

type ShiftDaySegment = {
  date: string;
  minutes: number;
  /** 勤務日（レコードの work_date）側の区間か */
  isWorkDate: boolean;
};

/**
 * 勤務を暦日 0:00 で分割（日跨ぎは最大 2 暦日）。
 * 絶対分は勤務日 0:00 = 0。
 */
function splitShiftByCalendarDay(params: {
  workDate: string;
  clockIn: string;
  clockOut: string;
  breakStart: string | null;
  breakEnd: string | null;
  break2Start: string | null;
  break2End: string | null;
}): ShiftDaySegment[] {
  const inAbs = toMinutesHm(params.clockIn);
  const outAbs = absoluteShiftEnd(inAbs, toMinutesHm(params.clockOut));
  const nextDate = addDaysJapan(params.workDate, 1);

  const day0 = workMinutesInAbsoluteSegment(
    inAbs,
    outAbs,
    0,
    1440,
    params.breakStart,
    params.breakEnd,
    params.break2Start,
    params.break2End,
  );
  const day1 = workMinutesInAbsoluteSegment(
    inAbs,
    outAbs,
    1440,
    outAbs > 1440 ? outAbs : 1440,
    params.breakStart,
    params.breakEnd,
    params.break2Start,
    params.break2End,
  );

  const segments: ShiftDaySegment[] = [
    { date: params.workDate, minutes: day0, isWorkDate: true },
  ];
  if (day1 > 0) {
    segments.push({ date: nextDate, minutes: day1, isWorkDate: false });
  }
  return segments;
}

function weekdayOvertimeForSegment(params: {
  workSystem: WorkSystem;
  dayCode: string | null;
  isWorkDate: boolean;
  minutes: number;
  clockIn: string;
  clockOut: string;
  breakStart: string | null;
  breakEnd: string | null;
  break2Start: string | null;
  break2End: string | null;
}): number {
  const { workSystem, dayCode, isWorkDate, minutes } = params;
  if (minutes <= 0) return 0;

  if (workSystem === "discretionary") {
    return Math.max(0, minutes - STANDARD_WORK_MINUTES);
  }

  // 半休ルールは勤務日側の平日区間にのみ適用
  if (isWorkDate && dayCode === "前") {
    return overtimeMinutesAfter18(
      params.clockIn,
      params.clockOut,
      params.breakStart,
      params.breakEnd,
      params.break2Start,
      params.break2End,
      1,
    );
  }
  if (isWorkDate && dayCode === "後") {
    return Math.max(0, minutes - HALF_DAY_PM_STANDARD_MINUTES);
  }

  return Math.max(0, minutes - STANDARD_WORK_MINUTES);
}

/**
 * 1 暦日分の勤務を残業 / 休日出勤へ振り分け。
 * dayCode「残」は勤務日側にのみ全日残業（または裁量の休出）として適用。
 */
function classifySegmentMinutes(params: {
  workSystem: WorkSystem;
  dayCode: string | null;
  kind: CalendarDayKind;
  isWorkDate: boolean;
  minutes: number;
  clockIn: string;
  clockOut: string;
  breakStart: string | null;
  breakEnd: string | null;
  break2Start: string | null;
  break2End: string | null;
}): { overtimeMinutes: number; holidayWorkMinutes: number; weekdayOvertimeMinutes: number } {
  const { workSystem, dayCode, kind, isWorkDate, minutes } = params;
  if (minutes <= 0) {
    return { overtimeMinutes: 0, holidayWorkMinutes: 0, weekdayOvertimeMinutes: 0 };
  }

  const treatAsResidualOff = isWorkDate && dayCode === "残";

  if (workSystem === "discretionary") {
    if (kind === "legalHoliday" || kind === "nonStatutoryHoliday" || treatAsResidualOff) {
      return { overtimeMinutes: 0, holidayWorkMinutes: minutes, weekdayOvertimeMinutes: 0 };
    }
    const ot = weekdayOvertimeForSegment(params);
    return { overtimeMinutes: ot, holidayWorkMinutes: 0, weekdayOvertimeMinutes: ot };
  }

  // standard
  if (kind === "legalHoliday") {
    return { overtimeMinutes: 0, holidayWorkMinutes: minutes, weekdayOvertimeMinutes: 0 };
  }
  if (kind === "nonStatutoryHoliday" || treatAsResidualOff) {
    return { overtimeMinutes: minutes, holidayWorkMinutes: 0, weekdayOvertimeMinutes: 0 };
  }

  const ot = weekdayOvertimeForSegment(params);
  return { overtimeMinutes: ot, holidayWorkMinutes: 0, weekdayOvertimeMinutes: ot };
}

function withDeemed(
  workSystem: WorkSystem,
  workDate: string,
  workMinutes: number,
  overtimeMinutes: number,
  holidayWorkMinutes: number,
  weekdayOvertimeMinutes: number,
): AttendanceBreakdown {
  const onDeemedWeekday =
    workSystem === "discretionary" &&
    workMinutes > 0 &&
    isDeemedOvertimeWeekdayJapan(workDate);
  const deemedOvertimeMinutes = onDeemedWeekday
    ? DEEMED_WEEKDAY_OVERTIME_MINUTES
    : 0;
  const deemedNonStatutoryMinutes = onDeemedWeekday
    ? Math.min(weekdayOvertimeMinutes, DEEMED_WEEKDAY_OVERTIME_MINUTES)
    : 0;
  return {
    workMinutes,
    overtimeMinutes,
    holidayWorkMinutes,
    deemedOvertimeMinutes,
    deemedNonStatutoryMinutes,
  };
}

/**
 * 勤務・残業・休日出勤・みなしの内訳。
 *
 * 共通:
 * - 日跨ぎ勤務は 0:00 で暦日分割し、各暦日の区分で振り分ける
 * - 法定休日 = 日曜 → 休日出勤
 * - 法定外休日 = 土曜・日曜以外の祝日 → 通常は残業 / 裁量は休日出勤
 *
 * 通常:
 * - 「残」: 勤務日側の全勤務が残業（その暦日が日曜なら休日出勤が優先）
 * - 「前」: 勤務日側は 18時以降のみ残業
 * - 「後」: 勤務日側は 3時間超過分が残業
 * - その他平日区間: その暦日の実働が 8時間超過分が残業
 * - みなし残業は適用しない
 *
 * 裁量労働制:
 * - 土日祝・「残」区間: 休日出勤
 * - 平日区間: 8時間超過分が残業（半休ルールなし）
 * - みなし残業 = 平日（月〜金・祝日除く）勤務日あたり 1.5 時間
 * - みなし法定外 = 平日区間の法定外残業のうちみなし枠内の分数
 */
export function calculateAttendanceBreakdown(
  params: BreakdownParams,
): AttendanceBreakdown {
  const workSystem = params.workSystem ?? "standard";
  const { workDate, dayCode, clockIn, clockOut, breakStart, breakEnd, break2Start, break2End } =
    params;

  const workMinutes = calculateWorkMinutes({
    clockIn,
    clockOut,
    breakStart,
    breakEnd,
    break2Start,
    break2End,
    workDate,
  });

  if (workMinutes <= 0 || !clockIn || !clockOut) {
    return emptyBreakdown(workMinutes > 0 ? workMinutes : 0);
  }

  const segments = splitShiftByCalendarDay({
    workDate,
    clockIn,
    clockOut,
    breakStart,
    breakEnd,
    break2Start: break2Start ?? null,
    break2End: break2End ?? null,
  });

  let overtimeMinutes = 0;
  let holidayWorkMinutes = 0;
  let weekdayOvertimeMinutes = 0;

  for (const segment of segments) {
    // 法定休日（日曜）は「残」より優先
    const kind = calendarDayKindJapan(segment.date);
    const part = classifySegmentMinutes({
      workSystem,
      dayCode,
      kind,
      isWorkDate: segment.isWorkDate,
      minutes: segment.minutes,
      clockIn,
      clockOut,
      breakStart,
      breakEnd,
      break2Start: break2Start ?? null,
      break2End: break2End ?? null,
    });
    overtimeMinutes += part.overtimeMinutes;
    holidayWorkMinutes += part.holidayWorkMinutes;
    weekdayOvertimeMinutes += part.weekdayOvertimeMinutes;
  }

  return withDeemed(
    workSystem,
    workDate,
    workMinutes,
    overtimeMinutes,
    holidayWorkMinutes,
    weekdayOvertimeMinutes,
  );
}
