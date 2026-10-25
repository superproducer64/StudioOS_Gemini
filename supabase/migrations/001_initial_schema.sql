-- ============================================================================
-- StudioOS v0.1 — BGP Studios Initial PostgreSQL Schema & Seed Migration
-- Database: PostgreSQL through Supabase
-- ============================================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PROJECTS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  description text not null default '',
  status text not null default 'Planning'
    check (status in ('Idea', 'Planning', 'Active', 'Waiting', 'Review', 'Completed', 'Archived')),
  priority text not null default 'Normal'
    check (priority in ('Low', 'Normal', 'High', 'Critical')),
  client text default null,
  revenue_model text default null,
  unbilled_amount numeric(12, 2) not null default 0.00,
  next_action text default null,
  due_date date default null,
  github_repo text default null,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_projects_priority on public.projects(priority);
create index if not exists idx_projects_due_date on public.projects(due_date);

-- ----------------------------------------------------------------------------
-- 2. TASKS TABLE
-- ----------------------------------------------------------------------------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  title text not null check (char_length(trim(title)) > 0),
  description text not null default '',
  status text not null default 'Open'
    check (status in ('Open', 'In Progress', 'Waiting', 'Completed')),
  priority text not null default 'Normal'
    check (priority in ('Low', 'Normal', 'High', 'Critical')),
  due_date date default null,
  completed_at timestamptz default null,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_due_date on public.tasks(due_date);

-- ----------------------------------------------------------------------------
-- 3. TRANSACTIONS TABLE (FINANCIAL ACTIVITY)
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  type text not null check (type in ('Income', 'Expense')),
  amount numeric(12, 2) not null check (amount >= 0),
  category text not null default 'General',
  description text not null default '',
  transaction_date date not null default current_date,
  client text default null,
  notes text default null,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_transactions_project_id on public.transactions(project_id);
create index if not exists idx_transactions_type on public.transactions(type);
create index if not exists idx_transactions_date on public.transactions(transaction_date);

-- ----------------------------------------------------------------------------
-- 4. AUTOMATIC UPDATED_AT TRIGGER
-- ----------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) FOR VERSION 0.1 SINGLE PRIMARY USER
-- ----------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.transactions enable row level security;

-- Authenticated primary user has full CRUD access to studio tables
create policy "Authenticated owner can read projects"
  on public.projects for select
  to authenticated
  using (true);

create policy "Authenticated owner can insert projects"
  on public.projects for insert
  to authenticated
  with check (true);

create policy "Authenticated owner can update projects"
  on public.projects for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated owner can delete projects"
  on public.projects for delete
  to authenticated
  using (true);

create policy "Authenticated owner can read tasks"
  on public.tasks for select
  to authenticated
  using (true);

create policy "Authenticated owner can insert tasks"
  on public.tasks for insert
  to authenticated
  with check (true);

create policy "Authenticated owner can update tasks"
  on public.tasks for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated owner can delete tasks"
  on public.tasks for delete
  to authenticated
  using (true);

create policy "Authenticated owner can read transactions"
  on public.transactions for select
  to authenticated
  using (true);

create policy "Authenticated owner can insert transactions"
  on public.transactions for insert
  to authenticated
  with check (true);

create policy "Authenticated owner can update transactions"
  on public.transactions for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated owner can delete transactions"
  on public.transactions for delete
  to authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- 6. SEED DATA FOR BGP STUDIOS (VERSION 0.1)
-- ----------------------------------------------------------------------------
insert into public.projects (id, name, description, status, priority, client, revenue_model, unbilled_amount, next_action, due_date)
values
  (
    '11111111-1111-4111-8111-111111111101',
    'Caddlatch',
    'iOS golf utility and caddie yardage companion app submitted to Apple App Store Connect.',
    'Review',
    'High',
    null,
    '$2.99 app purchase',
    0.00,
    'Check App Store review status',
    current_date + interval '1 day'
  ),
  (
    '11111111-1111-4111-8111-111111111102',
    'Pour Across America',
    'Custom event and tasting passport platform built for Diana with active sprint deliverables.',
    'Active',
    'High',
    'Diana',
    'Client retainer & hourly ($2,400 unbilled)',
    2400.00,
    'Review unbilled development hours',
    current_date + interval '2 days'
  ),
  (
    '11111111-1111-4111-8111-111111111103',
    'Mars Roofing',
    'Website operations, storm-lead capture funnel, and monthly analytics reporting for Mars Roofing & Exteriors.',
    'Active',
    'Normal',
    'Mars Roofing & Exteriors',
    'Monthly service',
    450.00,
    'Prepare monthly maintenance report',
    current_date + interval '4 days'
  ),
  (
    '11111111-1111-4111-8111-111111111104',
    'Intro',
    'Warm introduction and network relationship product currently running with initial beta cohort.',
    'Active',
    'Normal',
    null,
    'SaaS subscription (Beta)',
    0.00,
    'Review current beta feedback',
    current_date + interval '6 days'
  ),
  (
    '11111111-1111-4111-8111-111111111105',
    'FAB',
    'Internal BGP Studios venture in early product specification and scoping.',
    'Planning',
    'Normal',
    null,
    'Internal product / TBD',
    0.00,
    'Define MVP feature list',
    current_date + interval '12 days'
  ),
  (
    '11111111-1111-4111-8111-111111111106',
    'SignalOS',
    'Curated signal aggregation and briefing engine concept.',
    'Planning',
    'Low',
    null,
    'Internal intelligence tool',
    0.00,
    'Define first information sources',
    current_date + interval '20 days'
  )
on conflict (id) do nothing;
