import Link from "next/link";
import { commuteTypeDisplayClassName } from "@/lib/commute-types";
import { formatDayCodeCell } from "@/lib/day-codes";
import { AttendanceRecord } from "@/types/attendance";
import { calculateWorkMinutes, formatMinutes } from "@/lib/time";

type Props = {
  records: AttendanceRecord[];
};

function displayTime(value: string | null): string {
  return value ? value.slice(0, 5) : "-";
}

export function AttendanceTable({ records }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-left">
          <tr>
            <th className="px-3 py-2">勤務日</th>
            <th className="px-3 py-2">勤怠区分</th>
            <th className="px-3 py-2">出勤区分</th>
            <th className="px-3 py-2">出勤</th>
            <th className="px-3 py-2">退勤</th>
            <th className="px-3 py-2">休憩</th>
            <th className="px-3 py-2">勤務時間</th>
            <th className="px-3 py-2">メモ</th>
            <th className="px-3 py-2">編集</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const dayCell = formatDayCodeCell(record.day_code);
            const workMinutes = calculateWorkMinutes({
              clockIn: record.clock_in,
              clockOut: record.clock_out,
              breakStart: record.break_start,
              breakEnd: record.break_end,
              workDate: record.work_date,
            });
            return (
              <tr key={record.id} className="border-t">
                <td className="px-3 py-2">{record.work_date}</td>
                <td className={`px-3 py-2 ${dayCell.className}`.trim()} title={dayCell.title || undefined}>
                  {dayCell.text || record.day_code || "-"}
                </td>
                <td className={`px-3 py-2 ${commuteTypeDisplayClassName(record.commute_type)}`.trim()}>
                  {record.commute_type ?? "-"}
                </td>
                <td className="px-3 py-2">{displayTime(record.clock_in)}</td>
                <td className="px-3 py-2">{displayTime(record.clock_out)}</td>
                <td className="px-3 py-2">
                  {displayTime(record.break_start)} - {displayTime(record.break_end)}
                </td>
                <td className="px-3 py-2">{formatMinutes(workMinutes)}</td>
                <td className="px-3 py-2">{record.memo || "-"}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/record?date=${record.work_date}`}
                    className="rounded bg-blue-50 px-2 py-1 text-blue-700"
                  >
                    編集
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
