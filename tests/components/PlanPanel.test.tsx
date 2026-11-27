import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { geminiUrl } from '@shared/advice/gemini';
import { DEFAULT_MODEL } from '@shared/config';
import { App } from '@/app/App';
import { FALLBACK_NOTICE } from '@/features/advice/fallbackPlan';
import { SCENARIOS } from '@/features/profile/scenarios';
import { createAppStores } from '@/features/profile/stores';
import { BYOK_KEY, byokStore } from '@/features/settings/byok';
import { runAxe } from '../a11y/axe';
import {
  adviseHandler,
  airQualityHandler,
  createRequestLog,
  weatherHandler,
} from '../msw/handlers';
import { server } from '../msw/server';
import { samplePlan } from '../utils/advice';
import { at } from '../utils/at';
import { createTestQueryClient } from '../utils/render';

const S1 = at(SCENARIOS, 0);
const okBody = (plan = samplePlan()) => ({
  ok: true,
  mode: 'plan',
  data: plan,
  model: 'test-model',
  cached: false,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-26T13:10:00Z'));
  server.use(airQualityHandler('aqDelhi'), weatherHandler('weatherDelhi'));
});

afterEach(() => {
  vi.useRealTimers();
  byokStore.clear();
});

function setup(language: 'en' | 'hi' = 'en') {
  const stores = createAppStores();
  stores.profile.set({ ...S1.profile, language });
  stores.setLocation(S1.location);
  const user = userEvent.setup();
  const view = render(<App queryClient={createTestQueryClient()} stores={stores} />);
  return { ...view, user };
}

const panel = () => screen.findByRole('region', { name: 'Your plan for today' });

describe('PlanPanel', () => {
  it('shows the AI plan in three tabs, operable by keyboard', async () => {
    server.use(adviseHandler({ body: okBody() }));
    const { user } = setup();
    const plan = within(await panel());
    expect(await plan.findByText(samplePlan().headline)).toBeVisible();
    expect(
      plan.getByText(
        'Plan ready. Written by AI from today’s live data and the rules below. General guidance, not medical advice.',
      ),
    ).toBeVisible();

    const routine = plan.getByRole('tab', { name: "Today's routine" });
    expect(routine).toHaveAttribute('aria-selected', 'true');
    expect(plan.getByRole('heading', { name: "Move Aarav's play time to W1" })).toBeVisible();
    expect(plan.getByText('High priority')).toBeVisible();
    expect(plan.getByText(/For: Aarav/)).toBeVisible();

    routine.focus();
    await user.keyboard('{ArrowRight}');
    expect(plan.getByRole('tab', { name: 'Indoor air' })).toHaveAttribute('aria-selected', 'true');
    expect(plan.getByRole('heading', { name: 'Keep windows closed this evening' })).toBeVisible();
    await user.keyboard('{ArrowRight}');
    expect(plan.getByText(/cut about 2.1 kg CO₂ a week/)).toBeVisible();

    expect(plan.getByText(/Seek medical care if/)).toBeVisible();
    expect(plan.getByText(/reliever inhaler/)).toBeVisible();
  });

  it('renders AI text as text only (no HTML injection)', async () => {
    const injected = { ...samplePlan(), headline: '<img src=x onerror="alert(1)"> Stay in' };
    server.use(adviseHandler({ body: okBody(injected) }));
    const { container } = setup();
    expect(
      await within(await panel()).findByText('<img src=x onerror="alert(1)"> Stay in'),
    ).toBeVisible();
    expect(container.querySelector('img')).toBeNull();
  });

  it('marks AI text with the response language', async () => {
    server.use(adviseHandler({ body: okBody() }));
    setup('hi');
    const plan = await panel();
    await within(plan).findByText(samplePlan().headline);
    expect(plan.querySelector('[lang="hi"]')).not.toBeNull();
  });

  it('falls back to the rules-based plan with a notice when the AI fails', async () => {
    server.use(adviseHandler({ status: 502, body: { ok: false, error: 'upstream' } }));
    setup();
    const plan = within(await panel());
    expect(await plan.findByText(FALLBACK_NOTICE)).toBeVisible();
    expect(plan.getByText(/Air is Poor today/)).toBeVisible();
    expect(plan.getByRole('tab', { name: 'Indoor air' })).toBeVisible();
  });

  it('says "Too many requests" on a 429 and still shows the fallback plan', async () => {
    server.use(adviseHandler({ status: 429, body: { ok: false, error: 'rate_limited' } }));
    setup();
    expect(
      await within(await panel()).findByText(/Too many requests, try again in a minute/),
    ).toBeVisible();
  });

  it('retries once on an upstream failure, then succeeds', async () => {
    const log = createRequestLog();
    let calls = 0;
    server.use(
      http.post('*/api/advise', ({ request }) => {
        log.record(request);
        calls++;
        return calls === 1
          ? HttpResponse.json({ ok: false, error: 'upstream' }, { status: 502 })
          : HttpResponse.json(okBody());
      }),
    );
    setup();
    expect(await within(await panel()).findByText(samplePlan().headline)).toBeVisible();
    expect(log.urls).toHaveLength(2);
  });

  it('caches the plan per key and regenerates on request', async () => {
    const log = createRequestLog();
    server.use(adviseHandler({ body: okBody() }, log));
    const first = setup();
    await within(await panel()).findByText(samplePlan().headline);
    first.unmount();

    const second = setup();
    await within(await panel()).findByText(samplePlan().headline);
    expect(log.urls).toHaveLength(1); // served from sessionStorage

    await second.user.click(screen.getByRole('button', { name: 'Regenerate' }));
    await waitFor(() => {
      expect(log.urls).toHaveLength(2);
    });
  });

  it('has no axe violations', async () => {
    server.use(adviseHandler({ body: okBody() }));
    const { container } = setup();
    await within(await panel()).findByText(samplePlan().headline);
    expect(await runAxe(container)).toHaveNoViolations();
  });
});

describe('BYOK', () => {
  it('calls Gemini directly from the browser with the key in a header, not our server', async () => {
    const proxy = createRequestLog();
    let headerKey: string | null = null;
    server.use(
      adviseHandler({ body: okBody() }, proxy),
      http.post(geminiUrl(DEFAULT_MODEL), ({ request }) => {
        headerKey = request.headers.get('x-goog-api-key');
        return HttpResponse.json({
          candidates: [
            { content: { parts: [{ text: JSON.stringify(samplePlan()) }] }, finishReason: 'STOP' },
          ],
        });
      }),
    );
    byokStore.set({ apiKey: 'byok-test-key-12345', rejected: false });
    setup();
    expect(await within(await panel()).findByText(samplePlan().headline)).toBeVisible();
    expect(headerKey).toBe('byok-test-key-12345');
    expect(proxy.urls).toHaveLength(0);
    expect(sessionStorage.getItem(BYOK_KEY)).not.toBeNull();
    expect(localStorage.getItem(BYOK_KEY)).toBeNull();
  });

  it('a rejected key shows a fallback notice and an inline error in Settings', async () => {
    server.use(http.post(geminiUrl(DEFAULT_MODEL), () => HttpResponse.json({}, { status: 403 })));
    byokStore.set({ apiKey: 'wrong-key-1234567', rejected: false });
    const { user } = setup();
    expect(await within(await panel()).findByText(/Your Gemini key was rejected/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    expect(within(dialog).getByText(/Gemini rejected this key/)).toBeVisible();
  });

  it('the key field is masked, can be shown, saved to this tab and cleared', async () => {
    server.use(adviseHandler({ body: okBody() }));
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    const input = within(dialog).getByLabelText('Gemini API key');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'off');
    await user.click(within(dialog).getByRole('button', { name: 'Show' }));
    expect(input).toHaveAttribute('type', 'text');
    await user.type(input, 'my-own-key-123456');
    await user.click(within(dialog).getByRole('button', { name: 'Save key for this tab' }));
    expect(JSON.parse(sessionStorage.getItem(BYOK_KEY) ?? '{}')).toMatchObject({
      apiKey: 'my-own-key-123456',
    });
    expect(localStorage.getItem(BYOK_KEY)).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Clear key' }));
    expect(sessionStorage.getItem(BYOK_KEY)).toBeNull();
  });
});
