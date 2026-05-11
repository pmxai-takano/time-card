import Link from "next/link";
import { redirect } from "next/navigation";
import { AttendanceTable } from "@/components/attendance-table";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import { AttendanceRecord } from "@/types/attendance";

export default async function RecordsPage() {
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
    .order("work_date", { ascending: false })
    .limit(90);

  const records = (data ?? []) as AttendanceRecord[];

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">日別一覧</h1>
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
      <AttendanceTable records={records} />
    </main>
  );
}
