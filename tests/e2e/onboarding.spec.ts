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

/** Presses Tab until the locator has focus (proves it is keyboard-reachable). */
async function tabTo(page: Page, locator: ReturnType<Page['getByRole']>) {
  for (let i = 0; i < 80; i++) {
    if (await locator.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Not reachable with Tab');
}

test.describe('onboarding', () => {
  test.beforeEach(async ({ page }) => {
    await stubApis(page);
  });

  test('keyboard only: location, household, finish → live data', async ({ page, browserName }) => {
    // WebKit only tabs to links/buttons when a platform setting allows it (see shell spec).
    test.skip(browserName === 'webkit', 'WebKit tab order depends on a platform setting');
    const consoleErrors = await enforceCsp(page);
    await page.goto('/');

    await tabTo(page, page.getByRole('combobox', { name: 'Search for a town or city in India' }));
    await page.keyboard.type('Luck');
    await expect(page.getByRole('option', { name: 'Lucknow, Uttar Pradesh' })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await tabTo(page, page.getByRole('button', { name: "Next: who's at home" }));
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: "Who's at home?" })).toBeFocused();
    await tabTo(page, page.getByRole('checkbox', { name: 'Parent or carer' }));
    await page.keyboard.press('Space');
    await tabTo(page, page.getByRole('textbox', { name: /Name or nickname/ }));
    await page.keyboard.type('Asha');
    await tabTo(page, page.getByRole('combobox', { name: 'Age group' }));
    await page.keyboard.type('Adult');
    await tabTo(page, page.getByRole('button', { name: 'Next: your day & home' }));
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'Your day & home' })).toBeFocused();
    await tabTo(page, page.getByRole('button', { name: 'Finish' }));
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('heading', { name: 'Lucknow, Uttar Pradesh', level: 2 }),
    ).toBeVisible();
    await expect(page.getByRole('article', { name: 'Current air quality' })).toBeVisible();
    expect(await cspViolations(page, consoleErrors)).toEqual([]);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`every step has no axe violations (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/');
      expect(await axe(page)).toEqual([]);

      await page.getByRole('combobox').fill('Luck');
      await page.getByRole('option', { name: 'Lucknow, Uttar Pradesh' }).click();
      await page.getByRole('button', { name: "Next: who's at home" }).click();
      await expect(page.getByRole('heading', { name: "Who's at home?" })).toBeVisible();
      await page.getByRole('button', { name: 'Next: your day & home' }).click(); // show errors too
      await expect(page.getByText('3 fields need attention.')).toBeVisible();
      expect(await axe(page)).toEqual([]);

      await page.getByText('Student').click();
      await page.getByRole('textbox', { name: /Name or nickname/ }).fill('Me');
      await page.getByRole('combobox', { name: 'Age group' }).selectOption('adult_18_59');
      await page.getByRole('button', { name: 'Next: your day & home' }).click();
      await page
        .getByRole('combobox', { name: 'Usual way to work or school' })
        .selectOption('car_petrol');
      await expect(page.getByRole('group', { name: 'In the car, usually…' })).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });
  }
});
