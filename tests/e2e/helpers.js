import { expect } from '@playwright/test';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': '*'
};

export const openWorkspace = async (page) => {
  await page.goto('/');

  const acceptAnalyticsButton = page.getByRole('button', { name: 'Accept' });
  if (await acceptAnalyticsButton.isVisible().catch(() => false)) {
    await acceptAnalyticsButton.click();
  }

  const setupHeading = page.getByRole('heading', { name: 'Seasons & Teams' });
  if (await setupHeading.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: '2025-2026' }).click();
    await page.getByRole('button', { name: 'dwt H1' }).click();
  }

  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
};

export const installSupabaseWriteMocks = async (page, handlers) => {
  await page.route('https://example.supabase.co/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' });
      return;
    }

    const handler = handlers[key];
    if (!handler) {
      await route.abort();
      return;
    }

    const response = await handler({ request, url });
    await route.fulfill({
      status: response.status ?? 200,
      headers: {
        ...CORS_HEADERS,
        ...(response.body != null ? { 'content-type': 'application/json' } : {}),
        ...(response.headers || {})
      },
      body: response.body == null ? '' : JSON.stringify(response.body)
    });
  });
};
