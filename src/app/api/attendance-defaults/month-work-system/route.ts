import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  parseMonthWorkSystems,
  parseWorkSystem,
  yearMonthKey,
} from "@/lib/work-system";

const TABLE = "attendance_defaults";

export async function PUT(request: Request) {
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
    return NextResponse.json({ message: "年月が不正です。" }, { status: 400 });
  }

  const workSystem = parseWorkSystem(body.work_system);
  const key = yearMonthKey(year, month);

  const { data: existing, error: readErr } = await supabase
    .from(TABLE)
    .select("month_work_systems, work_system")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json(
      {
        message: readErr.message.includes("month_work_systems")
          ? "month_work_systems 列がありません。supabase/migration_month_work_systems.sql を実行してください。"
          : readErr.message,
      },
      { status: 500 },
    );
  }

  const map = parseMonthWorkSystems(existing?.month_work_systems);
  map[key] = workSystem;

  if (existing) {
    const { error } = await supabase
      .from(TABLE)
      .update({
        month_work_systems: map,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
    if (error) {
      return NextResponse.json(
        {
          message: error.message.includes("month_work_systems")
            ? "month_work_systems 列がありません。supabase/migration_month_work_systems.sql を実行してください。"
            : error.message,
        },
        { status: 500 },
      );
    }
  } else {
    const { error } = await supabase.from(TABLE).insert({
      user_id: user.id,
      work_system: "standard",
      month_work_systems: map,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      return NextResponse.json(
        {
          message: error.message.includes("month_work_systems")
            ? "month_work_systems 列がありません。supabase/migration_month_work_systems.sql を実行してください。"
            : error.message,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    message: "この月の勤務体系を保存しました。",
    work_system: workSystem,
  });
}
