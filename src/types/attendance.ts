export type AttendanceRecord = {
  id: string;
  user_id: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  memo: string | null;
  day_code: string | null;
  /** 出勤区分（未マイグレーションの行では欠けることがある） */
  commute_type?: string | null;
  overtime_minutes: number;
  /** 廃止（常に 0）。旧行のみ存在 */
  night_minutes?: number;
  paid_leave_days: number;
  summer_leave_days: number;
  business_trip_days: number;
  substitute_leave_days: number;
  special_leave_days: number;
  created_at: string;
  updated_at: string;
};

export type AttendanceInput = {
  work_date: string;
  clock_in: string;
  clock_out: string;
  break_start: string;
  break_end: string;
  memo: string;
  day_code: string;
  commute_type: string;
};
