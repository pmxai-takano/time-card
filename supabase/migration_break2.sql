-- 2つ目の休憩（個別編集画面のみ入力。勤務表は合算表示）
alter table public.attendance_records
  add column if not exists break2_start time,
  add column if not exists break2_end time;

comment on column public.attendance_records.break2_start is '休憩2開始（任意）';
comment on column public.attendance_records.break2_end is '休憩2終了（任意）';
