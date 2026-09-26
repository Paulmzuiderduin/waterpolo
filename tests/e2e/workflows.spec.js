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
  await page.getByText('Optional details', { exact: true }).click();
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
  await page.getByRole('button', { name: 'Matches', exact: true }).click();
  await page.getByRole('button', { name: 'Lineup' }).first().click();
  await expect(page.getByText('Only selected players can be chosen while mapping shots.')).toBeVisible();
  await page.getByRole('button', { name: 'Save lineup' }).click();
  await expect(page.getByText('Lineup saved.')).toBeVisible();
});

test('workflow: live mode prioritizes field, score, and period', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 720 });
  await openWorkspace(page);

  await page.getByRole('button', { name: 'Fullscreen' }).click();
  await expect(page.getByLabel('Live period')).toBeVisible();
  await expect(page.getByTestId('shotmap-field')).toBeVisible();
  await expect(page.getByText('Outcome analysis')).toHaveCount(0);
});

test('workflow: live shot editor keeps form controls legible', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 720 });
  await openWorkspace(page);

  await page.getByRole('button', { name: 'Fullscreen' }).click();
  await page.getByTestId('shotmap-field').click({ position: { x: 220, y: 150 } });

  await expect(page.getByLabel('Shot player')).toHaveCSS('color', 'rgb(15, 23, 42)');
  await expect(page.getByLabel('Shot result')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('workflow: expanded analysis remains available across scopes', async ({ page }) => {
  await openWorkspace(page);

  await expect(page.getByText('Outcome analysis')).toHaveCount(0);
  await page.getByRole('button', { name: 'Analytics', exact: true }).click();
  await expect(page.getByText('Outcome analysis')).toBeVisible();
  await expect(page.getByText('Score state')).toHaveCount(0);
  await expect(page.getByText('After shot', { exact: true })).toHaveCount(0);

  await page.getByLabel('Shotmap scope').selectOption('season');
  await expect(page.getByText('Outcome analysis')).toBeVisible();
});


test('season edits preserve match and historical score; deletion clears the right list', async ({ page }) => {
  let patch;
  await installSupabaseWriteMocks(page, {
    'PATCH /rest/v1/shots': async ({ request }) => {
      patch = request.postDataJSON();
      return { body: { id: 'smoke-s2', match_id: 'smoke-m2', score_for: 2, score_against: 3, ...patch } };
    },
    'DELETE /rest/v1/shots': async () => ({ status: 204, body: null })
  });
  await openWorkspace(page);
  await page.getByLabel('Shotmap scope').selectOption('season');
  const row = page.getByTestId('shot-row').filter({ hasText: 'Earlier Match' });
  await row.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByLabel('Shot player')).toHaveValue('5');
  await page.getByLabel('Shot result').selectOption('redding');
  await page.getByRole('button', { name: 'Update shot' }).click();
  await expect(row).toContainText('redding');
  expect(patch).not.toHaveProperty('match_id');
  expect(patch).not.toHaveProperty('score_for');
  expect(patch).not.toHaveProperty('score_against');
  expect(patch).not.toHaveProperty('user_id');
  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.getByLabel('Shotmap scope').selectOption('match');
  await expect(page.getByText('raak · 6vs6 · P1 · 6:21')).toBeVisible();
});

test('match filters work and analysis can be hidden in either scope', async ({ page }) => {
  await openWorkspace(page);
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByRole('button', { name: 'Miss', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(1);
  await page.getByLabel('Shotmap scope').selectOption('season');
  await page.getByRole('button', { name: 'Analytics', exact: true }).click();
  await expect(page.getByText('Outcome analysis')).toBeVisible();
  await page.getByRole('button', { name: 'Shotmap', exact: true }).click();
  await expect(page.getByText('Outcome analysis')).toHaveCount(0);
});

test('fullscreen deletion confirms without leaving fullscreen', async ({ page }) => {
  await installSupabaseWriteMocks(page, { 'DELETE /rest/v1/shots': async () => ({ status: 204, body: null }) });
  await openWorkspace(page);
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName)).toBe('HTML');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.getByRole('button', { name: 'Exit fullscreen' }).click();
  await expect(page.getByLabel('Shotmap scope')).toBeVisible();
});

test('CSV export contains separate records', async ({ page }) => {
  await openWorkspace(page);
  await page.getByLabel('Shotmap scope').selectOption('season');
  await page.getByText('Export', { exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloaded;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv.split('\r\n')).toHaveLength(3);
  expect(csv).toContain('Earlier Match');
  expect(csv).not.toContain('\\n');
});

test('mobile fullscreen editor fits and shot list is collapsible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page);
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Show shots (1)' }).click();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect(page.getByRole('button', { name: '+ Penalty', exact: true })).toBeInViewport();
  await page.getByTestId('shotmap-field').click({ position: { x: 170, y: 100 } });
  const save = page.getByRole('button', { name: 'Save shot' });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('image export downloads a PNG', async ({ page }) => {
  await openWorkspace(page);
  await page.getByText('Export', { exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Image (PNG)' }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});

test('fullscreen fallback keeps season scope and exits cleanly', async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('Unavailable'));
  });
  await openWorkspace(page);
  await page.getByLabel('Shotmap scope').selectOption('season');
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect(page.getByText('Whole season: view only')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Penalty', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Exit fullscreen' }).click();
  await expect(page.getByLabel('Shotmap scope')).toHaveValue('season');
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('field distance guides are labeled, positioned correctly, and allow shot entry', async ({ page }) => {
  await openWorkspace(page);
  const field = page.getByTestId('shotmap-field');
  for (const [kind, fraction, label] of [
    ['two', 0.16, '2 m line'],
    ['penalty', 0.40, '5 m · Penalties'],
    ['six', 0.48, '6 m line'],
    ['halfway', 1, 'Halfway · 12.5 m']
  ]) {
    const line = page.getByTestId(`field-line-${kind}`);
    await expect(line).toContainText(label);
    const height = await field.evaluate((el) => el.clientHeight);
    const offset = await line.evaluate((el) => parseFloat(getComputedStyle(el).top));
    expect(Math.abs(offset / height - fraction)).toBeLessThan(0.005);
  }
  await expect(page.getByTestId('field-line-penalty')).toHaveCSS('border-top-style', 'dashed');
  const box = await field.boundingBox();
  await field.click({ position: { x: box.width / 2, y: box.height * 0.4 } });
  await expect(page.getByRole('heading', { name: 'Shot details' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  for (const kind of ['two', 'penalty', 'six', 'halfway']) {
    await expect(page.getByTestId(`field-line-${kind}`).locator('span')).toBeInViewport();
  }
});
