create extension if not exists "pgcrypto";

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  clock_in time,
  clock_out time,
  break_start time,
  break_end time,
  memo text,
  day_code text,
  commute_type text,
  overtime_minutes integer not null default 0,
  night_minutes integer not null default 0,
  paid_leave_days numeric(4, 1) not null default 0,
  summer_leave_days numeric(4, 1) not null default 0,
  business_trip_days numeric(4, 1) not null default 0,
  substitute_leave_days numeric(4, 1) not null default 0,
  special_leave_days numeric(4, 1) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);

create index if not exists idx_attendance_records_user_date
  on public.attendance_records (user_id, work_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_attendance_records_updated_at on public.attendance_records;
create trigger trg_attendance_records_updated_at
before update on public.attendance_records
for each row
execute function public.set_updated_at();

-- 平日デフォルト勤怠（ユーザーごと1行）。RLS は rls.sql を実行してください。
create table if not exists public.attendance_defaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weekday_clock_in time,
  weekday_clock_out time,
  weekday_break_start time,
  weekday_break_end time,
  weekday_commute_type text,
  weekday_day_code text,
  updated_at timestamptz not null default now()
);
