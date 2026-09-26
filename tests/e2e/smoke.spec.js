import { expect, test } from '@playwright/test';
import { openWorkspace } from './helpers';

for (const width of [1180, 390]) {
  test(`workspace tabs isolate tasks at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 840 });
    await openWorkspace(page);
    const nav = page.getByRole('navigation', { name: 'Workspace tabs' });
    await expect(nav.getByRole('button')).toHaveCount(4);
    await expect(page.getByLabel('Active match')).toBeVisible();
    await page.screenshot({ path: `/tmp/waterpolo-tabs-${width}.png` });
    await expect(page.getByTestId('shotmap-field')).toBeVisible();
    await nav.getByRole('button', { name: 'Matches', exact: true }).click();
    await expect(page.getByTestId('shotmap-field')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Demo Match' })).toBeVisible();
    await page.getByRole('button', { name: 'New match' }).click();
    await expect(page.getByLabel('Match name')).toBeVisible();
    await nav.getByRole('button', { name: 'Roster', exact: true }).click();
    await expect(page.getByLabel('Player name')).toBeVisible();
    await expect(page.getByLabel('Match name')).toHaveCount(0);
    await expect(page.getByTestId('shotmap-field')).toHaveCount(0);
    await nav.getByRole('button', { name: 'Analytics', exact: true }).click();
    await expect(page.getByText('Outcome analysis')).toBeVisible();
    await expect(page.getByLabel('Player name')).toHaveCount(0);
    await nav.getByRole('button', { name: 'Shotmap', exact: true }).click();
    await expect(page.getByLabel('Active match')).toHaveValue('smoke-m1');
    await expect(page.getByText('Outcome analysis')).toHaveCount(0);
    await expect(page.getByTestId('shotmap-field')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
