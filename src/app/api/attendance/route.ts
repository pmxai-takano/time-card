import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeTimeForDb,
  parseCommuteTypeForDb,
  parseDayCodeForDb,
} from "@/lib/attendance-fields";
import { calculateOvertimeMinutes } from "@/lib/time";

const TABLE = "attendance_records";

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
  const clockIn = normalizeTimeForDb(String(body.clock_in ?? ""));
  const clockOut = normalizeTimeForDb(String(body.clock_out ?? ""));
  const breakStart = normalizeTimeForDb(String(body.break_start ?? ""));
  const breakEnd = normalizeTimeForDb(String(body.break_end ?? ""));
  const memo = String(body.memo ?? "").slice(0, 1000);
  const parsedDayCode = parseDayCodeForDb(body.day_code);
  if (!parsedDayCode.ok) {
    return NextResponse.json({ message: parsedDayCode.message }, { status: 400 });
  }
  const dayCode = parsedDayCode.dayCode;

  const parsedCommute = parseCommuteTypeForDb(body.commute_type);
  if (!parsedCommute.ok) {
    return NextResponse.json({ message: parsedCommute.message }, { status: 400 });
  }
  const commuteType = parsedCommute.commuteType;

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

  const overtimeMinutes = calculateOvertimeMinutes({
    workDate,
    dayCode,
    clockIn,
    clockOut,
    breakStart,
    breakEnd,
  });

  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: user.id,
      work_date: workDate,
      clock_in: clockIn,
      clock_out: clockOut,
      break_start: breakStart,
      break_end: breakEnd,
      memo,
      day_code: dayCode,
      commute_type: commuteType,
      overtime_minutes: overtimeMinutes,
      night_minutes: 0,
      paid_leave_days: 0,
      summer_leave_days: 0,
      business_trip_days: 0,
      substitute_leave_days: 0,
      special_leave_days: 0,
    },
    { onConflict: "user_id,work_date" },
  );

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: "保存しました。" });
}
