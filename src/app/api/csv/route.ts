import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAttendanceCsv } from "@/lib/csv";
import { fetchWorkSystemDefaults } from "@/lib/work-system-defaults";
import { AttendanceRecord } from "@/types/attendance";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [{ data, error }, workSysDefaults] = await Promise.all([
    supabase.from("attendance_records").select("*").order("work_date", { ascending: true }),
    fetchWorkSystemDefaults(supabase, user.id),
  ]);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const csv = buildAttendanceCsv((data ?? []) as AttendanceRecord[], workSysDefaults);
  const encoded = new TextEncoder().encode(`\ufeff${csv}`);

  return new NextResponse(encoded, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendance_records.csv"`,
    },
  });
}
