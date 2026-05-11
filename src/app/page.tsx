import Link from "next/link";
import { redirect } from "next/navigation";
import { AttendanceForm } from "@/components/attendance-form";
import { LogoutButton } from "@/components/logout-button";
import { calculateWorkMinutes, formatMinutes } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { AttendanceRecord } from "@/types/attendance";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

function toInputTime(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const selectedDate = params.date ?? new Date().toISOString().slice(0, 10);

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
    .eq("work_date", selectedDate)
    .maybeSingle();

  const record = data as AttendanceRecord | null;
  const todayWorkMinutes = calculateWorkMinutes({
    clockIn: record?.clock_in ?? null,
    clockOut: record?.clock_out ?? null,
    breakStart: record?.break_start ?? null,
    breakEnd: record?.break_end ?? null,
  });

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">time-card</h1>
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
        <a href="/api/csv" className="rounded bg-emerald-200 px-3 py-2">
          CSV出力
        </a>
      </nav>

      <AttendanceForm
        initialValue={{
          work_date: selectedDate,
          clock_in: toInputTime(record?.clock_in ?? null),
          clock_out: toInputTime(record?.clock_out ?? null),
          break_start: toInputTime(record?.break_start ?? null),
          break_end: toInputTime(record?.break_end ?? null),
          memo: record?.memo ?? "",
        }}
      />

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">本日の勤怠</h2>
        <p className="text-sm text-slate-700">勤務日: {selectedDate}</p>
        <p className="text-sm text-slate-700">勤務時間: {formatMinutes(todayWorkMinutes)}</p>
      </section>
    </main>
  );
}
