# Sport Apps Data, Storage, and Safety

Last updated: 2026-02-28
Scope:
- Waterpolo Hub: `/Users/paul/Documents/New project`
- Field Hockey Hub (code-reviewed via source): `/Users/paul/Documents/fieldhockey`

## 1) Executive safety assessment

Current state is **reasonable for an MVP** but **not yet robust for disaster recovery**.

Strong points:
- Supabase Auth (magic link) is used.
- Row Level Security (RLS) is enabled for core tables and scoped by `auth.uid() = user_id`.
- Player photos now use private storage paths plus signed URLs in app code, rather than public URLs.
- Client secrets are not hardcoded in source; env vars and GitHub Secrets are used.

Main gaps:
- No automated backup and restore process.
- Private photo storage now depends on bucket privacy and storage policies being applied correctly in Supabase.
- DB validation is improved for several core fields, but not yet exhaustive across all tables and workflows.

## 2) What data is collected

From app code and schema.

### Waterpolo Hub

### Authentication
- Email address for login via Supabase magic link.
- Supabase auth session/token handling in browser.

### Domain data
- `seasons`: season name.
- `teams`: team name, linked season.
- `roster`: name, cap number, birthday, height, weight, dominant hand, notes, `photo_path`, temporary signed photo URL in app memory.
- `matches`: match name, opponent name, date.
- `shots`: x/y, zone, result, player cap, attack type, period, time.
- `scoring_events`: event type, team side, player cap, period, time.
- `possessions`: outcome + links.
- `passes`: from/to player caps, coordinates, sequence.
- `feature_requests`: signed-in user email, subject, message, current app tab, optional season/team context, status.

### Browser local storage
- UI preferences and module visibility per user.
- Last opened tab per user.
- No auth secrets are intentionally stored in these app keys.

### Files
- Player photos uploaded to Supabase Storage bucket `player-photos`.
- App stores the storage path in `roster.photo_path`.
- App resolves temporary signed URLs at runtime for roster/report-card display.
- Optional scoring-assist video file selected by the user is handled locally in-browser (object URL) and is not uploaded to Supabase.
- Video Analysis source files, snippet exports, and burned-annotation exports are handled locally on the device (download/File Picker) and are not uploaded to Supabase.
- Video Analysis annotations/snippet metadata can be stored in browser local storage for the selected season/team and exported as local JSON by the user.

### Field Hockey Hub
- `seasons`: season name.
- `teams`: team name.
- `players`: player name, shirt number, position.
- `matches`: opponent and match date.
- `events`: event type, period, time left, player link, match link.
- Browser `localStorage` key `fieldhockey_settings` (UI settings only).

## 3) Where and how data is stored

### Supabase Postgres
Waterpolo schema defined in: `/Users/paul/Documents/New project/supabase/schema.sql`

- Tables include explicit `user_id` foreign keys to `auth.users(id)`.
- RLS is enabled on all main tables.
- Policies are user-owned (`auth.uid() = user_id`) for `for all`.
- Waterpolo also stores in-app feature requests in Postgres, scoped to the signed-in user through the same RLS ownership model.
- Core tables now also enforce DB-level checks for key enum-like values and coordinate/time ranges.

Field Hockey:
- Uses Supabase tables in app code (`seasons`, `teams`, `players`, `matches`, `events`).
- In this workspace, a versioned SQL schema file was not found in the `fieldhockey` repo.

### Supabase Storage
Used in:
- `/Users/paul/Documents/New project/src/modules/roster/RosterView.jsx`
- `/Users/paul/Documents/New project/src/modules/players/PlayersView.jsx`
- `/Users/paul/Documents/New project/src/lib/waterpolo/photos.js`

- Photos are uploaded under path structure: `userId/teamId/playerId.ext`.
- Bucket should be private.
- Storage path is saved to DB and temporary signed URLs are created in the client for display/export.

### GitHub Actions / deployment
- Build uses repository secrets for Supabase URL and anon key.
- Workflow file: `/Users/paul/Documents/New project/.github/workflows/pages.yml`.

## 4) Current controls in place

- Auth: Supabase OTP magic links.
- Authorization: RLS user-level ownership policies.
- Env separation: `.env.local` ignored by git (`.gitignore`).
- CI secret usage: URL/anon key pulled from GitHub Secrets.

## 5) Risks and recommendations

## High priority
- **Free backup strategy needs operational discipline**:
  - A free-only backup/recovery runbook now exists, but it depends on regular manual execution.
  - Action: follow `/Users/paul/Documents/New project/docs/BACKUP_AND_RECOVERY_FREE.md` consistently and record when backups are taken.

- **Field Hockey schema is not version-controlled in repo**:
  - Harder to audit, review, and rebuild after incident.
  - Action: add `supabase/schema.sql` (or migrations) to `fieldhockey`.

- **Private photo storage must stay enforced in Supabase**:
  - The app now expects `player-photos` to be private with authenticated storage policies.
  - Action: keep bucket privacy and storage policies aligned with the path pattern `userId/teamId/playerId.ext`.

## Medium priority
- **DB constraints are still partial**:
  - Key event/result/time fields now have `CHECK` constraints, but coverage is not yet exhaustive for every column and relationship.
  - Action: continue extending DB-level validation where free-text or range-limited values still exist.

- **No explicit security monitoring/audit process**:
  - Action: enable audit/review cadence for auth events and failed requests.

## 6) If the database gets wiped: response plan

Immediate steps:
1. Stop writes (temporarily disable app usage / maintenance banner).
2. Confirm blast radius (which tables affected, time window).
3. Restore from the latest available SQL dump.
4. Validate restored data integrity (row counts by table, spot checks).
5. Re-open app and communicate incident.

If no usable backup exists:
- Recovery is partial only (manual recreation from any exported CSV/PDF/PNG and user memory).
- Expect permanent data loss.

## 7) Required backup strategy

Free-only runbook:
- `/Users/paul/Documents/New project/docs/BACKUP_AND_RECOVERY_FREE.md`

Minimum recommended:
- Weekly manual DB backup using `pg_dump`.
- Fresh DB backup before schema changes or major refactors.
- Local backup folder for original player photos.
- Periodic restore verification using the checklist in the runbook.

Suggested checks after restore:
- Row counts per table.
- Random sample of teams/matches with child rows (shots/events/passes).
- Photo URL validity checks.

## 8) Document maintenance rule

Update this file whenever any of these change:
- New table/column storing user or match/player data.
- New storage bucket or file upload behavior.
- Auth method changes.
- Backup/recovery process changes.

PR checklist requirement (recommended):
- "If data model/security changed, `docs/DATA_SECURITY.md` updated."
