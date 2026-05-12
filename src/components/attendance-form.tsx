"use client";

import { useMemo, useState, useTransition } from "react";
import { COMMUTE_TYPE_OPTIONS } from "@/lib/commute-types";
import { ALLOWED_DAY_CODES, DAY_CODE_OPTIONS } from "@/lib/day-codes";
import {
  calculateOvertimeMinutes,
  calculateWorkMinutes,
  formatMinutes,
  isValidTime,
} from "@/lib/time";
import { AttendanceInput } from "@/types/attendance";

type Props = {
  initialValue: AttendanceInput;
};

export function AttendanceForm({ initialValue }: Props) {
  const [form, setForm] = useState<AttendanceInput>(initialValue);
  const [message, setMessage] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const workTime = useMemo(
    () =>
      formatMinutes(
        calculateWorkMinutes({
          clockIn: form.clock_in || null,
          clockOut: form.clock_out || null,
          breakStart: form.break_start || null,
          breakEnd: form.break_end || null,
          workDate: form.work_date,
        }),
      ),
    [form],
  );

  const overtimePreview = useMemo(
    () =>
      formatMinutes(
        calculateOvertimeMinutes({
          workDate: form.work_date,
          dayCode: form.day_code.trim() || null,
          clockIn: form.clock_in || null,
          clockOut: form.clock_out || null,
          breakStart: form.break_start || null,
          breakEnd: form.break_end || null,
        }),
      ),
    [form],
  );

  const dayCodeSelectOptions = useMemo(() => {
    const v = form.day_code.trim();
    if (!v || ALLOWED_DAY_CODES.has(v)) return DAY_CODE_OPTIONS;
    return [
      { value: "", label: "（未選択）" },
      { value: v, label: `${v}（旧データ・保存時は勤怠区分を選び直してください）` },
      ...DAY_CODE_OPTIONS.filter((o) => o.value !== ""),
    ];
  }, [form.day_code]);

  function updateField<K extends keyof AttendanceInput>(key: K, value: AttendanceInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateTime(value: string): boolean {
    return value === "" || isValidTime(value);
  }

  function redirectAfterSave(workDate: string) {
    const parts = workDate.split("-");
    const y = parts[0];
    const m = Number(parts[1]);
    if (y && Number.isFinite(m)) {
      window.location.href = `/?year=${y}&month=${m}`;
    } else {
      window.location.href = "/";
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const valid =
      validateTime(form.clock_in) &&
      validateTime(form.clock_out) &&
      validateTime(form.break_start) &&
      validateTime(form.break_end);

    if (!valid) {
      setMessage("時刻は HH:mm 形式で入力してください。");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as { message?: string };
      setMessage(result.message ?? (response.ok ? "保存しました。" : "保存に失敗しました。"));
      if (response.ok) {
        redirectAfterSave(form.work_date);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">勤怠入力</h2>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">基本</h3>
        <div className="grid grid-cols-1 gap-3">
          <label className="text-sm">
            勤務日
            <input
              type="date"
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={form.work_date}
              onChange={(event) => updateField("work_date", event.target.value)}
              required
            />
          </label>
          <label className="text-sm">
            勤怠区分
            <select
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={form.day_code}
              onChange={(event) => updateField("day_code", event.target.value)}
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
              value={form.commute_type}
              onChange={(event) => updateField("commute_type", event.target.value)}
            >
              {COMMUTE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value || "none"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            出勤時刻（HH:mm）
            <input
              type="time"
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={form.clock_in}
              onChange={(event) => updateField("clock_in", event.target.value)}
            />
          </label>
          <label className="text-sm">
            退勤時刻（HH:mm）
            <input
              type="time"
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={form.clock_out}
              onChange={(event) => updateField("clock_out", event.target.value)}
            />
          </label>
          <label className="text-sm">
            休憩開始（HH:mm）
            <input
              type="time"
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={form.break_start}
              onChange={(event) => updateField("break_start", event.target.value)}
            />
          </label>
          <label className="text-sm">
            休憩終了（HH:mm）
            <input
              type="time"
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={form.break_end}
              onChange={(event) => updateField("break_end", event.target.value)}
            />
          </label>
          <label className="text-sm">
            メモ
            <textarea
              className="mt-1 w-full rounded-md border px-3 py-2"
              value={form.memo}
              onChange={(event) => updateField("memo", event.target.value)}
              rows={3}
              maxLength={1000}
            />
          </label>
        </div>
      </section>

      <div className="space-y-1 rounded-md bg-slate-100 px-3 py-2 text-sm">
        <p>
          勤務時間（入力値ベース）: <span className="font-semibold">{workTime}</span>
        </p>
        <p>
          残業時間（自動計算・保存時に反映）: <span className="font-semibold">{overtimePreview}</span>
        </p>
        <p className="text-xs text-slate-600">
          平日は定時8時間超が残業。土日祝は全日残業。「前」は18時以降、「後」は3時間超過分。「残」は全日残業扱いです。
        </p>
      </div>

      <button
        type="submit"
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        disabled={isPending}
      >
        {isPending ? "保存中..." : "保存"}
      </button>
      {message ? <p className="text-sm text-slate-700">{message}</p> : null}
    </form>
  );
}
