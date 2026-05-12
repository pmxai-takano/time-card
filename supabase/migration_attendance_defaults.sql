-- 平日デフォルト勤怠（ユーザーごと1行）
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

alter table public.attendance_defaults enable row level security;

drop policy if exists "defaults_select_own" on public.attendance_defaults;
create policy "defaults_select_own"
on public.attendance_defaults
for select
using (auth.uid() = user_id);

drop policy if exists "defaults_insert_own" on public.attendance_defaults;
create policy "defaults_insert_own"
on public.attendance_defaults
for insert
with check (auth.uid() = user_id);

drop policy if exists "defaults_update_own" on public.attendance_defaults;
create policy "defaults_update_own"
on public.attendance_defaults
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "defaults_delete_own" on public.attendance_defaults;
create policy "defaults_delete_own"
on public.attendance_defaults
for delete
using (auth.uid() = user_id);
