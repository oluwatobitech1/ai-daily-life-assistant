create table if not exists ai_usage (id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade, created_at timestamptz default now());
alter table ai_usage enable row level security;
drop policy if exists "own usage" on ai_usage;
create policy "own usage" on ai_usage for all using (user_id = auth.uid()) with check (user_id = auth.uid());
