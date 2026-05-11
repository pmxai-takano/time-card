import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidTime } from "@/lib/time";

const TABLE = "attendance_records";

function normalizeTime(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return isValidTime(trimmed) ? `${trimmed}:00` : null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const workDate = String(body.work_date ?? "");
  const clockIn = normalizeTime(String(body.clock_in ?? ""));
  const clockOut = normalizeTime(String(body.clock_out ?? ""));
  const breakStart = normalizeTime(String(body.break_start ?? ""));
  const breakEnd = normalizeTime(String(body.break_end ?? ""));
  const memo = String(body.memo ?? "").slice(0, 1000);

  if (!workDate) {
    return NextResponse.json({ message: "勤務日が未入力です。" }, { status: 400 });
  }
  if (body.clock_in && !clockIn) {
    return NextResponse.json({ message: "出勤時刻の形式が不正です。" }, { status: 400 });
  }
  if (body.clock_out && !clockOut) {
    return NextResponse.json({ message: "退勤時刻の形式が不正です。" }, { status: 400 });
  }
  if (body.break_start && !breakStart) {
    return NextResponse.json({ message: "休憩開始時刻の形式が不正です。" }, { status: 400 });
  }
  if (body.break_end && !breakEnd) {
    return NextResponse.json({ message: "休憩終了時刻の形式が不正です。" }, { status: 400 });
  }

  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: user.id,
      work_date: workDate,
      clock_in: clockIn,
      clock_out: clockOut,
      break_start: breakStart,
      break_end: breakEnd,
      memo,
    },
    { onConflict: "user_id,work_date" },
  );

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "保存しました。" });
}
