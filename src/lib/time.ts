import {
  addDaysJapan,
  calendarDayKindJapan,
  isDeemedOvertimeWeekdayJapan,
  isLegalHolidayJapan,
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
/** 深夜帯: 22:00〜翌5:00 */
const NIGHT_START_MINUTES = 22 * 60;
const NIGHT_END_MINUTES = 5 * 60; // next calendar day absolute offset within day cycle
export const MONTHLY_45H_MINUTES = 45 * 60;
/** 単月100時間未満の上限（99:59） */
export const MONTHLY_UNDER_100H_CAP_MINUTES = 99 * 60 + 59;
export const MONTHLY_80H_WARN_MINUTES = 80 * 60;
export const MONTHLY_40H_APPROACH_MINUTES = 40 * 60;

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
  /**
   * 法定外（法定休日除外）。
   * 裁量: 平日 max(1:30, 実働-8h) + 土曜・祝日実働 + 日曜→月曜またぎの月曜分 など
   * 通常: 従来の残業
   */
  overtimeMinutes: number;
  /** 法定休日（日曜）の実勤務 */
  holidayWorkMinutes: number;
  /** みなし残業枠（裁量・平日勤務日は 1.5 時間） */
  deemedOvertimeMinutes: number;
  /**
   * みなし法定外（画面）= 法定外（休除）+ 法定休日労働
   * 裁量では overtime + holiday。通常は 0。
   */
  deemedNonStatutoryMinutes: number;
  /** 深夜 22:00〜翌5:00 の実勤務（みなしとは別集計） */
  nightMinutes: number;
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
    nightMinutes: 0,
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

/** 平日の残業（裁量）: max(みなし1:30, 実働 − 8h) */
export function discretionaryWeekdayOvertimeMinutes(workMinutes: number): number {
  if (workMinutes <= 0) return 0;
  return Math.max(DEEMED_WEEKDAY_OVERTIME_MINUTES, workMinutes - STANDARD_WORK_MINUTES);
}

/**
 * 深夜 22:00〜翌5:00 の実勤務（休憩控除後）。
 * 勤務日 0:00 基準の絶対分で、最大 2 暦日分の窓を評価する。
 */
function nightWorkMinutesInShift(
  clockIn: string,
  clockOut: string,
  breakStart: string | null,
  breakEnd: string | null,
  break2Start: string | null,
  break2End: string | null,
): number {
  const inAbs = toMinutesHm(clockIn);
  const outAbs = absoluteShiftEnd(inAbs, toMinutesHm(clockOut));

  let total = 0;
  for (let day = 0; day < 2; day += 1) {
    // 22:00〜24:00
    const eve0 = NIGHT_START_MINUTES + day * 1440;
    const eve1 = 1440 + day * 1440;
    total += workMinutesInAbsoluteSegment(
      inAbs,
      outAbs,
      eve0,
      eve1,
      breakStart,
      breakEnd,
      break2Start,
      break2End,
    );
    // 0:00〜5:00（翌日早朝帯。day=0 は勤務日早朝、day=1 は翌日早朝）
    const morn0 = day * 1440;
    const morn1 = NIGHT_END_MINUTES + day * 1440;
    total += workMinutesInAbsoluteSegment(
      inAbs,
      outAbs,
      morn0,
      morn1,
      breakStart,
      breakEnd,
      break2Start,
      break2End,
    );
  }
  return total;
}

function weekdayOvertimeForSegment(params: {
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
  const { dayCode, isWorkDate, minutes } = params;
  if (minutes <= 0) return 0;

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
 * 通常勤務: 1 暦日分を残業 / 休日出勤へ振り分け。
 */
function classifyStandardSegment(params: {
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
}): { overtimeMinutes: number; holidayWorkMinutes: number } {
  const { dayCode, kind, isWorkDate, minutes } = params;
  if (minutes <= 0) {
    return { overtimeMinutes: 0, holidayWorkMinutes: 0 };
  }

  const treatAsResidualOff = isWorkDate && dayCode === "残";

  if (kind === "legalHoliday") {
    return { overtimeMinutes: 0, holidayWorkMinutes: minutes };
  }
  if (kind === "nonStatutoryHoliday" || treatAsResidualOff) {
    return { overtimeMinutes: minutes, holidayWorkMinutes: 0 };
  }

  return {
    overtimeMinutes: weekdayOvertimeForSegment(params),
    holidayWorkMinutes: 0,
  };
}

/**
 * 裁量労働制の日別内訳。
 *
 * - 平日（勤務日が平日で実勤務あり）: みなし 1:30、残業 = max(1:30, 実働-8h)
 * - 土曜・祝日（日曜以外）: 実働全量を法定外（休除）
 * - 日曜: 法定休日労働（45h判定から除外）
 * - 日曜→月曜またぎの月曜分: 実働全量を法定外（みなしは付与しない）
 * - みなし法定外 = 法定外（休除）+ 法定休日
 */
function calculateDiscretionaryBreakdown(params: {
  workDate: string;
  dayCode: string | null;
  clockIn: string;
  clockOut: string;
  breakStart: string | null;
  breakEnd: string | null;
  break2Start: string | null;
  break2End: string | null;
  workMinutes: number;
}): AttendanceBreakdown {
  const {
    workDate,
    dayCode,
    clockIn,
    clockOut,
    breakStart,
    breakEnd,
    break2Start,
    break2End,
    workMinutes,
  } = params;

  const segments = splitShiftByCalendarDay({
    workDate,
    clockIn,
    clockOut,
    breakStart,
    breakEnd,
    break2Start,
    break2End,
  });

  const workDateIsLegalHoliday = isLegalHolidayJapan(workDate);
  const workDateIsDeemedWeekday = isDeemedOvertimeWeekdayJapan(workDate);
  const treatResidual = dayCode === "残";

  let overtimeMinutes = 0;
  let holidayWorkMinutes = 0;
  let weekdayWorkOnWorkDate = 0;

  for (const segment of segments) {
    if (segment.minutes <= 0) continue;
    const kind = calendarDayKindJapan(segment.date);

    if (kind === "legalHoliday") {
      holidayWorkMinutes += segment.minutes;
      continue;
    }

    // 日曜開始の日跨ぎで月曜に入った分 → 法定外へ実働全量（みなしなし）
    if (!segment.isWorkDate && workDateIsLegalHoliday && kind === "weekday") {
      overtimeMinutes += segment.minutes;
      continue;
    }

    if (kind === "nonStatutoryHoliday" || (treatResidual && segment.isWorkDate)) {
      overtimeMinutes += segment.minutes;
      continue;
    }

    // 平日区間
    if (segment.isWorkDate && workDateIsDeemedWeekday) {
      weekdayWorkOnWorkDate += segment.minutes;
    } else {
      // 祝日明けの平日など、みなし対象外の平日暦日分は実働全量を法定外へ
      overtimeMinutes += segment.minutes;
    }
  }

  const deemedOvertimeMinutes =
    workMinutes > 0 && workDateIsDeemedWeekday ? DEEMED_WEEKDAY_OVERTIME_MINUTES : 0;

  if (weekdayWorkOnWorkDate > 0) {
    overtimeMinutes += discretionaryWeekdayOvertimeMinutes(weekdayWorkOnWorkDate);
  }

  const nightMinutes = nightWorkMinutesInShift(
    clockIn,
    clockOut,
    breakStart,
    breakEnd,
    break2Start,
    break2End,
  );

  return {
    workMinutes,
    overtimeMinutes,
    holidayWorkMinutes,
    deemedOvertimeMinutes,
    deemedNonStatutoryMinutes: overtimeMinutes + holidayWorkMinutes,
    nightMinutes,
  };
}

/**
 * 勤務・残業・休日出勤・みなしの内訳。
 *
 * 共通:
 * - 日跨ぎ勤務は 0:00 で暦日分割し、各暦日の区分で振り分ける
 * - 法定休日 = 日曜
 *
 * 通常:
 * - 土曜・祝日・「残」: 全日残業（日曜は休日出勤）
 * - 「前」/「後」/平日: 従来ルール
 *
 * 裁量労働制:
 * - 平日実勤務あり: みなし 1:30、残業 = max(1:30, 実働-8h)（月45h判定も同値）
 * - 土曜・祝日: 実働全量を法定外
 * - 日曜: 法定休日労働
 * - みなし法定外 = 法定外 + 法定休日
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

  if (workSystem === "discretionary") {
    return calculateDiscretionaryBreakdown({
      workDate,
      dayCode,
      clockIn,
      clockOut,
      breakStart,
      breakEnd,
      break2Start: break2Start ?? null,
      break2End: break2End ?? null,
      workMinutes,
    });
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

  for (const segment of segments) {
    const kind = calendarDayKindJapan(segment.date);
    const part = classifyStandardSegment({
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
  }

  const nightMinutes = nightWorkMinutesInShift(
    clockIn,
    clockOut,
    breakStart,
    breakEnd,
    break2Start ?? null,
    break2End ?? null,
  );

  return {
    workMinutes,
    overtimeMinutes,
    holidayWorkMinutes,
    deemedOvertimeMinutes: 0,
    deemedNonStatutoryMinutes: 0,
    nightMinutes,
  };
}

export type DiscretionaryMonthlyMetrics = {
  workMinutes: number;
  deemedOvertimeMinutes: number;
  /** みなし加算後の労働時間（実働 + みなし） */
  totalLaborMinutes: number;
  /** 法定外（休除）= 月45h判定対象 */
  overtimeExcludingLegalHolidayMinutes: number;
  /** 法定休日労働 */
  legalHolidayWorkMinutes: number;
  /** みなし法定外 = 法定外 + 法定休日 */
  combinedOvertimeAndHolidayMinutes: number;
  nightMinutes: number;
  excessOver45Minutes: number;
  remainingTo45Minutes: number;
  remainingUnder100Minutes: number;
  over45: boolean;
  approach45: boolean;
  warn80: boolean;
  over100: boolean;
};

export function buildDiscretionaryMonthlyMetrics(params: {
  workMinutes: number;
  deemedOvertimeMinutes: number;
  overtimeMinutes: number;
  holidayWorkMinutes: number;
  nightMinutes: number;
}): DiscretionaryMonthlyMetrics {
  const overtimeExcludingLegalHolidayMinutes = params.overtimeMinutes;
  const legalHolidayWorkMinutes = params.holidayWorkMinutes;
  const combined =
    overtimeExcludingLegalHolidayMinutes + legalHolidayWorkMinutes;

  return {
    workMinutes: params.workMinutes,
    deemedOvertimeMinutes: params.deemedOvertimeMinutes,
    totalLaborMinutes: params.workMinutes + params.deemedOvertimeMinutes,
    overtimeExcludingLegalHolidayMinutes,
    legalHolidayWorkMinutes,
    combinedOvertimeAndHolidayMinutes: combined,
    nightMinutes: params.nightMinutes,
    excessOver45Minutes: Math.max(
      0,
      overtimeExcludingLegalHolidayMinutes - MONTHLY_45H_MINUTES,
    ),
    remainingTo45Minutes: Math.max(
      0,
      MONTHLY_45H_MINUTES - overtimeExcludingLegalHolidayMinutes,
    ),
    remainingUnder100Minutes: Math.max(
      0,
      MONTHLY_UNDER_100H_CAP_MINUTES - combined,
    ),
    over45: overtimeExcludingLegalHolidayMinutes > MONTHLY_45H_MINUTES,
    approach45:
      overtimeExcludingLegalHolidayMinutes >= MONTHLY_40H_APPROACH_MINUTES &&
      overtimeExcludingLegalHolidayMinutes <= MONTHLY_45H_MINUTES,
    warn80: combined >= MONTHLY_80H_WARN_MINUTES,
    over100: combined >= 100 * 60,
  };
}
