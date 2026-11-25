import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`app shell (${colorScheme})`, () => {
    test.use({ colorScheme });

    test('has no axe violations, including colour contrast', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(results.violations).toEqual([]);
    });
  });
}

test('skip link is the first tab stop and moves focus to main', async ({ page, browserName }) => {
  // WebKit only tabs to links when a platform setting allows it (Safari: "Press Tab to
  // highlight each item"), and neither Tab nor Alt+Tab is reliable across hosts.
  // Covered by chromium, firefox and mobile; Safari is checked in the Phase 8 manual pass.
  test.skip(browserName === 'webkit', 'WebKit link tabbing depends on a platform setting');

  await page.goto('/');
  await page.keyboard.press('Tab');

  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();

  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});
