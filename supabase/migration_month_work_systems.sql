-- 月ごとの勤務体系上書き（キー: YYYY-MM → standard | discretionary）
alter table public.attendance_defaults
  add column if not exists month_work_systems jsonb not null default '{}'::jsonb;

comment on column public.attendance_defaults.month_work_systems is
  '月別勤務体系上書き。例: {"2026-07":"discretionary"}。未設定月は組み込みデフォルトまたは work_system を使用';
