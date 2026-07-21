-- 勤務体系（通常 / 裁量労働制）と休日出勤分数
alter table public.attendance_defaults
  add column if not exists work_system text not null default 'standard';

alter table public.attendance_records
  add column if not exists holiday_work_minutes integer not null default 0;

comment on column public.attendance_defaults.work_system is '勤務体系: standard（通常） / discretionary（裁量労働制）';
comment on column public.attendance_records.holiday_work_minutes is '休日出勤分数（裁量労働制で土日祝・残の勤務）';
