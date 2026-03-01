# Waterpolo Hub Free Backup & Recovery Runbook

Last updated: 2026-02-28
Scope:
- `/Users/paul/Documents/New project`
- Supabase project used by Waterpolo Hub

This runbook is intentionally limited to **free-only** tooling and workflows.
It does **not** depend on Supabase paid features such as PITR.

## 1) Goal

Protect the Waterpolo Hub against:
- accidental row deletion,
- bad schema changes,
- broken client updates,
- partial storage loss,
- operator mistakes.

This strategy is pragmatic rather than fully automated:
- database backups are created manually from the operator machine,
- photo files are kept in a local backup folder,
- restore steps are documented and repeatable.

## 2) What must be backed up

### Database tables

Back up at least these tables:
- `seasons`
- `teams`
- `roster`
- `matches`
- `shots`
- `scoring_events`
- `possessions`
- `passes`
- `feature_requests`

### Storage

Back up:
- player photos from bucket `player-photos`

Do not treat signed URLs as backups.
The backup must be the actual photo files or their original source copies.

## 3) Backup cadence

### Minimum free-tier cadence

1. Weekly database backup
- create one SQL backup file on your laptop

2. Before any schema change
- create one fresh database backup

3. Before any major app refactor
- create one fresh database backup

4. After roster photo changes
- keep the original photo file locally in a backup folder

### Retention

Keep:
- 4 weekly backups
- 12 monthly backups

Suggested local folder:
- `~/Documents/Persoonlijke website/backups/waterpolo/`

Suggested structure:
- `~/Documents/Persoonlijke website/backups/waterpolo/db/`
- `~/Documents/Persoonlijke website/backups/waterpolo/photos/`

## 4) Free database backup method

Use `pg_dump` from your own machine.

You need from Supabase:
- project host
- database name
- database user
- database password
- SSL enabled

### Recommended commands

Schema backup:

```bash
pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  "postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require" \
  > ~/Documents/Persoonlijke\ website/backups/waterpolo/db/waterpolo_schema_$(date +%F).sql
```

Data backup:

```bash
pg_dump \
  --data-only \
  --no-owner \
  --no-privileges \
  --column-inserts \
  "postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require" \
  > ~/Documents/Persoonlijke\ website/backups/waterpolo/db/waterpolo_data_$(date +%F).sql
```

If you prefer one combined file:

```bash
pg_dump \
  --no-owner \
  --no-privileges \
  "postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require" \
  > ~/Documents/Persoonlijke\ website/backups/waterpolo/db/waterpolo_full_$(date +%F).sql
```

## 5) Free photo backup method

The database stores `roster.photo_path`, not the file content.
That means database backups alone are not enough.

### Required operator rule

When you upload or replace a player photo:
- keep the original file locally
- copy it into:
  - `~/Documents/Persoonlijke website/backups/waterpolo/photos/`

Suggested naming:
- `teamId_playerId_originalFilename.ext`

### Why this matters

If the bucket is damaged or files are deleted:
- the database can be restored,
- but the actual photo files still need to exist somewhere outside Supabase.

## 6) Pre-change safety checklist

Before:
- running schema SQL,
- changing storage policies,
- refactoring upload logic,
- deleting seasons/teams in bulk,

do this:

1. Run a fresh DB backup.
2. Confirm backup files exist and are non-empty.
3. Confirm photo originals are still present locally.
4. Only then apply the change.

## 7) Restore process

### Scenario A: database data loss, storage still intact

1. Stop using the app temporarily.
2. Restore the latest DB backup to the Supabase database.
3. Re-run current schema/policy SQL if needed.
4. Verify:
- login works,
- seasons load,
- teams load,
- matches load,
- shots/scoring/possessions load,
- photos render.

### Scenario B: player photo loss, database intact

1. Identify missing photos from `roster.photo_path`.
2. Re-upload photo files from:
- `~/Documents/Persoonlijke website/backups/waterpolo/photos/`
3. Verify roster and player report cards display them.

### Scenario C: full database + storage loss

1. Restore DB from latest SQL dump.
2. Recreate storage bucket and policies using current schema SQL.
3. Re-upload player photos from local backup folder.
4. Run smoke tests.

## 8) Restore verification checklist

After restore, verify:

1. Sign in via magic link.
2. Open the last used season/team.
3. Check roster count.
4. Check at least one player photo.
5. Check match list.
6. Add one test scoring event.
7. Add one test shot.
8. Add one test possession pass.
9. Submit one test feature request.

## 9) Owner checklist

The operator should be able to answer:
- where the latest SQL backup file is,
- where the latest photo backup folder is,
- when the last backup was made,
- when the last restore test was performed.

If any of those answers are missing, the backup process is not reliable enough.

## 10) Current limitations

This free-only plan does **not** provide:
- point-in-time recovery,
- automatic continuous backups,
- automatic storage snapshots,
- zero-effort restore.

It is a practical MVP recovery plan, not enterprise-grade disaster recovery.
