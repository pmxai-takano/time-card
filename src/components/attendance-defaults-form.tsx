"use client";

import { useState, useTransition } from "react";
import { COMMUTE_TYPE_OPTIONS } from "@/lib/commute-types";
import { ALLOWED_DAY_CODES, DAY_CODE_OPTIONS } from "@/lib/day-codes";
import {
  AttendanceDefaultsFormValue,
  defaultsRecordToForm,
} from "@/lib/attendance-defaults-map";
import { isValidTime } from "@/lib/time";
import { AttendanceDefaultsRecord } from "@/types/attendance-defaults";

type Props = {
  initialRow: AttendanceDefaultsRecord | null;
};

export function AttendanceDefaultsForm({ initialRow }: Props) {
  const [form, setForm] = useState<AttendanceDefaultsFormValue>(() =>
    defaultsRecordToForm(initialRow ?? undefined),
  );
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function updateField<K extends keyof AttendanceDefaultsFormValue>(
    key: K,
    value: AttendanceDefaultsFormValue[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateTime(value: string): boolean {
    return value === "" || isValidTime(value);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const valid =
      validateTime(form.weekday_clock_in) &&
      validateTime(form.weekday_clock_out) &&
      validateTime(form.weekday_break_start) &&
      validateTime(form.weekday_break_end);

    if (!valid) {
      setMessage("時刻は HH:mm 形式で入力してください。");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/attendance-defaults", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? "保存しました。" : "保存に失敗しました。"));
    });
  }

  const dayCodeSelectOptions =
    !form.weekday_day_code.trim() || ALLOWED_DAY_CODES.has(form.weekday_day_code.trim())
      ? DAY_CODE_OPTIONS
      : [
          { value: "", label: "（未選択）" },
          {
            value: form.weekday_day_code,
            label: `${form.weekday_day_code}（旧データ・選び直してください）`,
          },
          ...DAY_CODE_OPTIONS.filter((o) => o.value !== ""),
        ];

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">平日のデフォルト</h2>
      <p className="text-sm text-slate-600">
        「当月の空白を初期値で埋める」で使われる値です。出勤・退勤は一括登録に必須です。
      </p>

      <div className="grid grid-cols-1 gap-3">
        <label className="text-sm">
          勤怠区分
          <select
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={form.weekday_day_code}
            onChange={(e) => updateField("weekday_day_code", e.target.value)}
          >
            {dayCodeSelectOptions.map((opt) => (
              <option key={opt.value || "empty"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          出勤区分
          <select
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={form.weekday_commute_type}
            onChange={(e) => updateField("weekday_commute_type", e.target.value)}
          >
            {COMMUTE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value || "none"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          出勤（HH:mm）
          <input
            type="time"
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={form.weekday_clock_in}
            onChange={(e) => updateField("weekday_clock_in", e.target.value)}
          />
        </label>
        <label className="text-sm">
          退勤（HH:mm）
          <input
            type="time"
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={form.weekday_clock_out}
            onChange={(e) => updateField("weekday_clock_out", e.target.value)}
          />
        </label>
        <label className="text-sm">
          休憩開始（HH:mm）
          <input
            type="time"
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={form.weekday_break_start}
            onChange={(e) => updateField("weekday_break_start", e.target.value)}
          />
        </label>
        <label className="text-sm">
          休憩終了（HH:mm）
          <input
            type="time"
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={form.weekday_break_end}
            onChange={(e) => updateField("weekday_break_end", e.target.value)}
          />
        </label>
      </div>

      <button
        type="submit"
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        disabled={isPending}
      >
        {isPending ? "保存中…" : "設定を保存"}
      </button>
      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </form>
  );
}
