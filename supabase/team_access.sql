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
