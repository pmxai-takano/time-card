import Link from "next/link";
import { redirect } from "next/navigation";
import { MonthlySummary } from "@/components/monthly-summary";
import { LogoutButton } from "@/components/logout-button";
import { calculateWorkMinutes } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { AttendanceRecord } from "@/types/attendance";

export default async function SummaryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("attendance_records")
    .select("*")
    .order("work_date", { ascending: true });

  const records = (data ?? []) as AttendanceRecord[];
  const monthMap = new Map<string, { days: number; totalMinutes: number }>();

  records.forEach((record) => {
    const month = record.work_date.slice(0, 7);
    const workMinutes = calculateWorkMinutes({
      clockIn: record.clock_in,
      clockOut: record.clock_out,
      breakStart: record.break_start,
      breakEnd: record.break_end,
    });
    const current = monthMap.get(month) ?? { days: 0, totalMinutes: 0 };
    monthMap.set(month, {
      days: current.days + 1,
      totalMinutes: current.totalMinutes + workMinutes,
    });
  });

  const items = Array.from(monthMap.entries())
    .reverse()
    .map(([month, value]) => ({
      month,
      work_days: value.days,
      total_minutes: value.totalMinutes,
      average_minutes: value.days ? Math.round(value.totalMinutes / value.days) : 0,
    }));

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">月別集計</h1>
        <LogoutButton />
      </header>
      <nav className="flex gap-2 text-sm">
        <Link href="/" className="rounded bg-slate-200 px-3 py-2">
          メイン
        </Link>
        <Link href="/records" className="rounded bg-slate-200 px-3 py-2">
          一覧
        </Link>
        <Link href="/summary" className="rounded bg-slate-200 px-3 py-2">
          集計
        </Link>
      </nav>
      <MonthlySummary items={items} />
    </main>
  );
}
