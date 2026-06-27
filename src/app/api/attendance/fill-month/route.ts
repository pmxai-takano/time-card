import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  normalizeTimeForDb,
  parseCommuteTypeForDb,
  parseDayCodeForDb,
} from "@/lib/attendance-fields";
import {
  isFillableMonth,
  isJapanPublicHoliday,
  listWorkDatesInMonth,
  weekdayIndexJapan,
} from "@/lib/calendar-jp";
import { calculateOvertimeMinutes } from "@/lib/time";

const RECORDS = "attendance_records";
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
  const year = Number(body.year);
  const month = Number(body.month);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ message: "year / month が不正です。" }, { status: 400 });
  }

  if (!isFillableMonth(year, month)) {
    return NextResponse.json(
      { message: "一括登録は当月・来月の勤務表からのみ実行できます。" },
      { status: 400 },
    );
  }

  const { data: defRow, error: defErr } = await supabase
    .from(DEFAULTS)
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (defErr) {
    return NextResponse.json({ message: defErr.message }, { status: 500 });
  }
  if (!defRow) {
    return NextResponse.json(
      { message: "平日デフォルトが未設定です。設定画面で出勤・退勤を登録してください。" },
      { status: 400 },
    );
  }

  const clockIn = normalizeTimeForDb(String(defRow.weekday_clock_in ?? ""));
  const clockOut = normalizeTimeForDb(String(defRow.weekday_clock_out ?? ""));
  if (!clockIn || !clockOut) {
    return NextResponse.json(
      { message: "設定の平日出勤・退勤を入力してください。" },
      { status: 400 },
    );
  }

  const breakStart = normalizeTimeForDb(String(defRow.weekday_break_start ?? ""));
  const breakEnd = normalizeTimeForDb(String(defRow.weekday_break_end ?? ""));
  const parsedDay = parseDayCodeForDb(defRow.weekday_day_code);
  if (!parsedDay.ok) {
    return NextResponse.json({ message: parsedDay.message }, { status: 400 });
  }
  const parsedCom = parseCommuteTypeForDb(defRow.weekday_commute_type);
  if (!parsedCom.ok) {
    return NextResponse.json({ message: parsedCom.message }, { status: 400 });
  }
  const dayCode = parsedDay.dayCode;
  const commuteType = parsedCom.commuteType;

  if (defRow.weekday_break_start && !breakStart) {
    return NextResponse.json({ message: "設定の休憩開始の形式が不正です。" }, { status: 400 });
  }
  if (defRow.weekday_break_end && !breakEnd) {
    return NextResponse.json({ message: "設定の休憩終了の形式が不正です。" }, { status: 400 });
  }

  const dates = listWorkDatesInMonth(year, month);
  const start = dates[0];
  const end = dates[dates.length - 1];

  const { data: existing, error: exErr } = await supabase
    .from(RECORDS)
    .select("work_date")
    .gte("work_date", start)
    .lte("work_date", end);

  if (exErr) {
    return NextResponse.json({ message: exErr.message }, { status: 500 });
  }

  const existingSet = new Set((existing ?? []).map((r: { work_date: string }) => r.work_date));

  const toInsert: Array<Record<string, unknown>> = [];
  for (const workDate of dates) {
    if (existingSet.has(workDate)) continue;
    const dow = weekdayIndexJapan(workDate);
    if (dow < 1 || dow > 5) continue;
    if (isJapanPublicHoliday(workDate)) continue;

    const overtimeMinutes = calculateOvertimeMinutes({
      workDate,
      dayCode,
      clockIn,
      clockOut,
      breakStart,
      breakEnd,
    });

    toInsert.push({
      user_id: user.id,
      work_date: workDate,
      clock_in: clockIn,
      clock_out: clockOut,
      break_start: breakStart,
      break_end: breakEnd,
      memo: "",
      day_code: dayCode,
      commute_type: commuteType,
      overtime_minutes: overtimeMinutes,
      night_minutes: 0,
      paid_leave_days: 0,
      summer_leave_days: 0,
      business_trip_days: 0,
      substitute_leave_days: 0,
      special_leave_days: 0,
    });
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ message: "埋める対象の日がありません（既に登録済み、または土日祝のみ）。", created: 0 });
  }

  const { error: insErr } = await supabase.from(RECORDS).insert(toInsert);
  if (insErr) {
    return NextResponse.json({ message: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `${toInsert.length} 件の勤怠を登録しました。`,
    created: toInsert.length,
  });
}
