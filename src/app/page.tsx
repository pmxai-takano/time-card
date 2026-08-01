import Link from "next/link";
import { redirect } from "next/navigation";
import { MonthlyTimesheet } from "@/components/monthly-timesheet";
import { LogoutButton } from "@/components/logout-button";
import {
  isFillableMonth,
  listWorkDatesInMonth,
  parseYearMonth,
} from "@/lib/calendar-jp";
import {
  aggregateMonthCombinedMinutes,
  listPriorYearMonths,
  type MonthCombinedMinutes,
} from "@/lib/discretionary-monthly";
import { createClient } from "@/lib/supabase/server";
import { fetchWorkSystemDefaults } from "@/lib/work-system-defaults";
import { resolveWorkSystemForMonth } from "@/lib/work-system";
import { AttendanceRecord } from "@/types/attendance";

type Props = {
  searchParams: Promise<{ year?: string; month?: string }>;
};

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const { year, month } = parseYearMonth(params.year, params.month);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const dates = listWorkDatesInMonth(year, month);
  const start = dates[0];
  const end = dates[dates.length - 1];

  const priorMonths = listPriorYearMonths(year, month, 5);
  const oldest = priorMonths[priorMonths.length - 1] ?? { year, month };
  const historyStart = listWorkDatesInMonth(oldest.year, oldest.month)[0];

  const [{ data }, workSysDefaults, { data: historyData }] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("*")
      .gte("work_date", start)
      .lte("work_date", end)
      .order("work_date", { ascending: true }),
    fetchWorkSystemDefaults(supabase, user.id),
    supabase
      .from("attendance_records")
      .select("*")
      .gte("work_date", historyStart)
      .lte("work_date", end)
      .order("work_date", { ascending: true }),
  ]);

  const workSystem = resolveWorkSystemForMonth({
    year,
    month,
    userDefault: workSysDefaults.userDefault,
    monthWorkSystems: workSysDefaults.monthWorkSystems,
  });

  const map = new Map<string, AttendanceRecord>();
  for (const row of (data ?? []) as AttendanceRecord[]) {
    map.set(row.work_date, row);
  }

  const rows = dates.map((workDate) => ({
    workDate,
    record: map.get(workDate) ?? null,
  }));

  const showFillMissing = isFillableMonth(year, month);

  const historyRecords = (historyData ?? []) as AttendanceRecord[];
  const recentCombinedMonths: MonthCombinedMinutes[] = [];
  const monthChain = [{ year, month }, ...priorMonths];
  for (const ym of monthChain) {
    const sys = resolveWorkSystemForMonth({
      year: ym.year,
      month: ym.month,
      userDefault: workSysDefaults.userDefault,
      monthWorkSystems: workSysDefaults.monthWorkSystems,
    });
    const mm = String(ym.month).padStart(2, "0");
    const prefix = `${ym.year}-${mm}-`;
    const monthRecords = historyRecords.filter((r) => r.work_date.startsWith(prefix));
    recentCombinedMonths.push({
      year: ym.year,
      month: ym.month,
      combinedMinutes: aggregateMonthCombinedMinutes({
        year: ym.year,
        month: ym.month,
        records: monthRecords,
        workSystem: sys,
      }),
    });
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-2 py-3 sm:px-4 sm:py-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold sm:text-xl">time-card</h1>
        <LogoutButton />
      </header>

      <nav className="flex flex-wrap gap-2 text-sm">
        <Link href={`/?year=${year}&month=${month}`} className="rounded bg-slate-200 px-3 py-2">
          勤務表
        </Link>
        <Link href="/settings" className="rounded bg-slate-200 px-3 py-2">
          設定
        </Link>
        <a href="/api/csv" className="rounded bg-emerald-200 px-3 py-2">
          CSV出力
        </a>
      </nav>

      <MonthlyTimesheet
        key={`${year}-${month}`}
        year={year}
        month={month}
        rows={rows}
        showFillMissing={showFillMissing}
        workSystem={workSystem}
        recentCombinedMonths={recentCombinedMonths}
      />
    </main>
  );
}
