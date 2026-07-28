import Link from "next/link";
import {
  formatMonthTitle,
  getMonthlyStatutoryCaps,
  getTodayYmdJapan,
  isJapanPublicHoliday,
  nextMonth,
  prevMonth,
  weekdayIndexJapan,
  weekdayLabelJp,
} from "@/lib/calendar-jp";
import { commuteTypeDisplayClassName } from "@/lib/commute-types";
import { formatDayCodeCell } from "@/lib/day-codes";
import { FillMonthButton } from "@/components/fill-month-button";
import { MonthWorkSystemSelect } from "@/components/month-work-system-select";
import { AttendanceRecord } from "@/types/attendance";
import {
  calculateAttendanceBreakdown,
  calculateWorkMinutes,
  formatMinutes,
  totalBreakDurationMinutes,
} from "@/lib/time";
import type { WorkSystem } from "@/lib/work-system";

export type MonthlyTimesheetRow = {
  workDate: string;
  record: AttendanceRecord | null;
};

type Props = {
  year: number;
  month: number;
  rows: MonthlyTimesheetRow[];
  /** 日本時間の当月・来月表示中のみ true（一括登録ボタン用） */
  showFillMissing?: boolean;
  workSystem?: WorkSystem;
};

function displayTime(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 5);
}

function formatPercent1(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

export function MonthlyTimesheet({
  year,
  month,
  rows,
  showFillMissing,
  workSystem = "standard",
}: Props) {
  const isDiscretionary = workSystem === "discretionary";

  const totals = rows.reduce(
    (acc, { workDate, record }) => {
      const workMin = calculateWorkMinutes({
        clockIn: record?.clock_in ?? null,
        clockOut: record?.clock_out ?? null,
        breakStart: record?.break_start ?? null,
        breakEnd: record?.break_end ?? null,
        break2Start: record?.break2_start ?? null,
        break2End: record?.break2_end ?? null,
        workDate: record?.work_date ?? workDate,
      });
      const breakdown = record
        ? calculateAttendanceBreakdown({
            workSystem,
            workDate: record.work_date,
            dayCode: record.day_code,
            clockIn: record.clock_in,
            clockOut: record.clock_out,
            breakStart: record.break_start,
            breakEnd: record.break_end,
            break2Start: record.break2_start ?? null,
            break2End: record.break2_end ?? null,
          })
        : {
            overtimeMinutes: 0,
            holidayWorkMinutes: 0,
            deemedOvertimeMinutes: 0,
            deemedNonStatutoryMinutes: 0,
          };

      acc.workMinutes += workMin;
      acc.overtimeMinutes += breakdown.overtimeMinutes;
      acc.holidayWorkMinutes += breakdown.holidayWorkMinutes;
      acc.deemedOvertimeMinutes += breakdown.deemedOvertimeMinutes;
      acc.deemedNonStatutoryMinutes += breakdown.deemedNonStatutoryMinutes;

      return acc;
    },
    {
      workMinutes: 0,
      overtimeMinutes: 0,
      holidayWorkMinutes: 0,
      deemedOvertimeMinutes: 0,
      deemedNonStatutoryMinutes: 0,
    },
  );

  const caps = getMonthlyStatutoryCaps(year, month);
  const prev = prevMonth(year, month);
  const next = nextMonth(year, month);
  const today = getTodayYmdJapan();

  let officeRatePlainWeekdayCount = 0;
  let weekdayWorkDays = 0;
  let weekdayOfficeDays = 0;
  for (const { workDate, record } of rows) {
    const dow = weekdayIndexJapan(workDate);
    if (dow < 1 || dow > 5) continue;
    if (isJapanPublicHoliday(workDate)) continue;

    officeRatePlainWeekdayCount += 1;

    if (!record?.clock_in || !record?.clock_out) continue;
    weekdayWorkDays += 1;
    if (record.commute_type === "出社") {
      weekdayOfficeDays += 1;
    }
  }

  const officeRateBaseline =
    officeRatePlainWeekdayCount > 0 ? 8 / officeRatePlainWeekdayCount : null;
  const officeRateActual =
    weekdayWorkDays > 0 ? weekdayOfficeDays / weekdayWorkDays : null;

  return (
    <div className="w-full min-w-0 space-y-3">
      <h2 className="text-center text-base font-bold sm:text-lg">{formatMonthTitle(year, month)}</h2>
      <MonthWorkSystemSelect year={year} month={month} value={workSystem} />
      {isDiscretionary ? (
        <p className="text-center text-xs text-slate-600">勤務体系: 裁量労働制（みなし残業あり）</p>
      ) : (
        <p className="text-center text-xs text-slate-600">勤務体系: 通常</p>
      )}

      <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-slate-300 bg-white shadow-sm">
        <table
          className={`w-full table-fixed border-collapse text-xs sm:text-sm ${
            isDiscretionary ? "min-w-[860px]" : "min-w-[780px]"
          }`}
        >
          <colgroup>
            <col className="w-[5%]" />
            <col className="w-[4%]" />
            <col className="w-[6%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[7%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[7%]" />
            {isDiscretionary ? <col className="w-[8%]" /> : null}
            <col className={isDiscretionary ? "w-[16%]" : "w-[22%]"} />
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr className="bg-indigo-950 text-white">
              <th className="border border-indigo-900 px-1 py-2">日</th>
              <th className="border border-indigo-900 px-1 py-2">曜</th>
              <th className="border border-indigo-900 px-1 py-2">勤怠区分</th>
              <th className="border border-indigo-900 px-1 py-2">出勤区分</th>
              <th className="border border-indigo-900 px-1 py-2">出社</th>
              <th className="border border-indigo-900 px-1 py-2">退社</th>
              <th className="border border-indigo-900 px-1 py-2">休憩</th>
              <th className="border border-indigo-900 px-1 py-2">勤務</th>
              <th className="border border-indigo-900 px-1 py-2">残業</th>
              <th className="border border-indigo-900 px-1 py-2">休日出勤</th>
              {isDiscretionary ? (
                <th className="border border-indigo-900 px-1 py-2">みなし法定外</th>
              ) : null}
              <th className="border border-indigo-900 px-1 py-2">メモ</th>
              <th className="border border-indigo-900 px-1 py-2">編集</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ workDate, record }) => {
              const dow = weekdayIndexJapan(workDate);
              const isWeekend = dow === 0 || dow === 6;
              const isHoliday = isJapanPublicHoliday(workDate);
              const highlightRow = isWeekend || isHoliday;
              const workMin = calculateWorkMinutes({
                clockIn: record?.clock_in ?? null,
                clockOut: record?.clock_out ?? null,
                breakStart: record?.break_start ?? null,
                breakEnd: record?.break_end ?? null,
                break2Start: record?.break2_start ?? null,
                break2End: record?.break2_end ?? null,
                workDate: record?.work_date ?? workDate,
              });
              const brkMin = totalBreakDurationMinutes(
                { start: record?.break_start ?? null, end: record?.break_end ?? null },
                { start: record?.break2_start ?? null, end: record?.break2_end ?? null },
              );
              const dayCell = formatDayCodeCell(record?.day_code);
              const breakdown = record
                ? calculateAttendanceBreakdown({
                    workSystem,
                    workDate: record.work_date,
                    dayCode: record.day_code,
                    clockIn: record.clock_in,
                    clockOut: record.clock_out,
                    breakStart: record.break_start,
                    breakEnd: record.break_end,
                    break2Start: record.break2_start ?? null,
                    break2End: record.break2_end ?? null,
                  })
                : {
                    overtimeMinutes: 0,
                    holidayWorkMinutes: 0,
                    deemedOvertimeMinutes: 0,
                    deemedNonStatutoryMinutes: 0,
                  };

              return (
                <tr
                  key={workDate}
                  className={highlightRow ? "bg-amber-100" : "bg-white"}
                >
                  <td className="border border-slate-200 px-1 py-1 text-center">
                    {workDate.slice(5).replace("-", "/")}
                  </td>
                  <td className="border border-slate-200 px-1 py-1 text-center">
                    {weekdayLabelJp(workDate)}
                  </td>
                  <td
                    className={`border border-slate-200 px-1 py-1 text-center ${dayCell.className}`.trim()}
                    title={dayCell.title}
                  >
                    {dayCell.text}
                  </td>
                  <td
                    className={`border border-slate-200 px-1 py-1 text-center ${commuteTypeDisplayClassName(record?.commute_type)}`.trim()}
                  >
                    {record?.commute_type ?? ""}
                  </td>
                  <td className="border border-slate-200 px-1 py-1 text-center">
                    {displayTime(record?.clock_in)}
                  </td>
                  <td className="border border-slate-200 px-1 py-1 text-center">
                    {displayTime(record?.clock_out)}
                  </td>
                  <td className="border border-slate-200 px-1 py-1 text-center">
                    {brkMin ? formatMinutes(brkMin) : ""}
                  </td>
                  <td className="border border-slate-200 px-1 py-1 text-center">
                    {workMin ? formatMinutes(workMin) : ""}
                  </td>
                  <td className="border border-slate-200 px-1 py-1 text-center">
                    {breakdown.overtimeMinutes ? formatMinutes(breakdown.overtimeMinutes) : ""}
                  </td>
                  <td className="border border-slate-200 px-1 py-1 text-center">
                    {breakdown.holidayWorkMinutes
                      ? formatMinutes(breakdown.holidayWorkMinutes)
                      : ""}
                  </td>
                  {isDiscretionary ? (
                    <td className="border border-slate-200 px-1 py-1 text-center">
                      {breakdown.deemedNonStatutoryMinutes
                        ? formatMinutes(breakdown.deemedNonStatutoryMinutes)
                        : ""}
                    </td>
                  ) : null}
                  <td className="max-w-0 min-w-[30ch] border border-slate-200 px-1 py-1 text-left text-[11px] text-slate-800">
                    {record?.memo ? (
                      <span className="block truncate" title={record.memo}>
                        {record.memo}
                      </span>
                    ) : null}
                  </td>
                  <td className="border border-slate-200 px-1 py-1 text-center">
                    <Link
                      href={`/record?date=${workDate}`}
                      className="inline-block rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white"
                    >
                      編集
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showFillMissing ? (
        <div className="w-full rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
          <FillMonthButton year={year} month={month} />
        </div>
      ) : null}

      <div className="w-full space-y-2 rounded-lg border bg-white p-3 text-xs sm:text-sm">
        <p>勤務時間合計: {formatMinutes(totals.workMinutes)}</p>
        <p>残業時間合計（法定外）: {formatMinutes(totals.overtimeMinutes)}</p>
        <p>
          休日出勤合計
          {isDiscretionary ? "（日曜・土曜・祝日・残）" : "（法定休日・日曜）"}:{" "}
          {formatMinutes(totals.holidayWorkMinutes)}
        </p>
        {isDiscretionary ? (
          <>
            <p>
              みなし残業合計（平日 1:30 × 勤務日）:{" "}
              {formatMinutes(totals.deemedOvertimeMinutes)}
            </p>
            <p>みなし法定外合計: {formatMinutes(totals.deemedNonStatutoryMinutes)}</p>
            <p>
              みなし超過（法定外 − みなし法定外）:{" "}
              {formatMinutes(
                Math.max(0, totals.overtimeMinutes - totals.deemedNonStatutoryMinutes),
              )}
            </p>
          </>
        ) : null}
        <p>
          出社率実績:{" "}
          {officeRateActual !== null
            ? `${formatPercent1(officeRateActual)}（祝日を除く平日 出社 ${weekdayOfficeDays}日 / 勤務 ${weekdayWorkDays}日）`
            : "—（祝日を除く平日に勤務なし）"}
        </p>
        <p className="border-t border-slate-200 pt-2 text-[11px] text-slate-600">
          月内の月曜〜金曜の日数（祝日が月〜金にあっても含む）: {caps.weekdayCount}日 × 8時間
        </p>
        <p>法定労働時間: {formatMinutes(caps.legalMinutes)}</p>
        <p>目標勤務時間: {formatMinutes(caps.goalMinutes)}（法定 + 30時間）</p>
        <p>36協定勤務時間: {formatMinutes(caps.article36Minutes)}（法定 + 45時間）</p>
        <p>労働基準法勤務時間: {formatMinutes(caps.laborStandardsMinutes)}（法定 + 80時間）</p>
        <p>
          出社率基準値:{" "}
          {officeRateBaseline !== null
            ? `${formatPercent1(officeRateBaseline)}（8 ÷ 祝日を除く平日 ${officeRatePlainWeekdayCount}日）`
            : "—"}
        </p>
      </div>

      <nav className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
        <Link
          href={`/?year=${prev.year}&month=${prev.month}`}
          className="rounded-lg border bg-white px-3 py-2 hover:bg-slate-50"
        >
          前の月
        </Link>
        <Link
          href={`/?year=${today.year}&month=${today.month}`}
          className="rounded-lg border bg-white px-3 py-2 hover:bg-slate-50"
        >
          当月
        </Link>
        <Link
          href={`/?year=${next.year}&month=${next.month}`}
          className="rounded-lg border bg-white px-3 py-2 hover:bg-slate-50"
        >
          次の月
        </Link>
      </nav>
    </div>
  );
}
