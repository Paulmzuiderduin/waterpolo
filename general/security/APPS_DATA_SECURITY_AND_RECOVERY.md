# Apps Data Security & Recovery (Waterpolo + Field Hockey)

Last updated: 2026-02-20
Prepared from source review (no assumptions beyond code and SQL files in local repos).

Reviewed codebases:
- Waterpolo Hub: `/Users/paul/Documents/New project`
- Field Hockey Hub: `/Users/paul/Documents/fieldhockey`

## 1) Critical safety review

### High-priority findings

1. No documented, automated backup/restore workflow in either app repo.
- Risk: permanent loss if DB is wiped or corrupted.
- Evidence: no backup scripts/workflows or restore runbook found in reviewed repositories.

2. Field Hockey DB schema and RLS are not versioned in its repo.
- Risk: cannot reliably recreate/verify production DB permissions after incident.
- Evidence: no SQL schema/migrations found under `/Users/paul/Documents/fieldhockey`.

### Medium-priority findings

3. Waterpolo player photos are stored with public URLs.
- Risk: if URL is shared/guessed, player image is publicly accessible.
- Evidence: `getPublicUrl` usage in `/Users/paul/Documents/New project/src/App.jsx`.

4. Data validation is mostly app-side, not strongly constrained in DB for enum-like fields.
- Risk: malformed values can enter tables if API/client changes.
- Evidence: text columns for event/result/time fields in `/Users/paul/Documents/New project/supabase/schema.sql` without strict `CHECK` constraints.

### Lower-priority findings

5. Local storage keeps UI preferences and module state.
- Risk: low; no credentials/secrets stored intentionally in these keys.
- Evidence: keys in `/Users/paul/Documents/New project/src/App.jsx` and `/Users/paul/Documents/fieldhockey/src/App.jsx`.

## 2) Are the apps safe right now?

Short answer: **reasonably safe for MVP/private-team usage**, but **not disaster-ready**.

What is good:
- Supabase Auth with magic links.
- RLS in Waterpolo schema (`auth.uid() = user_id` ownership policies).
- Secrets are provided via env/GitHub Secrets, not hardcoded in source.

What prevents calling it robust production-grade yet:
- No tested backup/restore process documented in repo.
- Field Hockey schema/RLS not version controlled in repo.
- Public player photo URLs in Waterpolo.

## 3) What data is collected

## Waterpolo Hub (from code + schema)

Auth/session:
- User email (Supabase auth).

Domain data:
- `seasons`: season name.
- `teams`: team name.
- `roster`: name, cap number, birthday, height, weight, dominant hand, notes, photo URL.
- `matches`: match name, opponent name, date.
- `shots`: coordinates, zone, result, player cap, attack type, period, time.
- `scoring_events`: event type, team side, player cap, period, time.
- `possessions`: possession outcome.
- `passes`: from/to player caps, from/to coordinates, sequence.

Browser local storage:
- Module visibility, preferences, last active tab (per user).

File storage:
- Player photos in Supabase storage bucket (`player-photos`), URL saved in `roster.photo_url`.
- Optional scoring-assist video file is loaded locally in browser only (object URL) and is not uploaded.
- Video Analysis source files and snippet exports are local-device files only (browser file input + download/File Picker), not uploaded.
- Video Analysis annotations/snippet metadata may be kept in browser local storage and can be exported by the user as local JSON.

## Field Hockey Hub (from code)

Auth/session:
- User email (Supabase auth).

Domain data:
- `seasons`: season name.
- `teams`: team name.
- `players`: name, number, position.
- `matches`: opponent, match date.
- `events`: type, period, time_left, player_id, match_id.

Browser local storage:
- `fieldhockey_settings` (module visibility, quarter length, tooltip setting).

No file upload path found in current Field Hockey app code.

## 4) How data is stored and protected

Waterpolo DB schema and RLS source of truth:
- `/Users/paul/Documents/New project/supabase/schema.sql`
- Includes table creation and RLS policies per table with `auth.uid() = user_id`.

Supabase clients:
- Waterpolo: `/Users/paul/Documents/New project/src/lib/supabase.js`
- Field Hockey: `/Users/paul/Documents/fieldhockey/src/lib/supabase.js`

Deployment secrets:
- Waterpolo Pages workflow: `/Users/paul/Documents/New project/.github/workflows/pages.yml`
- Field Hockey Pages workflow: `/Users/paul/Documents/fieldhockey/.github/workflows/pages.yml`
- Supabase URL/anon key injected via GitHub Secrets.

## 5) If database gets wiped: incident runbook

Immediate response:
1. Freeze writes temporarily (maintenance mode / stop active usage).
2. Confirm scope: which tables and time window affected.
3. Restore from Supabase backup/PITR (if enabled).
4. Validate restore:
   - row counts by table,
   - sample records across parent-child chains (team -> match -> shots/events/passes),
   - auth and app read/write smoke checks.
5. Communicate impact and recovery status.

If no backup is available:
- Expect partial/manual recovery only.
- Likely permanent loss for event-level history.

## 6) Required hardening actions (recommended)

## Must-do next
1. Add a backup policy + documented restore test cadence.
2. Version-control Field Hockey schema + RLS in repo.

## Should-do
3. Decide if Waterpolo player photos must be private:
   - if yes, move to private bucket + signed URLs.
4. Add DB-level `CHECK` constraints for enum/time-like fields.
5. Add a simple operational checklist for auth failures and suspicious access patterns.

## 7) Maintenance rule

Update this document whenever any of these change:
- new tables/columns containing personal, match, or event data,
- auth flow/provider changes,
- storage bucket/privacy mode changes,
- backup/restore strategy changes.
