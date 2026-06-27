-- TechQuarters admin workspace additions
-- Safe to run in Supabase SQL Editor. Existing data is preserved.

alter table public.leads add column if not exists workflow_status text default 'New';
alter table public.leads add column if not exists internal_notes text;
alter table public.leads add column if not exists owner_user_id uuid;
alter table public.leads add column if not exists owner_name text;
alter table public.leads add column if not exists follow_up_due_date date;
alter table public.leads add column if not exists tags jsonb default '[]'::jsonb;
alter table public.leads add column if not exists archived_at timestamptz;
alter table public.leads add column if not exists archived_by uuid;
alter table public.leads add column if not exists completed_at timestamptz;
alter table public.leads add column if not exists booking_source text;
alter table public.leads add column if not exists booking_datetime timestamptz;
alter table public.leads add column if not exists booking_notes text;
alter table public.leads add column if not exists manually_booked boolean default false;
alter table public.leads add column if not exists project_name text;
alter table public.leads add column if not exists project_summary text;
alter table public.leads add column if not exists project_stage text;
alter table public.leads add column if not exists contract_status text;
alter table public.leads add column if not exists project_start_date date;
alter table public.leads add column if not exists target_completion_date date;
alter table public.leads add column if not exists project_timeline text;

alter table public.chat_sessions add column if not exists archived_at timestamptz;
alter table public.chat_sessions add column if not exists deleted_at timestamptz;

create table if not exists public.lead_activity_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  session_id uuid references public.chat_sessions(id) on delete set null,
  actor_user_id uuid,
  event_type text not null,
  event_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_leads_workflow_status on public.leads(workflow_status);
create index if not exists idx_leads_follow_up_due_date on public.leads(follow_up_due_date);
create index if not exists idx_leads_archived_at on public.leads(archived_at);
create index if not exists idx_leads_completed_at on public.leads(completed_at);
create index if not exists idx_leads_owner_user_id on public.leads(owner_user_id);
create index if not exists idx_chat_sessions_archived_at on public.chat_sessions(archived_at);
create index if not exists idx_chat_sessions_deleted_at on public.chat_sessions(deleted_at);
create index if not exists idx_lead_activity_log_lead_created on public.lead_activity_log(lead_id, created_at desc);
create index if not exists idx_lead_activity_log_session_created on public.lead_activity_log(session_id, created_at desc);

alter table public.lead_activity_log enable row level security;

drop policy if exists "Admins can read lead activity" on public.lead_activity_log;
create policy "Admins can read lead activity"
  on public.lead_activity_log
  for select
  using (exists (select 1 from public.admin_users au where au.id = auth.uid() and au.role = 'admin'));
