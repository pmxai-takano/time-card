import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeTimeForDb,
  parseCommuteTypeForDb,
  parseDayCodeForDb,
} from "@/lib/attendance-fields";
import { calculateAttendanceBreakdown } from "@/lib/time";
import { parseWorkSystem, resolveDayCodeForSave } from "@/lib/work-system";

const TABLE = "attendance_records";
const DEFAULTS = "attendance_defaults";

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
  const break2Start = normalizeTimeForDb(String(body.break2_start ?? ""));
  const break2End = normalizeTimeForDb(String(body.break2_end ?? ""));
  const memo = String(body.memo ?? "").slice(0, 1000);
  const parsedDayCode = parseDayCodeForDb(body.day_code);
  if (!parsedDayCode.ok) {
    return NextResponse.json({ message: parsedDayCode.message }, { status: 400 });
  }
  let dayCode = parsedDayCode.dayCode;

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
  if (body.break2_start && !break2Start) {
    return NextResponse.json({ message: "休憩2開始時刻の形式が不正です。" }, { status: 400 });
  }
  if (body.break2_end && !break2End) {
    return NextResponse.json({ message: "休憩2終了時刻の形式が不正です。" }, { status: 400 });
  }

  const { data: defRow } = await supabase
    .from(DEFAULTS)
    .select("work_system")
    .eq("user_id", user.id)
    .maybeSingle();
  const workSystem = parseWorkSystem(defRow?.work_system);

  const prelim = calculateAttendanceBreakdown({
    workSystem,
    workDate,
    dayCode,
    clockIn,
    clockOut,
    breakStart,
    breakEnd,
    break2Start,
    break2End,
  });

  dayCode = resolveDayCodeForSave({
    workSystem,
    workDate,
    dayCode,
    workMinutes: prelim.workMinutes,
  });

  const { overtimeMinutes, holidayWorkMinutes } = calculateAttendanceBreakdown({
    workSystem,
    workDate,
    dayCode,
    clockIn,
    clockOut,
    breakStart,
    breakEnd,
    break2Start,
    break2End,
  });

  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: user.id,
      work_date: workDate,
      clock_in: clockIn,
      clock_out: clockOut,
      break_start: breakStart,
      break_end: breakEnd,
      break2_start: break2Start,
      break2_end: break2End,
      memo,
      day_code: dayCode,
      commute_type: commuteType,
      overtime_minutes: overtimeMinutes,
      holiday_work_minutes: holidayWorkMinutes,
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
