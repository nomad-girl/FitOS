-- Milestones: user-entered personal achievements/records
create table if not exists milestones (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  milestone_date date not null default current_date,
  category    text not null default 'general',  -- strength, body, skill, general
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table milestones enable row level security;

create policy "Users manage own milestones"
  on milestones for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
