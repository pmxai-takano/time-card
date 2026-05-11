export type AttendanceRecord = {
  id: string;
  user_id: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  memo: string | null;
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
};
