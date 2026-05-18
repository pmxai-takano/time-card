import Link from "next/link";
import { redirect } from "next/navigation";
import { AttendanceForm } from "@/components/attendance-form";
import { LogoutButton } from "@/components/logout-button";
import { parseYearMonth } from "@/lib/calendar-jp";
import { recordToInput } from "@/lib/attendance-map";
import { createClient } from "@/lib/supabase/server";
import { AttendanceRecord } from "@/types/attendance";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

export default async function RecordPage({ searchParams }: Props) {
  const params = await searchParams;
  const workDate = params.date;

  if (!workDate) {
    redirect("/");
  }

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
    .eq("work_date", workDate)
    .maybeSingle();

  const record = data as AttendanceRecord | null;
  const parts = workDate.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const { year: backYear, month: backMonth } = parseYearMonth(String(y), String(m));

  return (
    <main className="mx-auto w-full min-w-0 max-w-2xl space-y-4 overflow-x-hidden p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">勤怠編集</h1>
        <LogoutButton />
      </header>

      <nav className="flex flex-wrap gap-2 text-sm">
        <Link
          href={`/?year=${backYear}&month=${backMonth}`}
          className="rounded bg-slate-200 px-3 py-2"
        >
          勤務表に戻る
        </Link>
        <Link href="/settings" className="rounded bg-slate-200 px-3 py-2">
          設定
        </Link>
      </nav>

      <AttendanceForm initialValue={recordToInput(record, workDate)} />
    </main>
  );
}
