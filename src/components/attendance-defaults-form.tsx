"use client";

import { useMemo, useState, useTransition } from "react";
import { COMMUTE_TYPE_OPTIONS } from "@/lib/commute-types";
import { ALLOWED_DAY_CODES, dayCodeOptionsForWorkSystem } from "@/lib/day-codes";
import {
  AttendanceDefaultsFormValue,
  defaultsRecordToForm,
} from "@/lib/attendance-defaults-map";
import { isValidTime } from "@/lib/time";
import { WORK_SYSTEM_OPTIONS, type WorkSystem } from "@/lib/work-system";
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
      if (response.ok) {
        window.location.href = "/";
        return;
      }
      setMessage(result.message ?? "保存に失敗しました。");
    });
  }

  const baseDayOptions = useMemo(
    () => dayCodeOptionsForWorkSystem(form.work_system),
    [form.work_system],
  );

  const dayCodeSelectOptions =
    !form.weekday_day_code.trim() || ALLOWED_DAY_CODES.has(form.weekday_day_code.trim())
      ? baseDayOptions
      : [
          { value: "", label: "（未選択）" },
          {
            value: form.weekday_day_code,
            label: `${form.weekday_day_code}（旧データ・選び直してください）`,
          },
          ...baseDayOptions.filter((o) => o.value !== ""),
        ];

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-xl border bg-white p-4 shadow-sm">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">勤務体系</h2>
        <p className="text-sm text-slate-600">
          裁量労働制では、平日8時間超が残業、土曜・祝日・日曜・「残」は休日出勤として集計します。みなし残業は平日1.5時間（みなし法定外はその枠内の残業分）です。勤務表では月ごとに通常／裁量を選べます（2026年6月以前は通常、2026年7月は裁量が初期値）。保存した内容は以降の入力・再保存から適用されます。
        </p>
        <fieldset className="space-y-2">
          <legend className="sr-only">勤務体系</legend>
          {WORK_SYSTEM_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="work_system"
                value={opt.value}
                checked={form.work_system === opt.value}
                onChange={() => {
                  const next = opt.value as WorkSystem;
                  setForm((prev) => {
                    const day = prev.weekday_day_code.trim();
                    const clearHalf =
                      next === "discretionary" && (day === "前" || day === "後");
                    return {
                      ...prev,
                      work_system: next,
                      weekday_day_code: clearHalf ? "" : prev.weekday_day_code,
                    };
                  });
                }}
              />
              {opt.label}
            </label>
          ))}
        </fieldset>
      </section>

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
