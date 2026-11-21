-- VibeVault schema
-- Run in Supabase SQL Editor as a project owner.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  global_style text not null default '',
  is_pro boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  project_rules text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_id_user_id_unique unique (id, user_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  source_ai text not null check (source_ai in ('Claude','ChatGPT','Lovable','Base44','Trae','Qoder','Gemini','Other')),
  raw_content text not null,
  cleaned_spec text not null default '',
  tags text[] not null default '{}',
  image_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_project_owner_fk foreign key (project_id, user_id)
    references public.projects(id, user_id) on delete cascade
);

create table if not exists public.agent_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_name text not null check (char_length(role_name) between 1 and 100),
  instructions text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_skills_user_role_unique unique (user_id, role_name)
);

create table if not exists public.handoffs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  target_ai text not null,
  role_name text not null,
  generated_agent_md text not null,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint handoffs_project_owner_fk foreign key (project_id, user_id)
    references public.projects(id, user_id) on delete cascade
);

-- Composite uniqueness on (id, user_id) supports ownership-enforcing foreign keys.

create index if not exists projects_user_created_idx on public.projects(user_id, created_at desc);
create index if not exists conversations_user_project_created_idx on public.conversations(user_id, project_id, created_at desc);
create index if not exists conversations_source_idx on public.conversations(user_id, source_ai);
create index if not exists agent_skills_user_created_idx on public.agent_skills(user_id, created_at);
create index if not exists handoffs_user_created_idx on public.handoffs(user_id, created_at desc);

-- Ensure every table using set_updated_at has the target column, including older installs.
-- CREATE TABLE IF NOT EXISTS does not add columns to tables that already exist.
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.projects add column if not exists updated_at timestamptz not null default now();
alter table public.conversations add column if not exists updated_at timestamptz not null default now();
alter table public.agent_skills add column if not exists updated_at timestamptz not null default now();

-- Keep updated_at current on editable records.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();
drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at before update on public.conversations
for each row execute function public.set_updated_at();
drop trigger if exists agent_skills_set_updated_at on public.agent_skills;
create trigger agent_skills_set_updated_at before update on public.agent_skills
for each row execute function public.set_updated_at();

-- Keep the auth trigger minimal: only create the required profile.
-- Default agent roles are provisioned by the app after authentication, so an
-- optional role-seeding operation can never abort account creation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.conversations enable row level security;
alter table public.agent_skills enable row level security;
alter table public.handoffs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Remove every legacy project policy before recreating the four non-recursive owner rules.
-- Older installations may have extra policies whose subqueries read public.projects again.
do $drop_project_rls_policies$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'projects'
  loop
    execute format('drop policy if exists %I on public.projects', existing_policy.policyname);
  end loop;
end;
$drop_project_rls_policies$;

create policy "projects_select_own" on public.projects
  for select to authenticated using (user_id = (select auth.uid()));
create policy "projects_insert_own" on public.projects
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "projects_update_own" on public.projects
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "projects_delete_own" on public.projects
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "conversations_select_own" on public.conversations;
create policy "conversations_select_own" on public.conversations for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "conversations_insert_own" on public.conversations;
create policy "conversations_insert_own" on public.conversations for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())
  )
);
drop policy if exists "conversations_update_own" on public.conversations;
create policy "conversations_update_own" on public.conversations for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "conversations_delete_own" on public.conversations;
create policy "conversations_delete_own" on public.conversations for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "agent_skills_select_own" on public.agent_skills;
create policy "agent_skills_select_own" on public.agent_skills for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "agent_skills_insert_own" on public.agent_skills;
create policy "agent_skills_insert_own" on public.agent_skills for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "agent_skills_update_own" on public.agent_skills;
create policy "agent_skills_update_own" on public.agent_skills for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "agent_skills_delete_own" on public.agent_skills;
create policy "agent_skills_delete_own" on public.agent_skills for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "handoffs_select_own" on public.handoffs;
create policy "handoffs_select_own" on public.handoffs for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "handoffs_insert_own" on public.handoffs;
create policy "handoffs_insert_own" on public.handoffs for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())
  )
);
drop policy if exists "handoffs_update_own" on public.handoffs;
create policy "handoffs_update_own" on public.handoffs for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant usage on schema public to authenticated;
grant select, insert, delete on public.profiles to authenticated;
revoke insert, update on public.profiles from authenticated;
grant insert (id, email, display_name, global_style) on public.profiles to authenticated;
grant update (email, display_name, global_style) on public.profiles to authenticated;
grant select, insert, update, delete on public.projects, public.conversations, public.agent_skills, public.handoffs to authenticated;

-- Starter-plan limits are enforced at the database boundary, not only in the UI.
create or replace function public.enforce_starter_limits()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  account_is_pro boolean;
  item_count integer;
begin
  -- Serialize inserts per account so simultaneous requests cannot exceed Starter caps.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  select coalesce(p.is_pro, false) into account_is_pro
  from public.profiles p where p.id = new.user_id;

  if coalesce(account_is_pro, false) then
    return new;
  end if;

  if tg_table_name = 'projects' then
    select count(*) into item_count from public.projects p where p.user_id = new.user_id;
    if item_count >= 1 then
      raise exception 'Starter Vault limit reached (1/1 Project). Unlock unlimited projects & convos.' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'conversations' then
    select count(*) into item_count from public.conversations c where c.user_id = new.user_id;
    if item_count >= 3 then
      raise exception 'Starter Vault limit reached (3/3 Convos). Upgrade to keep vaulting your AI brain.' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'agent_skills' then
    select count(*) into item_count from public.agent_skills a where a.user_id = new.user_id;
    if item_count >= 3 or not new.is_default or new.role_name not in ('Backend Architect', 'UI Designer', 'Image Prompt Engineer') then
      raise exception 'Starter Vault includes only the 3 built-in AGENT.md skills. Upgrade for custom roles.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_enforce_starter_limits on public.projects;
create trigger projects_enforce_starter_limits before insert on public.projects
for each row execute function public.enforce_starter_limits();
drop trigger if exists agent_skills_enforce_starter_limits on public.agent_skills;
create trigger agent_skills_enforce_starter_limits before insert on public.agent_skills
for each row execute function public.enforce_starter_limits();
drop trigger if exists conversations_enforce_starter_limits on public.conversations;
create trigger conversations_enforce_starter_limits before insert on public.conversations
for each row execute function public.enforce_starter_limits();


-- VibeVault Continuity, Import, and Integration Layer (2026-11-21)
-- Re-run this file in the Supabase SQL Editor after deploying the matching Edge Functions.

-- Existing installations may have created public.projects before the composite
-- owner key was added to the schema. CREATE TABLE IF NOT EXISTS does not retrofit
-- constraints, so add the referenced key explicitly before creating child FKs.
do $vibevault_migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.projects'::regclass
      and conname = 'projects_id_user_id_unique'
      and contype = 'u'
  ) then
    alter table public.projects
      add constraint projects_id_user_id_unique unique (id, user_id);
  end if;
end;
$vibevault_migration$;

alter table public.profiles
  add column if not exists ai_preferences jsonb not null default '{"providers":{},"last_target":"Claude","recommendations":false}'::jsonb,
  add column if not exists onboarding_completed boolean not null default false;

alter table public.conversations
  add column if not exists source_url text,
  add column if not exists source_payload jsonb,
  add column if not exists capture_metadata jsonb not null default '{}'::jsonb;

alter table public.conversations drop constraint if exists conversations_source_ai_check;
alter table public.conversations add constraint conversations_source_ai_check
  check (source_ai in ('Claude','ChatGPT','Gemini','Cursor','Windsurf','Perplexity','DeepSeek','Lovable','Base44','Trae','Qoder','Other'));

-- A dedicated review inbox prevents browser captures from silently entering a project.
create table if not exists public.capture_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_ai text not null check (source_ai in ('Claude','ChatGPT','Gemini','Cursor','Windsurf','Perplexity','DeepSeek','Lovable','Base44','Trae','Qoder','Other')),
  title text not null check (char_length(title) between 1 and 180),
  raw_content text not null check (char_length(raw_content) between 1 and 2000000),
  source_url text,
  capture_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','imported','archived')),
  project_id uuid references public.projects(id) on delete set null,
  imported_conversation_id uuid references public.conversations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Integration credentials are stored as SHA-256 hashes. Plaintext tokens are shown once.
create table if not exists public.integration_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  scope text not null check (scope in ('capture','mcp')),
  token_hash text not null unique check (char_length(token_hash) = 64),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.project_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  category text not null default 'decision' check (category in ('decision','open_question')),
  title text not null check (char_length(title) between 1 and 180),
  content text not null check (char_length(content) between 1 and 30000),
  status text not null default 'approved' check (status in ('approved','proposed','open','resolved','superseded')),
  source_ai text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_decisions_project_owner_fk foreign key (project_id, user_id)
    references public.projects(id, user_id) on delete cascade
);

create table if not exists public.session_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  summary text not null check (char_length(summary) between 1 and 30000),
  source_ai text,
  created_at timestamptz not null default now(),
  constraint session_summaries_project_owner_fk foreign key (project_id, user_id)
    references public.projects(id, user_id) on delete cascade
);

create index if not exists capture_inbox_user_status_idx on public.capture_inbox(user_id, status, created_at desc);
create index if not exists integration_tokens_hash_idx on public.integration_tokens(token_hash) where revoked_at is null;
create index if not exists project_decisions_project_created_idx on public.project_decisions(user_id, project_id, created_at desc);
create index if not exists session_summaries_project_created_idx on public.session_summaries(user_id, project_id, created_at desc);

drop trigger if exists capture_inbox_set_updated_at on public.capture_inbox;
create trigger capture_inbox_set_updated_at before update on public.capture_inbox
for each row execute function public.set_updated_at();
drop trigger if exists project_decisions_set_updated_at on public.project_decisions;
create trigger project_decisions_set_updated_at before update on public.project_decisions
for each row execute function public.set_updated_at();

alter table public.capture_inbox enable row level security;
alter table public.integration_tokens enable row level security;
alter table public.project_decisions enable row level security;
alter table public.session_summaries enable row level security;

-- SECURITY DEFINER ownership check avoids invoking projects RLS recursively from child-table policies.
create or replace function public.user_owns_project(target_project_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1 from public.projects p
    where p.id = target_project_id and p.user_id = target_user_id
  );
$$;
revoke all on function public.user_owns_project(uuid, uuid) from public;
grant execute on function public.user_owns_project(uuid, uuid) to authenticated;

drop policy if exists "conversations_insert_own" on public.conversations;
create policy "conversations_insert_own" on public.conversations
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.user_owns_project(project_id, (select auth.uid())));

drop policy if exists "handoffs_insert_own" on public.handoffs;
create policy "handoffs_insert_own" on public.handoffs
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.user_owns_project(project_id, (select auth.uid())));

drop policy if exists "capture_inbox_select_own" on public.capture_inbox;
create policy "capture_inbox_select_own" on public.capture_inbox for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "capture_inbox_update_own" on public.capture_inbox;
create policy "capture_inbox_update_own" on public.capture_inbox for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "capture_inbox_delete_own" on public.capture_inbox;
create policy "capture_inbox_delete_own" on public.capture_inbox for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "integration_tokens_select_own" on public.integration_tokens;
create policy "integration_tokens_select_own" on public.integration_tokens for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "integration_tokens_insert_own" on public.integration_tokens;
create policy "integration_tokens_insert_own" on public.integration_tokens for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "integration_tokens_update_own" on public.integration_tokens;
create policy "integration_tokens_update_own" on public.integration_tokens for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "integration_tokens_delete_own" on public.integration_tokens;
create policy "integration_tokens_delete_own" on public.integration_tokens for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "project_decisions_select_own" on public.project_decisions;
create policy "project_decisions_select_own" on public.project_decisions for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "project_decisions_insert_own" on public.project_decisions;
create policy "project_decisions_insert_own" on public.project_decisions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.user_owns_project(project_id, (select auth.uid())));
drop policy if exists "project_decisions_update_own" on public.project_decisions;
create policy "project_decisions_update_own" on public.project_decisions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "project_decisions_delete_own" on public.project_decisions;
create policy "project_decisions_delete_own" on public.project_decisions for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "session_summaries_select_own" on public.session_summaries;
create policy "session_summaries_select_own" on public.session_summaries for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "session_summaries_insert_own" on public.session_summaries;
create policy "session_summaries_insert_own" on public.session_summaries for insert to authenticated
  with check (user_id = (select auth.uid()) and public.user_owns_project(project_id, (select auth.uid())));
drop policy if exists "session_summaries_update_own" on public.session_summaries;
create policy "session_summaries_update_own" on public.session_summaries for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "session_summaries_delete_own" on public.session_summaries;
create policy "session_summaries_delete_own" on public.session_summaries for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.capture_inbox, public.integration_tokens,
  public.project_decisions, public.session_summaries to authenticated;
grant update (ai_preferences, onboarding_completed) on public.profiles to authenticated;


-- Compatibility repair for databases created before updated_at was added.
-- Every table with a set_updated_at trigger must expose this column.
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.projects add column if not exists updated_at timestamptz not null default now();
alter table public.conversations add column if not exists updated_at timestamptz not null default now();
alter table public.agent_skills add column if not exists updated_at timestamptz not null default now();
alter table public.capture_inbox add column if not exists updated_at timestamptz not null default now();
alter table public.project_decisions add column if not exists updated_at timestamptz not null default now();

