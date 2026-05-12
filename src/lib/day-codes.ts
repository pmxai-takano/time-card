/** 勤怠区分（`day_code`）: 保存は先頭1文字、表示は label */

export type DayCodeOption = {
  value: string;
  label: string;
};

/** 並び順: 出勤 → 休日出勤 → 半休 → 全日有給 → 特休 → リフレ */
export const DAY_CODE_DEFINITIONS = [
  { code: "勤", label: "出勤" },
  { code: "残", label: "休日出勤・残業扱い" },
  { code: "前", label: "午前半休" },
  { code: "後", label: "午後半休" },
  { code: "有", label: "全：全日有給" },
  { code: "特", label: "特別休暇" },
  { code: "リ", label: "リフレッシュ休暇" },
] as const;

/** 廃止コード（既存行の表示・CSV のみ） */
const LEGACY_DAY_LABELS: Record<string, string> = {
  欠: "欠勤",
  振: "振替休日",
};

export const DAY_CODE_OPTIONS: DayCodeOption[] = [
  { value: "", label: "（未選択）" },
  ...DAY_CODE_DEFINITIONS.map((d) => ({ value: d.code, label: `${d.code}: ${d.label}` })),
];

export const ALLOWED_DAY_CODES: Set<string> = new Set(
  DAY_CODE_DEFINITIONS.map((d) => d.code),
);

const labelByCode = new Map<string, string>([
  ...DAY_CODE_DEFINITIONS.map((d) => [d.code, d.label] as const),
  ...Object.entries(LEGACY_DAY_LABELS),
]);

const ORANGE_CODES = new Set(["残"]);
const RED_CODES = new Set(["前", "後", "有", "特", "リ"]);

export function dayCodeCellClassName(code: string | null | undefined): string {
  const c = (code ?? "").trim();
  if (!c) return "";
  if (ORANGE_CODES.has(c)) return "font-semibold text-orange-600";
  if (RED_CODES.has(c)) return "font-semibold text-red-600";
  return "";
}

/** 月次表など: セルは短く、title に全文 */
export function formatDayCodeCell(value: string | null | undefined): {
  text: string;
  title: string;
  className: string;
} {
  const code = (value ?? "").trim();
  if (!code) return { text: "", title: "", className: "" };
  const label = labelByCode.get(code);
  const title = label ? `${code}: ${label}` : code;
  const className = dayCodeCellClassName(code);
  return { text: code, title, className };
}

/** CSV 用: コード + 名称 */
export function formatDayCodeForCsv(value: string | null | undefined): string {
  const code = (value ?? "").trim();
  if (!code) return "";
  const label = labelByCode.get(code);
  if (!label) return code;
  return `${code}:${label}`;
}
