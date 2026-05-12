/** 出勤区分（出社・在宅など）。DB は `commute_type` に保存、空は null */

export type CommuteTypeOption = { value: string; label: string };

/** プルダウン順: 在宅 → 出社 → 社外 → 出張（先頭は未設定） */
export const COMMUTE_TYPE_OPTIONS: CommuteTypeOption[] = [
  { value: "", label: "なし" },
  { value: "在宅", label: "在宅" },
  { value: "出社", label: "出社" },
  { value: "社外", label: "社外" },
  { value: "出張", label: "出張" },
];

export const ALLOWED_COMMUTE_TYPES: Set<string> = new Set(
  COMMUTE_TYPE_OPTIONS.filter((o) => o.value !== "").map((o) => o.value),
);

const GREEN_COMMUTE_DISPLAY = new Set(["出社", "社外", "出張"]);

/** 勤務表など: 出社・社外・出張を緑で強調 */
export function commuteTypeDisplayClassName(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (GREEN_COMMUTE_DISPLAY.has(v)) return "font-semibold text-green-600";
  return "";
}
