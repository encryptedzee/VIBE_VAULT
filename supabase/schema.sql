-- BrainRelay / VibeVault schema
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

-- New users receive a profile and the three built-in role templates.
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

  insert into public.agent_skills (user_id, role_name, instructions, is_default)
  values
    (new.id, 'Backend Architect', 'Design reliable APIs, data models, authorization and backend services. Explain trade-offs before implementation.', true),
    (new.id, 'UI Designer', 'Translate product intent into precise, accessible interfaces. Preserve the existing design system and responsive behavior.', true),
    (new.id, 'Image Prompt Engineer', 'Turn the supplied visual direction into detailed, production-ready image generation prompts. Preserve all constraints.', true)
  on conflict (user_id, role_name) do nothing;
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

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects for delete to authenticated using (user_id = (select auth.uid()));

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
  project_count integer;
begin
  select coalesce(p.is_pro, false) into account_is_pro
  from public.profiles p where p.id = new.user_id;

  if tg_table_name = 'projects' and not account_is_pro then
    select count(*) into project_count from public.projects p where p.user_id = new.user_id;
    if project_count >= 2 then
      raise exception 'Starter Vault supports up to 2 projects. Upgrade your plan to create more.' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'agent_skills' and not account_is_pro and (
    not new.is_default or new.role_name not in ('Backend Architect', 'UI Designer', 'Image Prompt Engineer')
  ) then
    raise exception 'Custom AGENT.md skills require a Pro plan.' using errcode = 'P0001';
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
