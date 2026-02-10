create extension if not exists pgcrypto;

create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists roster (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  cap_number text not null,
  age integer,
  preferred_position text,
  height_cm integer,
  weight_kg integer,
  dominant_hand text,
  notes text,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table roster add column if not exists age integer;
alter table roster add column if not exists preferred_position text;
alter table roster add column if not exists height_cm integer;
alter table roster add column if not exists weight_kg integer;
alter table roster add column if not exists dominant_hand text;
alter table roster add column if not exists notes text;
alter table roster add column if not exists photo_url text;

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  date date not null,
  created_at timestamptz not null default now()
);

create table if not exists shots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  x numeric not null,
  y numeric not null,
  zone integer not null,
  result text not null,
  player_cap text not null,
  attack_type text not null,
  period text not null,
  time text not null,
  created_at timestamptz not null default now()
);

create index if not exists seasons_user_id_idx on seasons(user_id);
create index if not exists teams_user_id_idx on teams(user_id);
create index if not exists roster_team_id_idx on roster(team_id);
create index if not exists matches_team_id_idx on matches(team_id);
create index if not exists shots_team_id_idx on shots(team_id);
create index if not exists shots_match_id_idx on shots(match_id);

alter table seasons enable row level security;
alter table teams enable row level security;
alter table roster enable row level security;
alter table matches enable row level security;
alter table shots enable row level security;

create policy "Seasons are user-owned" on seasons
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Teams are user-owned" on teams
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Roster is user-owned" on roster
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Matches are user-owned" on matches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Shots are user-owned" on shots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
