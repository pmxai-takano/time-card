alter table public.attendance_records enable row level security;

drop policy if exists "attendance_select_own" on public.attendance_records;
create policy "attendance_select_own"
on public.attendance_records
for select
using (auth.uid() = user_id);

drop policy if exists "attendance_insert_own" on public.attendance_records;
create policy "attendance_insert_own"
on public.attendance_records
for insert
with check (auth.uid() = user_id);

drop policy if exists "attendance_update_own" on public.attendance_records;
create policy "attendance_update_own"
on public.attendance_records
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "attendance_delete_own" on public.attendance_records;
create policy "attendance_delete_own"
on public.attendance_records
for delete
using (auth.uid() = user_id);

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
