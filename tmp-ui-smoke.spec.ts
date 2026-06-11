import { test, expect, request as playwrightRequest } from '@playwright/test';
import fs from 'node:fs';

const webBase = 'http://localhost:3001';
const apiBase = 'http://localhost:4000/api/';
const localEnv = Object.fromEntries(
  fs.readFileSync('apps/api/.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')];
    })
);
const adminEmail = 'admin@example.com';
const adminPassword = localEnv.SEED_ADMIN_PASSWORD || 'AdminDevPass!2026';
const userEmail = 'user@example.com';
const userPassword = localEnv.SEED_USER_PASSWORD || 'UserDevPass!2026';

async function apiLogin(email: string, password: string) {
  const context = await playwrightRequest.newContext({ baseURL: apiBase });
  const response = await context.post('auth/login', { data: { email, password } });
  if (!response.ok()) {
    const text = await response.text().catch(() => '');
    throw new Error(`login ${email} failed with ${response.status()}: ${text.slice(0, 180)}`);
  }
  const data = await response.json();
  await context.dispose();
  return data as { token: string; user: { theme?: string } };
}

async function apiPatchMe(token: string, body: Record<string, unknown>) {
  const context = await playwrightRequest.newContext({ baseURL: apiBase });
  const response = await context.patch('auth/me', {
    headers: { Authorization: `Bearer ${token}` },
    data: body
  });
  expect(response.ok(), 'restore profile settings').toBeTruthy();
  await context.dispose();
}

async function centerCredentials() {
  const admin = await apiLogin(adminEmail, adminPassword);
  const context = await playwrightRequest.newContext({ baseURL: apiBase });
  const centersResponse = await context.get('centers?page=1&pageSize=1');
  expect(centersResponse.ok(), 'load center list').toBeTruthy();
  const centers = await centersResponse.json();
  const center = centers.items[0];
  expect(center?.id, 'first center id').toBeTruthy();
  const reveal = await context.post(`centers/${center.id}/credentials/reveal`, {
    headers: { Authorization: `Bearer ${admin.token}` },
    data: { password: adminPassword }
  });
  expect(reveal.ok(), 'reveal center credentials').toBeTruthy();
  const credentials = await reveal.json();
  await context.dispose();
  return credentials as { email: string; password: string };
}

async function assertLoginPageClean(page) {
  await page.goto(`${webBase}/login`);
  await expect(page.locator('input[name="email"]')).toHaveValue('');
}

async function openWithSession(page, session: { token: string; user: unknown }, path: string) {
  await page.addInitScript((saved) => {
    window.sessionStorage.setItem('qys_session', JSON.stringify(saved));
  }, session);
  await page.goto(`${webBase}${path}`);
  await page.waitForLoadState('domcontentloaded');
}

async function setThemeFromSettings(page, settingsPath: string, theme: 'light' | 'dark') {
  await page.goto(`${webBase}${settingsPath}`);
  await page.locator('select[name="theme"]').selectOption(theme);
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

test('admin UI controls and dark mode work', async ({ page }) => {
  page.on('console', (message) => console.log(`browser console ${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => console.log(`browser pageerror: ${error.message}`));
  page.on('requestfailed', (request) => console.log(`browser request failed: ${request.method()} ${request.url()} ${request.failure()?.errorText}`));
  const admin = await apiLogin(adminEmail, adminPassword);
  const originalTheme = admin.user.theme || 'light';
  try {
    await assertLoginPageClean(page);
    await openWithSession(page, admin, '/admin');
    console.log('admin after open', page.url(), (await page.locator('body').innerText()).slice(0, 80));
    console.log('admin session/fetch', await page.evaluate(async () => {
      const saved = window.sessionStorage.getItem('qys_session');
      const parsed = saved ? JSON.parse(saved) : null;
      if (!parsed?.token) return { hasSession: Boolean(saved), fetchStatus: 'no-token' };
      try {
        const response = await fetch('http://localhost:4000/api/auth/me', { headers: { Authorization: `Bearer ${parsed.token}` } });
        return { hasSession: true, fetchStatus: response.status, body: (await response.text()).slice(0, 80) };
      } catch (error) {
        return { hasSession: true, fetchStatus: String(error) };
      }
    }));
    await expect(page).toHaveURL(/\/admin/);

    console.log('admin before settings');
    await setThemeFromSettings(page, '/admin/settings', 'dark');
    console.log('admin after dark', page.url(), (await page.locator('body').innerText()).slice(0, 80));
    await expect.poll(() => page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor)).not.toBe('rgb(255, 255, 255)');

    console.log('admin before users');
    await page.goto(`${webBase}/admin/users`);
    console.log('admin users', (await page.locator('body').innerText()).slice(0, 120));
    await page.getByRole('button', { name: /إضافة مستخدم|إضافة حساب مركز/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'إغلاق' }).last().click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: /حسابات المراكز/ }).click();
    await expect(page.getByRole('button', { name: /إضافة حساب مركز/ })).toBeVisible();

    await page.goto(`${webBase}/admin/reports`);
    await page.getByRole('button', { name: 'الشهر الماضي' }).click();
    await expect(page.getByRole('button', { name: 'الشهر الماضي' })).toHaveClass(/primary/);

    await page.getByLabel('فتح مساعد المنصة').click();
    await expect(page.getByRole('region', { name: 'مساعد المنصة' })).toBeVisible();
    await page.getByLabel('إغلاق المساعد').click();
    await expect(page.getByRole('region', { name: 'مساعد المنصة' })).toHaveCount(0);
  } finally {
    await apiPatchMe(admin.token, { theme: originalTheme });
  }
});

test('center UI controls and dark mode work', async ({ page }) => {
  const credentials = await centerCredentials();
  const center = await apiLogin(credentials.email, credentials.password);
  const originalTheme = center.user.theme || 'light';
  try {
    await openWithSession(page, center, '/center/reports');
    await expect(page).toHaveURL(/\/center\/reports/);

    await setThemeFromSettings(page, '/center/settings', 'dark');
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');

    await page.goto(`${webBase}/center/reports`);
    await page.getByRole('button', { name: 'الشهر الماضي' }).click();
    await expect(page.getByRole('button', { name: 'الشهر الماضي' })).toHaveClass(/primary/);
    await expect(page.locator('select[name="centerId"]')).toHaveCount(0);

    await page.goto(`${webBase}/center/users`);
    await page.getByRole('button', { name: /إضافة مستخدم/ }).click();
    await expect(page.locator('form').filter({ has: page.locator('input[name="password"]') })).toBeVisible();
    await page.getByRole('button', { name: /إغلاق إضافة مستخدم/ }).click();
    await expect(page.locator('input[name="password"]')).toHaveCount(0);

    await page.goto(`${webBase}/center/chat`);
    await expect(page.getByText('تواصل مباشر مع المديرية')).toBeVisible();
    await expect(page.getByPlaceholder('اكتب رسالتك...')).toBeVisible();
  } finally {
    await apiPatchMe(center.token, { theme: originalTheme });
  }
});

test('normal user UI controls and dark mode work', async ({ page }) => {
  const user = await apiLogin(userEmail, userPassword);
  const originalTheme = user.user.theme || 'light';
  try {
    await openWithSession(page, user, '/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);

    await setThemeFromSettings(page, '/settings', 'dark');
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');

    await page.goto(`${webBase}/complaints`);
    await expect(page.getByRole('heading', { name: /الشكاوى|المقترحات/ })).toBeVisible();

    await page.getByLabel('فتح مساعد المنصة').click();
    await expect(page.getByRole('region', { name: 'مساعد المنصة' })).toBeVisible();
  } finally {
    await apiPatchMe(user.token, { theme: originalTheme });
  }
});
