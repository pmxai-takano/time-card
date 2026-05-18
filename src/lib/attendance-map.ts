import { AttendanceInput, AttendanceRecord } from "@/types/attendance";

function toInputTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "";
}

/** DB行または空からフォーム初期値を組み立てる */
export function recordToInput(
  record: AttendanceRecord | null | undefined,
  workDate: string,
): AttendanceInput {
  return {
    work_date: workDate,
    clock_in: toInputTime(record?.clock_in ?? null),
    clock_out: toInputTime(record?.clock_out ?? null),
    break_start: toInputTime(record?.break_start ?? null),
    break_end: toInputTime(record?.break_end ?? null),
    break2_start: toInputTime(record?.break2_start ?? null),
    break2_end: toInputTime(record?.break2_end ?? null),
    memo: record?.memo ?? "",
    day_code: record?.day_code ?? "",
    commute_type: record?.commute_type ?? "",
  };
}
