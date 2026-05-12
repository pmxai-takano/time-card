import { weekdayLabelJp } from "@/lib/calendar-jp";
import { formatDayCodeForCsv } from "@/lib/day-codes";
import { AttendanceRecord } from "@/types/attendance";
import {
  breakDurationMinutes,
  calculateOvertimeMinutes,
  calculateWorkMinutes,
  formatMinutes,
} from "@/lib/time";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function displayTime(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

export function buildAttendanceCsv(records: AttendanceRecord[]): string {
  const header = [
    "勤務日",
    "曜日",
    "勤怠区分",
    "出勤区分",
    "出勤",
    "退勤",
    "休憩開始",
    "休憩終了",
    "休憩時間",
    "勤務時間",
    "残業",
    "メモ",
  ];

  const rows = records.map((record) => {
    const workMinutes = calculateWorkMinutes({
      clockIn: record.clock_in,
      clockOut: record.clock_out,
      breakStart: record.break_start,
      breakEnd: record.break_end,
      workDate: record.work_date,
    });
    const breakMin = breakDurationMinutes(record.break_start, record.break_end);
    const overtimeMin = calculateOvertimeMinutes({
      workDate: record.work_date,
      dayCode: record.day_code,
      clockIn: record.clock_in,
      clockOut: record.clock_out,
      breakStart: record.break_start,
      breakEnd: record.break_end,
    });

    return [
      record.work_date,
      weekdayLabelJp(record.work_date),
      formatDayCodeForCsv(record.day_code),
      record.commute_type ?? "",
      displayTime(record.clock_in),
      displayTime(record.clock_out),
      displayTime(record.break_start),
      displayTime(record.break_end),
      formatMinutes(breakMin),
      formatMinutes(workMinutes),
      formatMinutes(overtimeMin),
      record.memo ?? "",
    ].map((cell) => escapeCsv(cell));
  });

  return [header, ...rows].map((line) => line.join(",")).join("\n");
}
