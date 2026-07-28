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
  buildDiscretionaryMonthlyMetrics,
  MONTHLY_80H_WARN_MINUTES,
} from "@/lib/time";
import type { WorkSystem } from "@/lib/work-system";
import type { MonthCombinedMinutes } from "@/lib/discretionary-monthly";
import { computeRollingAverages } from "@/lib/discretionary-monthly";

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
  /** 当月を先頭にした直近月の（法定外＋法定休日）分。裁量の複数月平均用 */
  recentCombinedMonths?: MonthCombinedMinutes[];
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
  recentCombinedMonths = [],
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
            nightMinutes: 0,
          };

      acc.workMinutes += workMin;
      acc.overtimeMinutes += breakdown.overtimeMinutes;
      acc.holidayWorkMinutes += breakdown.holidayWorkMinutes;
      acc.deemedOvertimeMinutes += breakdown.deemedOvertimeMinutes;
      acc.deemedNonStatutoryMinutes += breakdown.deemedNonStatutoryMinutes;
      acc.nightMinutes += breakdown.nightMinutes;

      return acc;
    },
    {
      workMinutes: 0,
      overtimeMinutes: 0,
      holidayWorkMinutes: 0,
      deemedOvertimeMinutes: 0,
      deemedNonStatutoryMinutes: 0,
      nightMinutes: 0,
    },
  );

  const discMetrics = isDiscretionary
    ? buildDiscretionaryMonthlyMetrics(totals)
    : null;

  const rolling = isDiscretionary
    ? computeRollingAverages(
        recentCombinedMonths.length > 0
          ? recentCombinedMonths
          : [
              {
                year,
                month,
                combinedMinutes: totals.overtimeMinutes + totals.holidayWorkMinutes,
              },
            ],
      )
    : [];
  const anyRollingOver80 = rolling.some(
    (r) => r.averageMinutes !== null && r.averageMinutes > MONTHLY_80H_WARN_MINUTES,
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
              <th
                className="border border-indigo-900 px-1 py-2"
                title={
                  isDiscretionary
                    ? "法定休日を除く時間外（月45時間判定対象）"
                    : undefined
                }
              >
                {isDiscretionary ? "法定外(休除)" : "残業"}
              </th>
              <th className="border border-indigo-900 px-1 py-2">
                {isDiscretionary ? "法定休日" : "休日出勤"}
              </th>
              {isDiscretionary ? (
                <th
                  className="border border-indigo-900 px-1 py-2"
                  title="法定外（休除）＋法定休日労働"
                >
                  みなし法定外
                </th>
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
                    nightMinutes: 0,
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
        <p>実勤務時間合計: {formatMinutes(totals.workMinutes)}</p>
        {isDiscretionary && discMetrics ? (
          <>
            <p>みなし残業合計: {formatMinutes(discMetrics.deemedOvertimeMinutes)}</p>
            <p>
              みなし加算後労働時間: {formatMinutes(discMetrics.totalLaborMinutes)}
            </p>
            <p title="月45時間判定の対象">
              法定外（休除みなし）:{" "}
              {formatMinutes(discMetrics.overtimeExcludingLegalHolidayMinutes)}
            </p>
            <p>法定休日労働: {formatMinutes(discMetrics.legalHolidayWorkMinutes)}</p>
            <p title="法定外（休除）＋法定休日">
              みなし法定外（時間外・法定休日労働合計）:{" "}
              {formatMinutes(discMetrics.combinedOvertimeAndHolidayMinutes)}
            </p>
            <p>深夜労働（22:00〜翌5:00）: {formatMinutes(discMetrics.nightMinutes)}</p>
            <p
              className={
                discMetrics.over45
                  ? "text-orange-700"
                  : discMetrics.approach45
                    ? "text-amber-700"
                    : undefined
              }
            >
              法定外45H超みなし: {formatMinutes(discMetrics.excessOver45Minutes)}
            </p>
            <p className={discMetrics.approach45 || discMetrics.remainingTo45Minutes === 0 ? "text-amber-700" : undefined}>
              法休除 当月残みなし（月45時間までの残り）:{" "}
              {formatMinutes(discMetrics.remainingTo45Minutes)}
            </p>
            <p
              className={
                discMetrics.over100
                  ? "font-semibold text-red-700"
                  : discMetrics.warn80
                    ? "text-red-600"
                    : undefined
              }
            >
              法休含 当月残みなし（単月100時間未満までの残り）:{" "}
              {formatMinutes(discMetrics.remainingUnder100Minutes)}
            </p>
            {discMetrics.over45 ? (
              <p className="rounded bg-orange-50 px-2 py-1 text-orange-800">
                月45時間を超過しています。特別条項の適用状況は本システムでは判定しません。
              </p>
            ) : null}
            {discMetrics.warn80 ? (
              <p className="rounded bg-red-50 px-2 py-1 text-red-800">
                法定休日込み時間が80時間以上です（健康管理上の長時間労働警告）。単月80時間超だけでは法令違反と断定しません。
              </p>
            ) : null}
            {discMetrics.over100 ? (
              <p className="rounded bg-red-100 px-2 py-1 font-semibold text-red-900">
                法定休日込み時間が100時間以上です（単月上限超過警告）。
              </p>
            ) : null}
            <div className="border-t border-slate-200 pt-2">
              <p className="mb-1 font-medium">2〜6か月平均（法定外＋法定休日）</p>
              {rolling.map((r) => (
                <p
                  key={r.months}
                  className={
                    r.averageMinutes !== null && r.averageMinutes > MONTHLY_80H_WARN_MINUTES
                      ? "font-semibold text-red-700"
                      : undefined
                  }
                >
                  {r.months}か月平均:{" "}
                  {r.averageMinutes !== null ? formatMinutes(r.averageMinutes) : "—（データ不足）"}
                </p>
              ))}
              {anyRollingOver80 ? (
                <p className="mt-1 rounded bg-red-100 px-2 py-1 font-semibold text-red-900">
                  2〜6か月平均のいずれかが80時間を超えています。
                </p>
              ) : null}
            </div>
            <p className="border-t border-slate-200 pt-2 text-[11px] text-slate-600">
              凡例: 40〜45時間＝黄（上限接近）／45時間超＝橙（原則上限超過）／法休込80時間以上＝赤／100時間以上・複数月平均80超＝強い赤
            </p>
          </>
        ) : (
          <>
            <p>残業時間合計（法定外）: {formatMinutes(totals.overtimeMinutes)}</p>
            <p>休日出勤合計（法定休日・日曜）: {formatMinutes(totals.holidayWorkMinutes)}</p>
          </>
        )}
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
