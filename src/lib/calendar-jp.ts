import JapaneseHolidays from "japanese-holidays";

/** 勤務日（YYYY-MM-DD）を日本のカレンダー日として解釈した曜日（0=日 … 6=土） */
export function weekdayIndexJapan(workDate: string): number {
  const parts = workDate.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return 0;
  const utc = Date.UTC(y, m - 1, d, 3, 0, 0);
  return new Date(utc).getUTCDay();
}

const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function weekdayLabelJp(workDate: string): string {
  return WEEKDAY_JP[weekdayIndexJapan(workDate)] ?? "";
}

export function isWeekendJapan(workDate: string): boolean {
  const w = weekdayIndexJapan(workDate);
  return w === 0 || w === 6;
}

/** 国民の祝日（振替休日を含む `furikae: true`） */
export function isJapanPublicHoliday(workDate: string): boolean {
  const parts = workDate.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return false;
  const date = new Date(Date.UTC(y, m - 1, d, 3, 0, 0));
  return Boolean(JapaneseHolidays.isHolidayAt(date, true));
}

/** 法定休日（日曜） */
export function isLegalHolidayJapan(workDate: string): boolean {
  return weekdayIndexJapan(workDate) === 0;
}

/**
 * 法定外休日: 土曜、または日曜以外の国民の祝日（振替含む）。
 * 日曜の祝日は法定休日側に寄せる。
 */
export function isNonStatutoryHolidayJapan(workDate: string): boolean {
  if (isLegalHolidayJapan(workDate)) return false;
  return weekdayIndexJapan(workDate) === 6 || isJapanPublicHoliday(workDate);
}

/**
 * みなし残業の対象平日（裁量労働制）: 月曜〜金曜かつ祝日でない日。
 */
export function isDeemedOvertimeWeekdayJapan(workDate: string): boolean {
  const w = weekdayIndexJapan(workDate);
  if (w < 1 || w > 5) return false;
  return !isJapanPublicHoliday(workDate);
}

/** YYYY-MM-DD に日数を加算（日本の暦日として） */
export function addDaysJapan(workDate: string, deltaDays: number): string {
  const parts = workDate.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return workDate;
  const utc = Date.UTC(y, m - 1, d + deltaDays, 3, 0, 0);
  const dt = new Date(utc);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export type CalendarDayKind = "legalHoliday" | "nonStatutoryHoliday" | "weekday";

/** 暦日の休日区分（法定休日 / 法定外休日 / 平日） */
export function calendarDayKindJapan(workDate: string): CalendarDayKind {
  if (isLegalHolidayJapan(workDate)) return "legalHoliday";
  if (isNonStatutoryHolidayJapan(workDate)) return "nonStatutoryHoliday";
  return "weekday";
}

/** 日本時間の「今日」の年月日 */
export function getTodayYmdJapan(): { year: number; month: number; day: number } {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = s.split("-").map(Number);
  return { year: y, month: m, day: d };
}

/** month は 1〜12 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 指定月における「月曜〜金曜」の日数（その日が祝日でもカウントに含める） */
export function countMondayToFridayInMonth(year: number, month: number): number {
  return listWorkDatesInMonth(year, month).filter((d) => {
    const w = weekdayIndexJapan(d);
    return w >= 1 && w <= 5;
  }).length;
}

const MINUTES_PER_LEGAL_WEEKDAY = 8 * 60;

export type MonthlyStatutoryCaps = {
  weekdayCount: number;
  legalMinutes: number;
  goalMinutes: number;
  article36Minutes: number;
  laborStandardsMinutes: number;
};

export function getMonthlyStatutoryCaps(year: number, month: number): MonthlyStatutoryCaps {
  const weekdayCount = countMondayToFridayInMonth(year, month);
  const legalMinutes = weekdayCount * MINUTES_PER_LEGAL_WEEKDAY;
  return {
    weekdayCount,
    legalMinutes,
    goalMinutes: legalMinutes + 30 * 60,
    article36Minutes: legalMinutes + 45 * 60,
    laborStandardsMinutes: legalMinutes + 80 * 60,
  };
}

/** 指定月の全日付 YYYY-MM-DD（日本の暦として列挙） */
export function listWorkDatesInMonth(year: number, month: number): string[] {
  const count = daysInMonth(year, month);
  const dates: string[] = [];
  for (let day = 1; day <= count; day += 1) {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    dates.push(`${year}-${mm}-${dd}`);
  }
  return dates;
}

export function parseYearMonth(
  yearParam: string | undefined,
  monthParam: string | undefined,
): { year: number; month: number } {
  const today = getTodayYmdJapan();
  const y = yearParam ? Number(yearParam) : today.year;
  const m = monthParam ? Number(monthParam) : today.month;
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { year: today.year, month: today.month };
  }
  return { year: y, month: m };
}

export function prevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

export function nextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

/** 一括初期入力が許可される月（当月・来月）か */
export function isFillableMonth(year: number, month: number): boolean {
  const today = getTodayYmdJapan();
  if (year === today.year && month === today.month) return true;
  const next = nextMonth(today.year, today.month);
  return year === next.year && month === next.month;
}

export function formatMonthTitle(year: number, month: number): string {
  const last = daysInMonth(year, month);
  const mm = String(month).padStart(2, "0");
  return `勤務表(${year}/${mm}/01~${mm}/${String(last).padStart(2, "0")})`;
}
