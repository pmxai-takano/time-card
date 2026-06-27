"use client";

import { getTodayYmdJapan, nextMonth } from "@/lib/calendar-jp";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  year: number;
  month: number;
};

function fillButtonLabel(year: number, month: number, isPending: boolean): string {
  if (isPending) return "登録中…";
  const today = getTodayYmdJapan();
  const next = nextMonth(today.year, today.month);
  if (year === next.year && month === next.month) {
    return "来月の空白を初期値で埋める";
  }
  return "当月の空白を初期値で埋める";
}

export function FillMonthButton({ year, month }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function onClick() {
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/attendance/fill-month", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      const result = (await response.json()) as { message?: string; created?: number };
      setMessage(result.message ?? (response.ok ? "完了しました。" : "失敗しました。"));
      if (response.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-950 hover:bg-indigo-100 disabled:opacity-50"
      >
        {fillButtonLabel(year, month, isPending)}
      </button>
      <p className="text-[11px] text-slate-600">
        土日祝を除く平日で、まだ行がない日だけを設定画面のデフォルトで追加します（既存の行は変更しません）。
      </p>
      {message ? <p className="text-xs text-slate-800">{message}</p> : null}
    </div>
  );
}
