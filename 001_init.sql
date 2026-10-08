create table if not exists profiles (id uuid primary key references auth.users on delete cascade,
  display_name text, timezone text default 'Africa/Lagos', day_start text default '08:00');
create table if not exists tasks (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null, priority text default 'medium', status text default 'open', due_at timestamptz,
  scheduled_start timestamptz, scheduled_end timestamptz, completed_at timestamptz, created_at timestamptz default now(), updated_at timestamptz);
create table if not exists reminders (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null, due_at timestamptz not null, status text default 'pending', sent_at timestamptz, created_at timestamptz default now(), updated_at timestamptz);
create table if not exists notes (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null, body text, created_at timestamptz default now(), updated_at timestamptz);
create table if not exists goals (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null, target_date date, progress int default 0, created_at timestamptz default now(), updated_at timestamptz);
create table if not exists messages (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade,
  role text not null, content text not null, proposal jsonb, state text, created_at timestamptz default now(), updated_at timestamptz);
do $$ declare t text; begin
  foreach t in array array['tasks','reminders','notes','goals','messages'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
alter table profiles enable row level security;
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for all using (id = auth.uid()) with check (id = auth.uid());
