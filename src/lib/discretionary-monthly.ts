import { prevMonth } from "@/lib/calendar-jp";
import {
  buildDiscretionaryMonthlyMetrics,
  calculateAttendanceBreakdown,
  type DiscretionaryMonthlyMetrics,
} from "@/lib/time";
import {
  resolveWorkSystemForMonth,
  type WorkSystem,
} from "@/lib/work-system";
import type { AttendanceRecord } from "@/types/attendance";

export type MonthCombinedMinutes = {
  year: number;
  month: number;
  combinedMinutes: number;
};

/** 当月を含む 2〜6 か月平均（法定外＋法定休日）。データが足りない窓は null。 */
export function computeRollingAverages(
  monthsNewestFirst: MonthCombinedMinutes[],
): Array<{ months: number; averageMinutes: number | null }> {
  const result: Array<{ months: number; averageMinutes: number | null }> = [];
  for (let n = 2; n <= 6; n += 1) {
    if (monthsNewestFirst.length < n) {
      result.push({ months: n, averageMinutes: null });
      continue;
    }
    const slice = monthsNewestFirst.slice(0, n);
    const sum = slice.reduce((s, m) => s + m.combinedMinutes, 0);
    result.push({ months: n, averageMinutes: Math.round(sum / n) });
  }
  return result;
}

export function aggregateMonthCombinedMinutes(params: {
  year: number;
  month: number;
  records: AttendanceRecord[];
  workSystem: WorkSystem;
}): number {
  let overtime = 0;
  let holiday = 0;
  for (const record of params.records) {
    const b = calculateAttendanceBreakdown({
      workSystem: params.workSystem,
      workDate: record.work_date,
      dayCode: record.day_code,
      clockIn: record.clock_in,
      clockOut: record.clock_out,
      breakStart: record.break_start,
      breakEnd: record.break_end,
      break2Start: record.break2_start ?? null,
      break2End: record.break2_end ?? null,
    });
    overtime += b.overtimeMinutes;
    holiday += b.holidayWorkMinutes;
  }
  return overtime + holiday;
}

export function listPriorYearMonths(
  year: number,
  month: number,
  count: number,
): Array<{ year: number; month: number }> {
  const out: Array<{ year: number; month: number }> = [];
  let y = year;
  let m = month;
  for (let i = 0; i < count; i += 1) {
    const p = prevMonth(y, m);
    y = p.year;
    m = p.month;
    out.push({ year: y, month: m });
  }
  return out;
}

export function metricsFromBreakdownTotals(totals: {
  workMinutes: number;
  overtimeMinutes: number;
  holidayWorkMinutes: number;
  deemedOvertimeMinutes: number;
  nightMinutes: number;
  discretionaryWorkMinutes: number;
  nonStatutoryHolidayMinutes: number;
  actualOvertimeReferenceMinutes: number;
}): DiscretionaryMonthlyMetrics {
  return buildDiscretionaryMonthlyMetrics(totals);
}

export function resolveSystemsForMonths(params: {
  months: Array<{ year: number; month: number }>;
  userDefault: WorkSystem;
  monthWorkSystems: Record<string, WorkSystem>;
}): WorkSystem[] {
  return params.months.map(({ year, month }) =>
    resolveWorkSystemForMonth({
      year,
      month,
      userDefault: params.userDefault,
      monthWorkSystems: params.monthWorkSystems,
    }),
  );
}
