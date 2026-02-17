import { expect, test } from '@playwright/test';

const openWorkspace = async (page) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Seasons & Teams' })).toBeVisible();
  await page.getByRole('button', { name: '2025-2026' }).click();
  await page.getByRole('button', { name: 'dwt H1' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
};

test('smoke: modules open from sidebar', async ({ page }) => {
  await openWorkspace(page);

  await page.getByRole('button', { name: 'Matches' }).click();
  await expect(page.getByRole('heading', { name: 'Season Team Matches' })).toBeVisible();

  await page.getByRole('button', { name: 'Shotmap' }).click();
  await expect(page.getByRole('heading', { name: 'Shot Tracking & Recording' })).toBeVisible();

  await page.getByRole('button', { name: 'Analytics' }).click();
  await expect(page.getByRole('heading', { name: 'Heatmaps & Analysis' })).toBeVisible();

  await page.getByRole('button', { name: 'Scoring' }).click();
  await expect(page.getByRole('heading', { name: 'Match Events' })).toBeVisible();

  await page.getByRole('button', { name: 'Possession' }).click();
  await expect(page.getByRole('heading', { name: 'Possession Mapping' })).toBeVisible();

  await page.getByRole('button', { name: 'Players' }).click();
  await expect(page.getByRole('heading', { name: 'Player Report Card' })).toBeVisible();

  await page.getByRole('button', { name: 'Roster' }).click();
  await expect(page.getByRole('heading', { name: 'Player Info' })).toBeVisible();

  await page.getByRole('button', { name: 'Help' }).click();
  await expect(page.getByRole('heading', { name: 'Getting Started & FAQ' })).toBeVisible();
});

test('smoke: settings toggle hides and restores module', async ({ page }) => {
  await openWorkspace(page);

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Workspace Preferences' })).toBeVisible();

  const shotmapToggle = page.locator('label:has-text("Shotmap") input[type="checkbox"]');
  await shotmapToggle.uncheck();
  await expect(page.locator('aside button', { hasText: 'Shotmap' })).toHaveCount(0);

  await shotmapToggle.check();
  await expect(page.locator('aside button', { hasText: 'Shotmap' })).toHaveCount(1);
});

test('smoke: app dialogs open for rename and delete', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Seasons & Teams' })).toBeVisible();

  await page.getByRole('button', { name: 'Rename' }).first().click();
  await expect(page.getByText('New season name')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Delete' }).first().click();
  await expect(page.getByText('Delete season? All teams and data will be removed.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
});
