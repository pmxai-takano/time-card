"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  WORK_SYSTEM_OPTIONS,
  type WorkSystem,
} from "@/lib/work-system";

type Props = {
  year: number;
  month: number;
  value: WorkSystem;
};

export function MonthWorkSystemSelect({ year, month, value }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(next: WorkSystem) {
    if (next === value || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/attendance-defaults/month-work-system", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month, work_system: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? "勤務体系の保存に失敗しました。");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
      <label className="flex items-center gap-2">
        <span className="text-slate-600">この月の勤務体系</span>
        <select
          className="rounded border border-slate-300 bg-white px-2 py-1"
          value={value}
          disabled={pending}
          onChange={(e) => onChange(e.target.value as WorkSystem)}
        >
          {WORK_SYSTEM_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      {pending ? <span className="text-xs text-slate-500">保存中…</span> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
