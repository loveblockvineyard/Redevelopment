-- Vineyard Planner: scenarios + audit trail + app versions
-- Paste this whole file into Supabase -> SQL Editor -> Run

create table if not exists scenarios (
  id bigint generated always as identity primary key,
  name text unique not null,
  state jsonb not null,
  updated_by text,
  updated_at timestamptz default now()
);

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  at timestamptz default now(),
  email text,
  action text,          -- 'save' | 'load' | 'delete'
  scenario text,
  app_version text
);

create table if not exists app_versions (
  version text primary key,
  notes text,
  released_at timestamptz default now()
);

alter table scenarios enable row level security;
alter table audit_log enable row level security;
alter table app_versions enable row level security;

create policy "team read scenarios"  on scenarios  for select to authenticated using (true);
create policy "team write scenarios" on scenarios  for insert to authenticated with check (true);
create policy "team edit scenarios"  on scenarios  for update to authenticated using (true);
create policy "team read audit"      on audit_log  for select to authenticated using (true);
create policy "team write audit"     on audit_log  for insert to authenticated with check (true);
create policy "team read versions"   on app_versions for select to authenticated using (true);
create policy "team write versions"  on app_versions for insert to authenticated with check (true);

insert into app_versions (version, notes) values ('1.0.0', 'First deployment') on conflict do nothing;

-- live sync between open browsers
alter publication supabase_realtime add table scenarios;
