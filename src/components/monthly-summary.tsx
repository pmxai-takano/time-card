type MonthlySummaryItem = {
  month: string;
  work_days: number;
  total_minutes: number;
  average_minutes: number;
  overtime_minutes: number;
};

type Props = {
  items: MonthlySummaryItem[];
};

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function MonthlySummary({ items }: Props) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">月別集計</h2>
      <p className="mb-3 text-xs text-slate-600">
        勤務表のフッターは「その月の行の合計」です。ここは「保存済みレコードのみ」を月ごとに集計しています。
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.month} className="rounded-md border p-3 text-sm">
            <p className="font-semibold">{item.month}</p>
            <p>勤務日数（出退あり）: {item.work_days}日</p>
            <p>合計勤務時間: {formatMinutes(item.total_minutes)}</p>
            <p>平均勤務時間: {formatMinutes(item.average_minutes)}</p>
            <p>合計残業: {formatMinutes(item.overtime_minutes)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
