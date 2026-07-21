import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAttendanceCsv } from "@/lib/csv";
import { parseWorkSystem } from "@/lib/work-system";
import { AttendanceRecord } from "@/types/attendance";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [{ data, error }, { data: defaults }] = await Promise.all([
    supabase.from("attendance_records").select("*").order("work_date", { ascending: true }),
    supabase
      .from("attendance_defaults")
      .select("work_system")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const workSystem = parseWorkSystem(defaults?.work_system);
  const csv = buildAttendanceCsv((data ?? []) as AttendanceRecord[], workSystem);
  const encoded = new TextEncoder().encode(`\ufeff${csv}`);

  return new NextResponse(encoded, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance_records.csv"`,
    },
  });
}
