import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { SCENARIOS } from '@/features/profile/scenarios';
import { createAppStores, LOCATION_KEY, PROFILE_KEY } from '@/features/profile/stores';
import { runAxe } from '../a11y/axe';
import {
  adviseHandler,
  airQualityHandler,
  placeSearchHandler,
  weatherHandler,
} from '../msw/handlers';
import { server } from '../msw/server';
import { at } from '../utils/at';
import { createTestQueryClient } from '../utils/render';

const scenario = at(SCENARIOS, 0);

beforeEach(() => {
  server.use(
    placeSearchHandler(() => 'geoSearchLucknow'),
    airQualityHandler('aqDelhi'),
    weatherHandler('weatherDelhi'),
    adviseHandler({ status: 502, body: { ok: false, error: 'upstream' } }),
  );
});

function setupOnboarded() {
  const stores = createAppStores();
  stores.profile.set(scenario.profile);
  stores.setLocation(scenario.location);
  const user = userEvent.setup();
  const view = render(<App queryClient={createTestQueryClient()} stores={stores} />);
  return { ...view, user, stores };
}

async function openSheet(name: string) {
  const user = userEvent.setup();
  const trigger = screen.getByRole('button', { name });
  await user.click(trigger);
  return { trigger, user };
}

describe('Household sheet', () => {
  it('edits the household and saves it', async () => {
    const { stores } = setupOnboarded();
    const { user } = await openSheet('Household');
    const dialog = await screen.findByRole('dialog', { name: 'Your household' });
    const name = at(within(dialog).getAllByRole('textbox', { name: /Name or nickname/ }), 1);
    await user.clear(name);
    await user.type(name, 'Aarav K');
    await user.click(within(dialog).getByRole('button', { name: 'Save household' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(stores.profile.get()?.members[1]?.label).toBe('Aarav K');
    expect(stores.profile.get()?.commute?.carAc).toBe('windows_open');
  });

  it('shows errors and keeps the sheet open when invalid', async () => {
    const { stores } = setupOnboarded();
    const { user } = await openSheet('Household');
    const dialog = await screen.findByRole('dialog', { name: 'Your household' });
    const name = at(within(dialog).getAllByRole('textbox', { name: /Name or nickname/ }), 0);
    await user.clear(name);
    await user.click(within(dialog).getByRole('button', { name: 'Save household' }));

    expect(await within(dialog).findByText('Enter a name or nickname.')).toBeVisible();
    await waitFor(() => {
      expect(name).toHaveFocus();
    });
    expect(stores.profile.get()?.members[0]?.label).toBe('Me');
  });

  it('returns focus to its trigger and has no axe violations', async () => {
    setupOnboarded();
    const { trigger, user } = await openSheet('Household');
    const dialog = await screen.findByRole('dialog', { name: 'Your household' });
    expect(await runAxe(dialog)).toHaveNoViolations();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });
});

describe('Settings sheet', () => {
  it('changes the theme override', async () => {
    setupOnboarded();
    const { user } = await openSheet('Settings');
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    await user.click(within(dialog).getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    await user.click(within(dialog).getByRole('radio', { name: 'Light' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('changes the response language in the profile', async () => {
    const { stores } = setupOnboarded();
    const { user } = await openSheet('Settings');
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    await user.selectOptions(
      within(dialog).getByRole('combobox', { name: 'Language for advice' }),
      'ta',
    );
    expect(stores.profile.get()?.language).toBe('ta');
  });

  it('"Remember my location" off forgets the saved location', async () => {
    setupOnboarded();
    const { user } = await openSheet('Settings');
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    expect(localStorage.getItem(LOCATION_KEY)).not.toBeNull();
    await user.click(
      within(dialog).getByRole('checkbox', { name: 'Remember my location on this device' }),
    );
    expect(localStorage.getItem(LOCATION_KEY)).toBeNull();
  });

  it('"Clear all my data" asks first; Cancel returns focus and keeps data', async () => {
    const { stores } = setupOnboarded();
    const { user } = await openSheet('Settings');
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    const clear = within(dialog).getByRole('button', { name: 'Clear all my data' });
    await user.click(clear);
    const confirm = await screen.findByRole('alertdialog', { name: 'Clear all your data?' });
    expect(await runAxe(confirm)).toHaveNoViolations();
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(clear).toHaveFocus();
    });
    expect(stores.profile.get()).not.toBeNull();
  });

  it('"Clear everything" removes all data and returns to onboarding with focus on its heading', async () => {
    const { stores } = setupOnboarded();
    const { user } = await openSheet('Settings');
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    await user.click(within(dialog).getByRole('button', { name: 'Clear all my data' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Clear everything' }));

    expect(await screen.findByText('Step 1 of 3')).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Where are you?' })).toHaveFocus();
    });
    expect(stores.profile.get()).toBeNull();
    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
    expect(localStorage.getItem(LOCATION_KEY)).toBeNull();
  });

  it('opens the sample picker and About & privacy, each returning focus', async () => {
    setupOnboarded();
    const { user } = await openSheet('Settings');
    const settings = await screen.findByRole('dialog', { name: 'Settings' });

    for (const [button, title] of [
      ['Try a sample household', 'Try a sample household'],
      ['About & privacy', 'About & privacy'],
    ] as const) {
      const trigger = within(settings).getByRole('button', { name: button });
      await user.click(trigger);
      const inner = await screen.findByRole('dialog', { name: title });
      expect(await runAxe(inner)).toHaveNoViolations();
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    }
  });

  it('returns focus to its trigger and has no axe violations', async () => {
    setupOnboarded();
    const { trigger, user } = await openSheet('Settings');
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    expect(await runAxe(dialog)).toHaveNoViolations();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });
});

describe('sample picker from onboarding', () => {
  it('returns focus to "Try a sample household" when closed', async () => {
    render(<App queryClient={createTestQueryClient()} stores={createAppStores()} />);
    const { trigger, user } = await openSheet('Try a sample household');
    const dialog = await screen.findByRole('dialog', { name: 'Try a sample household' });
    expect(await runAxe(dialog)).toHaveNoViolations();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });
});
