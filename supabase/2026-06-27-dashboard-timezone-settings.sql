-- TechQuarters dashboard timezone settings
-- Safe to run in Supabase SQL Editor. Existing UTC timestamps are not modified.

create table if not exists public.admin_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.admin_settings (key, value, updated_at)
values ('reporting_timezone', to_jsonb('Australia/Sydney'::text), now())
on conflict (key) do nothing;

alter table public.admin_settings enable row level security;

drop policy if exists "Admins can read admin settings" on public.admin_settings;
create policy "Admins can read admin settings"
  on public.admin_settings
  for select
  using (exists (select 1 from public.admin_users au where au.id = auth.uid() and au.role = 'admin'));

drop policy if exists "Admins can update admin settings" on public.admin_settings;
create policy "Admins can update admin settings"
  on public.admin_settings
  for all
  using (exists (select 1 from public.admin_users au where au.id = auth.uid() and au.role = 'admin'))
  with check (exists (select 1 from public.admin_users au where au.id = auth.uid() and au.role = 'admin'));
