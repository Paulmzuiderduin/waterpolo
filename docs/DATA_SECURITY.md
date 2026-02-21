# Sport Apps Data, Storage, and Safety

Last updated: 2026-02-20
Scope:
- Waterpolo Hub: `/Users/paul/Documents/New project`
- Field Hockey Hub (code-reviewed via source): `/Users/paul/Documents/fieldhockey`

## 1) Executive safety assessment

Current state is **reasonable for an MVP** but **not yet robust for disaster recovery**.

Strong points:
- Supabase Auth (magic link) is used.
- Row Level Security (RLS) is enabled for core tables and scoped by `auth.uid() = user_id`.
- Client secrets are not hardcoded in source; env vars and GitHub Secrets are used.

Main gaps:
- No documented/automated backup and restore process.
- Public player photo URLs (privacy exposure risk if links are shared).
- Schema/data constraints are mostly app-side; DB-level validation is limited.

## 2) What data is collected

From app code and schema.

### Waterpolo Hub

### Authentication
- Email address for login via Supabase magic link.
- Supabase auth session/token handling in browser.

### Domain data
- `seasons`: season name.
- `teams`: team name, linked season.
- `roster`: name, cap number, birthday, height, weight, dominant hand, notes, `photo_url`.
- `matches`: match name, opponent name, date.
- `shots`: x/y, zone, result, player cap, attack type, period, time.
- `scoring_events`: event type, team side, player cap, period, time.
- `possessions`: outcome + links.
- `passes`: from/to player caps, coordinates, sequence.

### Browser local storage
- UI preferences and module visibility per user.
- Last opened tab per user.
- No auth secrets are intentionally stored in these app keys.

### Files
- Player photos uploaded to Supabase Storage bucket `player-photos`.
- App stores/uses public photo URL in `roster.photo_url`.
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

Field Hockey:
- Uses Supabase tables in app code (`seasons`, `teams`, `players`, `matches`, `events`).
- In this workspace, a versioned SQL schema file was not found in the `fieldhockey` repo.

### Supabase Storage
Used in: `/Users/paul/Documents/New project/src/App.jsx` (photo upload).

- Photos are uploaded under path structure: `userId/teamId/playerId.ext`.
- Public URL is generated and saved to DB.

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
- **No backup/restore runbook**:
  - If data is deleted/corrupted, recovery path is unclear.
  - Action: define backup schedule, restore test cadence, and owner.

- **Field Hockey schema is not version-controlled in repo**:
  - Harder to audit, review, and rebuild after incident.
  - Action: add `supabase/schema.sql` (or migrations) to `fieldhockey`.

- **Public player images**:
  - `photo_url` points to public bucket URLs.
  - Action: move to private bucket + signed URLs if privacy requirement is strict.

## Medium priority
- **DB constraints are light**:
  - Example: limited checks on enum-like fields and time formats.
  - Action: add `CHECK` constraints for event/result types and time patterns.

- **No explicit security monitoring/audit process**:
  - Action: enable audit/review cadence for auth events and failed requests.

## 6) If the database gets wiped: response plan

Immediate steps:
1. Stop writes (temporarily disable app usage / maintenance banner).
2. Confirm blast radius (which tables affected, time window).
3. Restore from Supabase backup/PITR if available.
4. Validate restored data integrity (row counts by table, spot checks).
5. Re-open app and communicate incident.

If no usable backup exists:
- Recovery is partial only (manual recreation from any exported CSV/PDF/PNG and user memory).
- Expect permanent data loss.

## 7) Required backup strategy (to implement)

Minimum recommended:
- Daily automated DB backup (or Supabase PITR on paid plan).
- Weekly restore drill to non-production project.
- Keep at least 30 days retention.
- Store backup run logs and restore test results.

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
