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
  photo_path text,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table roster add column if not exists birthday date;
alter table roster add column if not exists height_cm integer;
alter table roster add column if not exists weight_kg integer;
alter table roster add column if not exists dominant_hand text;
alter table roster add column if not exists notes text;
alter table roster add column if not exists photo_path text;
alter table roster add column if not exists photo_url text;
alter table roster drop column if exists age;
alter table roster drop column if exists preferred_position;

alter table roster drop constraint if exists roster_height_cm_check;
alter table roster add constraint roster_height_cm_check
  check (height_cm is null or (height_cm >= 50 and height_cm <= 260));

alter table roster drop constraint if exists roster_weight_kg_check;
alter table roster add constraint roster_weight_kg_check
  check (weight_kg is null or (weight_kg >= 20 and weight_kg <= 250));

alter table roster drop constraint if exists roster_dominant_hand_check;
alter table roster add constraint roster_dominant_hand_check
  check (dominant_hand is null or dominant_hand in ('left', 'right', 'ambidextrous'));

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

alter table matches drop constraint if exists matches_date_check;
alter table matches add constraint matches_date_check
  check (date >= date '2000-01-01' and date <= date '2100-12-31');

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

alter table shots drop constraint if exists shots_x_check;
alter table shots add constraint shots_x_check
  check (x >= 0 and x <= 100);

alter table shots drop constraint if exists shots_y_check;
alter table shots add constraint shots_y_check
  check (y >= 0 and y <= 100);

alter table shots drop constraint if exists shots_zone_check;
alter table shots add constraint shots_zone_check
  check (zone between 1 and 14);

alter table shots drop constraint if exists shots_result_check;
alter table shots add constraint shots_result_check
  check (result in ('raak', 'redding', 'mis'));

alter table shots drop constraint if exists shots_attack_type_check;
alter table shots add constraint shots_attack_type_check
  check (attack_type in ('6vs6', '6vs5', '6vs4', 'strafworp'));

alter table shots drop constraint if exists shots_period_check;
alter table shots add constraint shots_period_check
  check (period in ('1', '2', '3', '4', 'OT'));

alter table shots drop constraint if exists shots_time_check;
alter table shots add constraint shots_time_check
  check (time ~ '^[0-7]:[0-5][0-9]$');

create table if not exists scoring_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  event_type text not null,
  player_cap text,
  period text not null,
  time text not null,
  created_at timestamptz not null default now()
);

alter table scoring_events drop constraint if exists scoring_events_team_side_check;
alter table scoring_events drop column if exists team_side;

alter table scoring_events drop constraint if exists scoring_events_event_type_check;
alter table scoring_events add constraint scoring_events_event_type_check
  check (event_type in ('goal', 'exclusion', 'foul', 'turnover_won', 'turnover_lost', 'penalty', 'timeout'));

alter table scoring_events drop constraint if exists scoring_events_period_check;
alter table scoring_events add constraint scoring_events_period_check
  check (period in ('1', '2', '3', '4', 'OT'));

alter table scoring_events drop constraint if exists scoring_events_time_check;
alter table scoring_events add constraint scoring_events_time_check
  check (time ~ '^[0-7]:[0-5][0-9]$');

create table if not exists possessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  outcome text,
  created_at timestamptz not null default now()
);

alter table possessions drop constraint if exists possessions_outcome_check;
alter table possessions add constraint possessions_outcome_check
  check (outcome is null or outcome in ('goal', 'miss', 'exclusion', 'turnover_won', 'turnover_lost'));

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

alter table passes drop constraint if exists passes_from_x_check;
alter table passes add constraint passes_from_x_check
  check (from_x >= 0 and from_x <= 100);

alter table passes drop constraint if exists passes_from_y_check;
alter table passes add constraint passes_from_y_check
  check (from_y >= 0 and from_y <= 100);

alter table passes drop constraint if exists passes_to_x_check;
alter table passes add constraint passes_to_x_check
  check (to_x >= 0 and to_x <= 100);

alter table passes drop constraint if exists passes_to_y_check;
alter table passes add constraint passes_to_y_check
  check (to_y >= 0 and to_y <= 100);

alter table passes drop constraint if exists passes_sequence_check;
alter table passes add constraint passes_sequence_check
  check (sequence >= 1 and sequence <= 999);

create table if not exists feature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid references seasons(id) on delete set null,
  team_id uuid references teams(id) on delete set null,
  app text not null default 'waterpolo',
  context_tab text,
  email text,
  subject text not null,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists site_visit_totals (
  site_key text primary key,
  total bigint not null default 0,
  updated_at timestamptz not null default now()
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
create index if not exists feature_requests_user_id_idx on feature_requests(user_id);

alter table seasons enable row level security;
alter table teams enable row level security;
alter table roster enable row level security;
alter table matches enable row level security;
alter table shots enable row level security;
alter table scoring_events enable row level security;
alter table possessions enable row level security;
alter table passes enable row level security;
alter table feature_requests enable row level security;
alter table site_visit_totals enable row level security;

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

drop policy if exists "Feature requests are user-owned" on feature_requests;
create policy "Feature requests are user-owned" on feature_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Site visit totals are readable" on site_visit_totals;
create policy "Site visit totals are readable" on site_visit_totals
  for select to anon, authenticated using (true);

create or replace function increment_site_visit_total(site_input text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_total bigint;
begin
  insert into public.site_visit_totals (site_key, total, updated_at)
  values (site_input, 1, now())
  on conflict (site_key)
  do update set
    total = public.site_visit_totals.total + 1,
    updated_at = now()
  returning total into next_total;

  return next_total;
end;
$$;

grant execute on function increment_site_visit_total(text) to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('player-photos', 'player-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "Users can read own player photos" on storage.objects;
create policy "Users can read own player photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'player-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload own player photos" on storage.objects;
create policy "Users can upload own player photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'player-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own player photos" on storage.objects;
create policy "Users can update own player photos" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'player-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'player-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own player photos" on storage.objects;
create policy "Users can delete own player photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'player-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
