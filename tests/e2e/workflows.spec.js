import { expect, test } from '@playwright/test';
import { installSupabaseWriteMocks, openWorkspace } from './helpers';

test('workflow: active module persists after refresh', async ({ page }) => {
  await openWorkspace(page);

  await page.getByRole('button', { name: 'Players', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Player Report Card' })).toBeVisible();
  await page.waitForFunction(() => window.localStorage.getItem('waterpolo_last_tab_smoke-user') === 'players');

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Player Report Card' })).toBeVisible();
});

test('workflow: feature request submits through Supabase', async ({ page }) => {
  await installSupabaseWriteMocks(page, {
    'POST /rest/v1/feature_requests': async () => ({ status: 201, body: [] })
  });

  await openWorkspace(page);
  await page.getByRole('button', { name: 'Request feature' }).first().click();
  await expect(page.getByRole('heading', { name: 'Request a feature' })).toBeVisible();

  await page.getByLabel('Feature request subject').fill('Need better exports');
  await page.getByLabel('Feature request message').fill('Add season-level PDF export with charts.');
  await page.getByRole('button', { name: 'Send request' }).click();

  await expect(page.getByText('Feature request sent.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Request a feature' })).toHaveCount(0);
});

test('workflow: matches can be created and edited', async ({ page }) => {
  await installSupabaseWriteMocks(page, {
    'POST /rest/v1/matches': async ({ request }) => {
      const payload = request.postDataJSON();
      return {
        status: 201,
        body: {
          id: 'match-new-1',
          name: payload.name,
          date: payload.date,
          opponent_name: payload.opponent_name,
          season_id: payload.season_id,
          team_id: payload.team_id,
          user_id: payload.user_id
        }
      };
    },
    'PATCH /rest/v1/matches': async () => ({ status: 204, body: null })
  });

  await openWorkspace(page);
  await page.getByRole('button', { name: 'Matches', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Season Team Matches' })).toBeVisible();

  await page.getByPlaceholder('Match name').fill('Cup Final');
  await page.getByPlaceholder('Opponent', { exact: true }).fill('Polar Bears');
  await page.locator('input[type="date"]').first().fill('2026-02-20');
  await page.getByRole('button', { name: 'Create' }).click();

  const newRow = page.locator('tbody tr').first();
  await expect(newRow).toContainText('Cup Final');
  await expect(newRow).toContainText('Polar Bears');

  await newRow.getByRole('button', { name: 'Edit' }).click();
  await expect(newRow.getByRole('button', { name: 'Save' })).toBeVisible();
  await newRow.locator('input').first().fill('Cup Final Replay');
  await newRow.getByRole('button', { name: 'Save' }).click();

  await expect(page.locator('tr').filter({ hasText: 'Cup Final Replay' })).toBeVisible();
});

test('workflow: shotmap can save a shot', async ({ page }) => {
  await installSupabaseWriteMocks(page, {
    'POST /rest/v1/shots': async ({ request }) => {
      const payload = request.postDataJSON();
      return {
        status: 201,
        body: {
          id: 'shot-new-1',
          ...payload
        }
      };
    }
  });

  await openWorkspace(page);
  await page.getByRole('button', { name: 'Shotmap', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Shot Tracking & Recording' })).toBeVisible();

  await page.getByTestId('shotmap-field').click({ position: { x: 220, y: 150 } });
  await page.getByLabel('Shot result').selectOption('mis');
  await page.getByLabel('Shot attack').selectOption('6vs5');
  await page.getByLabel('Shot period').selectOption('2');
  await page.getByRole('button', { name: '5:00' }).click();
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('mis · 6vs5 · P2 · 5:00')).toBeVisible();
});

test('workflow: scoring can add and delete an event', async ({ page }) => {
  await installSupabaseWriteMocks(page, {
    'POST /rest/v1/scoring_events': async ({ request }) => {
      const payload = request.postDataJSON();
      return {
        status: 201,
        body: {
          id: 'event-new-1',
          ...payload,
          created_at: '2026-02-20T12:00:00.000Z'
        }
      };
    },
    'DELETE /rest/v1/scoring_events': async () => ({ status: 204, body: null })
  });

  await openWorkspace(page);
  await page.getByRole('button', { name: 'Scoring', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Match Events' })).toBeVisible();

  await page.getByRole('button', { name: '#5' }).click();
  await page.getByLabel('Scoring period').selectOption('2');
  await page.getByRole('button', { name: '5:00' }).click();
  await page.getByRole('button', { name: '+ Penalty foul' }).click();

  const eventRow = page.locator('div.rounded-lg').filter({ hasText: 'Penalty foul · #5' }).first();
  await expect(eventRow).toContainText('P2 · 5:00');

  await eventRow.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('div').filter({ hasText: 'Penalty foul · #5' })).toHaveCount(0);
});

test('workflow: possession can create a pass and close possession', async ({ page }) => {
  await installSupabaseWriteMocks(page, {
    'POST /rest/v1/possessions': async () => ({
      status: 201,
      body: {
        id: 'pos-new-1',
        match_id: 'smoke-m1',
        outcome: null,
        created_at: '2026-02-20T12:00:00.000Z'
      }
    }),
    'POST /rest/v1/passes': async ({ request }) => {
      const payload = request.postDataJSON();
      return {
        status: 201,
        body: {
          id: 'pass-new-1',
          possession_id: payload.possession_id,
          match_id: payload.match_id,
          from_player_cap: payload.from_player_cap,
          to_player_cap: payload.to_player_cap,
          from_x: payload.from_x,
          from_y: payload.from_y,
          to_x: payload.to_x,
          to_y: payload.to_y,
          sequence: payload.sequence
        }
      };
    },
    'PATCH /rest/v1/possessions': async () => ({ status: 204, body: null })
  });

  await openWorkspace(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('checkbox', { name: /show advanced analysis/i }).check();
  await page.getByRole('button', { name: 'Possession', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Possession Mapping' })).toBeVisible();

  await page.getByRole('button', { name: 'Start possession' }).click();
  await expect(page.getByText('Possession 2')).toBeVisible();

  const field = page.getByTestId('possession-field');
  await field.click({ position: { x: 120, y: 420 } });
  await page.getByRole('button', { name: '#1 Alex Example' }).click();
  await field.click({ position: { x: 250, y: 240 } });
  await page.getByRole('button', { name: '#5 Sam Demo' }).click();

  await page.locator('button').filter({ hasText: 'Replay' }).first().click();
  await expect(page.getByText('#1 → #5')).toBeVisible();
  await page.getByRole('button', { name: 'Miss' }).click();
  await expect(page.getByText('No active possession selected.')).toBeVisible();
});
