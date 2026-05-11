"use client";

import { useMemo, useState, useTransition } from "react";
import { calculateWorkMinutes, formatMinutes, isValidTime } from "@/lib/time";
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
        }),
      ),
    [form],
  );

  function updateField<K extends keyof AttendanceInput>(key: K, value: AttendanceInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateTime(value: string): boolean {
    return value === "" || isValidTime(value);
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
        window.location.href = `/?date=${form.work_date}`;
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">勤怠入力</h2>
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

      <div className="rounded-md bg-slate-100 px-3 py-2 text-sm">
        今日の勤務時間（入力値ベース）: <span className="font-semibold">{workTime}</span>
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
