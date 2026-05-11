import { AttendanceRecord } from "@/types/attendance";
import { calculateWorkMinutes, formatMinutes } from "@/lib/time";

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
    "出勤",
    "退勤",
    "休憩開始",
    "休憩終了",
    "勤務時間",
    "メモ",
  ];

  const rows = records.map((record) => {
    const minutes = calculateWorkMinutes({
      clockIn: record.clock_in,
      clockOut: record.clock_out,
      breakStart: record.break_start,
      breakEnd: record.break_end,
    });

    return [
      record.work_date,
      displayTime(record.clock_in),
      displayTime(record.clock_out),
      displayTime(record.break_start),
      displayTime(record.break_end),
      formatMinutes(minutes),
      record.memo ?? "",
    ].map((cell) => escapeCsv(cell));
  });

  return [header, ...rows].map((line) => line.join(",")).join("\n");
}
