import { AttendanceDefaultsRecord } from "@/types/attendance-defaults";
import { parseWorkSystem, type WorkSystem } from "@/lib/work-system";

function toInputTime(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : "";
}

export type AttendanceDefaultsFormValue = {
  work_system: WorkSystem;
  weekday_clock_in: string;
  weekday_clock_out: string;
  weekday_break_start: string;
  weekday_break_end: string;
  weekday_commute_type: string;
  weekday_day_code: string;
};

export function defaultsRecordToForm(
  row: AttendanceDefaultsRecord | null | undefined,
): AttendanceDefaultsFormValue {
  return {
    work_system: parseWorkSystem(row?.work_system),
    weekday_clock_in: toInputTime(row?.weekday_clock_in ?? null),
    weekday_clock_out: toInputTime(row?.weekday_clock_out ?? null),
    weekday_break_start: toInputTime(row?.weekday_break_start ?? null),
    weekday_break_end: toInputTime(row?.weekday_break_end ?? null),
    weekday_commute_type: row?.weekday_commute_type ?? "",
    weekday_day_code: row?.weekday_day_code ?? "",
  };
}
