import { expect, test } from '@playwright/test';
import { openWorkspace } from './helpers';

test('smoke: the Shotmap workspace is the only primary screen', async ({ page }) => {
  await openWorkspace(page);

  await expect(page.getByRole('heading', { name: 'Demo Match' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New match' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Roster' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lineup' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Matches', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Scoring', exact: true })).toHaveCount(0);
});
