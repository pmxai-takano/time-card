import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeTimeForDb,
  parseCommuteTypeForDb,
  parseDayCodeForDb,
} from "@/lib/attendance-fields";
import { AttendanceDefaultsRecord } from "@/types/attendance-defaults";
import { parseWorkSystem } from "@/lib/work-system";

const TABLE = "attendance_defaults";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.from(TABLE).select("*").eq("user_id", user.id).maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ defaults: (data ?? null) as AttendanceDefaultsRecord | null });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const workSystem = parseWorkSystem(body.work_system);
  const clockIn = normalizeTimeForDb(String(body.weekday_clock_in ?? ""));
  const clockOut = normalizeTimeForDb(String(body.weekday_clock_out ?? ""));
  const breakStart = normalizeTimeForDb(String(body.weekday_break_start ?? ""));
  const breakEnd = normalizeTimeForDb(String(body.weekday_break_end ?? ""));

  if (body.weekday_clock_in && !clockIn) {
    return NextResponse.json({ message: "平日出勤の形式が不正です。" }, { status: 400 });
  }
  if (body.weekday_clock_out && !clockOut) {
    return NextResponse.json({ message: "平日退勤の形式が不正です。" }, { status: 400 });
  }
  if (body.weekday_break_start && !breakStart) {
    return NextResponse.json({ message: "平日休憩開始の形式が不正です。" }, { status: 400 });
  }
  if (body.weekday_break_end && !breakEnd) {
    return NextResponse.json({ message: "平日休憩終了の形式が不正です。" }, { status: 400 });
  }

  const parsedDay = parseDayCodeForDb(body.weekday_day_code);
  if (!parsedDay.ok) {
    return NextResponse.json({ message: parsedDay.message }, { status: 400 });
  }
  const parsedCom = parseCommuteTypeForDb(body.weekday_commute_type);
  if (!parsedCom.ok) {
    return NextResponse.json({ message: parsedCom.message }, { status: 400 });
  }

  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: user.id,
      work_system: workSystem,
      weekday_clock_in: clockIn,
      weekday_clock_out: clockOut,
      weekday_break_start: breakStart,
      weekday_break_end: breakEnd,
      weekday_day_code: parsedDay.dayCode,
      weekday_commute_type: parsedCom.commuteType,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "設定を保存しました。" });
}
