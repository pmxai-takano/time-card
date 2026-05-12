-- 出勤区分（出社 / 在宅 / 出張 / 社外）。空は null
alter table public.attendance_records
  add column if not exists commute_type text;

comment on column public.attendance_records.commute_type is '出勤区分: 出社・在宅・出張・社外（未設定は null）';
