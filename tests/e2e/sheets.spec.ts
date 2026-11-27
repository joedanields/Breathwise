import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { cspViolations, enforceCsp, stubApis } from './support/stubs';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}

async function loadScenario(page: Page, id: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a sample household' }).click();
  await page.getByRole('button', { name: new RegExp(`^${id} ·`) }).click();
  await expect(page.getByRole('button', { name: 'Household' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await stubApis(page);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`sheets and dialogs have no axe violations (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await page.getByRole('button', { name: 'Try a sample household' }).click();
    await expect(page.getByRole('dialog', { name: 'Try a sample household' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.getByRole('button', { name: /^S1 ·/ }).click();

    await page.getByRole('button', { name: 'Household' }).click();
    await expect(page.getByRole('dialog', { name: 'Your household' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await expect(settings).toBeVisible();
    expect(await axe(page)).toEqual([]);

    await settings.getByRole('button', { name: 'About & privacy' }).click();
    await expect(page.getByRole('dialog', { name: 'About & privacy' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press('Escape');

    await settings.getByRole('button', { name: 'Clear all my data' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Clear all your data?' })).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });
}

test('no CSP violations while using every sheet and dialog', async ({ page }) => {
  const consoleErrors = await enforceCsp(page);
  await loadScenario(page, 'S6');
  await expect(page.getByRole('article', { name: 'Current air quality' })).toBeVisible();

  for (const name of ['Household', 'Settings']) {
    await page.getByRole('button', { name }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Clear all my data' }).click();
  await page.getByRole('button', { name: 'Clear everything' }).click();
  await expect(page.getByRole('heading', { name: 'Where are you?' })).toBeFocused();

  expect(await cspViolations(page, consoleErrors)).toEqual([]);
});

test('no horizontal scroll once onboarded (E9, 360 px on mobile)', async ({ page }) => {
  await loadScenario(page, 'S5');
  await expect(page.getByRole('article', { name: 'Current air quality' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('sample household persists across a reload', async ({ page }) => {
  await loadScenario(page, 'S3');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Bengaluru, Karnataka', level: 2 })).toBeVisible();
});
