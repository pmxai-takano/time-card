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

const fieldLabelClass = "block min-w-0 text-sm";
const dateTimeInputClass =
  "mt-1 block w-full min-w-0 max-w-full box-border rounded-md border px-2 py-2 text-base sm:px-3";
const textInputClass =
  "mt-1 block w-full min-w-0 max-w-full box-border rounded-md border px-2 py-2 sm:px-3";

function TimeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="time"
      className={dateTimeInputClass}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      onInput={(event) => onChange(event.currentTarget.value)}
    />
  );
}

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
          break2Start: form.break2_start || null,
          break2End: form.break2_end || null,
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
          break2Start: form.break2_start || null,
          break2End: form.break2_end || null,
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

  function resetBreakTimes() {
    setForm((prev) => ({
      ...prev,
      break_start: "",
      break_end: "",
      break2_start: "",
      break2_end: "",
    }));
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
      validateTime(form.break_end) &&
      validateTime(form.break2_start) &&
      validateTime(form.break2_end);

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
    <form
      onSubmit={onSubmit}
      className="min-w-0 space-y-6 overflow-hidden rounded-xl border bg-white p-4 shadow-sm"
    >
      <h2 className="text-lg font-semibold">勤怠入力</h2>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">基本</h3>
        <div className="grid min-w-0 grid-cols-1 gap-3">
          <label className={fieldLabelClass}>
            勤務日
            <input
              type="date"
              className={dateTimeInputClass}
              value={form.work_date}
              onChange={(event) => updateField("work_date", event.target.value)}
              required
            />
          </label>
          <label className={fieldLabelClass}>
            勤怠区分
            <select
              className={textInputClass}
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
          <label className={fieldLabelClass}>
            出勤区分
            <select
              className={textInputClass}
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
          <label className={fieldLabelClass}>
            出勤時刻（HH:mm）
            <TimeInput value={form.clock_in} onChange={(value) => updateField("clock_in", value)} />
          </label>
          <label className={fieldLabelClass}>
            退勤時刻（HH:mm）
            <TimeInput value={form.clock_out} onChange={(value) => updateField("clock_out", value)} />
          </label>

          <div className="min-w-0 space-y-3 rounded-md border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-700">休憩時間</span>
              <button
                type="button"
                className="shrink-0 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                onClick={resetBreakTimes}
              >
                リセット
              </button>
            </div>
            <label className={fieldLabelClass}>
              休憩開始（HH:mm）
              <TimeInput
                value={form.break_start}
                onChange={(value) => updateField("break_start", value)}
              />
            </label>
            <label className={fieldLabelClass}>
              休憩終了（HH:mm）
              <TimeInput
                value={form.break_end}
                onChange={(value) => updateField("break_end", value)}
              />
            </label>
            <label className={fieldLabelClass}>
              休憩2開始（HH:mm）
              <TimeInput
                value={form.break2_start}
                onChange={(value) => updateField("break2_start", value)}
              />
            </label>
            <label className={fieldLabelClass}>
              休憩2終了（HH:mm）
              <TimeInput
                value={form.break2_end}
                onChange={(value) => updateField("break2_end", value)}
              />
            </label>
          </div>

          <label className={fieldLabelClass}>
            メモ
            <textarea
              className={textInputClass}
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
