# Apps Data Security & Recovery (Waterpolo + Field Hockey)

Last updated: 2026-02-28
Prepared from source review (no assumptions beyond code and SQL files in local repos).

Reviewed codebases:
- Waterpolo Hub: `/Users/paul/Documents/New project`
- Field Hockey Hub: `/Users/paul/Documents/fieldhockey`

## 1) Critical safety review

### High-priority findings

1. No automated backup/restore workflow in either app repo.
- Risk: permanent loss if the free manual process is skipped or stale.
- Evidence: Waterpolo now has a documented free-only runbook at `/Users/paul/Documents/New project/docs/BACKUP_AND_RECOVERY_FREE.md`, but the process is still manual.

2. Field Hockey DB schema and RLS are not versioned in its repo.
- Risk: cannot reliably recreate/verify production DB permissions after incident.
- Evidence: no SQL schema/migrations found under `/Users/paul/Documents/fieldhockey`.

### Medium-priority findings

3. Private Waterpolo photo storage depends on bucket/privacy config staying correct.
- Risk: if the `player-photos` bucket is left public or storage policies drift, player images can become accessible outside the intended user scope.
- Evidence: app now uses private storage paths + signed URLs, so protection depends on Supabase bucket and storage policy configuration.

4. Data validation is improved, but still not complete across the whole schema.
- Risk: malformed values are now better controlled for core Waterpolo event/result/time fields, but unconstrained columns still exist elsewhere.
- Evidence: `CHECK` constraints now protect core Waterpolo match-event values in `/Users/paul/Documents/New project/supabase/schema.sql`, but the schema still includes other free-text fields.

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
- Backup and restore are still manual, not automated.
- Field Hockey schema/RLS not version controlled in repo.
- Private photo protection in Waterpolo still depends on correct Supabase storage configuration.

## 3) What data is collected

## Waterpolo Hub (from code + schema)

Auth/session:
- User email (Supabase auth).

Domain data:
- `seasons`: season name.
- `teams`: team name.
- `roster`: name, cap number, birthday, height, weight, dominant hand, notes, photo storage path.
- `matches`: match name, opponent name, date.
- `shots`: coordinates, zone, result, player cap, attack type, period, time.
- `scoring_events`: event type, team side, player cap, period, time.
- `possessions`: possession outcome.
- `passes`: from/to player caps, from/to coordinates, sequence.
- `feature_requests`: signed-in user email, subject, message, app tab, optional season/team context, status.

Browser local storage:
- Module visibility, preferences, last active tab (per user).

File storage:
- Player photos in Supabase storage bucket (`player-photos`), storage path saved in `roster.photo_path`, signed URLs generated at runtime.
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
- Includes the `feature_requests` table used for in-app Waterpolo Hub request submissions.

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
3. Restore from the latest available SQL dump.
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
1. Follow the free backup policy + documented restore test cadence in:
   - `/Users/paul/Documents/New project/docs/BACKUP_AND_RECOVERY_FREE.md`
2. Version-control Field Hockey schema + RLS in repo.

## Should-do
3. Keep Waterpolo player photos private:
   - keep `player-photos` private,
   - keep storage policies aligned to the `userId/teamId/playerId.ext` path pattern,
   - periodically verify signed-url access still behaves correctly.
4. Continue extending DB-level `CHECK` constraints where free-text values still represent fixed app enums or bounded ranges.
5. Add a simple operational checklist for auth failures and suspicious access patterns.

## 7) Maintenance rule

Update this document whenever any of these change:
- new tables/columns containing personal, match, or event data,
- auth flow/provider changes,
- storage bucket/privacy mode changes,
- backup/restore strategy changes.
