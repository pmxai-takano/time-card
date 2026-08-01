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
import { MonthNav } from "@/components/month-nav";
import { MonthWorkSystemSelect } from "@/components/month-work-system-select";
import { AttendanceRecord } from "@/types/attendance";
import {
  calculateAttendanceBreakdown,
  calculateWorkMinutes,
  formatMinutes,
  totalBreakDurationMinutes,
  buildDiscretionaryMonthlyMetrics,
  MONTHLY_80H_WARN_MINUTES,
  type AttendanceBreakdown,
} from "@/lib/time";
import { workSystemLabel, type WorkSystem } from "@/lib/work-system";
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
  /** 当月を先頭にした直近月の法休含（法定外＋法定休日）。複数月平均用 */
  recentCombinedMonths?: MonthCombinedMinutes[];
};

const EMPTY_BREAKDOWN: AttendanceBreakdown = {
  workMinutes: 0,
  overtimeMinutes: 0,
  holidayWorkMinutes: 0,
  deemedOvertimeMinutes: 0,
  deemedNonStatutoryMinutes: 0,
  nightMinutes: 0,
  discretionaryWorkMinutes: 0,
  nonStatutoryHolidayMinutes: 0,
  actualOvertimeReferenceMinutes: 0,
};

function displayTime(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 5);
}

function formatPercent1(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function formatCellMinutes(minutes: number): string {
  return minutes ? formatMinutes(minutes) : "";
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
        : EMPTY_BREAKDOWN;

      acc.workMinutes += workMin;
      acc.overtimeMinutes += breakdown.overtimeMinutes;
      acc.holidayWorkMinutes += breakdown.holidayWorkMinutes;
      acc.deemedOvertimeMinutes += breakdown.deemedOvertimeMinutes;
      acc.deemedNonStatutoryMinutes += breakdown.deemedNonStatutoryMinutes;
      acc.nightMinutes += breakdown.nightMinutes;
      acc.discretionaryWorkMinutes += breakdown.discretionaryWorkMinutes;
      acc.nonStatutoryHolidayMinutes += breakdown.nonStatutoryHolidayMinutes;
      acc.actualOvertimeReferenceMinutes += breakdown.actualOvertimeReferenceMinutes;

      return acc;
    },
    {
      workMinutes: 0,
      overtimeMinutes: 0,
      holidayWorkMinutes: 0,
      deemedOvertimeMinutes: 0,
      deemedNonStatutoryMinutes: 0,
      nightMinutes: 0,
      discretionaryWorkMinutes: 0,
      nonStatutoryHolidayMinutes: 0,
      actualOvertimeReferenceMinutes: 0,
    },
  );

  const discMetrics = isDiscretionary
    ? buildDiscretionaryMonthlyMetrics(totals)
    : null;

  const rollingMonths =
    recentCombinedMonths.length > 0
      ? recentCombinedMonths
      : discMetrics
        ? [
            {
              year,
              month,
              workSystem,
              recordCount: rows.filter((r) => r.record).length,
              combinedMinutes: discMetrics.companyDeemedNonStatutoryMinutes,
            } satisfies MonthCombinedMinutes,
          ]
        : [];
  const rolling =
    isDiscretionary && discMetrics ? computeRollingAverages(rollingMonths) : [];
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
            isDiscretionary ? "min-w-[1100px]" : "min-w-[780px]"
          }`}
        >
          <colgroup>
            <col className="w-[5%]" />
            <col className="w-[4%]" />
            <col className="w-[6%]" />
            <col className="w-[7%]" />
            <col className="w-[6%]" />
            <col className="w-[6%]" />
            <col className="w-[5%]" />
            {isDiscretionary ? (
              <>
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[6%]" />
                <col className="w-[6%]" />
                <col className="w-[5%]" />
              </>
            ) : (
              <>
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
              </>
            )}
            <col className={isDiscretionary ? "w-[12%]" : "w-[22%]"} />
            <col className="w-[8%]" />
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
              {isDiscretionary ? (
                <>
                  <th className="border border-indigo-900 px-1 py-2" title="実労働時間">
                    勤務(実労働)
                  </th>
                  <th className="border border-indigo-900 px-1 py-2" title="みなし労働時間（平日9:30）">
                    みなし労働
                  </th>
                  <th
                    className="border border-indigo-900 px-1 py-2"
                    title="社内みなし法定外（暫定）= 法休除＋法定休日"
                  >
                    みなし法定外
                  </th>
                  <th className="border border-indigo-900 px-1 py-2" title="所定休日・法定外休日の実労働">
                    所定休日
                  </th>
                  <th className="border border-indigo-900 px-1 py-2">法定休日</th>
                  <th className="border border-indigo-900 px-1 py-2" title="22:00〜翌5:00">
                    深夜
                  </th>
                </>
              ) : (
                <>
                  <th className="border border-indigo-900 px-1 py-2">勤務</th>
                  <th className="border border-indigo-900 px-1 py-2">残業</th>
                  <th className="border border-indigo-900 px-1 py-2">休日出勤</th>
                </>
              )}
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
                : EMPTY_BREAKDOWN;

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
                  {isDiscretionary ? (
                    <>
                      <td className="border border-slate-200 px-1 py-1 text-center">
                        {formatCellMinutes(workMin)}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 text-center">
                        {formatCellMinutes(breakdown.discretionaryWorkMinutes)}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 text-center">
                        {formatCellMinutes(breakdown.deemedNonStatutoryMinutes)}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 text-center">
                        {formatCellMinutes(breakdown.nonStatutoryHolidayMinutes)}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 text-center">
                        {formatCellMinutes(breakdown.holidayWorkMinutes)}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 text-center">
                        {formatCellMinutes(breakdown.nightMinutes)}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="border border-slate-200 px-1 py-1 text-center">
                        {formatCellMinutes(workMin)}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 text-center">
                        {formatCellMinutes(breakdown.overtimeMinutes)}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 text-center">
                        {formatCellMinutes(breakdown.holidayWorkMinutes)}
                      </td>
                    </>
                  )}
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
        {isDiscretionary && discMetrics ? (
          <>
            <section className="space-y-1">
              <h3 className="font-semibold text-slate-800">A) 実態</h3>
              <p>実労働合計: {formatMinutes(discMetrics.workMinutes)}</p>
              <p>深夜: {formatMinutes(discMetrics.nightMinutes)}</p>
              <p title="MAX(実労働 − 9:30, 0)。法令レイヤーへは加算しない">
                実労働超過参考(9:30超):{" "}
                {formatMinutes(discMetrics.actualOvertimeReferenceMinutes)}
              </p>
            </section>

            <section className="space-y-1 border-t border-slate-200 pt-2">
              <h3 className="font-semibold text-slate-800">B) 会社制度・給与（暫定）</h3>
              <p>みなし労働合計: {formatMinutes(discMetrics.discretionaryWorkMinutes)}</p>
              <p title="みなし法定外1:30×勤務日">
                裁量手当対象(みなし1:30×日):{" "}
                {formatMinutes(discMetrics.allowanceTargetMinutes)}
              </p>
              <p>所定休日労働: {formatMinutes(discMetrics.nonStatutoryHolidayMinutes)}</p>
              <p>法定休日: {formatMinutes(discMetrics.legalHolidayWorkMinutes)}</p>
              <p title="裁量手当対象＋所定休日労働">
                社内60h判定値: {formatMinutes(discMetrics.company60hBasisMinutes)}
              </p>
              <p>60h超: {formatMinutes(discMetrics.companyOver60Minutes)}</p>
              <p title="月45時間判定の対象（暫定）">
                法休除: {formatMinutes(discMetrics.overtimeExcludingLegalHolidayMinutes)}
              </p>
              <p title="法休除＋法定休日（暫定）">
                社内みなし法定外:{" "}
                {formatMinutes(discMetrics.companyDeemedNonStatutoryMinutes)}
              </p>
              <p>社内80hまでの残り: {formatMinutes(discMetrics.company80hRemainingMinutes)}</p>
              {discMetrics.companyWarn80 ? (
                <p className="rounded bg-red-50 px-2 py-1 text-red-800">
                  社内みなし法定外が80時間を超えています（会社制度・健康管理上の警告）。
                </p>
              ) : null}
            </section>

            <section className="space-y-1 border-t border-slate-200 pt-2">
              <h3 className="font-semibold text-slate-800">C) 法令・36協定</h3>
              <p
                className={
                  discMetrics.over45
                    ? "text-orange-700"
                    : discMetrics.approach45
                      ? "text-amber-700"
                      : undefined
                }
              >
                法休除: {formatMinutes(discMetrics.overtimeExcludingLegalHolidayMinutes)}
              </p>
              <p
                className={
                  discMetrics.over100
                    ? "font-semibold text-red-700"
                    : discMetrics.lawWarn80
                      ? "text-red-600"
                      : undefined
                }
                title="社内みなし法定外（暫定）と同値"
              >
                法休含(=社内みなし法定外暫定):{" "}
                {formatMinutes(discMetrics.companyDeemedNonStatutoryMinutes)}
              </p>
              <p
                className={
                  discMetrics.over45
                    ? "text-orange-700"
                    : discMetrics.approach45
                      ? "text-amber-700"
                      : undefined
                }
              >
                45h超: {formatMinutes(discMetrics.excessOver45Minutes)}
              </p>
              <p
                className={
                  discMetrics.approach45 || discMetrics.remainingTo45Minutes === 0
                    ? "text-amber-700"
                    : undefined
                }
              >
                45hまでの残り: {formatMinutes(discMetrics.remainingTo45Minutes)}
              </p>
              <p
                className={
                  discMetrics.over100
                    ? "font-semibold text-red-700"
                    : discMetrics.lawWarn80
                      ? "text-red-600"
                      : undefined
                }
              >
                100h未満までの残り: {formatMinutes(discMetrics.remainingUnder100Minutes)}
              </p>
              {discMetrics.over45 ? (
                <p className="rounded bg-orange-50 px-2 py-1 text-orange-800">
                  月45時間を超過しています。特別条項の適用状況は本システムでは判定しません。
                </p>
              ) : null}
              {discMetrics.lawWarn80 ? (
                <p className="rounded bg-red-50 px-2 py-1 text-red-800">
                  法定休日込み時間が80時間以上です（健康管理上の長時間労働警告）。単月80時間超だけでは法令違反と断定しません。
                </p>
              ) : null}
              {discMetrics.over100 ? (
                <p className="rounded bg-red-100 px-2 py-1 font-semibold text-red-900">
                  法定休日込み時間が100時間以上です（単月上限超過警告）。
                </p>
              ) : null}
              <div className="pt-1">
                <p className="mb-1 font-medium">
                  2〜6か月平均（法休含：法定外＋法定休日）
                </p>
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
                    {r.averageMinutes !== null
                      ? formatMinutes(r.averageMinutes)
                      : "—（データ不足）"}
                  </p>
                ))}
                {anyRollingOver80 ? (
                  <p className="mt-1 rounded bg-red-100 px-2 py-1 font-semibold text-red-900">
                    2〜6か月平均のいずれかが80時間を超えています。
                  </p>
                ) : null}
                {rollingMonths.length > 0 ? (
                  <div className="mt-2 rounded border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] text-slate-700">
                    <p className="mb-1 font-medium text-slate-800">月別内訳（平均の分子）</p>
                    <ul className="space-y-0.5">
                      {rollingMonths.map((m) => (
                        <li key={`${m.year}-${m.month}`}>
                          {m.year}/{String(m.month).padStart(2, "0")}{" "}
                          {workSystemLabel(m.workSystem)}:{" "}
                          {m.recordCount > 0
                            ? `${formatMinutes(m.combinedMinutes)}（${m.recordCount}日）`
                            : "—（未入力）"}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1.5 text-slate-600">
                      通常月は実残業、裁量月はみなし1:30等を含みます。みなしを通常月へ遡及適用していません。未入力月を含む窓の平均は「データ不足」です。
                    </p>
                  </div>
                ) : null}
              </div>
              {discMetrics.statusNotes.length > 0 ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-slate-600">
                  {discMetrics.statusNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
              <p className="pt-1 text-[11px] text-slate-600">
                凡例: 40〜45時間＝黄（上限接近）／45時間超＝橙（原則上限超過）／法休込80時間以上＝赤／100時間以上・複数月平均80超＝強い赤
              </p>
            </section>
          </>
        ) : (
          <>
            <p>実勤務時間合計: {formatMinutes(totals.workMinutes)}</p>
            <p>残業時間合計（法定外）: {formatMinutes(totals.overtimeMinutes)}</p>
            <p>休日出勤合計（法定休日・日曜）: {formatMinutes(totals.holidayWorkMinutes)}</p>
          </>
        )}
        <p className="border-t border-slate-200 pt-2">
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

      <MonthNav
        prev={prev}
        current={{ year: today.year, month: today.month }}
        next={next}
      />
    </div>
  );
}
