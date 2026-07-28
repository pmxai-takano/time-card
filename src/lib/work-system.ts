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

/** YYYY-MM キー */
export function yearMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * 月の組み込みデフォルト。
 * - 2026年6月以前 → 通常
 * - 2026年7月 → 裁量労働制
 * - それ以外 → null（ユーザー設定を使う）
 */
export function builtInWorkSystemForMonth(
  year: number,
  month: number,
): WorkSystem | null {
  if (year < 2026) return "standard";
  if (year === 2026 && month <= 6) return "standard";
  if (year === 2026 && month === 7) return "discretionary";
  return null;
}

export function parseMonthWorkSystems(
  value: unknown,
): Record<string, WorkSystem> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, WorkSystem> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}$/.test(key)) continue;
    if (raw === "standard" || raw === "discretionary") {
      out[key] = raw;
    }
  }
  return out;
}

export function monthOverrideFromMap(
  map: Record<string, WorkSystem>,
  year: number,
  month: number,
): WorkSystem | undefined {
  return map[yearMonthKey(year, month)];
}

/**
 * 対象月の勤務体系。
 * 優先順位: 月別上書き → 組み込みデフォルト（〜2026/6, 2026/7）→ ユーザー設定
 */
export function resolveWorkSystemForMonth(params: {
  year: number;
  month: number;
  userDefault: WorkSystem;
  monthWorkSystems?: Record<string, WorkSystem> | null;
}): WorkSystem {
  const override = params.monthWorkSystems
    ? monthOverrideFromMap(params.monthWorkSystems, params.year, params.month)
    : undefined;
  if (override) return override;
  return (
    builtInWorkSystemForMonth(params.year, params.month) ?? params.userDefault
  );
}

export function resolveWorkSystemForWorkDate(params: {
  workDate: string;
  userDefault: WorkSystem;
  monthWorkSystems?: Record<string, WorkSystem> | null;
}): WorkSystem {
  const parts = params.workDate.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  if (!year || !month) return params.userDefault;
  return resolveWorkSystemForMonth({
    year,
    month,
    userDefault: params.userDefault,
    monthWorkSystems: params.monthWorkSystems,
  });
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
