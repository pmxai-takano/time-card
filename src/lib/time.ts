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
/** 裁量: 所定労働時間 8:00 */
export const STANDARD_DAILY_MINUTES = STANDARD_WORK_MINUTES;
/** 裁量: みなし労働時間 9:30（協定） */
export const DISCRETIONARY_DAILY_MINUTES = 9 * 60 + 30;
/** 裁量: みなし法定外 1:30（9:30 − 8:00） */
export const DEEMED_WEEKDAY_OVERTIME_MINUTES = 90;
/** 深夜帯: 22:00〜翌5:00 */
const NIGHT_START_MINUTES = 22 * 60;
const NIGHT_END_MINUTES = 5 * 60;
export const MONTHLY_45H_MINUTES = 45 * 60;
/** 単月100時間未満の上限表示用（99:59）。100:00到達で不適合 */
export const MONTHLY_UNDER_100H_CAP_MINUTES = 99 * 60 + 59;
export const MONTHLY_100H_LIMIT_MINUTES = 100 * 60;
export const MONTHLY_80H_WARN_MINUTES = 80 * 60;
export const MONTHLY_40H_APPROACH_MINUTES = 40 * 60;
export const COMPANY_60H_MINUTES = 60 * 60;
export const ANNUAL_SPECIAL_OVERTIME_MINUTES = 720 * 60;
export const SPECIAL_MONTH_COUNT_LIMIT = 6;

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
  /** 実労働時間 */
  workMinutes: number;
  /**
   * 法休除（会社制度・暫定の45h対象）。
   * 裁量: みなし法定外1:30 + 所定休日実働 + 日曜→月曜またぎ等（実労働の9:30超は含めない）
   * 通常: 従来の残業
   */
  overtimeMinutes: number;
  /** 法定休日（日曜）の実労働 */
  holidayWorkMinutes: number;
  /** みなし法定外（日次・平日1:30）／裁量手当対象の日次分 */
  deemedOvertimeMinutes: number;
  /**
   * 社内みなし法定外（暫定）= 法休除 + 法定休日
   * 通常は 0
   */
  deemedNonStatutoryMinutes: number;
  /** 深夜 22:00〜翌5:00 の実労働 */
  nightMinutes: number;
  /** みなし労働時間（裁量・平日勤務日は 9:30） */
  discretionaryWorkMinutes: number;
  /** 所定休日・法定外休日（土曜・祝日）の実労働 */
  nonStatutoryHolidayMinutes: number;
  /** 実労働超過参考値 MAX(実労働 − 9:30, 0)。法令レイヤーへは加算しない */
  actualOvertimeReferenceMinutes: number;
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
    discretionaryWorkMinutes: 0,
    nonStatutoryHolidayMinutes: 0,
    actualOvertimeReferenceMinutes: 0,
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

/** 平日の残業（裁量・廃止予定の互換）。仕様 v0.1 では固定 1:30 を用いる。 */
export function discretionaryWeekdayOvertimeMinutes(workMinutes: number): number {
  if (workMinutes <= 0) return 0;
  return DEEMED_WEEKDAY_OVERTIME_MINUTES;
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
 * 裁量労働制の日別内訳（仕様書 v0.1.0）。
 *
 * - 所定労働日に実勤務あり: みなし労働 9:30、みなし法定外 1:30
 * - 実労働の 9:30 超は参考値のみ（法令・45hへ自動加算しない）
 * - 土曜・祝日: 所定休日実労働（法休除の会社集計へ加算）
 * - 日曜: 法定休日労働
 * - 日曜→月曜またぎの月曜分: 所定外の追加実労働として法休除へ
 * - 社内みなし法定外（暫定）= 法休除 + 法定休日
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

  let holidayWorkMinutes = 0;
  let nonStatutoryHolidayMinutes = 0;
  let weekdayExtraMinutes = 0;

  for (const segment of segments) {
    if (segment.minutes <= 0) continue;
    const kind = calendarDayKindJapan(segment.date);

    if (kind === "legalHoliday") {
      holidayWorkMinutes += segment.minutes;
      continue;
    }

    // 日曜開始の日跨ぎで月曜に入った分 → 法休除へ実働全量（みなしなし）
    if (!segment.isWorkDate && workDateIsLegalHoliday && kind === "weekday") {
      weekdayExtraMinutes += segment.minutes;
      continue;
    }

    if (kind === "nonStatutoryHoliday" || (treatResidual && segment.isWorkDate)) {
      nonStatutoryHolidayMinutes += segment.minutes;
      continue;
    }

    // 平日区間（みなし対象日の実働自体は法休除へ重ねない）
    if (!(segment.isWorkDate && workDateIsDeemedWeekday)) {
      weekdayExtraMinutes += segment.minutes;
    }
  }

  const onDeemedWeekday = workMinutes > 0 && workDateIsDeemedWeekday;
  const discretionaryWorkMinutes = onDeemedWeekday ? DISCRETIONARY_DAILY_MINUTES : 0;
  const deemedOvertimeMinutes = onDeemedWeekday ? DEEMED_WEEKDAY_OVERTIME_MINUTES : 0;
  const actualOvertimeReferenceMinutes = onDeemedWeekday
    ? Math.max(0, workMinutes - DISCRETIONARY_DAILY_MINUTES)
    : 0;

  // 法休除（会社制度・暫定）: みなし1:30 + 所定休日実働 + その他追加実働
  const overtimeMinutes =
    deemedOvertimeMinutes + nonStatutoryHolidayMinutes + weekdayExtraMinutes;

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
    discretionaryWorkMinutes,
    nonStatutoryHolidayMinutes,
    actualOvertimeReferenceMinutes,
  };
}

/**
 * 勤務・残業・休日出勤・みなしの内訳。
 *
 * 共通: 日跨ぎは 0:00 で暦日分割。法定休日 = 日曜。
 *
 * 通常: 土曜・祝日・「残」は残業、日曜は休日出勤、平日は 8h 超など従来ルール。
 *
 * 裁量（仕様書 v0.1）:
 * - 所定労働日の実勤務あり → みなし労働 9:30・みなし法定外 1:30
 * - 実労働の 9:30 超は参考値のみ
 * - 土曜・祝日実働 → 所定休日労働（法休除へ）
 * - 日曜実働 → 法定休日
 * - 社内みなし法定外（暫定）= 法休除 + 法定休日
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
    discretionaryWorkMinutes: 0,
    nonStatutoryHolidayMinutes: 0,
    actualOvertimeReferenceMinutes: 0,
  };
}

export type DiscretionaryMonthlyMetrics = {
  /** 実態 */
  workMinutes: number;
  nightMinutes: number;
  actualOvertimeReferenceMinutes: number;
  /** 会社制度 */
  discretionaryWorkMinutes: number;
  allowanceTargetMinutes: number;
  nonStatutoryHolidayMinutes: number;
  legalHolidayWorkMinutes: number;
  company60hBasisMinutes: number;
  companyOver60Minutes: number;
  /** 法休除（暫定・会社45h対象） */
  overtimeExcludingLegalHolidayMinutes: number;
  /** 社内みなし法定外（暫定） */
  companyDeemedNonStatutoryMinutes: number;
  company80hRemainingMinutes: number;
  companyWarn80: boolean;
  /** 法令・36協定 */
  excessOver45Minutes: number;
  remainingTo45Minutes: number;
  remainingUnder100Minutes: number;
  over45: boolean;
  approach45: boolean;
  lawWarn80: boolean;
  over100: boolean;
  statusNotes: string[];
};

export function buildDiscretionaryMonthlyMetrics(params: {
  workMinutes: number;
  deemedOvertimeMinutes: number;
  overtimeMinutes: number;
  holidayWorkMinutes: number;
  nightMinutes: number;
  discretionaryWorkMinutes: number;
  nonStatutoryHolidayMinutes: number;
  actualOvertimeReferenceMinutes: number;
}): DiscretionaryMonthlyMetrics {
  const allowanceTargetMinutes = params.deemedOvertimeMinutes;
  const nonStatutoryHolidayMinutes = params.nonStatutoryHolidayMinutes;
  const legalHolidayWorkMinutes = params.holidayWorkMinutes;
  const overtimeExcludingLegalHolidayMinutes = params.overtimeMinutes;
  const companyDeemedNonStatutoryMinutes =
    overtimeExcludingLegalHolidayMinutes + legalHolidayWorkMinutes;
  const company60hBasisMinutes = allowanceTargetMinutes + nonStatutoryHolidayMinutes;

  const statusNotes = [
    "会社制度値・法令値はレイヤー別に表示しています。",
    "社内みなし法定外・80時間措置の式は総務サマリー照合中のため暫定です。",
    "実労働の9:30超は参考値であり、法休除・45h判定へ自動加算していません。",
    "週40時間超過による法定時間外の再計算は未実装です。",
  ];

  return {
    workMinutes: params.workMinutes,
    nightMinutes: params.nightMinutes,
    actualOvertimeReferenceMinutes: params.actualOvertimeReferenceMinutes,
    discretionaryWorkMinutes: params.discretionaryWorkMinutes,
    allowanceTargetMinutes,
    nonStatutoryHolidayMinutes,
    legalHolidayWorkMinutes,
    company60hBasisMinutes,
    companyOver60Minutes: Math.max(0, company60hBasisMinutes - COMPANY_60H_MINUTES),
    overtimeExcludingLegalHolidayMinutes,
    companyDeemedNonStatutoryMinutes,
    company80hRemainingMinutes: Math.max(
      0,
      MONTHLY_80H_WARN_MINUTES - companyDeemedNonStatutoryMinutes,
    ),
    companyWarn80: companyDeemedNonStatutoryMinutes > MONTHLY_80H_WARN_MINUTES,
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
      MONTHLY_UNDER_100H_CAP_MINUTES - companyDeemedNonStatutoryMinutes,
    ),
    over45: overtimeExcludingLegalHolidayMinutes > MONTHLY_45H_MINUTES,
    approach45:
      overtimeExcludingLegalHolidayMinutes >= MONTHLY_40H_APPROACH_MINUTES &&
      overtimeExcludingLegalHolidayMinutes <= MONTHLY_45H_MINUTES,
    lawWarn80: companyDeemedNonStatutoryMinutes >= MONTHLY_80H_WARN_MINUTES,
    over100: companyDeemedNonStatutoryMinutes >= MONTHLY_100H_LIMIT_MINUTES,
    statusNotes,
  };
}
