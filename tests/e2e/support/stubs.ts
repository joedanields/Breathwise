import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { type FixtureName, loadFixture } from '../../fixtures';

/**
 * Deterministic E2E (TESTING.md §2): every external API is answered from the
 * captured fixtures. Unknown external hosts are aborted, so a test can never
 * reach a live API.
 */
export async function stubApis(
  page: Page,
  overrides: { reverse?: FixtureName; adviseStatus?: number } = {},
) {
  await page.route(/^https:\/\/(?!localhost)/, (route) => route.abort('blockedbyclient'));
  const json = (name: FixtureName) => ({ json: loadFixture(name) });
  await page.route('https://geocoding-api.open-meteo.com/**', (route) => {
    const name = new URL(route.request().url()).searchParams.get('name') ?? '';
    return route.fulfill(
      json(
        /^luck/i.test(name)
          ? 'geoSearchLucknow'
          : /^pun/i.test(name)
            ? 'geoSearchPun'
            : 'geoSearchNoMatch',
      ),
    );
  });
  await page.route('https://air-quality-api.open-meteo.com/**', (route) =>
    route.fulfill(json('aqDelhi')),
  );
  await page.route('https://api.open-meteo.com/**', (route) => route.fulfill(json('weatherDelhi')));
  await page.route('**/api/advise', (route) =>
    overrides.adviseStatus
      ? route.fulfill({ status: overrides.adviseStatus, json: { ok: false, error: 'upstream' } })
      : route.fulfill(json('advicePlanSynthetic')),
  );
  await page.route('https://api.bigdatacloud.net/**', (route) =>
    route.fulfill(json(overrides.reverse ?? 'reverseGeocodePune')),
  );
}

/** The production CSP from public/_headers (minus upgrade-insecure-requests, which would break http://localhost). */
export function productionCsp(): string {
  const headers = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8');
  const match = /Content-Security-Policy:\s*(.+)/.exec(headers);
  if (!match?.[1]) throw new Error('No CSP in public/_headers');
  return match[1]
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d && d !== 'upgrade-insecure-requests')
    .join('; ');
}

/**
 * `vite preview` ignores public/_headers, so apply the real CSP to every page
 * response and record violations. Call `cspViolations(page)` at the end of a test.
 */
export async function enforceCsp(page: Page) {
  const csp = productionCsp();
  await page.route('http://localhost:4173/**', async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback();
    const response = await route.fetch();
    return route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': csp },
    });
  });
  await page.addInitScript(() => {
    const store: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = store;
    document.addEventListener('securitypolicyviolation', (event) => {
      store.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (/content security policy/i.test(message.text())) consoleErrors.push(message.text());
  });
  return consoleErrors;
}

export async function cspViolations(page: Page, consoleErrors: string[]): Promise<string[]> {
  const events = await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);
  return [...events, ...consoleErrors];
}
