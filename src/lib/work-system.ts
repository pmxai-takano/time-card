import { isJapanPublicHoliday, isWeekendJapan } from "@/lib/calendar-jp";

/** 勤務体系（設定で切替） */
export type WorkSystem = "standard" | "discretionary";

export const WORK_SYSTEM_OPTIONS = [
  { value: "standard" as const, label: "通常" },
  { value: "discretionary" as const, label: "裁量労働制" },
];

/** 裁量労働制: この分数以上で出勤扱い */
export const ATTENDANCE_THRESHOLD_MINUTES = 60;

/** 自動「勤」で上書きしない休暇コード */
const LEAVE_DAY_CODES = new Set(["有", "特", "リ"]);

/** 自動「勤」で上書きしないコード（休暇 + 休日出勤「残」） */
const PROTECTED_DAY_CODES = new Set([...LEAVE_DAY_CODES, "残"]);

export function parseWorkSystem(value: unknown): WorkSystem {
  return value === "discretionary" ? "discretionary" : "standard";
}

export function isLeaveDayCode(code: string | null | undefined): boolean {
  return LEAVE_DAY_CODES.has((code ?? "").trim());
}

export function isPlainWeekdayJapan(workDate: string): boolean {
  return !isWeekendJapan(workDate) && !isJapanPublicHoliday(workDate);
}

/**
 * 裁量労働制の保存時: 平日かつ勤務 ≥1時間なら「勤」。
 * 休暇（有・特・リ）と「残」は優先して上書きしない。
 */
export function resolveDayCodeForSave(params: {
  workSystem: WorkSystem;
  workDate: string;
  dayCode: string | null;
  workMinutes: number;
}): string | null {
  const code = (params.dayCode ?? "").trim() || null;
  if (params.workSystem !== "discretionary") return code;
  if (code && PROTECTED_DAY_CODES.has(code)) return code;
  if (!isPlainWeekdayJapan(params.workDate)) return code;
  if (params.workMinutes >= ATTENDANCE_THRESHOLD_MINUTES) return "勤";
  return code;
}
