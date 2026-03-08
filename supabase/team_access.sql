-- Team access sharing (coach/assistant roles)
-- Run this in Supabase SQL editor after reviewing.

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('coach', 'assistant')),
  created_at timestamptz not null default now(),
  unique(team_id, member_user_id)
);

create index if not exists team_members_team_id_idx on team_members(team_id);
create index if not exists team_members_member_user_id_idx on team_members(member_user_id);

alter table team_members enable row level security;

drop policy if exists "Team members owner-managed" on team_members;
create policy "Team members owner-managed" on team_members
for all
using (auth.uid() = owner_user_id or auth.uid() = member_user_id)
with check (auth.uid() = owner_user_id);

create or replace function can_read_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teams t
    where t.id = target_team_id
      and (
        t.user_id = auth.uid()
        or exists (
          select 1
          from public.team_members tm
          where tm.team_id = t.id
            and tm.member_user_id = auth.uid()
        )
      )
  );
$$;

create or replace function can_write_team(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.teams t
    where t.id = target_team_id
      and (
        t.user_id = auth.uid()
        or exists (
          select 1
          from public.team_members tm
          where tm.team_id = t.id
            and tm.member_user_id = auth.uid()
            and tm.role = 'coach'
        )
      )
  );
$$;

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  birthday date,
  height_cm integer,
  weight_kg integer,
  dominant_hand text,
  notes text,
  photo_path text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists team_players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  cap_number text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(team_id, player_id)
);

create table if not exists match_lineups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  team_player_id uuid not null references team_players(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  cap_number text not null,
  status text not null default 'playing',
  created_at timestamptz not null default now()
);

alter table players drop constraint if exists players_height_cm_check;
alter table players add constraint players_height_cm_check
  check (height_cm is null or (height_cm >= 50 and height_cm <= 260));
alter table players drop constraint if exists players_weight_kg_check;
alter table players add constraint players_weight_kg_check
  check (weight_kg is null or (weight_kg >= 20 and weight_kg <= 250));
alter table players drop constraint if exists players_dominant_hand_check;
alter table players add constraint players_dominant_hand_check
  check (dominant_hand is null or dominant_hand in ('left', 'right', 'ambidextrous'));
alter table match_lineups drop constraint if exists match_lineups_status_check;
alter table match_lineups add constraint match_lineups_status_check
  check (status in ('playing', 'bench', 'absent'));

create index if not exists players_user_id_idx on players(user_id);
create index if not exists team_players_team_id_idx on team_players(team_id);
create index if not exists team_players_player_id_idx on team_players(player_id);
create index if not exists match_lineups_team_id_idx on match_lineups(team_id);
create index if not exists match_lineups_match_id_idx on match_lineups(match_id);
create index if not exists match_lineups_team_player_id_idx on match_lineups(team_player_id);

alter table players enable row level security;
alter table team_players enable row level security;
alter table match_lineups enable row level security;

insert into players (id, user_id, name, birthday, height_cm, weight_kg, dominant_hand, notes, photo_path, photo_url, created_at)
select
  r.id,
  r.user_id,
  r.name,
  r.birthday,
  r.height_cm,
  r.weight_kg,
  r.dominant_hand,
  r.notes,
  r.photo_path,
  r.photo_url,
  r.created_at
from roster r
on conflict (id) do update
set
  name = excluded.name,
  birthday = excluded.birthday,
  height_cm = excluded.height_cm,
  weight_kg = excluded.weight_kg,
  dominant_hand = excluded.dominant_hand,
  notes = excluded.notes,
  photo_path = excluded.photo_path,
  photo_url = excluded.photo_url;

insert into team_players (user_id, team_id, player_id, cap_number, is_active, created_at)
select
  r.user_id,
  r.team_id,
  r.id,
  r.cap_number,
  true,
  r.created_at
from roster r
on conflict (team_id, player_id) do update
set
  cap_number = excluded.cap_number,
  is_active = true;

insert into match_lineups (user_id, season_id, team_id, match_id, team_player_id, player_id, cap_number, status)
select
  m.user_id,
  m.season_id,
  m.team_id,
  m.id,
  tp.id,
  tp.player_id,
  tp.cap_number,
  'playing'
from matches m
join team_players tp on tp.team_id = m.team_id and tp.is_active = true
where not exists (
  select 1
  from match_lineups ml
  where ml.match_id = m.id
    and ml.team_player_id = tp.id
);

create or replace function can_read_player(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.players p
    where p.id = target_player_id
      and (
        p.user_id = auth.uid()
        or exists (
          select 1
          from public.team_players tp
          where tp.player_id = p.id
            and can_read_team(tp.team_id)
        )
      )
  );
$$;

create or replace function can_write_player(target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.players p
    where p.id = target_player_id
      and (
        p.user_id = auth.uid()
        or exists (
          select 1
          from public.team_players tp
          where tp.player_id = p.id
            and can_write_team(tp.team_id)
        )
      )
  );
$$;

drop policy if exists "Seasons are user-owned" on seasons;
drop policy if exists "Seasons are owner-write and team-readable" on seasons;
drop policy if exists "Seasons owner-write" on seasons;
create policy "Seasons are owner-write and team-readable" on seasons
for select using (
  auth.uid() = user_id
  or exists (
    select 1
    from teams t
    join team_members tm on tm.team_id = t.id
    where t.season_id = seasons.id
      and tm.member_user_id = auth.uid()
  )
);
create policy "Seasons owner-write" on seasons
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Teams are user-owned" on teams;
drop policy if exists "Teams are shared" on teams;
drop policy if exists "Teams writable by owner or coach" on teams;
drop policy if exists "Teams updatable by owner or coach" on teams;
drop policy if exists "Teams deletable by owner or coach" on teams;
drop policy if exists "Teams insertable by season owner" on teams;
create policy "Teams are shared" on teams
for select using (can_read_team(id));
create policy "Teams updatable by owner or coach" on teams
for update
using (can_write_team(id))
with check (can_write_team(id));
create policy "Teams deletable by owner or coach" on teams
for delete
using (can_write_team(id));
create policy "Teams insertable by season owner" on teams
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from seasons s
    where s.id = season_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "Players are user-owned" on players;
drop policy if exists "Players are shared through teams" on players;
drop policy if exists "Players insertable by current user" on players;
drop policy if exists "Players updatable by owner or coach" on players;
drop policy if exists "Players deletable by owner or coach" on players;
create policy "Players are shared through teams" on players
for select using (can_read_player(id));
create policy "Players insertable by current user" on players
for insert with check (auth.uid() = user_id);
create policy "Players updatable by owner or coach" on players
for update
using (can_write_player(id))
with check (can_write_player(id));
create policy "Players deletable by owner or coach" on players
for delete
using (can_write_player(id));

drop policy if exists "Team players are user-owned" on team_players;
drop policy if exists "Team players are team-shared" on team_players;
drop policy if exists "Team players insertable by owner or coach" on team_players;
drop policy if exists "Team players updatable by owner or coach" on team_players;
drop policy if exists "Team players deletable by owner or coach" on team_players;
create policy "Team players are team-shared" on team_players
for select using (can_read_team(team_id));
create policy "Team players insertable by owner or coach" on team_players
for insert
with check (
  can_write_team(team_id)
  and can_read_player(player_id)
);
create policy "Team players updatable by owner or coach" on team_players
for update
using (can_write_team(team_id))
with check (can_write_team(team_id));
create policy "Team players deletable by owner or coach" on team_players
for delete
using (can_write_team(team_id));

drop policy if exists "Roster is user-owned" on roster;
drop policy if exists "Roster is team-shared" on roster;
drop policy if exists "Roster writable by owner or coach" on roster;
create policy "Roster is team-shared" on roster
for select using (can_read_team(team_id));
create policy "Roster writable by owner or coach" on roster
for all
using (can_write_team(team_id))
with check (can_write_team(team_id));

drop policy if exists "Matches are user-owned" on matches;
drop policy if exists "Matches are team-shared" on matches;
drop policy if exists "Matches writable by owner or coach" on matches;
create policy "Matches are team-shared" on matches
for select using (can_read_team(team_id));
create policy "Matches writable by owner or coach" on matches
for all
using (can_write_team(team_id))
with check (can_write_team(team_id));

drop policy if exists "Match lineups are user-owned" on match_lineups;
drop policy if exists "Match lineups are team-shared" on match_lineups;
drop policy if exists "Match lineups writable by owner or coach" on match_lineups;
create policy "Match lineups are team-shared" on match_lineups
for select using (can_read_team(team_id));
create policy "Match lineups writable by owner or coach" on match_lineups
for all
using (can_write_team(team_id))
with check (can_write_team(team_id));

drop policy if exists "Shots are user-owned" on shots;
drop policy if exists "Shots are team-shared" on shots;
drop policy if exists "Shots writable by owner or coach" on shots;
create policy "Shots are team-shared" on shots
for select using (can_read_team(team_id));
create policy "Shots writable by owner or coach" on shots
for all
using (can_write_team(team_id))
with check (can_write_team(team_id));

drop policy if exists "Scoring events are user-owned" on scoring_events;
drop policy if exists "Scoring events are team-shared" on scoring_events;
drop policy if exists "Scoring events writable by owner or coach" on scoring_events;
create policy "Scoring events are team-shared" on scoring_events
for select using (can_read_team(team_id));
create policy "Scoring events writable by owner or coach" on scoring_events
for all
using (can_write_team(team_id))
with check (can_write_team(team_id));

drop policy if exists "Possessions are user-owned" on possessions;
drop policy if exists "Possessions are team-shared" on possessions;
drop policy if exists "Possessions writable by owner or coach" on possessions;
create policy "Possessions are team-shared" on possessions
for select using (can_read_team(team_id));
create policy "Possessions writable by owner or coach" on possessions
for all
using (can_write_team(team_id))
with check (can_write_team(team_id));

drop policy if exists "Passes are user-owned" on passes;
drop policy if exists "Passes are team-shared" on passes;
drop policy if exists "Passes writable by owner or coach" on passes;
create policy "Passes are team-shared" on passes
for select using (can_read_team(team_id));
create policy "Passes writable by owner or coach" on passes
for all
using (can_write_team(team_id))
with check (can_write_team(team_id));
