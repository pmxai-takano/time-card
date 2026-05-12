/** Supabase `attendance_defaults` 行 */
export type AttendanceDefaultsRecord = {
  user_id: string;
  weekday_clock_in: string | null;
  weekday_clock_out: string | null;
  weekday_break_start: string | null;
  weekday_break_end: string | null;
  weekday_commute_type: string | null;
  weekday_day_code: string | null;
  updated_at: string;
};
