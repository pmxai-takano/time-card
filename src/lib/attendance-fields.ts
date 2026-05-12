import { ALLOWED_COMMUTE_TYPES } from "@/lib/commute-types";
import { ALLOWED_DAY_CODES } from "@/lib/day-codes";
import { isValidTime } from "@/lib/time";

export function normalizeTimeForDb(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hhmm = trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
  if (!isValidTime(hhmm)) return null;
  return `${hhmm}:00`;
}

export function parseDayCodeForDb(
  value: unknown,
): { ok: true; dayCode: string | null } | { ok: false; message: string } {
  const s = String(value ?? "").trim();
  if (!s) return { ok: true, dayCode: null };
  if (!ALLOWED_DAY_CODES.has(s)) {
    return { ok: false, message: "勤怠区分の値が不正です。" };
  }
  return { ok: true, dayCode: s };
}

export function parseCommuteTypeForDb(
  value: unknown,
): { ok: true; commuteType: string | null } | { ok: false; message: string } {
  const s = String(value ?? "").trim();
  if (!s) return { ok: true, commuteType: null };
  if (!ALLOWED_COMMUTE_TYPES.has(s)) {
    return { ok: false, message: "出勤区分の値が不正です。" };
  }
  return { ok: true, commuteType: s };
}
