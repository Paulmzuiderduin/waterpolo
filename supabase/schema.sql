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
  birthday date,
  height_cm integer,
  weight_kg integer,
  dominant_hand text,
  notes text,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table roster add column if not exists birthday date;
alter table roster add column if not exists height_cm integer;
alter table roster add column if not exists weight_kg integer;
alter table roster add column if not exists dominant_hand text;
alter table roster add column if not exists notes text;
alter table roster add column if not exists photo_url text;
alter table roster drop column if exists age;
alter table roster drop column if exists preferred_position;

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  opponent_name text,
  date date not null,
  created_at timestamptz not null default now()
);

alter table matches add column if not exists opponent_name text;

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

create table if not exists scoring_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  event_type text not null,
  team_side text not null,
  player_cap text,
  period text not null,
  time text not null,
  created_at timestamptz not null default now()
);

create table if not exists possessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  outcome text,
  created_at timestamptz not null default now()
);

create table if not exists passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  possession_id uuid not null references possessions(id) on delete cascade,
  from_player_cap text not null,
  to_player_cap text not null,
  from_x numeric not null,
  from_y numeric not null,
  to_x numeric not null,
  to_y numeric not null,
  sequence integer not null,
  created_at timestamptz not null default now()
);

create index if not exists seasons_user_id_idx on seasons(user_id);
create index if not exists teams_user_id_idx on teams(user_id);
create index if not exists roster_team_id_idx on roster(team_id);
create index if not exists matches_team_id_idx on matches(team_id);
create index if not exists shots_team_id_idx on shots(team_id);
create index if not exists shots_match_id_idx on shots(match_id);
create index if not exists scoring_events_team_id_idx on scoring_events(team_id);
create index if not exists scoring_events_match_id_idx on scoring_events(match_id);
create index if not exists possessions_team_id_idx on possessions(team_id);
create index if not exists possessions_match_id_idx on possessions(match_id);
create index if not exists passes_team_id_idx on passes(team_id);
create index if not exists passes_possession_id_idx on passes(possession_id);

alter table seasons enable row level security;
alter table teams enable row level security;
alter table roster enable row level security;
alter table matches enable row level security;
alter table shots enable row level security;
alter table scoring_events enable row level security;
alter table possessions enable row level security;
alter table passes enable row level security;

drop policy if exists "Seasons are user-owned" on seasons;
create policy "Seasons are user-owned" on seasons
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Teams are user-owned" on teams;
create policy "Teams are user-owned" on teams
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Roster is user-owned" on roster;
create policy "Roster is user-owned" on roster
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Matches are user-owned" on matches;
create policy "Matches are user-owned" on matches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Shots are user-owned" on shots;
create policy "Shots are user-owned" on shots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Scoring events are user-owned" on scoring_events;
create policy "Scoring events are user-owned" on scoring_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Possessions are user-owned" on possessions;
create policy "Possessions are user-owned" on possessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Passes are user-owned" on passes;
create policy "Passes are user-owned" on passes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
