import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { stubApis } from './support/stubs';

// TESTING.md §6 journeys 1, 3 and 4 (2, 5–8 are in sheets.spec.ts / onboarding.spec.ts).

async function finishOnboarding(page: Page) {
  await page.getByRole('button', { name: "Next: who's at home" }).click();
  await page.getByText('Parent or carer').click();
  await page.getByRole('textbox', { name: /Name or nickname/ }).fill('Aarav');
  await page.getByRole('combobox', { name: 'Age group' }).selectOption('child_2_5');
  await page.getByRole('checkbox', { name: 'Asthma' }).check();
  await page.getByRole('button', { name: 'Next: your day & home' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
}

test('journey 1: search Lucknow, onboard a child with asthma, see AQI, provenance, timeline and plan', async ({
  page,
  browserName,
}) => {
  await stubApis(page);
  await page.goto('/');
  await page.getByRole('combobox').fill('Luck');
  await page.getByRole('option', { name: 'Lucknow, Uttar Pradesh' }).click();
  await finishOnboarding(page);

  const live = page.getByRole('article', { name: 'Current air quality' });
  await expect(live.getByText('India AQI (estimated)')).toBeVisible();
  await expect(live.getByText(/Open-Meteo Air Quality API · CAMS global model/)).toBeVisible();
  await expect(live.getByText(/Modelled estimate/)).toBeVisible();
  await expect(page.getByRole('region', { name: /48-hour PM2.5 timeline/ })).toBeVisible();
  const plan = page.getByRole('region', { name: 'Your plan for today' });
  await expect(plan.getByRole('tab', { name: "Today's routine" })).toBeVisible();
  // Playwright's Firefox crashes inside axe on the full dashboard; Chromium, WebKit and mobile run it.
  if (browserName === 'firefox') return;
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test.describe('journey 3: geolocation in India (Pune)', () => {
  test.use({
    geolocation: { latitude: 18.5204, longitude: 73.8567 },
    permissions: ['geolocation'],
  });

  test('shows the place name from reverse geocoding', async ({ page }) => {
    await stubApis(page, { reverse: 'reverseGeocodePune' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Use my location' }).click();
    await expect(page.getByText('Showing Pune, Maharashtra.')).toBeVisible();
    await finishOnboarding(page);
    await expect(page.getByRole('heading', { name: 'Pune, Maharashtra', level: 2 })).toBeVisible();
  });
});

test.describe('journey 4: geolocation outside India (Kathmandu)', () => {
  test.use({ geolocation: { latitude: 27.7172, longitude: 85.324 }, permissions: ['geolocation'] });

  test('shows the India-only message and moves focus to search', async ({ page }) => {
    await stubApis(page, { reverse: 'reverseGeocodeKathmandu' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Use my location' }).click();
    await expect(
      page.getByText(/Breathwise covers India only\. Your location appears to be in Nepal\./),
    ).toBeVisible();
    await expect(
      page.getByRole('combobox', { name: 'Search for a town or city in India' }),
    ).toBeFocused();
  });
});

test('E1: denied location permission explains and moves focus to search', async ({
  page,
  context,
  browserName,
}) => {
  // Firefox leaves an unanswered permission prompt pending, and the Geolocation timeout only
  // starts after permission is granted, so no error ever fires there (correct browser behaviour).
  test.skip(browserName === 'firefox', 'Firefox keeps the permission prompt pending');
  await context.clearPermissions();
  await stubApis(page);
  await page.goto('/');
  // Without a granted permission, Chromium and WebKit report "denied".
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(
    page.getByRole('combobox', { name: 'Search for a town or city in India' }),
  ).toBeFocused();
  await expect(page.getByText(/Search for a town or city instead./)).toBeVisible();
});
