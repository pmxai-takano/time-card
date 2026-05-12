-- 既存の attendance_records に勤務表用カラムを追加（再実行安全）
alter table public.attendance_records
  add column if not exists day_code text;

alter table public.attendance_records
  add column if not exists overtime_minutes integer not null default 0;

alter table public.attendance_records
  add column if not exists night_minutes integer not null default 0;

alter table public.attendance_records
  add column if not exists paid_leave_days numeric(4, 1) not null default 0;

alter table public.attendance_records
  add column if not exists summer_leave_days numeric(4, 1) not null default 0;

alter table public.attendance_records
  add column if not exists business_trip_days numeric(4, 1) not null default 0;

alter table public.attendance_records
  add column if not exists substitute_leave_days numeric(4, 1) not null default 0;

alter table public.attendance_records
  add column if not exists special_leave_days numeric(4, 1) not null default 0;

comment on column public.attendance_records.day_code is '勤怠区分（1文字コード）';

comment on column public.attendance_records.overtime_minutes is '残業（分）';
comment on column public.attendance_records.night_minutes is '深夜（分）';
