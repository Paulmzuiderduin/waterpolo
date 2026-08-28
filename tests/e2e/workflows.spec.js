import { expect, test } from '@playwright/test';
import { installSupabaseWriteMocks, openWorkspace } from './helpers';

test('workflow: a mapped shot captures follow-up context', async ({ page }) => {
  await installSupabaseWriteMocks(page, {
    'POST /rest/v1/shots': async ({ request }) => ({
      status: 201,
      body: { id: 'shot-new-1', ...request.postDataJSON() }
    })
  });

  await openWorkspace(page);
  await page.getByTestId('shotmap-field').click({ position: { x: 220, y: 150 } });
  await page.getByLabel('Shot result').selectOption('mis');
  await page.getByLabel('Shot follow-up outcome').selectOption('rebound_retained');
  await page.getByRole('button', { name: 'Save shot' }).click();

  await expect(page.getByText('mis · 6vs6 · P1')).toBeVisible();
});

test('workflow: lineup setup limits the match context', async ({ page }) => {
  await installSupabaseWriteMocks(page, {
    'DELETE /rest/v1/match_lineups': async () => ({ status: 204, body: null }),
    'POST /rest/v1/match_lineups': async () => ({ status: 201, body: [] })
  });

  await openWorkspace(page);
  await page.getByRole('button', { name: 'Lineup' }).click();
  await expect(page.getByText('Only selected players can be chosen while mapping shots.')).toBeVisible();
  await page.getByRole('button', { name: 'Save lineup' }).click();
  await expect(page.getByText('Lineup saved.')).toBeVisible();
});
