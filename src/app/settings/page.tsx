import Link from "next/link";
import { redirect } from "next/navigation";
import { AttendanceDefaultsForm } from "@/components/attendance-defaults-form";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import { AttendanceDefaultsRecord } from "@/types/attendance-defaults";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase.from("attendance_defaults").select("*").eq("user_id", user.id).maybeSingle();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">設定</h1>
        <LogoutButton />
      </header>

      <nav className="flex flex-wrap gap-2 text-sm">
        <Link href="/" className="rounded bg-slate-200 px-3 py-2">
          勤務表
        </Link>
        <Link href="/settings" className="rounded bg-slate-300 px-3 py-2 font-medium">
          設定
        </Link>
      </nav>

      <AttendanceDefaultsForm initialRow={(data ?? null) as AttendanceDefaultsRecord | null} />
    </main>
  );
}
